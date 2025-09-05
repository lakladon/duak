const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const games = new Map();
const waitingPlayers = [];
const playerStats = new Map(); // Store player statistics

// Durak game class
class DurakGame {
    constructor(gameId) {
        this.gameId = gameId;
        this.players = [];
        this.deck = this.createDeck();
        this.trumpSuit = null;
        this.currentAttacker = 0;
        this.currentDefender = 1;
        this.table = [];
        this.gameStarted = false;
        this.gameEnded = false;
        this.winner = null;
    }

    createDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
        const deck = [];

        for (let suit of suits) {
            for (let rank of ranks) {
                deck.push({
                    suit: suit,
                    rank: rank,
                    value: this.getCardValue(rank)
                });
            }
        }

        return this.shuffleDeck(deck);
    }

    getCardValue(rank) {
        const values = { '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
        return values[rank];
    }

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    addPlayer(playerId, playerName) {
        if (this.players.length < 2) {
            this.players.push({
                id: playerId,
                name: playerName,
                hand: [],
                isConnected: true
            });
            return true;
        }
        return false;
    }

    startGame() {
        if (this.players.length === 2) {
            // Deal 6 cards to each player
            for (let i = 0; i < 6; i++) {
                this.players[0].hand.push(this.deck.pop());
                this.players[1].hand.push(this.deck.pop());
            }

            // Set trump suit (last card in deck)
            this.trumpSuit = this.deck[0].suit;
            this.gameStarted = true;

            return true;
        }
        return false;
    }

    canAttack(playerId, card) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentAttacker) return false;

        // First attack - any card
        if (this.table.length === 0) return true;

        // Subsequent attacks - must match rank of cards on table
        const tableRanks = this.table.map(pair => pair.attack?.rank).filter(Boolean);
        const defenseRanks = this.table.map(pair => pair.defense?.rank).filter(Boolean);
        const allRanks = [...tableRanks, ...defenseRanks];

        return allRanks.includes(card.rank);
    }

    canDefend(playerId, attackCard, defenseCard) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        if (playerIndex !== this.currentDefender) return false;

        // Same suit - higher value
        if (attackCard.suit === defenseCard.suit) {
            return defenseCard.value > attackCard.value;
        }

        // Trump beats non-trump
        if (defenseCard.suit === this.trumpSuit && attackCard.suit !== this.trumpSuit) {
            return true;
        }

        return false;
    }

    attack(playerId, card) {
        if (!this.canAttack(playerId, card)) return false;

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        const cardIndex = this.players[playerIndex].hand.findIndex(c => 
            c.suit === card.suit && c.rank === card.rank
        );

        if (cardIndex === -1) return false;

        // Remove card from hand and add to table
        this.players[playerIndex].hand.splice(cardIndex, 1);
        this.table.push({ attack: card, defense: null });

        return true;
    }

    defend(playerId, attackIndex, defenseCard) {
        const attack = this.table[attackIndex];
        if (!attack || attack.defense || !this.canDefend(playerId, attack.attack, defenseCard)) {
            return false;
        }

        const playerIndex = this.players.findIndex(p => p.id === playerId);
        const cardIndex = this.players[playerIndex].hand.findIndex(c => 
            c.suit === defenseCard.suit && c.rank === defenseCard.rank
        );

        if (cardIndex === -1) return false;

        // Remove card from hand and add to table
        this.players[playerIndex].hand.splice(cardIndex, 1);
        this.table[attackIndex].defense = defenseCard;

        return true;
    }

    endTurn() {
        const allDefended = this.table.every(pair => pair.defense !== null);

        if (allDefended) {
            // All attacks defended - clear table, defender becomes attacker
            this.table = [];
            [this.currentAttacker, this.currentDefender] = [this.currentDefender, this.currentAttacker];
        } else {
            // Some attacks not defended - defender takes all cards
            const cardsToTake = [];
            this.table.forEach(pair => {
                cardsToTake.push(pair.attack);
                if (pair.defense) cardsToTake.push(pair.defense);
            });

            this.players[this.currentDefender].hand.push(...cardsToTake);
            this.table = [];

            // Attacker remains the same, find new defender
            this.currentDefender = (this.currentDefender + 1) % this.players.length;
            if (this.currentDefender === this.currentAttacker) {
                this.currentDefender = (this.currentDefender + 1) % this.players.length;
            }
        }

        // Deal cards to maintain 6 in hand (if deck has cards)
        this.dealCards();

        // Check for game end
        this.checkGameEnd();
    }

    dealCards() {
        // Deal to attacker first, then defender
        const dealOrder = [this.currentAttacker, this.currentDefender];
        
        for (let playerIndex of dealOrder) {
            while (this.players[playerIndex].hand.length < 6 && this.deck.length > 0) {
                this.players[playerIndex].hand.push(this.deck.pop());
            }
        }
    }

    checkGameEnd() {
        // Game ends when a player has no cards and deck is empty
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].hand.length === 0 && this.deck.length === 0) {
                this.gameEnded = true;
                this.winner = this.players[i].id;
                return;
            }
        }

        // If only one player has cards left, they are the durak (fool)
        const playersWithCards = this.players.filter(p => p.hand.length > 0);
        if (playersWithCards.length === 1 && this.deck.length === 0) {
            this.gameEnded = true;
            this.winner = this.players.find(p => p.hand.length === 0)?.id || null;
        }
    }

    getGameState(playerId) {
        const playerIndex = this.players.findIndex(p => p.id === playerId);
        const opponent = this.players.find(p => p.id !== playerId);

        return {
            gameId: this.gameId,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                handSize: p.hand.length,
                isConnected: p.isConnected
            })),
            playerHand: playerIndex !== -1 ? this.players[playerIndex].hand : [],
            table: this.table,
            trumpSuit: this.trumpSuit,
            deckSize: this.deck.length,
            currentAttacker: this.currentAttacker,
            currentDefender: this.currentDefender,
            gameStarted: this.gameStarted,
            gameEnded: this.gameEnded,
            winner: this.winner,
            isYourTurn: playerIndex === this.currentAttacker || playerIndex === this.currentDefender
        };
    }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('joinGame', (playerName) => {
        // Add player to waiting list
        waitingPlayers.push({ id: socket.id, name: playerName, socket: socket });

        // If we have 2 players, start a game
        if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift();
            const player2 = waitingPlayers.shift();

            const gameId = `game_${Date.now()}`;
            const game = new DurakGame(gameId);

            game.addPlayer(player1.id, player1.name);
            game.addPlayer(player2.id, player2.name);

            // Join both players to the game room
            player1.socket.join(gameId);
            player2.socket.join(gameId);

            games.set(gameId, game);

            // Start the game
            game.startGame();

            // Send game state to both players
            player1.socket.emit('gameStarted', game.getGameState(player1.id));
            player2.socket.emit('gameStarted', game.getGameState(player2.id));

            console.log(`Game ${gameId} started with players ${player1.name} and ${player2.name}`);
        } else {
            socket.emit('waitingForPlayer');
        }
    });

    socket.on('attack', (data) => {
        const game = findGameByPlayerId(socket.id);
        if (!game) return;

        if (game.attack(socket.id, data.card)) {
            // Broadcast updated game state
            io.to(game.gameId).emit('gameUpdate', {
                playerId: socket.id,
                action: 'attack',
                card: data.card
            });

            // Send updated game state to all players
            game.players.forEach(player => {
                io.to(player.id).emit('gameState', game.getGameState(player.id));
            });
        }
    });

    socket.on('defend', (data) => {
        const game = findGameByPlayerId(socket.id);
        if (!game) return;

        if (game.defend(socket.id, data.attackIndex, data.card)) {
            // Broadcast updated game state
            io.to(game.gameId).emit('gameUpdate', {
                playerId: socket.id,
                action: 'defend',
                attackIndex: data.attackIndex,
                card: data.card
            });

            // Send updated game state to all players
            game.players.forEach(player => {
                io.to(player.id).emit('gameState', game.getGameState(player.id));
            });
        }
    });

    socket.on('endTurn', () => {
        const game = findGameByPlayerId(socket.id);
        if (!game) return;

        game.endTurn();

        // Send updated game state to all players
        game.players.forEach(player => {
            io.to(player.id).emit('gameState', game.getGameState(player.id));
        });

        if (game.gameEnded) {
            // Update player statistics
            const winner = game.players.find(p => p.id === game.winner);
            const loser = game.players.find(p => p.id !== game.winner);
            
            if (winner && loser) {
                updatePlayerStats(winner.name, true);  // Winner
                updatePlayerStats(loser.name, false);  // Loser
            }

            io.to(game.gameId).emit('gameEnded', {
                winner: game.winner,
                winnerName: winner?.name,
                winnerStats: winner ? getPlayerStats(winner.name) : null,
                loserStats: loser ? getPlayerStats(loser.name) : null
            });
        }
    });

    // Get player statistics
    socket.on('getPlayerStats', (playerName) => {
        const stats = getPlayerStats(playerName);
        socket.emit('playerStats', stats);
    });

    // Handle chat messages
    socket.on('chatMessage', (message) => {
        const game = findGameByPlayerId(socket.id);
        if (game) {
            const player = game.players.find(p => p.id === socket.id);
            if (player) {
                // Send message to opponent only
                socket.to(game.gameId).emit('chatMessage', {
                    playerName: player.name,
                    message: message,
                    isOwnMessage: false
                });
                
                // Send back to sender with isOwnMessage flag
                socket.emit('chatMessage', {
                    playerName: player.name,
                    message: message,
                    isOwnMessage: true
                });
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);

        // Remove from waiting players
        const waitingIndex = waitingPlayers.findIndex(p => p.id === socket.id);
        if (waitingIndex !== -1) {
            waitingPlayers.splice(waitingIndex, 1);
        }

        // Handle disconnect in active game
        const game = findGameByPlayerId(socket.id);
        if (game) {
            const player = game.players.find(p => p.id === socket.id);
            if (player) {
                player.isConnected = false;
                
                // End the game when a player disconnects
                game.gameEnded = true;
                const remainingPlayer = game.players.find(p => p.id !== socket.id);
                if (remainingPlayer) {
                    game.winner = remainingPlayer.id;
                    
                    // Update statistics - remaining player wins, disconnected player loses
                    updatePlayerStats(remainingPlayer.name, true);
                    updatePlayerStats(player.name, false);
                }
                
                // Notify remaining player
                socket.to(game.gameId).emit('playerDisconnected', {
                    playerId: socket.id,
                    playerName: player.name
                });
                
                // Send game ended event
                socket.to(game.gameId).emit('gameEnded', {
                    winner: game.winner,
                    winnerName: remainingPlayer?.name,
                    reason: 'opponent_disconnected',
                    winnerStats: remainingPlayer ? getPlayerStats(remainingPlayer.name) : null,
                    loserStats: getPlayerStats(player.name)
                });
                
                // Remove the game after a delay
                setTimeout(() => {
                    games.delete(game.gameId);
                    console.log(`Game ${game.gameId} removed due to player disconnect`);
                }, 5000);
            }
        }
    });
});

function findGameByPlayerId(playerId) {
    for (let game of games.values()) {
        if (game.players.some(p => p.id === playerId)) {
            return game;
        }
    }
    return null;
}

// Player statistics functions
function getPlayerStats(playerName) {
    if (!playerStats.has(playerName)) {
        playerStats.set(playerName, {
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            winRate: 0
        });
    }
    return playerStats.get(playerName);
}

function updatePlayerStats(playerName, won) {
    const stats = getPlayerStats(playerName);
    stats.gamesPlayed++;
    if (won) {
        stats.wins++;
    } else {
        stats.losses++;
    }
    stats.winRate = stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed * 100).toFixed(1) : 0;
    playerStats.set(playerName, stats);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Durak game server running on port ${PORT}`);
});