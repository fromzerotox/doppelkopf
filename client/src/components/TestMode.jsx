import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import App from '../App';
import './TestMode.css';

function TestMode() {
  const [sockets, setSockets] = useState([]);
  const [testPlayers, setTestPlayers] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [playerCount, setPlayerCount] = useState(4);
  const [currentGame, setCurrentGame] = useState(null);

  const createTestPlayer = async (name, index) => {
    return new Promise((resolve) => {
      const socket = io('http://localhost:3000', {
        transports: ['websocket'],
        forceNew: true
      });

      socket.once('connect', () => {
        console.log(`Player ${name} connected with ID: ${socket.id}`);
        const player = {
          id: socket.id,
          name,
          socket,
          isCreator: index === 0
        };

        socket.emit('join', name);
        resolve(player);

        // Common event handlers for all players
        socket.on('playerJoined', ({ gameId, players }) => {
          console.log(`${name} received player update for game ${gameId}:`, players);
          setCurrentGame(prev => {
            if (prev && prev.id === gameId) {
              return { ...prev, players };
            }
            return prev;
          });
        });

        socket.on('gameState', (game) => {
          console.log(`${name} received game state update:`, game);
          if (game.isTestMode) {
            setCurrentGame(game);
          }
        });

        socket.on('error', (error) => {
          console.error(`Error for player ${name}:`, error);
        });

        socket.on('disconnect', () => {
          console.log(`Player ${name} disconnected`);
        });
      });
    });
  };

  const createGame = () => {
    if (sockets.length > 0) {
      const creatorSocket = sockets[0];
      creatorSocket.once('gameCreated', (game) => {
        console.log('Game created:', game);
        setCurrentGame(game);
        
        // Other players join the game
        sockets.slice(1).forEach(socket => {
          socket.emit('joinGame', {
            gameId: game.id,
            playerId: socket.id,
            playerName: socket.playerName
          });
        });
      });

      creatorSocket.emit('createGame', {
        playWithNine: false,
        zweiteDulleSchlaegtErsteDulle: true,
        mitSchaf: true,
        isTestMode: true
      });
    }
  };

  const closeAllTestGames = () => {
    if (sockets.length > 0) {
      sockets[0].emit('closeAllTestGames');
      setCurrentGame(null);
    }
  };

  const startTestMode = async () => {
    // Clear existing players first
    stopTestMode();

    try {
      setIsRunning(true);
      const players = [];
      
      // Create players sequentially
      for (let i = 0; i < playerCount; i++) {
        console.log(`Creating player ${i + 1}`);
        const player = await createTestPlayer(`Spieler ${i + 1}`, i);
        players.push(player);
        setSockets(prev => [...prev, player.socket]);
        // Kurze Pause zwischen den Spielern
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setTestPlayers(players);
      console.log('All players created and connected');
    } catch (error) {
      console.error('Error starting test mode:', error);
      stopTestMode();
    }
  };

  const stopTestMode = () => {
    closeAllTestGames();
    sockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
    setSockets([]);
    setTestPlayers([]);
    setIsRunning(false);
    setCurrentGame(null);
  };

  const handleStartGame = () => {
    if (currentGame && sockets[0]) {
      console.log('Starting game with ID:', currentGame.id);
      sockets[0].emit('startGame', currentGame.id);
    }
  };

  useEffect(() => {
    return () => {
      stopTestMode();
    };
  }, []);

  return (
    <div className="test-mode">
      <div className="test-controls">
        <h2>Doppelkopf Test-Modus</h2>
        <div className="player-count-selector">
          <label>Anzahl der Spieler:</label>
          <select 
            value={playerCount} 
            onChange={(e) => setPlayerCount(Number(e.target.value))}
            disabled={isRunning}
          >
            <option value={4}>4 Spieler</option>
          </select>
        </div>
        <div className="test-buttons">
          {!isRunning ? (
            <button onClick={startTestMode} className="test-start-btn">
              Test-Modus Starten
            </button>
          ) : (
            <>
              <button onClick={stopTestMode} className="test-stop-btn">
                Test-Modus Stoppen
              </button>
              <button onClick={closeAllTestGames} className="test-reset-btn">
                Alle Testspiele Schließen
              </button>
              {!currentGame && (
                <button onClick={createGame} className="test-create-game-btn">
                  Testspiel Erstellen
                </button>
              )}
              {currentGame && currentGame.players.length === 4 && (
                <button onClick={handleStartGame} className="test-start-game-btn">
                  Spiel Starten
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {isRunning && (
        <div className="test-views">
          {testPlayers.map(player => (
            <div key={player.id} className="test-player-view">
              <h3>{player.name}</h3>
              <App 
                socket={player.socket} 
                myId={player.id} 
                isConnected={player.socket.connected}
                isTestMode={true}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TestMode; 