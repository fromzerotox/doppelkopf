import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import App from './App';
import TestMode from './components/TestMode';
import './index.css';

function Main() {
  const [socket, setSocket] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
      const savedPlayerName = localStorage.getItem('playerName');
      const savedPlayerId = localStorage.getItem('playerId');
      
      if (savedPlayerName && savedPlayerId) {
        setPlayerName(savedPlayerName);
        setMyId(savedPlayerId);
        // Rejoin with saved session
        newSocket.emit('rejoin', {
          name: savedPlayerName,
          id: savedPlayerId
        });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    const newId = socket.id;
    setMyId(newId);
    
    // Save session to localStorage
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('playerId', newId);
    
    // Join with new session
    socket.emit('join', playerName);
  };

  const handleDisconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setMyId(null);
      localStorage.removeItem('playerName');
      localStorage.removeItem('playerId');
    }
  };

  const GameEntry = () => (
    <div className="join-form">
      <h2>Doppelkopf</h2>
      <form onSubmit={handleJoin}>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Dein Name"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin(e)}
        />
        <button type="submit">Beitreten</button>
      </form>
    </div>
  );

  return (
    <Router>
      <Routes>
        <Route path="/test" element={<TestMode />} />
        <Route 
          path="/" 
          element={
            !isConnected || !myId ? (
              <GameEntry />
            ) : (
              <App socket={socket} myId={myId} isConnected={isConnected} onDisconnect={handleDisconnect} />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Main />);

