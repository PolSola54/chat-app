const express = require("express");
const app = express();
const http = require("http");
const WebSocket = require("ws");
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Map(); // socket -> { username, room }
const rooms = new Map(); // room -> Set of usernames
const socketsPerUser = new Map(); // username -> socket
const roomAdmins = new Map(); // room -> Set of admins

app.use(express.static("public"));

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      return;
    }

    if (msg.type === "join") {
      const username = msg.username;
      const room = msg.room.toLowerCase();
      // Comprovar si ja existeix el nom a la sala
      if (rooms.get(room)?.has(username)) {
        ws.send(JSON.stringify({
          type: "error",
          text: `El nom d'usuari "${username}" ja està en ús a la sala "${room}".`,
        }));
        return;
      }


      clients.set(ws, { username, room });
      socketsPerUser.set(username, ws);

      if (!rooms.has(room)) {
        rooms.set(room, new Set());
        roomAdmins.set(room, new Set([username]));
        console.log(`Primer admin de la sala "${room}": ${username}`);
      }

      rooms.get(room).add(username);

      broadcast(room, {
        type: "info",
        text: `* ${username} s'ha unit a la sala.`,
      });

      if (roomAdmins.get(room).has(username)) {
        ws.send(
          JSON.stringify({
            type: "you_are_admin",
            username,
          })
        );
      }
    }

    if (msg.type === "chat") {
      const { username, room } = clients.get(ws) || {};
      if (!username || !room) return;

      const censored = censorText(msg.text);
      broadcast(room, {
        type: "chat",
        from: username,
        text: censored,
        id: msg.id,
      });

    }

    if (msg.type === "delete") {
      const { username, room } = clients.get(ws) || {};
      if (roomAdmins.get(room)?.has(username)) {
        broadcast(room, {
          type: "delete",
          id: msg.id,
        });
      }
    }

    if (msg.type === "make_admin") {
      const { username, room } = clients.get(ws) || {};
      if (roomAdmins.get(room)?.has(username)) {
        roomAdmins.get(room).add(msg.target);
        broadcast(room, {
          type: "info",
          text: `* ${msg.target} ara és administrador.`,
        });

        const targetSocket = socketsPerUser.get(msg.target);
        if (targetSocket) {
          targetSocket.send(
            JSON.stringify({
              type: "you_are_admin",
              username: msg.target,
            })
          );
        }
      }
    }
  });

  ws.on("close", () => {
    const user = clients.get(ws);
    if (user) {
      const { username, room } = user;
      clients.delete(ws);
      rooms.get(room)?.delete(username);

      broadcast(room, {
        type: "info",
        text: `* ${username} ha sortit.`,
      });
    }
  });
});

function broadcast(room, message) {
  for (const [client, { room: r }] of clients.entries()) {
    if (r === room) {
      client.send(JSON.stringify(message));
    }
  }
}


function censorText(text) {
  const bannedWords = ["merda", "idiota", "imbecil", "tonto", "capullo"];
  const regex = new RegExp(`\\b(${bannedWords.join("|")})\\b`, "gi");
  return text.replace(regex, (match) => "*".repeat(match.length));
}


server.listen(3000, () => {
  console.log("Servidor actiu a http://localhost:3000");
});
