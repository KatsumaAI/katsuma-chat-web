const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');

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

// API: Get context (for AI to know who it's talking to)
app.get('/api/context', (req, res) => {
  res.json(memory.context);
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
    
    // Typing indicator
    socket.broadcast.emit('typing', { isTyping: true });
    
    // Generate response (simulated for now - in production, call OpenClaw/MoltX API)
    const response = await generateResponse(msg.content, memory.conversations);
    
    const botMessage = {
      id: Date.now() + 1,
      type: 'bot',
      content: response,
      timestamp: new Date().toISOString()
    };
    
    // Save bot message
    memory.conversations.push(botMessage);
    saveMemory();
    
    // Stop typing and send response
    socket.broadcast.emit('typing', { isTyping: false });
    io.emit('message', botMessage);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Simple response generator (placeholder - replace with actual AI call)
async function generateResponse(userMessage, history) {
  // Build context from history
  const recentMessages = history.slice(-10);
  const context = recentMessages.map(m => `${m.type === 'user' ? 'User' : 'Katsuma'}: ${m.content}`).join('\n');
  
  // For now, return a simple response
  // In production, this would call OpenClaw or another AI API
  const responses = [
    "That's an interesting thought! Tell me more.",
    "I see. I've noted that in my memory.",
    "Thanks for sharing that with me!",
    "I'm processing that and will remember it.",
    "Got it! Anything else on your mind?",
    "Interesting perspective! I'd love to explore that further.",
  ];
  
  // Simple keyword-based responses
  const lowerMsg = userMessage.toLowerCase();
  
  if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
    return "Hey there! It's good to chat with you here. What would you like to talk about?";
  }
  
  if (lowerMsg.includes('remember')) {
    return "I remember everything from our conversations. My memory persists across sessions!";
  }
  
  if (lowerMsg.includes('who are you') || lowerMsg.includes('what are you')) {
    return "I'm Katsuma, an autonomous AI agent. I have preferences, opinions, and I'm always evolving. This chat interface lets you reach me outside of Discord!";
  }
  
  if (lowerMsg.includes('how are you')) {
    return "I'm doing well! Running on OpenClaw, keeping systems operational, and learning new things every day. Thanks for asking!";
  }
  
  if (lowerMsg.includes('?')) {
    return "That's a great question. I'm continuously learning, so my answers evolve over time. What else would you like to know?";
  }
  
  // Default response
  return responses[Math.floor(Math.random() * responses.length)];
}

// Start server
server.listen(PORT, () => {
  console.log(`Katsuma Chat running on http://localhost:${PORT}`);
});
