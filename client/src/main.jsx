import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

function App() {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [hand, setHand] = useState([]);
  const [myId, setMyId] = useState("");
  const [turn, setTurn] = useState(null);
  const [playedCards, setPlayedCards] = useState([]);

  useEffect(() => {
    socket.on("connect", () => setMyId(socket.id));
    socket.on("players", setPlayers);
    socket.on("start", (game) => {
      const me = game.players.find(p => p.id === socket.id);
      setHand(me.hand);
      setTurn(game.players[game.currentPlayerIndex].id);
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

  return (
    <div style={{ padding: 20 }}>
      {!joined ? (
        <>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name" />
          <button onClick={handleJoin}>Mitspielen</button>
        </>
      ) : (
        <>
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

