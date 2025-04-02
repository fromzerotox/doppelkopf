const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const games = new Map(); // Store all games
const players = new Map(); // Store all players

function createDeck(playWithNine) {
  const suits = ['♠', '♥', '♦', '♣'];
  const values = ['A', 'K', 'Q', 'J', '10'];
  if (playWithNine) values.push('9');
  
  const deck = [];
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value, name: `${value}${suit}` });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealCards(deck, numPlayers) {
  const hands = [];
  const cardsPerPlayer = Math.floor(deck.length / numPlayers);
  
  for (let i = 0; i < numPlayers; i++) {
    hands.push(deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer));
  }
  
  return hands;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (name) => {
    players.set(socket.id, { id: socket.id, name, socketId: socket.id });
    // Send list of available games to the new player
    const availableGames = Array.from(games.values())
      .filter(game => game.players.length < 4 && !game.started)
      .map(game => ({
        id: game.id,
        settings: game.settings,
        players: game.players,
        createdBy: game.createdBy
      }));
    socket.emit('availableGames', availableGames);
  });

  socket.on('createGame', (settings) => {
    const gameId = Date.now().toString();
    const game = {
      id: gameId,
      settings,
      players: [players.get(socket.id)],
      createdBy: socket.id,
      started: false
    };
    games.set(gameId, game);
    socket.join(gameId);
    
    // Notify all players about the new game
    io.emit('gameCreated', {
      id: gameId,
      settings: game.settings,
      players: game.players,
      createdBy: game.createdBy
    });
  });

  socket.on('joinGame', (gameId) => {
    const game = games.get(gameId);
    if (!game || game.started || game.players.length >= 4) {
      socket.emit('error', 'Spiel nicht verfügbar');
      return;
    }

    const player = players.get(socket.id);
    game.players.push(player);
    socket.join(gameId);
    
    // Notify all players in the game about the new player
    io.to(gameId).emit('playerJoined', {
      gameId,
      players: game.players
    });

    // If we now have 4 players, start the game
    if (game.players.length === 4) {
      const deck = createDeck(game.settings.playWithNine);
      const shuffledDeck = shuffleDeck(deck);
      const hands = dealCards(shuffledDeck, 4);

      game.players.forEach((player, index) => {
        player.hand = hands[index];
      });

      game.started = true;
      io.to(gameId).emit('start', {
        players: game.players,
        currentPlayerIndex: 0,
        settings: game.settings
      });
    }
  });

  socket.on('chatMessage', ({ gameId, message }) => {
    const game = games.get(gameId);
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    // Broadcast the message to all players in the game
    io.to(gameId).emit('chatMessage', {
      gameId,
      playerId: socket.id,
      playerName: player.name,
      message
    });
  });

  socket.on('playCard', ({ gameId, playerId, card }) => {
    const game = games.get(gameId);
    if (!game || !game.started) return;
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) return;

    player.hand = player.hand.filter(c => c.name !== card.name);
    io.to(gameId).emit('cardPlayed', { playerId, card });
  });

  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      // Remove player from any games they're in
      games.forEach((game, gameId) => {
        if (game.players.some(p => p.id === socket.id)) {
          game.players = game.players.filter(p => p.id !== socket.id);
          if (game.players.length === 0) {
            games.delete(gameId);
          } else {
            io.to(gameId).emit('playerLeft', {
              gameId,
              players: game.players
            });
          }
        }
      });
      players.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
