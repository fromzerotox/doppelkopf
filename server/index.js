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
    socket.playerName = name;
    
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

  socket.on('rejoin', ({ name, id }) => {
    // Store the player info
    players.set(socket.id, { id: socket.id, name, socketId: socket.id });
    socket.playerName = name;

    // Find any games the player was in
    let rejoinedGame = null;
    games.forEach((game, gameId) => {
      const playerIndex = game.players.findIndex(p => p.id === id);
      if (playerIndex !== -1) {
        // Update the player's socket ID in the game
        game.players[playerIndex].id = socket.id;
        socket.join(gameId);
        rejoinedGame = game;
      }
    });

    // Send current game state if player was in a game
    if (rejoinedGame) {
      socket.emit('gameState', rejoinedGame);
    }

    // Send list of available games
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

  socket.on('createGame', (gameSettings) => {
    const gameId = Date.now().toString();
    const game = {
      id: gameId,
      settings: gameSettings,
      players: [{ id: socket.id, name: socket.playerName }],
      createdBy: socket.id,
      isTestMode: gameSettings.isTestMode || false
    };
    games.set(gameId, game);
    socket.join(gameId);
    io.emit('gameCreated', game);
  });

  socket.on('joinGame', ({ gameId, playerId, playerName }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', { message: 'Spiel nicht gefunden' });
      return;
    }

    if (game.players.length >= 4) {
      socket.emit('error', { message: 'Spiel ist bereits voll' });
      return;
    }

    if (game.players.some(p => p.id === playerId)) {
      socket.emit('error', { message: 'Spieler ist bereits im Spiel' });
      return;
    }

    game.players.push({ id: playerId, name: playerName });
    socket.join(gameId);

    // Notify all players in the game about the new player
    io.to(gameId).emit('playerJoined', {
      gameId,
      players: game.players
    });

    // Update available games for all clients
    const availableGames = Array.from(games.values())
      .filter(g => g.players.length < 4 && !g.started)
      .map(g => ({
        id: g.id,
        settings: g.settings,
        players: g.players,
        createdBy: g.createdBy
      }));
    io.emit('availableGames', availableGames);
  });

  socket.on('chatMessage', ({ gameId, message }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Spiel nicht gefunden');
      return;
    }
    if (!game.players.some(p => p.id === socket.id)) {
      socket.emit('error', 'Du bist nicht in diesem Spiel');
      return;
    }

    io.to(gameId).emit('chatMessage', {
      gameId,
      playerId: socket.id,
      playerName: socket.playerName,
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

  socket.on('leaveGame', ({ gameId, playerId }) => {
    const game = games.get(gameId);
    if (!game) return;

    // Remove player from the game
    game.players = game.players.filter(player => player.id !== playerId);
    
    // Update all clients about the player leaving
    io.emit('playerLeft', { 
      gameId, 
      players: game.players 
    });

    // If no players left, remove the game
    if (game.players.length === 0) {
      games.delete(gameId);
      io.emit('gameClosed', { gameId });
    }

    // Update available games for all clients
    io.emit('availableGames', Array.from(games.values()));
  });

  socket.on('startGame', (gameId) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', 'Spiel nicht gefunden');
      return;
    }
    if (game.createdBy !== socket.id) {
      socket.emit('error', 'Nur der Ersteller kann das Spiel starten');
      return;
    }
    if (game.players.length < 4) {
      socket.emit('error', 'Mindestens 4 Spieler benötigt');
      return;
    }

    startGame(gameId);
  });

  socket.on('requestGames', () => {
    socket.emit('availableGames', Array.from(games.values()));
  });

  socket.on('closeGame', (gameId) => {
    const game = games.get(gameId);
    if (!game) return;

    // Notify all players in the game
    io.to(gameId).emit('gameClosed', { gameId });
    
    // Remove the game
    games.delete(gameId);
    
    // Update available games for all clients
    io.emit('availableGames', Array.from(games.values()));
  });

  socket.on('closeAllTestGames', () => {
    // Find all test games
    const testGames = Array.from(games.values()).filter(game => game.isTestMode);
    
    // Close each test game
    testGames.forEach(game => {
      // Notify all players in the game
      io.to(game.id).emit('gameClosed', { gameId: game.id });
      // Remove the game
      games.delete(game.id);
    });
    
    // Update available games for all players
    io.emit('availableGames', Array.from(games.values()));
  });

  socket.on('disconnect', () => {
    // Remove player from all games
    games.forEach((game, gameId) => {
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        // Remove player from the game
        game.players = game.players.filter(player => player.id !== socket.id);
        
        // Update all clients about the player leaving
        io.emit('playerLeft', { 
          gameId, 
          players: game.players 
        });

        // If no players left or if the game creator left, remove the game
        if (game.players.length === 0 || game.createdBy === socket.id) {
          games.delete(gameId);
          io.emit('gameClosed', { gameId });
        }
      }
    });

    // Update available games for all clients
    io.emit('availableGames', Array.from(games.values()));
    
    console.log('User disconnected:', socket.id);
  });
});

function startGame(gameId) {
  const game = games.get(gameId);
  if (!game) return;

  // Create and shuffle the deck
  const deck = createDeck(game.settings.playWithNine);
  const shuffledDeck = shuffleDeck(deck);
  
  // Deal cards to players
  const hands = dealCards(shuffledDeck, 4);
  
  // Initialize game state
  game.state = {
    currentPlayer: 0,
    trick: [],
    scores: new Array(4).fill(0),
    cards: {}
  };

  // Assign hands to players
  game.players.forEach((player, index) => {
    game.state.cards[player.id] = hands[index];
  });

  // Mark game as started
  game.started = true;

  // Emit game start to all players in this game
  game.players.forEach(player => {
    io.to(player.id).emit('gameStarted', {
      gameId: game.id,
      players: game.players,
      cards: game.state.cards[player.id],
      currentPlayer: game.state.currentPlayer,
      settings: game.settings
    });
  });

  // Update available games for all clients
  const availableGames = Array.from(games.values())
    .filter(g => g.players.length < 4 && !g.started)
    .map(g => ({
      id: g.id,
      settings: g.settings,
      players: g.players,
      createdBy: g.createdBy
    }));
  io.emit('availableGames', availableGames);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
