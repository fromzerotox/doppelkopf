import React, { useState, useRef, useEffect } from 'react';

function Lobby({ 
  availableGames, 
  onJoinGame, 
  onCreateGame, 
  gameSettings, 
  onSettingsChange,
  currentGame,
  messages,
  myId,
  socket,
  onLeaveGame
}) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSettingChange = (setting) => {
    onSettingsChange(setting, !gameSettings[setting]);
  };

  const handleCreateGame = () => {
    onCreateGame();
  };

  const handleJoinGame = (gameId) => {
    onJoinGame(gameId);
  };

  const handleLeaveGame = () => {
    onLeaveGame();
  };

  const handleStartGame = () => {
    if (currentGame && socket) {
      socket.emit('startGame', currentGame.id);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentGame || !socket) return;

    socket.emit('chatMessage', {
      gameId: currentGame.id,
      message: newMessage.trim()
    });
    setNewMessage('');
  };

  const isGameLeader = currentGame?.createdBy === myId;

  return (
    <div className="lobby">
      <h2>Doppelkopf Lobby</h2>

      {currentGame ? (
        <div className="current-game">
          <div className="game-info">
            <h3>Aktuelles Spiel</h3>
            <div className="game-settings-summary">
              <span>Mit 9: {currentGame.settings.playWithNine ? 'Ja' : 'Nein'}</span>
              <span>Zweite Dulle schlägt erste Dulle: {currentGame.settings.zweiteDulleSchlaegtErsteDulle ? 'Ja' : 'Nein'}</span>
              <span>Mit Schaf: {currentGame.settings.mitSchaf ? 'Ja' : 'Nein'}</span>
            </div>
            <div className="game-players">
              <h4>Spieler ({currentGame.players.length}/4):</h4>
              <ul>
                {currentGame.players.map(player => (
                  <li key={player.id}>{player.name}</li>
                ))}
              </ul>
            </div>
            <div className="game-controls">
              {isGameLeader ? (
                currentGame.players.length === 4 ? (
                  <button onClick={handleStartGame} className="start-game-btn">
                    Spiel starten
                  </button>
                ) : (
                  <button onClick={handleLeaveGame} className="leave-game-btn">
                    Spiel schließen
                  </button>
                )
              ) : (
                <button onClick={handleLeaveGame} className="leave-game-btn">
                  Spiel verlassen
                </button>
              )}
            </div>
          </div>

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
        </div>
      ) : (
        <>
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

          <div className="available-games">
            <h3>Verfügbare Spiele</h3>
            {availableGames.length === 0 ? (
              <p>Keine verfügbaren Spiele</p>
            ) : (
              <div className="games-list">
                {availableGames.map(game => (
                  <div key={game.id} className="game-item">
                    <div className="game-settings-summary">
                      <span>Mit 9: {game.settings.playWithNine ? 'Ja' : 'Nein'}</span>
                      <span>Zweite Dulle schlägt erste Dulle: {game.settings.zweiteDulleSchlaegtErsteDulle ? 'Ja' : 'Nein'}</span>
                      <span>Mit Schaf: {game.settings.mitSchaf ? 'Ja' : 'Nein'}</span>
                    </div>
                    <div className="game-players">
                      <h3>Spieler ({game.players.length}/4):</h3>
                      <ul>
                        {game.players.map(player => (
                          <li key={player.id}>{player.name}</li>
                        ))}
                      </ul>
                    </div>
                    <button 
                      onClick={() => handleJoinGame(game.id)}
                      className="join-game-btn"
                      disabled={game.players.length >= 4}
                    >
                      Spiel beitreten
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Lobby;