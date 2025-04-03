import React, { useState, useEffect } from 'react';
import './Game.css';

const Game = ({ socket, gameId, playerId, isTestMode }) => {
  const [gameState, setGameState] = useState(null);
  const [playerHands, setPlayerHands] = useState({});
  const [currentTrick, setCurrentTrick] = useState([]);
  const [activePlayer, setActivePlayer] = useState(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for game state updates
    socket.on('gameState', (state) => {
      console.log('Received game state:', state);
      setGameState(state);
    });

    // Listen for player hands
    socket.on('playerHand', (hand) => {
      console.log('Received player hand:', hand);
      if (isTestMode) {
        // In test mode, store all players' hands
        setPlayerHands(prevHands => ({
          ...prevHands,
          [hand.playerId]: hand.cards
        }));
      } else {
        // In production mode, only store current player's hand
        if (hand.playerId === playerId) {
          setPlayerHands({ [playerId]: hand.cards });
        }
      }
    });

    // Listen for trick updates
    socket.on('trickUpdate', (trick) => {
      console.log('Trick update:', trick);
      setCurrentTrick(trick);
    });

    // Listen for active player updates
    socket.on('activePlayer', (player) => {
      console.log('Active player:', player);
      setActivePlayer(player);
    });

    return () => {
      socket.off('gameState');
      socket.off('playerHand');
      socket.off('trickUpdate');
      socket.off('activePlayer');
    };
  }, [socket, playerId, isTestMode]);

  const playCard = (card, fromPlayerId) => {
    if (!socket || !gameState) return;
    
    // Check if it's the player's turn
    if (!isTestMode && fromPlayerId !== activePlayer) {
      console.log('Not your turn!');
      return;
    }

    socket.emit('playCard', {
      gameId,
      playerId: fromPlayerId,
      card
    });
  };

  const renderPlayerHand = (hand, pId) => {
    if (!hand) return null;

    return (
      <div className={`player-hand ${pId === activePlayer ? 'active' : ''}`}>
        <h3>{pId === playerId ? 'Deine Karten' : `Spieler ${pId}`}</h3>
        <div className="cards">
          {hand.map((card, index) => (
            <button
              key={`${card.suit}-${card.value}-${index}`}
              className="card"
              onClick={() => playCard(card, pId)}
              disabled={!isTestMode && pId !== playerId}
              data-suit={card.suit}
            >
              {card.suit} {card.value}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderCurrentTrick = () => {
    if (!currentTrick || currentTrick.length === 0) return null;

    return (
      <div className="current-trick">
        <h3>Aktueller Stich</h3>
        <div className="cards">
          {currentTrick.map((play, index) => (
            <div key={index} className="played-card" data-suit={play.card.suit}>
              {play.card.suit} {play.card.value}
              <small>{play.playerId}</small>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!gameState) {
    return <div>Warte auf Spielstart...</div>;
  }

  return (
    <div className="game">
      {renderCurrentTrick()}
      <div className={`hands-container ${isTestMode ? 'test-mode' : ''}`}>
        {isTestMode ? (
          // Test mode: show all hands
          Object.entries(playerHands).map(([pId, hand]) => (
            renderPlayerHand(hand, pId)
          ))
        ) : (
          // Production mode: show only player's hand
          renderPlayerHand(playerHands[playerId], playerId)
        )}
      </div>
    </div>
  );
};

export default Game; 