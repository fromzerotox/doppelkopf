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
    console.log(`Player ${name} joining with socket ID ${socket.id}`);
    players.set(socket.id, { id: socket.id, name, socketId: socket.id });
    socket.playerName = name;
    
    // Send list of available games to the new player
    const availableGames = Array.from(games.values())
      .filter(game => game.players.length < 4 && !game.started)
      .map(game => ({
        id: game.id,
        settings: game.settings,
        players: game.players.map(p => ({
          id: p.id,
          name: p.name || players.get(p.id)?.name || 'Unbekannt'
        })),
        createdBy: game.createdBy,
        isTestMode: game.isTestMode
      }));
    
    console.log('Sending available games to new player:', availableGames);
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

  // Helper function to check if a player already has created a game
  function hasExistingGame(playerId) {
    for (const [_, game] of games) {
      if (game.createdBy === playerId && !game.started) {
        return game;
      }
    }
    return null;
  }

  // Helper function to clean up any existing games for a player
  function cleanupExistingGames(playerId) {
    for (const [gameId, game] of games) {
      if (game.createdBy === playerId) {
        games.delete(gameId);
        io.to(gameId).emit('gameClosed', { gameId });
        console.log(`Cleaned up existing game ${gameId} for player ${playerId}`);
      }
    }
  }

  socket.on('createGame', (gameSettings) => {
    // Check if player already has created a game
    const existingGame = hasExistingGame(socket.id);
    if (existingGame) {
      socket.emit('error', { 
        message: 'Du hast bereits ein aktives Spiel erstellt. Schließe zuerst das bestehende Spiel.' 
      });
      return;
    }

    const gameId = Date.now().toString();
    const game = {
      id: gameId,
      settings: gameSettings,
      players: [], // Start with empty players array
      createdBy: socket.id,
      isTestMode: gameSettings.isTestMode || false,
      started: false
    };

    games.set(gameId, game);
    
    console.log(`Game ${gameId} created by ${socket.playerName}`);

    // Broadcast game creation to all clients
    io.emit('gameCreated', {
      id: game.id,
      settings: game.settings,
      players: [],
      createdBy: game.createdBy,
      isTestMode: game.settings.isTestMode
    });

    // Automatically join the creator to the game
    handleJoinGame(socket, {
      gameId,
      playerId: socket.id,
      playerName: socket.playerName
    });

    // Update available games
    broadcastAvailableGames();
  });

  // Helper function to handle joining a game
  function handleJoinGame(socket, { gameId, playerId, playerName }) {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', { message: 'Spiel nicht gefunden' });
      return;
    }

    console.log('Join game attempt:', {
      gameId,
      playerId,
      playerName,
      currentPlayers: game.players.map(p => ({ id: p.id, name: p.name }))
    });

    // Check if player is already in the game
    const existingPlayerIndex = game.players.findIndex(p => p.id === playerId);
    if (existingPlayerIndex !== -1) {
      // Update player name if it's missing
      if (!game.players[existingPlayerIndex].name) {
        game.players[existingPlayerIndex].name = playerName;
      }
      
      // Always join the socket room, even if already in the game
      socket.join(gameId);
      
      console.log('Player already in game:', {
        gameId,
        player: game.players[existingPlayerIndex]
      });

      // Send game state to the rejoining player
      socket.emit('gameJoined', {
        id: game.id,
        settings: game.settings,
        players: game.players,
        createdBy: game.createdBy,
        isTestMode: game.settings.isTestMode,
        started: game.started
      });

      // Notify all players about the current player list
      io.to(gameId).emit('playerJoined', {
        gameId,
        players: game.players
      });
      return;
    }

    // For test mode games, allow joining even if the game appears full
    if (game.players.length >= 4 && !game.settings.isTestMode) {
      socket.emit('error', { message: 'Spiel ist bereits voll' });
      return;
    }

    // Add the new player with complete information
    const newPlayer = { 
      id: playerId, 
      name: playerName || players.get(playerId)?.name || 'Unbekannt'
    };
    game.players.push(newPlayer);
    
    // Join the socket room
    socket.join(gameId);

    console.log('Player joined game:', {
      gameId,
      newPlayer,
      totalPlayers: game.players.length,
      allPlayers: game.players.map(p => ({ id: p.id, name: p.name }))
    });

    // Update the game in the games Map
    games.set(gameId, game);

    // Send game state to the joining player
    socket.emit('gameJoined', {
      id: game.id,
      settings: game.settings,
      players: game.players,
      createdBy: game.createdBy,
      isTestMode: game.settings.isTestMode,
      started: game.started
    });

    // Notify all players about the updated player list
    io.to(gameId).emit('playerJoined', {
      gameId,
      players: game.players
    });

    // Update available games for all clients
    broadcastAvailableGames();
  }

  socket.on('joinGame', ({ gameId, playerId, playerName }) => {
    handleJoinGame(socket, { gameId, playerId, playerName });
  });

  socket.on('chatMessage', ({ gameId, message }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', { message: 'Spiel nicht gefunden' });
      return;
    }

    const player = game.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Du bist nicht in diesem Spiel' });
      return;
    }

    console.log(`Chat message in game ${gameId} from ${player.name}: ${message}`);

    // Make sure the sender is in the room before broadcasting
    if (!socket.rooms.has(gameId)) {
      socket.join(gameId);
    }

    // Broadcast the message to all players in the game room
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
      socket.emit('error', { message: 'Spiel nicht gefunden' });
      return;
    }

    console.log('Attempting to start game:', {
      gameId,
      playerCount: game.players.length,
      players: game.players.map(p => ({ id: p.id, name: p.name })),
      creator: game.createdBy,
      requestingPlayer: socket.id,
      isCreator: game.createdBy === socket.id
    });

    // Prüfe, ob der anfragende Spieler der Spielleiter ist
    if (game.createdBy !== socket.id) {
      console.log('Start game rejected: Not the game creator');
      socket.emit('error', { message: 'Nur der Spielleiter kann das Spiel starten' });
      return;
    }

    // Prüfe, ob genau 4 Spieler anwesend sind
    const validPlayers = game.players.filter(p => p.id && p.name);
    if (validPlayers.length !== 4) {
      console.log('Start game rejected: Invalid player count', {
        validPlayers: validPlayers.length,
        expectedPlayers: 4,
        players: validPlayers
      });
      socket.emit('error', { 
        message: `Es müssen genau 4 Spieler anwesend sein (aktuell: ${validPlayers.length})` 
      });
      return;
    }

    // Initialisiere das Spiel
    const deck = createDeck(game.settings.playWithNine);
    shuffleDeck(deck);

    // Teile die Karten auf
    const hands = dealCards(deck, 4);
    game.players.forEach((player, index) => {
      player.hand = hands[index];
    });

    // Setze den Spielstatus
    game.started = true;
    game.currentPlayer = 0;
    game.tricks = [];
    game.scores = game.players.map(() => 0);

    console.log('Game started successfully:', {
      gameId,
      players: game.players.map(p => ({ id: p.id, name: p.name })),
      hands: game.players.map(p => p.hand.length)
    });

    // Benachrichtige alle Spieler
    io.to(gameId).emit('gameStarted', {
      id: game.id,
      settings: game.settings,
      players: game.players.map(p => ({
        id: p.id,
        name: p.name,
        hand: p.hand
      })),
      currentPlayer: game.currentPlayer,
      scores: game.scores
    });

    // Aktualisiere die verfügbaren Spiele
    broadcastAvailableGames();
  });

  socket.on('requestGames', () => {
    socket.emit('availableGames', Array.from(games.values()));
  });

  socket.on('closeGame', ({ gameId }) => {
    const game = games.get(gameId);
    if (!game) {
      socket.emit('error', { message: 'Spiel nicht gefunden' });
      return;
    }

    // Only allow game creator or test mode to close games
    if (game.createdBy !== socket.id && !game.settings.isTestMode) {
      socket.emit('error', { message: 'Nur der Spielersteller kann das Spiel schließen' });
      return;
    }

    // Remove the game
    games.delete(gameId);
    
    // Notify all clients in the game room
    io.to(gameId).emit('gameClosed', { gameId });
    
    console.log(`Game ${gameId} closed by ${socket.playerName}`);
    
    // Update available games
    broadcastAvailableGames();
  });

  socket.on('closeAllTestGames', () => {
    let gamesRemoved = 0;
    for (const [gameId, game] of games) {
      if (game.settings.isTestMode) {
        games.delete(gameId);
        io.to(gameId).emit('gameClosed', { gameId });
        gamesRemoved++;
      }
    }
    console.log(`Closed ${gamesRemoved} test games`);
    broadcastAvailableGames();
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

// Helper function to broadcast available games
function broadcastAvailableGames() {
  const availableGames = Array.from(games.values())
    .filter(game => game.players.length < 4 && !game.started)
    .map(game => ({
      id: game.id,
      settings: game.settings,
      players: game.players.map(p => ({
        id: p.id,
        name: p.name || players.get(p.id)?.name || 'Unbekannt'
      })),
      createdBy: game.createdBy,
      isTestMode: game.isTestMode
    }));
  
  console.log('Broadcasting available games:', availableGames);
  io.emit('availableGames', availableGames);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
