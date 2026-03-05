#!/usr/bin/env node
// Script to check chat queue and respond

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'message_queue.json');
const RESPONSE_FILE = path.join(DATA_DIR, 'last_response.json');

function checkQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return;
  
  try {
    const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const pending = queue.find(m => !m.responded);
    
    if (pending) {
      console.log(`[Chat] New message: ${pending.message.substring(0, 50)}...`);
      // Mark as being processed
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    }
  } catch (e) {
    console.error('Error checking queue:', e.message);
  }
}

checkQueue();
