import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Game from './Game';
import './Game.css';

function GameTest() {
  console.log('GameTest component rendering'); // Debug log

  const [testPlayers, setTestPlayers] = useState([]);
  const [gameId, setGameId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('GameTest useEffect running'); // Debug log
    const setupTestPlayers = async () => {
      try {
        console.log('Setting up test players...'); // Debug log
        const players = [];
        // Create 4 test players
        for (let i = 0; i < 4; i++) {
          console.log(`Creating test player ${i + 1}`); // Debug log
          const socket = io('http://localhost:3000', {
            transports: ['websocket'],
            forceNew: true
          });

          await new Promise((resolve, reject) => {
            socket.once('connect', () => {
              console.log(`Test player ${i + 1} connected with ID: ${socket.id}`); // Debug log
              const player = {
                id: socket.id,
                name: `Test Spieler ${i + 1}`,
                socket,
                isCreator: i === 0
              };
              players.push(player);
              resolve();
            });

            socket.once('connect_error', (error) => {
              console.error(`Connection error for player ${i + 1}:`, error); // Debug log
              reject(error);
            });
          });
        }

        // First player creates the game
        const creator = players[0];
        console.log('Creating test game...'); // Debug log
        await new Promise((resolve) => {
          creator.socket.once('gameCreated', (game) => {
            console.log('Game created:', game); // Debug log
            setGameId(game.id);
            resolve();
          });

          creator.socket.emit('createGame', {
            playWithNine: false,
            zweiteDulleSchlaegtErsteDulle: true,
            mitSchaf: true,
            isTestMode: true
          });
        });

        // Other players join the game
        console.log('Other players joining the game...'); // Debug log
        await Promise.all(players.slice(1).map(player => 
          new Promise((resolve) => {
            player.socket.emit('joinGame', {
              gameId,
              playerId: player.id,
              playerName: player.name
            });
            resolve();
          })
        ));

        setTestPlayers(players);
        setIsConnecting(false);
        console.log('All players connected and game ready'); // Debug log

      } catch (err) {
        console.error('Error setting up test players:', err);
        setError('Fehler beim Verbinden der Testspieler');
        setIsConnecting(false);
      }
    };

    setupTestPlayers();

    return () => {
      console.log('GameTest cleanup running'); // Debug log
      testPlayers.forEach(player => {
        if (player.socket.connected) {
          player.socket.disconnect();
        }
      });
    };
  }, []);

  const handleStartGame = () => {
    if (gameId && testPlayers.length > 0) {
      console.log('Starting game...'); // Debug log
      testPlayers[0].socket.emit('startGame', gameId);
    }
  };

  if (error) {
    return (
      <div className="game-test-error">
        <h2>Fehler</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="game-test-loading">
        <h2>Verbinde Testspieler...</h2>
      </div>
    );
  }

  return (
    <div className="game-test">
      <div className="game-test-controls">
        <h2>Doppelkopf Spiel-Test</h2>
        <button onClick={handleStartGame} className="start-game-btn">
          Spiel Starten
        </button>
      </div>
      <div className="game-test-views">
        {testPlayers.map(player => (
          <div key={player.id} className="game-test-player">
            <h3>{player.name}</h3>
            <Game
              socket={player.socket}
              gameId={gameId}
              playerId={player.id}
              isTestMode={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default GameTest; 