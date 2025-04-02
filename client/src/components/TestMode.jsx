import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import App from '../App';

function TestMode() {
  const [sockets, setSockets] = useState([]);
  const [testPlayers, setTestPlayers] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [playerCount, setPlayerCount] = useState(4);
  const [gameStarted, setGameStarted] = useState(false);
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
        
        if (index === 0) {
          socket.once('gameCreated', (game) => {
            setCurrentGame(game);
            resolve(player);
          });

          socket.emit('createGame', {
            playWithNine: false,
            zweiteDulleSchlaegtErsteDulle: true,
            mitSchaf: true,
            isTestMode: true
          });
        } else {
          const handleAvailableGames = (games) => {
            const testGames = games.filter(game => game.isTestMode);
            if (testGames.length > 0) {
              const game = testGames[0];
              socket.emit('joinGame', {
                gameId: game.id,
                playerId: player.id,
                playerName: name
              });
              socket.off('availableGames', handleAvailableGames);
              resolve(player);
            }
          };

          socket.on('availableGames', handleAvailableGames);
          socket.emit('requestGames');
        }

        // Listen for game start
        socket.on('gameStarted', (data) => {
          console.log(`Game started for player ${name}`, data);
          setGameStarted(true);
        });

        // Listen for errors
        socket.on('error', (error) => {
          console.error(`Error for player ${name}:`, error);
        });

        // Listen for disconnect
        socket.on('disconnect', () => {
          console.log(`Player ${name} disconnected`);
        });

        // Listen for chat messages
        socket.on('chatMessage', (data) => {
          console.log(`Chat message for player ${name}:`, data);
        });
      });
    });
  };

  const closeAllTestGames = () => {
    if (sockets.length > 0) {
      sockets[0].emit('closeAllTestGames');
      setCurrentGame(null);
      setGameStarted(false);
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
        const player = await createTestPlayer(`Spieler ${i + 1}`, i);
        players.push(player);
        setSockets(prev => [...prev, player.socket]);
      }
      
      setTestPlayers(players);
      setGameStarted(false);
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
    setGameStarted(false);
    setCurrentGame(null);
  };

  const handleStartGame = () => {
    if (currentGame && sockets[0]) {
      sockets[0].emit('startGame', currentGame.id);
    }
  };

  useEffect(() => {
    return () => {
      stopTestMode();
    };
  }, []);

  const getGridColumns = () => {
    if (gameStarted) {
      return '1fr';
    }
    return 'repeat(2, 1fr)';
  };

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
        <div className="test-views" style={{ gridTemplateColumns: getGridColumns() }}>
          {testPlayers.map(player => (
            <div key={player.id} className={`test-player-view ${gameStarted ? 'game-started' : ''}`}>
              <h3>{player.name}</h3>
              <App 
                socket={player.socket} 
                myId={player.id} 
                isConnected={player.socket.connected}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TestMode; 