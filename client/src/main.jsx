import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import App from './App';
import TestMode from './components/TestMode';
import GameTest from './components/game/GameTest';
import './index.css';

// GameEntry als separate Komponente
const GameEntry = ({ onJoin, playerName, setPlayerName, nameError, setNameError, isConnected }) => {
  const handleNameChange = useCallback((e) => {
    setPlayerName(e.target.value);
    setNameError('');
  }, [setPlayerName, setNameError]);

  return (
    <div className="join-form-container">
      <div className="join-form">
        <h2>Willkommen zu Doppelkopf</h2>
        <p className="join-description">
          Gib deinen Namen ein, um dem Spiel beizutreten.
        </p>
        {!isConnected && (
          <div className="connection-status error">
            Verbindung zum Server wird hergestellt...
          </div>
        )}
        <form onSubmit={onJoin}>
          <div className="form-group">
            <label htmlFor="playerName">Dein Name:</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={handleNameChange}
              placeholder="z.B. Max"
              className={nameError ? 'error' : ''}
              maxLength={20}
              autoFocus
              disabled={!isConnected}
            />
            {nameError && <div className="error-message">{nameError}</div>}
          </div>
          <button type="submit" className="join-button" disabled={!isConnected || !playerName.trim()}>
            Beitreten
          </button>
        </form>
      </div>
    </div>
  );
};

function Main() {
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [nameError, setNameError] = useState('');
  const [shouldConnect, setShouldConnect] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Verbesserte Socket-Initialisierung
  useEffect(() => {
    let newSocket = null;

    const connectSocket = () => {
      if (socket && socket.connected) {
        return socket;
      }

      if (newSocket) {
        newSocket.close();
      }

      console.log('Versuche Verbindung zum Server aufzubauen...');
      newSocket = io('http://localhost:3000', {
        transports: ['websocket'],
        forceNew: !isReconnecting,
        reconnection: false // Deaktiviere automatische Wiederverbindung
      });

      newSocket.on('connect', () => {
        console.log('Verbunden mit Server');
        setIsConnected(true);
        setSocket(newSocket);
        setIsReconnecting(false);

        const savedPlayerName = localStorage.getItem('playerName');
        const savedPlayerId = localStorage.getItem('playerId');
        
        if (savedPlayerName && savedPlayerId) {
          setPlayerName(savedPlayerName);
          setMyId(savedPlayerId);
          newSocket.emit('rejoin', {
            name: savedPlayerName,
            id: savedPlayerId
          });
        }
      });

      newSocket.on('disconnect', () => {
        console.log('Verbindung zum Server getrennt');
        setIsConnected(false);
        if (shouldConnect) {
          setIsReconnecting(true);
        }
      });

      newSocket.on('connect_error', (error) => {
        console.log('Verbindungsfehler:', error);
        setIsConnected(false);
        if (shouldConnect) {
          setIsReconnecting(true);
        }
      });

      return newSocket;
    };

    if (shouldConnect && !socket) {
      newSocket = connectSocket();
    }

    return () => {
      if (newSocket && !isReconnecting) {
        newSocket.close();
      }
    };
  }, [shouldConnect, isReconnecting]);

  const validateName = useCallback((name) => {
    if (!name.trim()) {
      return 'Bitte gib einen Namen ein';
    }
    if (name.length < 2) {
      return 'Der Name muss mindestens 2 Zeichen lang sein';
    }
    if (name.length > 20) {
      return 'Der Name darf maximal 20 Zeichen lang sein';
    }
    if (!/^[a-zA-Z0-9äöüÄÖÜß\s-_]+$/.test(name)) {
      return 'Der Name darf nur Buchstaben, Zahlen, Leerzeichen und - _ enthalten';
    }
    return '';
  }, []);

  const handleJoin = useCallback((e) => {
    e.preventDefault();
    
    const error = validateName(playerName);
    if (error) {
      setNameError(error);
      return;
    }

    if (!socket || !socket.connected) {
      setNameError('Keine Verbindung zum Server. Bitte Seite neu laden.');
      return;
    }

    setNameError('');
    const newId = socket.id;
    setMyId(newId);
    
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('playerId', newId);
    
    socket.emit('join', playerName);
  }, [playerName, socket, validateName]);

  const handleDisconnect = useCallback(() => {
    if (socket) {
      console.log('Starte Abmeldeprozess...');
      setShouldConnect(false);
      
      // Session-Daten löschen
      localStorage.removeItem('playerName');
      localStorage.removeItem('playerId');
      setPlayerName('');
      setMyId(null);
      
      // Socket trennen
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      
      // Neuverbindung nach Verzögerung
      setTimeout(() => {
        console.log('Erlaube neue Verbindung...');
        setShouldConnect(true);
      }, 500);
    }
  }, [socket]);

  // Reset error message when connection status changes
  useEffect(() => {
    if (isConnected) {
      setNameError('');
    }
  }, [isConnected]);

  return (
    <Router>
      <Routes>
        <Route path="/test" element={<TestMode />} />
        <Route path="/game-test" element={<GameTest />} />
        <Route 
          path="/" 
          element={
            !isConnected || !myId ? (
              <GameEntry 
                onJoin={handleJoin}
                playerName={playerName}
                setPlayerName={setPlayerName}
                nameError={nameError}
                setNameError={setNameError}
                isConnected={isConnected}
              />
            ) : (
              <div>
                <div className="header-buttons">
                  <div className="player-info">
                    Spieler: {playerName}
                    <button onClick={handleDisconnect} className="disconnect-btn">
                      Abmelden
                    </button>
                  </div>
                </div>
                <App 
                  socket={socket} 
                  myId={myId} 
                  isConnected={isConnected} 
                  onDisconnect={handleDisconnect}
                />
              </div>
            )
          } 
        />
      </Routes>
    </Router>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Main />);

