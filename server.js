const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map(); // ws => { username, room }
const rooms = new Map(); // room => Set(ws)

wss.on('connection', (ws) => {
  console.log('Nou client connectat');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'setName') {
        users.set(ws, { username: data.username, room: null });
      }

      if (data.type === 'joinRoom') {
        const user = users.get(ws);
        if (!user) return;

        // Normalizem el nom de la sala
        const room = data.room.toLowerCase();

        if (user.room && rooms.has(user.room)) {
          rooms.get(user.room).delete(ws);
        }

        user.room = room;
        users.set(ws, user);

        if (!rooms.has(room)) {
          rooms.set(room, new Set());
        }

        rooms.get(room).add(ws);
      }

      if (data.type === 'message') {
        const user = users.get(ws);
        if (!user || !user.room) return;

        const payload = JSON.stringify({
          username: user.username,
          text: data.text,
        });

        rooms.get(user.room)?.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }

    } catch (err) {
      console.error('Error processant missatge:', err);
    }
  });

  ws.on('close', () => {
    const user = users.get(ws);
    if (user?.room && rooms.has(user.room)) {
      rooms.get(user.room).delete(ws);
    }
    users.delete(ws);
  });
});

server.listen(3000, () => {
  console.log('Servidor escoltant a http://localhost:3000');
});
