const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite default
    methods: ["GET", "POST"]
  }
});

let game = {
  players: [], // { id, name, hand: [], seat }
  started: false,
  currentPlayerIndex: 0,
};

function dealCards() {
  const deck = [...Array(48).keys()].map(i => `Karte${i + 1}`); // Dummykarten
  deck.sort(() => Math.random() - 0.5);
  for (let i = 0; i < 4; i++) {
    game.players[i].hand = deck.slice(i * 12, (i + 1) * 12);
  }
}

io.on("connection", (socket) => {
  console.log("User connected", socket.id);

  socket.on("join", (name) => {
    if (game.players.length >= 4 || game.started) return;
    game.players.push({ id: socket.id, name, hand: [], seat: game.players.length });
    io.emit("players", game.players);

    if (game.players.length === 4) {
      game.started = true;
      dealCards();
      io.emit("start", game);
    }
  });

  socket.on("playCard", ({ playerId, card }) => {
    const player = game.players.find(p => p.id === playerId);
    if (!player || game.players[game.currentPlayerIndex].id !== playerId) return;
    if (!player.hand.includes(card)) return;

    player.hand = player.hand.filter(c => c !== card);
    io.emit("cardPlayed", { playerId, card });
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % 4;
    io.emit("turn", game.players[game.currentPlayerIndex].id);
  });
});

server.listen(3000, () => console.log("Server läuft auf Port 3000"));