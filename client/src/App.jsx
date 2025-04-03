import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Lobby from './components/Lobby';
import GameView from './components/game/Game';
import './App.css';

function App({ socket, myId, isConnected, isTestMode = false }) {
  const [gameState, setGameState] = useState(null);
  const [availableGames, setAvailableGames] = useState([]);
  const [gameSettings, setGameSettings] = useState({
    playWithNine: false,
    zweiteDulleSchlaegtErsteDulle: true,
    mitSchaf: true
  });
  const [currentGame, setCurrentGame] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('App mounted with:', { myId, isConnected, isTestMode });

    socket.emit('requestGames');

    socket.on('availableGames', (games) => {
      console.log('Received all games:', games);
      console.log('Current isTestMode:', isTestMode);
      // Filter games based on test mode, treating undefined as false
      const filteredGames = games.filter(game => {
        const gameIsTestMode = Boolean(game.isTestMode);
        const ourIsTestMode = Boolean(isTestMode);
        console.log(`Game ${game.id}: isTestMode=${gameIsTestMode}, our isTestMode=${ourIsTestMode}`);
        return gameIsTestMode === ourIsTestMode;
      });
      console.log('Filtered games for our mode:', filteredGames);
      setAvailableGames(filteredGames);
    });

    socket.on('gameCreated', (game) => {
      console.log('Game created:', game);
      console.log('Comparing createdBy:', { gameCreatedBy: game.createdBy, myId });
      // Only handle games matching our mode (test/production)
      if (game.isTestMode === isTestMode) {
        setAvailableGames(prev => {
          const exists = prev.some(g => g.id === game.id);
          return exists ? prev : [...prev, game];
        });

        // If we created the game, join it automatically
        if (game.createdBy === myId) {
          console.log('Auto-joining as game creator');
          setCurrentGame(game);
          setMessages([]);
          
          socket.emit('joinGame', {
            gameId: game.id,
            playerId: myId,
            playerName: socket.playerName
          });
        }
      }
    });

    socket.on('gameJoined', (game) => {
      console.log('Game joined:', game);
      console.log('Game creator check:', { gameCreatedBy: game.createdBy, myId });
      // Set current game regardless of who joined
      setCurrentGame(game);
      // Update available games list
      setAvailableGames(prev => 
        prev.map(g => g.id === game.id ? game : g)
      );
    });

    socket.on('playerJoined', ({ gameId, players }) => {
      console.log('Player joined:', { gameId, players });
      // Update current game if we're in it
      if (currentGame?.id === gameId || players.some(p => p.id === myId)) {
        setCurrentGame(prev => ({
          ...prev,
          players: players
        }));
      }
      // Update available games list
      setAvailableGames(prev => 
        prev.map(game => 
          game.id === gameId ? { ...game, players } : game
        )
      );
    });

    socket.on('playerLeft', ({ gameId, players }) => {
      console.log('Player left:', { gameId, players });
      if (currentGame?.id === gameId) {
        setCurrentGame(prev => ({
          ...prev,
          players: players
        }));
      }
      setAvailableGames(prev => 
        prev.map(game => 
          game.id === gameId ? { ...game, players } : game
        )
      );
    });

    socket.on('gameClosed', ({ gameId }) => {
      console.log('Game closed:', gameId);
      setAvailableGames(prev => prev.filter(game => game.id !== gameId));
      if (currentGame?.id === gameId) {
        setCurrentGame(null);
        setMessages([]);
      }
    });

    socket.on('gameStarted', (data) => {
      console.log('Game started:', data);
      setGameState(data);
      setCurrentGame(null);
      setMessages([]);
    });

    socket.on('chatMessage', ({ gameId, playerId, playerName, message }) => {
      if (currentGame?.id === gameId) {
        setMessages(prev => [...prev, { playerId, playerName, message }]);
      }
    });

    return () => {
      socket.off('availableGames');
      socket.off('gameCreated');
      socket.off('gameJoined');
      socket.off('gameClosed');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('gameStarted');
      socket.off('chatMessage');
    };
  }, [socket, isConnected, currentGame?.id, myId, isTestMode]);

  const handleCreateGame = () => {
    if (!socket) return;
    socket.emit('createGame', {
      ...gameSettings,
      isTestMode
    });
  };

  const handleJoinGame = (gameId) => {
    if (!socket) return;
    console.log(`Attempting to join game ${gameId}`);
    socket.emit('joinGame', {
      gameId,
      playerId: myId,
      playerName: socket.playerName
    });
  };

  const handleLeaveGame = () => {
    if (!currentGame || !socket) return;
    
    if (currentGame.createdBy === myId) {
      socket.emit('closeGame', currentGame.id);
    } else {
      socket.emit('leaveGame', {
        gameId: currentGame.id,
        playerId: myId
      });
    }
    setCurrentGame(null);
    setMessages([]);
  };

  const handleSettingChange = (setting, value) => {
    setGameSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handlePlayCard = (card) => {
    if (gameState && socket) {
      socket.emit('playCard', {
        gameId: gameState.id,
        playerId: myId,
        card
      });
    }
  };

  // Render game interface
  return (
    <div className="app">
      {!isTestMode && (
        <nav>
          <ul>
            <li><Link to="/">Lobby</Link></li>
            <li><Link to="/test">Test-Modus</Link></li>
          </ul>
        </nav>
      )}

      {!gameState ? (
        <Lobby
          availableGames={availableGames}
          onJoinGame={handleJoinGame}
          onCreateGame={handleCreateGame}
          gameSettings={gameSettings}
          onSettingsChange={handleSettingChange}
          currentGame={currentGame}
          messages={messages}
          myId={myId}
          socket={socket}
          onLeaveGame={handleLeaveGame}
        />
      ) : (
        <GameView
          gameState={gameState}
          myId={myId}
          onPlayCard={handlePlayCard}
          onCloseGame={handleLeaveGame}
        />
      )}
    </div>
  );
}

export default App; 