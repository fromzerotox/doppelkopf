// Doppelkopf game logic
const SUITS = {
  HEARTS: 'hearts',
  DIAMONDS: 'diamonds',
  CLUBS: 'clubs',
  SPADES: 'spades'
};

const RANKS = {
  ACE: 'A',
  KING: 'K',
  QUEEN: 'Q',
  JACK: 'J',
  TEN: '10',
  NINE: '9'
};

// Special cards
const DOLLS = [RANKS.ACE, RANKS.TEN];
const TRUMP_CARDS = [
  { suit: SUITS.DIAMONDS, rank: RANKS.JACK },
  { suit: SUITS.HEARTS, rank: RANKS.JACK },
  { suit: SUITS.CLUBS, rank: RANKS.JACK },
  { suit: SUITS.SPADES, rank: RANKS.JACK }
];

class DoppelkopfGame {
  constructor(gameSettings) {
    this.settings = gameSettings;
    this.deck = this.createDeck();
    this.players = [];
    this.currentTrick = [];
    this.currentPlayerIndex = 0;
    this.tricks = [];
    this.scores = {};
    this.gameStarted = false;
  }

  createDeck() {
    const deck = [];
    const suits = Object.values(SUITS);
    const ranks = Object.values(RANKS);

    // Create regular cards
    for (const suit of suits) {
      for (const rank of ranks) {
        // Skip 9s if not playing with nines
        if (!this.settings.playWithNine && rank === RANKS.NINE) continue;
        
        deck.push({ suit, rank });
      }
    }

    // Add special cards based on settings
    if (this.settings.mitSchaf) {
      deck.push({ suit: SUITS.DIAMONDS, rank: RANKS.QUEEN });
    }

    return this.shuffleDeck(deck);
  }

  shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  dealCards() {
    const cardsPerPlayer = Math.floor(this.deck.length / this.players.length);
    const hands = {};
    
    this.players.forEach((player, index) => {
      const start = index * cardsPerPlayer;
      const end = start + cardsPerPlayer;
      hands[player.id] = this.deck.slice(start, end);
    });

    return hands;
  }

  determineTrump(card) {
    // Jacks are always trump
    if (card.rank === RANKS.JACK) return true;
    
    // Queens are trump if playing with sheep
    if (this.settings.mitSchaf && card.rank === RANKS.QUEEN) return true;
    
    // Hearts are trump
    if (card.suit === SUITS.HEARTS) return true;
    
    return false;
  }

  compareCards(card1, card2) {
    // If both are trump
    if (this.determineTrump(card1) && this.determineTrump(card2)) {
      // Compare trump cards
      if (card1.rank === RANKS.JACK && card2.rank === RANKS.JACK) {
        // If both are jacks, compare suits
        const suitOrder = [SUITS.DIAMONDS, SUITS.HEARTS, SUITS.CLUBS, SUITS.SPADES];
        return suitOrder.indexOf(card1.suit) - suitOrder.indexOf(card2.suit);
      }
      if (card1.rank === RANKS.JACK) return 1;
      if (card2.rank === RANKS.JACK) return -1;
      if (card1.rank === RANKS.QUEEN && card2.rank === RANKS.QUEEN) {
        return suitOrder.indexOf(card1.suit) - suitOrder.indexOf(card2.suit);
      }
      if (card1.rank === RANKS.QUEEN) return 1;
      if (card2.rank === RANKS.QUEEN) return -1;
      // Compare hearts
      return 0;
    }
    
    // If only one is trump, it wins
    if (this.determineTrump(card1)) return 1;
    if (this.determineTrump(card2)) return -1;
    
    // If neither is trump, compare suits and ranks
    if (card1.suit !== card2.suit) return 0; // Must follow suit
    const rankOrder = [RANKS.ACE, RANKS.TEN, RANKS.KING, RANKS.QUEEN, RANKS.JACK];
    return rankOrder.indexOf(card2.rank) - rankOrder.indexOf(card1.rank);
  }

  isValidPlay(card, playerHand) {
    // First card of the trick can be any card
    if (this.currentTrick.length === 0) return true;
    
    // Must follow suit if possible
    const leadingSuit = this.currentTrick[0].suit;
    const hasSuit = playerHand.some(c => c.suit === leadingSuit);
    
    if (hasSuit && card.suit !== leadingSuit) return false;
    
    return true;
  }

  playCard(card, playerId) {
    if (!this.isValidPlay(card, this.players.find(p => p.id === playerId).hand)) {
      throw new Error('Invalid play');
    }

    this.currentTrick.push({ card, playerId });
    
    // If trick is complete, determine winner
    if (this.currentTrick.length === this.players.length) {
      const winner = this.determineTrickWinner();
      this.tricks.push({
        cards: [...this.currentTrick],
        winner: winner.playerId
      });
      this.currentTrick = [];
      this.currentPlayerIndex = this.players.findIndex(p => p.id === winner.playerId);
    } else {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }
  }

  determineTrickWinner() {
    let winner = this.currentTrick[0];
    
    for (let i = 1; i < this.currentTrick.length; i++) {
      if (this.compareCards(this.currentTrick[i].card, winner.card) > 0) {
        winner = this.currentTrick[i];
      }
    }
    
    return winner;
  }

  calculateScores() {
    // Initialize scores
    this.players.forEach(player => {
      this.scores[player.id] = 0;
    });

    // Count tricks
    this.tricks.forEach(trick => {
      this.scores[trick.winner]++;
    });

    return this.scores;
  }
}

module.exports = DoppelkopfGame; 