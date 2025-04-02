import React, { useState, useEffect } from 'react';

function GameView({ socket, gameState, myId }) {
  const [cards, setCards] = useState([]);
  const [currentTrick, setCurrentTrick] = useState([]);
  const [scores, setScores] = useState([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('gameStarted', (data) => {
      setCards(data.cards);
      setScores(new Array(4).fill(0));
    });

    socket.on('trickPlayed', (data) => {
      setCurrentTrick(data.trick);
      setScores(data.scores);
    });

    return () => {
      socket.off('gameStarted');
      socket.off('trickPlayed');
    };
  }, [socket]);

  const playCard = (cardIndex) => {
    if (!gameState || gameState.currentPlayer !== gameState.players.findIndex(p => p.id === myId)) {
      return;
    }

    const card = cards[cardIndex];
    socket.emit('playCard', {
      gameId: gameState.gameId,
      card: card
    });

    // Remove played card from hand
    setCards(prevCards => prevCards.filter((_, index) => index !== cardIndex));
  };

  const getCardColor = (card) => {
    const suit = card.suit;
    switch (suit) {
      case 'hearts': return '#ff0000';
      case 'diamonds': return '#ff0000';
      case 'clubs': return '#000000';
      case 'spades': return '#000000';
      default: return '#000000';
    }
  };

  const getCardSymbol = (card) => {
    const suit = card.suit;
    switch (suit) {
      case 'hearts': return '♥';
      case 'diamonds': return '♦';
      case 'clubs': return '♣';
      case 'spades': return '♠';
      default: return '';
    }
  };

  return (
    <div className="game-view">
      <div className="game-info">
        <div className="scores">
          {scores.map((score, index) => (
            <div key={index} className="player-score">
              {gameState.players[index].name}: {score}
            </div>
          ))}
        </div>
      </div>

      <div className="current-trick">
        {currentTrick.map((card, index) => (
          <div key={index} className="played-card">
            <span style={{ color: getCardColor(card) }}>
              {card.value} {getCardSymbol(card)}
            </span>
          </div>
        ))}
      </div>

      <div className="player-hand">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`card ${gameState.currentPlayer === gameState.players.findIndex(p => p.id === myId) ? 'playable' : ''}`}
            onClick={() => playCard(index)}
          >
            <span style={{ color: getCardColor(card) }}>
              {card.value} {getCardSymbol(card)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default GameView; 