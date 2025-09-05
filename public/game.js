class DurakClient {
    constructor() {
        this.socket = io();
        this.gameState = null;
        this.selectedCard = null;
        this.selectedAttackIndex = null;
        this.playerName = '';
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
    }

    initializeElements() {
        // Screens
        this.loginScreen = document.getElementById('loginScreen');
        this.waitingScreen = document.getElementById('waitingScreen');
        this.gameScreen = document.getElementById('gameScreen');
        this.gameOverScreen = document.getElementById('gameOverScreen');

        // Login elements
        this.playerNameInput = document.getElementById('playerName');
        this.joinGameBtn = document.getElementById('joinGameBtn');

        // Game elements
        this.opponentName = document.getElementById('opponentName');
        this.opponentHandCount = document.getElementById('opponentHandCount');
        this.currentPlayerName = document.getElementById('currentPlayerName');
        this.currentPlayerHandCount = document.getElementById('currentPlayerHandCount');
        this.trumpCard = document.getElementById('trumpCard');
        this.deckCount = document.getElementById('deckCount');
        this.tableArea = document.getElementById('tableArea');
        this.playerHand = document.getElementById('playerHand');
        this.gameStatusText = document.getElementById('gameStatusText');
        this.turnIndicator = document.getElementById('turnIndicator');
        this.endTurnBtn = document.getElementById('endTurnBtn');
        this.takeCardsBtn = document.getElementById('takeCardsBtn');

        // Game over elements
        this.gameResult = document.getElementById('gameResult');
        this.gameResultText = document.getElementById('gameResultText');
        this.playAgainBtn = document.getElementById('playAgainBtn');

        // Templates
        this.cardTemplate = document.getElementById('cardTemplate');
        this.tableCardPairTemplate = document.getElementById('tableCardPairTemplate');
    }

    setupEventListeners() {
        // Login
        this.joinGameBtn.addEventListener('click', () => this.joinGame());
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });

        // Game actions
        this.endTurnBtn.addEventListener('click', () => this.endTurn());
        this.takeCardsBtn.addEventListener('click', () => this.takeCards());

        // Play again
        this.playAgainBtn.addEventListener('click', () => this.playAgain());
    }

    setupSocketListeners() {
        this.socket.on('waitingForPlayer', () => {
            this.showScreen('waitingScreen');
        });

        this.socket.on('gameStarted', (gameState) => {
            this.gameState = gameState;
            this.showScreen('gameScreen');
            this.updateGameDisplay();
        });

        this.socket.on('gameState', (gameState) => {
            this.gameState = gameState;
            this.updateGameDisplay();
        });

        this.socket.on('gameUpdate', (update) => {
            this.handleGameUpdate(update);
        });

        this.socket.on('gameEnded', (result) => {
            this.handleGameEnd(result);
        });

        this.socket.on('playerDisconnected', (data) => {
            this.showNotification(`${data.playerName} покинул игру`);
            this.gameStatusText.textContent = `${data.playerName} отключился от игры`;
            
            // Disable all game controls
            this.endTurnBtn.disabled = true;
            this.takeCardsBtn.disabled = true;
            
            // Disable all cards
            document.querySelectorAll('.card').forEach(card => {
                card.classList.add('disabled');
            });
        });

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.gameStatusText.textContent = 'Соединение потеряно...';
        });
    }

    joinGame() {
        const name = this.playerNameInput.value.trim();
        if (name.length < 2) {
            alert('Имя должно содержать минимум 2 символа');
            return;
        }

        this.playerName = name;
        this.socket.emit('joinGame', name);
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }

    updateGameDisplay() {
        if (!this.gameState) return;

        // Update player info
        const opponent = this.gameState.players.find(p => p.id !== this.socket.id);
        if (opponent) {
            this.opponentName.textContent = opponent.name;
            this.opponentHandCount.textContent = `${opponent.handSize} карт`;
        }

        const currentPlayer = this.gameState.players.find(p => p.id === this.socket.id);
        if (currentPlayer) {
            this.currentPlayerName.textContent = this.playerName;
            this.currentPlayerHandCount.textContent = `${currentPlayer.handSize} карт`;
        }

        // Update trump and deck
        this.updateTrumpCard();
        this.deckCount.textContent = this.gameState.deckSize;

        // Update table
        this.updateTable();

        // Update player hand
        this.updatePlayerHand();

        // Update game status
        this.updateGameStatus();

        // Update action buttons
        this.updateActionButtons();
    }

    updateTrumpCard() {
        if (this.gameState.trumpSuit) {
            this.trumpCard.innerHTML = this.getSuitSymbol(this.gameState.trumpSuit);
            this.trumpCard.style.color = this.getSuitColor(this.gameState.trumpSuit);
        }
    }

    updateTable() {
        this.tableArea.innerHTML = '';
        
        this.gameState.table.forEach((pair, index) => {
            const pairElement = this.createTableCardPair(pair, index);
            this.tableArea.appendChild(pairElement);
        });

        if (this.gameState.table.length === 0) {
            this.tableArea.innerHTML = '<div style="color: rgba(255,255,255,0.5); font-size: 1.2em;">Стол пуст</div>';
        }
    }

    createTableCardPair(pair, index) {
        const template = this.tableCardPairTemplate.content.cloneNode(true);
        const pairElement = template.querySelector('.card-pair');
        
        // Attack card
        const attackCard = pairElement.querySelector('.attack-card');
        this.setupCard(attackCard, pair.attack);
        
        // Defense card
        const defenseSlot = pairElement.querySelector('.defense-card-slot');
        if (pair.defense) {
            const defenseCard = this.createCard(pair.defense);
            defenseSlot.appendChild(defenseCard);
            defenseSlot.classList.add('has-card');
        } else {
            // Allow defending if it's player's turn and they're the defender
            if (this.canDefend() && this.selectedCard) {
                defenseSlot.classList.add('can-defend');
                defenseSlot.addEventListener('click', () => this.defendCard(index));
            }
        }

        return pairElement;
    }

    updatePlayerHand() {
        this.playerHand.innerHTML = '';
        
        this.gameState.playerHand.forEach(card => {
            const cardElement = this.createCard(card);
            cardElement.addEventListener('click', () => this.selectCard(cardElement, card));
            
            // Highlight cards that can be played
            if (this.canAttack() && this.canPlayCard(card)) {
                cardElement.classList.add('can-attack');
            } else if (this.canDefend() && this.selectedAttackIndex !== null) {
                const attackCard = this.gameState.table[this.selectedAttackIndex]?.attack;
                if (attackCard && this.canDefendWith(attackCard, card)) {
                    cardElement.classList.add('can-defend');
                }
            }
            
            this.playerHand.appendChild(cardElement);
        });
    }

    createCard(cardData) {
        const template = this.cardTemplate.content.cloneNode(true);
        const card = template.querySelector('.card');
        this.setupCard(card, cardData);
        return card;
    }

    setupCard(cardElement, cardData) {
        cardElement.dataset.suit = cardData.suit;
        cardElement.dataset.rank = cardData.rank;
        
        const rankElement = cardElement.querySelector('.card-rank');
        const suitElement = cardElement.querySelector('.card-suit');
        
        rankElement.textContent = cardData.rank;
        suitElement.style.color = this.getSuitColor(cardData.suit);
        
        // Add trump indicator
        if (cardData.suit === this.gameState.trumpSuit) {
            cardElement.classList.add('trump-card');
        }
    }

    selectCard(cardElement, cardData) {
        // Remove previous selection
        document.querySelectorAll('.card.selected').forEach(card => {
            card.classList.remove('selected');
        });

        // Select new card
        cardElement.classList.add('selected');
        this.selectedCard = cardData;

        // If player can attack, try to attack
        if (this.canAttack() && this.canPlayCard(cardData)) {
            this.attackWithCard(cardData);
        }
    }

    attackWithCard(card) {
        this.socket.emit('attack', { card: card });
        this.selectedCard = null;
        document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
    }

    defendCard(attackIndex) {
        if (this.selectedCard && this.canDefend()) {
            this.socket.emit('defend', { 
                attackIndex: attackIndex, 
                card: this.selectedCard 
            });
            this.selectedCard = null;
            this.selectedAttackIndex = null;
            document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
        }
    }

    endTurn() {
        this.socket.emit('endTurn');
    }

    takeCards() {
        // In Durak, taking cards is the same as ending turn without defending
        this.endTurn();
    }

    updateGameStatus() {
        if (!this.gameState.gameStarted) {
            this.gameStatusText.textContent = 'Игра начинается...';
            return;
        }

        const isAttacker = this.gameState.currentAttacker === this.gameState.players.findIndex(p => p.id === this.socket.id);
        const isDefender = this.gameState.currentDefender === this.gameState.players.findIndex(p => p.id === this.socket.id);

        if (isAttacker) {
            this.gameStatusText.textContent = 'Ваш ход - атакуйте!';
            this.turnIndicator.textContent = 'Выберите карту для атаки';
        } else if (isDefender) {
            this.gameStatusText.textContent = 'Ваш ход - защищайтесь!';
            this.turnIndicator.textContent = 'Выберите карту для защиты или возьмите карты';
        } else {
            this.gameStatusText.textContent = 'Ход противника';
            this.turnIndicator.textContent = 'Ожидайте...';
        }
    }

    updateActionButtons() {
        const isAttacker = this.gameState.currentAttacker === this.gameState.players.findIndex(p => p.id === this.socket.id);
        const isDefender = this.gameState.currentDefender === this.gameState.players.findIndex(p => p.id === this.socket.id);
        
        // End turn button - available for attacker when there are cards on table
        this.endTurnBtn.disabled = !(isAttacker && this.gameState.table.length > 0);
        
        // Take cards button - available for defender when there are undefended cards
        const hasUndefendedCards = this.gameState.table.some(pair => !pair.defense);
        this.takeCardsBtn.disabled = !(isDefender && hasUndefendedCards);
    }

    canAttack() {
        const playerIndex = this.gameState.players.findIndex(p => p.id === this.socket.id);
        return playerIndex === this.gameState.currentAttacker;
    }

    canDefend() {
        const playerIndex = this.gameState.players.findIndex(p => p.id === this.socket.id);
        return playerIndex === this.gameState.currentDefender;
    }

    canPlayCard(card) {
        if (this.gameState.table.length === 0) return true;

        // Must match rank of cards on table
        const tableRanks = [];
        this.gameState.table.forEach(pair => {
            if (pair.attack) tableRanks.push(pair.attack.rank);
            if (pair.defense) tableRanks.push(pair.defense.rank);
        });

        return tableRanks.includes(card.rank);
    }

    canDefendWith(attackCard, defenseCard) {
        // Same suit - higher value
        if (attackCard.suit === defenseCard.suit) {
            return defenseCard.value > attackCard.value;
        }

        // Trump beats non-trump
        if (defenseCard.suit === this.gameState.trumpSuit && attackCard.suit !== this.gameState.trumpSuit) {
            return true;
        }

        return false;
    }

    handleGameUpdate(update) {
        // Add visual feedback for game updates
        if (update.action === 'attack') {
            this.showNotification(`${this.getPlayerName(update.playerId)} атакует картой ${update.card.rank}${this.getSuitSymbol(update.card.suit)}`);
        } else if (update.action === 'defend') {
            this.showNotification(`${this.getPlayerName(update.playerId)} защищается картой ${update.card.rank}${this.getSuitSymbol(update.card.suit)}`);
        }
    }

    handleGameEnd(result) {
        if (result.reason === 'opponent_disconnected') {
            if (result.winner === this.socket.id) {
                this.gameResult.textContent = 'Победа!';
                this.gameResult.style.color = '#27ae60';
                this.gameResultText.textContent = 'Противник покинул игру. Вы выиграли!';
            } else {
                this.gameResult.textContent = 'Игра прервана';
                this.gameResult.style.color = '#f39c12';
                this.gameResultText.textContent = 'Соединение с противником потеряно.';
            }
        } else if (result.winner === this.socket.id) {
            this.gameResult.textContent = 'Победа!';
            this.gameResult.style.color = '#27ae60';
            this.gameResultText.textContent = 'Поздравляем! Вы выиграли игру!';
        } else if (result.winner) {
            this.gameResult.textContent = 'Поражение';
            this.gameResult.style.color = '#e74c3c';
            this.gameResultText.textContent = `${result.winnerName} выиграл игру.`;
        } else {
            this.gameResult.textContent = 'Ничья';
            this.gameResult.style.color = '#f39c12';
            this.gameResultText.textContent = 'Игра закончилась ничьей.';
        }

        setTimeout(() => {
            this.showScreen('gameOverScreen');
        }, 2000);
    }

    playAgain() {
        this.showScreen('loginScreen');
        this.gameState = null;
        this.selectedCard = null;
        this.selectedAttackIndex = null;
    }

    getPlayerName(playerId) {
        const player = this.gameState.players.find(p => p.id === playerId);
        return player ? player.name : 'Игрок';
    }

    getSuitSymbol(suit) {
        const symbols = {
            'hearts': '♥',
            'diamonds': '♦',
            'clubs': '♣',
            'spades': '♠'
        };
        return symbols[suit] || suit;
    }

    getSuitColor(suit) {
        return (suit === 'hearts' || suit === 'diamonds') ? '#e74c3c' : '#333';
    }

    showNotification(message) {
        // Simple notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 1em;
            max-width: 300px;
            backdrop-filter: blur(10px);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DurakClient();
});