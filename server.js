const express = require('express');
const http = require('http');
 = require('socketconst { Server }.io');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');
const QUEUE_FILE = path.join(DATA_DIR, 'message_queue.json');

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

// Load or initialize memory
let memory = {
  conversations: [],
  context: {},
  lastUpdated: new Date().toISOString()
};

if (fs.existsSync(MEMORY_FILE)) {
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
  } catch (e) {
    console.log('Starting with fresh memory');
  }
}

// Save memory function
function saveMemory() {
  memory.lastUpdated = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// API: Get conversation history
app.get('/api/memory', (req, res) => {
  res.json(memory);
});

// API: Clear memory
app.post('/api/clear', (req, res) => {
  memory = {
    conversations: [],
    context: {},
    lastUpdated: new Date().toISOString()
  };
  saveMemory();
  io.emit('memoryCleared');
  res.json({ success: true });
});

// API: Get context
app.get('/api/context', (req, res) => {
  res.json(memory.context);
});

// API: Submit response from agent
app.post('/api/agent-response', (req, res) => {
  const { response } = req.body;
  if (!response) {
    res.json({ error: 'No response provided' });
    return;
  }
  
  // Broadcast response to all connected clients
  io.emit('agentResponse', { response });
  res.json({ success: true });
});

// API: Get pending messages (for agent to poll)
app.get('/api/pending-messages', (req, res) => {
  try {
    if (!fs.existsSync(QUEUE_FILE)) {
      res.json({ messages: [] });
      return;
    }
    
    const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const pending = queue.filter(m => !m.responded);
    res.json({ messages: pending });
  } catch (e) {
    res.json({ messages: [] });
  }
});

// API: Mark message as responded
app.post('/api/mark-responded', (req, res) => {
  const { timestamp } = req.body;
  
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      const msg = queue.find(m => m.timestamp === timestamp);
      if (msg) {
        msg.responded = true;
        fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
      }
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ error: e.message });
  }
});

// Socket.io for real-time chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Send existing conversation
  socket.emit('loadConversation', memory.conversations);
  
  // Handle incoming messages
  socket.on('chatMessage', async (msg) => {
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: msg.content,
      timestamp: new Date().toISOString()
    };
    
    // Save user message
    memory.conversations.push(userMessage);
    saveMemory();
    
    // Broadcast to all clients
    io.emit('message', userMessage);
    
    // Add to queue for agent to respond
    let queue = [];
    if (fs.existsSync(QUEUE_FILE)) {
      try { queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8')); } catch (e) {}
    }
    
    queue.push({
      message: msg.content,
      timestamp: Date.now(),
      responded: false
    });
    
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    
    // Typing indicator while waiting for agent
    socket.broadcast.emit('typing', { isTyping: true });
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Katsuma Chat running on http://localhost:${PORT}`);
  console.log('Chat API endpoints:');
  console.log('  GET  /api/pending-messages - Get messages waiting for response');
  console.log('  POST /api/agent-response - Submit response from agent');
  console.log('  POST /api/mark-responded - Mark message as handled');
});
