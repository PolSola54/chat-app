const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', function connection(ws) {
  console.log('Nou client connectat');
  
  ws.on('message', function incoming(data) {
    const message = JSON.parse(data);
    
    if (message.type === 'setName') {
      ws.username = message.username; // Guardem el nom de l'usuari
    } else {
      // Si és un missatge de xat, reenviem amb el nom de l'usuari
      const messageWithName = {
        username: ws.username || 'Desconegut', // Nom de l'usuari o "Desconegut"
        text: message.text
      };

      wss.clients.forEach(function each(client) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(messageWithName));
        }
      });
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Servidor escoltant a http://localhost:${PORT}`);
});
