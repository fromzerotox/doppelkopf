import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import GameView from './components/GameView';
import './App.css';

function App({ socket, myId, isConnected }) {
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
    if (socket && isConnected) {
      // Request initial games list
      socket.emit('requestGames');

      socket.on('availableGames', (games) => {
        // Filter out test games in production mode
        const filteredGames = games.filter(game => !game.isTestMode);
        setAvailableGames(filteredGames);
      });

      socket.on('gameCreated', (game) => {
        // Only add non-test games to available games
        if (!game.isTestMode) {
          setAvailableGames(prev => [...prev, game]);
          if (game.createdBy === myId) {
            setCurrentGame(game);
            setMessages([]);
          }
        }
      });

      socket.on('gameClosed', ({ gameId }) => {
        setAvailableGames(prev => prev.filter(game => game.id !== gameId));
        if (currentGame?.id === gameId) {
          setCurrentGame(null);
          setMessages([]);
        }
      });

      socket.on('playerJoined', ({ gameId, players }) => {
        setAvailableGames(prev => 
          prev.map(game => 
            game.id === gameId ? { ...game, players } : game
          )
        );
        if (currentGame?.id === gameId) {
          setCurrentGame(prev => ({ ...prev, players }));
        }
      });

      socket.on('playerLeft', ({ gameId, players }) => {
        setAvailableGames(prev => 
          prev.map(game => 
            game.id === gameId ? { ...game, players } : game
          )
        );
        if (currentGame?.id === gameId) {
          setCurrentGame(prev => ({ ...prev, players }));
        }
      });

      socket.on('gameStarted', (data) => {
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
        socket.off('gameClosed');
        socket.off('playerJoined');
        socket.off('playerLeft');
        socket.off('gameStarted');
        socket.off('chatMessage');
      };
    }
  }, [socket, isConnected, currentGame, myId]);

  const handleJoinGame = (gameId) => {
    socket.emit('joinGame', {
      gameId,
      playerId: myId,
      playerName: socket.playerName
    });
    const game = availableGames.find(g => g.id === gameId);
    setCurrentGame(game);
    setMessages([]);
  };

  const handleCreateGame = () => {
    socket.emit('createGame', gameSettings);
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

  const handleCloseGame = () => {
    if (currentGame && socket) {
      socket.emit('closeGame', currentGame.id);
      setCurrentGame(null);
      setMessages([]);
    }
  };

  const handleLeaveGame = () => {
    if (currentGame && socket) {
      if (currentGame.createdBy === myId) {
        // If game leader, close the game
        socket.emit('closeGame', currentGame.id);
      } else {
        // If regular player, leave the game
        socket.emit('leaveGame', {
          gameId: currentGame.id,
          playerId: myId
        });
      }
      setCurrentGame(null);
      setMessages([]);
    }
  };

  if (!isConnected) {
    return <div>Verbindung zum Server wird hergestellt...</div>;
  }

  return (
    <div className="app">
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
          onCloseGame={handleCloseGame}
        />
      )}
    </div>
  );
}

export default App; 