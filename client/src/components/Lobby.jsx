import React, { useState, useEffect, useRef } from 'react';

function Lobby({ socket, myId }) {
  const [gameSettings, setGameSettings] = useState({
    playWithNine: false,
    zweiteDulleSchlaegtErsteDulle: true,
    mitSchaf: true
  });
  const [availableGames, setAvailableGames] = useState([]);
  const [error, setError] = useState(null);
  const [currentGame, setCurrentGame] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socket.on('availableGames', (games) => {
      setAvailableGames(games);
    });

    socket.on('gameCreated', (game) => {
      setAvailableGames(prev => [...prev, game]);
      // Set the current game when we receive the server's confirmation
      if (game.createdBy === myId) {
        setCurrentGame(game);
        setMessages([]); // Clear messages for the new game
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

    socket.on('chatMessage', ({ gameId, playerId, playerName, message }) => {
      if (currentGame?.id === gameId) {
        setMessages(prev => [...prev, { playerId, playerName, message }]);
      }
    });

    socket.on('error', (message) => {
      setError(message);
    });

    return () => {
      socket.off('availableGames');
      socket.off('gameCreated');
      socket.off('playerJoined');
      socket.off('chatMessage');
      socket.off('error');
    };
  }, [socket, currentGame, myId]);

  const handleSettingChange = (setting) => {
    setGameSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleCreateGame = () => {
    socket.emit('createGame', gameSettings);
  };

  const handleJoinGame = (gameId) => {
    socket.emit('joinGame', gameId);
    const game = availableGames.find(g => g.id === gameId);
    setCurrentGame(game);
    setMessages([]); // Clear messages when joining a new game
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentGame) return;

    socket.emit('chatMessage', {
      gameId: currentGame.id,
      message: newMessage.trim()
    });
    setNewMessage('');
  };

  return (
    <div className="lobby">
      <h2>Doppelkopf Lobby</h2>
      
      {error && <div className="error-message">{error}</div>}

      <div className="available-games">
        <h3>Verfügbare Spiele</h3>
        {availableGames.length === 0 ? (
          <p>Keine verfügbaren Spiele</p>
        ) : (
          <div className="games-list">
            {availableGames.map(game => (
              <div key={game.id} className="game-item">
                <div className="game-settings-summary">
                  <span>{game.settings.playWithNine ? "Mit 9" : "Ohne 9"}</span>
                  <span>{game.settings.zweiteDulleSchlaegtErsteDulle ? "Zweite Dulle schlägt erste Dulle" : "Erste Dulle schlägt zweite Dulle"}</span>
                  <span>{game.settings.mitSchaf ? "Mit Schaf" : "Ohne Schaf"}</span>
                </div>
                <div className="game-players">
                  Spieler: {game.players.length}/4
                  <ul>
                    {game.players.map(player => (
                      <li key={player.id}>{player.name}</li>
                    ))}
                  </ul>
                </div>
                {game.createdBy !== myId && game.players.length < 4 && (
                  <button 
                    onClick={() => handleJoinGame(game.id)}
                    className="join-game-btn"
                  >
                    Spiel beitreten
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {currentGame && (
        <div className="game-chat">
          <h3>Chat</h3>
          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.playerId === myId ? 'own-message' : ''}`}>
                <span className="player-name">{msg.playerName}:</span>
                <span className="message-text">{msg.message}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="chat-input">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Nachricht eingeben..."
            />
            <button type="submit">Senden</button>
          </form>
        </div>
      )}

      {!currentGame && (
        <div className="create-game">
          <h3>Neues Spiel erstellen</h3>
          <div className="game-settings">
            <div className="setting">
              <label>
                <input
                  type="checkbox"
                  checked={gameSettings.playWithNine}
                  onChange={() => handleSettingChange('playWithNine')}
                />
                Mit 9 spielen
              </label>
            </div>
            <div className="setting">
              <label>
                <input
                  type="checkbox"
                  checked={gameSettings.zweiteDulleSchlaegtErsteDulle}
                  onChange={() => handleSettingChange('zweiteDulleSchlaegtErsteDulle')}
                />
                Zweite Dulle schlägt erste Dulle
              </label>
            </div>
            <div className="setting">
              <label>
                <input
                  type="checkbox"
                  checked={gameSettings.mitSchaf}
                  onChange={() => handleSettingChange('mitSchaf')}
                />
                Mit Schaf
              </label>
            </div>
          </div>
          <button onClick={handleCreateGame} className="create-game-btn">
            Spiel erstellen
          </button>
        </div>
      )}
    </div>
  );
}

export default Lobby; 