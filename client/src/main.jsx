import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';

const socket = io('http://localhost:3000');

function App() {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState([]);
  const [hand, setHand] = useState([]);
  const [myId, setMyId] = useState("");
  const [turn, setTurn] = useState(null);
  const [playedCards, setPlayedCards] = useState([]);
  const [gameSettings, setGameSettings] = useState(null);

  useEffect(() => {
    socket.on("connect", () => setMyId(socket.id));
    socket.on("players", setPlayers);
    socket.on("start", (game) => {
      const me = game.players.find(p => p.id === socket.id);
      setHand(me.hand);
      setTurn(game.players[game.currentPlayerIndex].id);
      setGameStarted(true);
      setGameSettings(game.settings);
    });
    socket.on("cardPlayed", ({ playerId, card }) => {
      setPlayedCards(prev => [...prev, { playerId, card }]);
    });
    socket.on("turn", setTurn);
  }, []);

  const handleJoin = () => {
    if (!name) return;
    socket.emit("join", name);
    setJoined(true);
  };

  const playCard = (card) => {
    if (turn !== myId) return;
    socket.emit("playCard", { playerId: myId, card });
    setHand(prev => prev.filter(c => c !== card));
  };

  const GameSettingsInfo = () => {
    if (!gameSettings) return null;

    return (
      <div className="game-settings-info">
        <h3>Spieleinstellungen:</h3>
        <ul>
          <li>{gameSettings.playWithNine ? "Mit 9" : "Ohne 9"}</li>
          <li>{gameSettings.zweiteDulleSchlaegtErsteDulle ? "Zweite Dulle schlägt erste Dulle" : "Erste Dulle schlägt zweite Dulle"}</li>
          <li>{gameSettings.mitSchaf ? "Mit Schaf" : "Ohne Schaf"}</li>
        </ul>
      </div>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      {!joined ? (
        <>
          <input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Dein Name"
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
          />
          <button onClick={handleJoin}>Mitspielen</button>
        </>
      ) : !gameStarted ? (
        <Lobby socket={socket} myId={myId} />
      ) : (
        <>
          <GameSettingsInfo />
          <h3>Spieler:</h3>
          <ul>
            {players.map(p => (
              <li key={p.id} style={{ fontWeight: p.id === turn ? 'bold' : 'normal' }}>
                {p.name} {p.id === myId ? "(Du)" : ""}
              </li>
            ))}
          </ul>
          <h4>Deine Karten:</h4>
          <div>
            {hand.map(card => (
              <button key={card} onClick={() => playCard(card)}>{card}</button>
            ))}
          </div>
          <h4>Gespielte Karten:</h4>
          <ul>
            {playedCards.map(({ playerId, card }, i) => (
              <li key={i}>{players.find(p => p.id === playerId)?.name}: {card}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

