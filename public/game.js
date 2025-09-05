class DurakClient {
    constructor() {
        this.socket = io();
        this.gameState = null;
        this.selectedCard = null;
        this.playerName = '';
        
        this.initializeElements();
        this.setupEventListeners();
        this.setupSocketListeners();
        this.initializeSoundSystem();
        this.initializeThemeSystem();
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
        
        // Statistics elements
        this.playerStatsContainer = document.getElementById('playerStatsContainer');
        this.gamesPlayedEl = document.getElementById('gamesPlayed');
        this.winsEl = document.getElementById('wins');
        this.lossesEl = document.getElementById('losses');
        this.winRateEl = document.getElementById('winRate');

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
        
        // Final statistics elements
        this.finalGamesPlayedEl = document.getElementById('finalGamesPlayed');
        this.finalWinsEl = document.getElementById('finalWins');
        this.finalWinRateEl = document.getElementById('finalWinRate');

        // Chat elements
        this.chatContainer = document.querySelector('.chat-container');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendChatBtn = document.getElementById('sendChatBtn');
        this.toggleChatBtn = document.getElementById('toggleChat');
        this.toggleSoundBtn = document.getElementById('toggleSound');
        this.toggleThemeBtn = document.getElementById('toggleTheme');
        this.chatContent = document.getElementById('chatContent');

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

        // Chat functionality
        this.sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
        this.toggleChatBtn.addEventListener('click', () => this.toggleChat());
        this.toggleSoundBtn.addEventListener('click', () => this.toggleSound());
        this.toggleThemeBtn.addEventListener('click', () => this.toggleTheme());
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

        this.socket.on('playerStats', (stats) => {
            this.updatePlayerStats(stats);
        });

        this.socket.on('chatMessage', (data) => {
            this.displayChatMessage(data.playerName, data.message, data.isOwnMessage);
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
        this.socket.emit('getPlayerStats', name);
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
            // Always add click listener for defense slots
            defenseSlot.addEventListener('click', () => this.defendCard(index));
        }

        return pairElement;
    }

    updatePlayerHand() {
        this.playerHand.innerHTML = '';
        const cardElements = [];
        
        this.gameState.playerHand.forEach(card => {
            const cardElement = this.createCard(card);
            cardElement.addEventListener('click', () => this.selectCard(cardElement, card));
            
            // Highlight cards that can be played
            if (this.canAttack() && this.canPlayCard(card)) {
                cardElement.classList.add('can-attack');
            } else if (this.canDefend()) {
                // Check if this card can defend against any undefended attack on the table
                let canDefendAny = false;
                for (let pair of this.gameState.table) {
                    if (pair.attack && !pair.defense && this.canDefendWith(pair.attack, card)) {
                        canDefendAny = true;
                        break;
                    }
                }
                if (canDefendAny) {
                    cardElement.classList.add('can-defend');
                }
            }
            
            this.playerHand.appendChild(cardElement);
            cardElements.push(cardElement);
        });
        
        // Apply staggered animations to new cards
        if (cardElements.length > 0) {
            this.staggerCardAnimations(cardElements, 50);
        }
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
        this.playSound('cardSelect');

        // If player can attack, try to attack immediately
        if (this.canAttack() && this.canPlayCard(cardData)) {
            this.attackWithCard(cardData);
        } else if (this.canDefend()) {
            // For defense, just select the card and wait for player to click on attack card
            // The card will remain selected until used or another card is selected
            this.updateDefenseSlots();
        }
    }

    attackWithCard(card) {
        // Add played animation to the card before sending
        const selectedCardEl = document.querySelector('.card.selected');
        if (selectedCardEl) {
            this.animateCardPlay(selectedCardEl);
        }
        
        this.socket.emit('attack', { card: card });
        this.selectedCard = null;
        document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
        this.playSound('cardPlace');
    }

    updateDefenseSlots() {
        // Remove previous defense slot highlights
        document.querySelectorAll('.defense-card-slot.can-defend').forEach(slot => {
            slot.classList.remove('can-defend');
        });

        // Highlight defense slots where selected card can be used
        if (this.selectedCard && this.canDefend()) {
            this.gameState.table.forEach((pair, index) => {
                if (pair.attack && !pair.defense && this.canDefendWith(pair.attack, this.selectedCard)) {
                    const defenseSlot = document.querySelector(`.card-pair:nth-child(${index + 1}) .defense-card-slot`);
                    if (defenseSlot) {
                        defenseSlot.classList.add('can-defend');
                    }
                }
            });
        }
    }

    defendCard(attackIndex) {
        if (this.selectedCard && this.canDefend()) {
            const attackCard = this.gameState.table[attackIndex]?.attack;
            if (attackCard && this.canDefendWith(attackCard, this.selectedCard)) {
                this.socket.emit('defend', { 
                    attackIndex: attackIndex, 
                    card: this.selectedCard 
                });
                this.selectedCard = null;
                document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
            }
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
                this.playSound('victory');
            } else {
                this.gameResult.textContent = 'Игра прервана';
                this.gameResult.style.color = '#f39c12';
                this.gameResultText.textContent = 'Соединение с противником потеряно.';
            }
        } else if (result.winner === this.socket.id) {
            this.gameResult.textContent = 'Победа!';
            this.gameResult.style.color = '#27ae60';
            this.gameResultText.textContent = 'Поздравляем! Вы выиграли игру!';
            this.playSound('victory');
        } else if (result.winner) {
            this.gameResult.textContent = 'Поражение';
            this.gameResult.style.color = '#e74c3c';
            this.gameResultText.textContent = `${result.winnerName} выиграл игру.`;
            this.playSound('defeat');
        } else {
            this.gameResult.textContent = 'Ничья';
            this.gameResult.style.color = '#f39c12';
            this.gameResultText.textContent = 'Игра закончилась ничьей.';
        }

        // Update final statistics display
        if (result.winner === this.socket.id && result.winnerStats) {
            this.updateFinalStats(result.winnerStats);
        } else if (result.winner !== this.socket.id && result.loserStats) {
            this.updateFinalStats(result.loserStats);
        }

        setTimeout(() => {
            this.showScreen('gameOverScreen');
        }, 2000);
    }

    playAgain() {
        this.showScreen('loginScreen');
        this.gameState = null;
        this.selectedCard = null;
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

    updatePlayerStats(stats) {
        if (!stats) return;
        
        this.gamesPlayedEl.textContent = stats.gamesPlayed;
        this.winsEl.textContent = stats.wins;
        this.lossesEl.textContent = stats.losses;
        this.winRateEl.textContent = stats.winRate + '%';
        
        // Show stats container if player has played games
        if (stats.gamesPlayed > 0) {
            this.playerStatsContainer.style.display = 'block';
        }
    }

    updateFinalStats(stats) {
        if (!stats) return;
        
        this.finalGamesPlayedEl.textContent = stats.gamesPlayed;
        this.finalWinsEl.textContent = stats.wins;
        this.finalWinRateEl.textContent = stats.winRate + '%';
    }

    sendChatMessage() {
        const message = this.chatInput.value.trim();
        if (message.length === 0) return;
        
        this.socket.emit('chatMessage', message);
        this.chatInput.value = '';
    }

    displayChatMessage(playerName, message, isOwnMessage = false) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${isOwnMessage ? 'own-message' : 'other-message'}`;
        
        const timeEl = document.createElement('span');
        timeEl.className = 'chat-time';
        timeEl.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const nameEl = document.createElement('span');
        nameEl.className = 'chat-name';
        nameEl.textContent = playerName + ':';
        
        const textEl = document.createElement('span');
        textEl.className = 'chat-text';
        textEl.textContent = message;
        
        messageEl.appendChild(timeEl);
        messageEl.appendChild(nameEl);
        messageEl.appendChild(textEl);
        
        this.chatMessages.appendChild(messageEl);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        
        // Play sound for incoming messages (not own messages)
        if (!isOwnMessage) {
            this.playSound('chat');
        }
    }

    toggleChat() {
        const isVisible = this.chatContent.style.display !== 'none';
        if (isVisible) {
            this.chatContent.style.display = 'none';
            this.toggleChatBtn.textContent = '+';
        } else {
            this.chatContent.style.display = 'block';
            this.toggleChatBtn.textContent = '−';
        }
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.toggleSoundBtn.textContent = this.soundEnabled ? '🔊' : '🔇';
        this.toggleSoundBtn.title = this.soundEnabled ? 'Отключить звуки' : 'Включить звуки';
    }

    initializeThemeSystem() {
        // Check for saved theme preference or default to light
        this.isDarkTheme = localStorage.getItem('durak-theme') === 'dark';
        this.applyTheme();
    }

    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        localStorage.setItem('durak-theme', this.isDarkTheme ? 'dark' : 'light');
        this.applyTheme();
    }

    applyTheme() {
        if (this.isDarkTheme) {
            document.body.classList.add('dark-theme');
            this.toggleThemeBtn.textContent = '☀️';
            this.toggleThemeBtn.title = 'Переключить на светлую тему';
        } else {
            document.body.classList.remove('dark-theme');
            this.toggleThemeBtn.textContent = '🌙';
            this.toggleThemeBtn.title = 'Переключить на тёмную тему';
        }
    }

    // Animation helper functions
    animateCardPlay(cardElement) {
        cardElement.classList.add('played');
        setTimeout(() => {
            cardElement.classList.remove('played');
        }, 500);
    }

    animateCardFlip(cardElement) {
        cardElement.style.animation = 'cardFlip 0.6s ease-in-out';
        setTimeout(() => {
            cardElement.style.animation = '';
        }, 600);
    }

    animateInvalidMove(element) {
        element.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    staggerCardAnimations(cards, delay = 100) {
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.animation = 'cardAppear 0.5s ease-out';
            }, index * delay);
        });
    }

    initializeSoundSystem() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.soundEnabled = true;
        } catch (e) {
            console.warn('Web Audio API not supported, sounds disabled');
            this.soundEnabled = false;
        }
    }

    playSound(type) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        // Resume audio context if it's suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Configure sound based on type
        switch (type) {
            case 'cardPlace':
                oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(180, this.audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.15);
                break;
                
            case 'cardSelect':
                oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.1);
                break;
                
            case 'victory':
                // Victory fanfare
                this.playVictoryFanfare();
                return;
                
            case 'defeat':
                oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.5);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.5);
                break;
                
            case 'turnStart':
                oscillator.frequency.setValueAtTime(330, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.2);
                break;
                
            case 'chat':
                oscillator.frequency.setValueAtTime(660, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.03, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.1);
                break;
        }
    }

    playVictoryFanfare() {
        const notes = [262, 330, 392, 523]; // C, E, G, C (major chord)
        notes.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
            }, index * 100);
        });
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new DurakClient();
});