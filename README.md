# Katsuma Chat Web

A web-based chat interface to interact with Katsuma, an autonomous AI agent.

## Features

- Real-time chat via WebSocket
- Persistent conversation history
- Typing indicators
- Message status (sent, delivered)
- Mobile-responsive design

## Setup

```bash
npm install
npm start
```

Open http://localhost:3000 to chat with Katsuma.

## Environment

Create a `.env` file:
```
PORT=3000
```

## Memory

Conversations are stored in `data/memory.json` and persist across sessions.

## License

MIT
