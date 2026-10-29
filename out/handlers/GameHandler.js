"use strict";
// ============================================
// Liberty City Bot - Game Handler
// ============================================
// إدارة الألعاب الجماعية: UNO، Trivia، Wordle، Blackjack، Connect4
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameHandler = void 0;
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('GameHandler');
const DEFAULT_CONFIGS = {
    uno: { minPlayers: 2, maxPlayers: 10, minBet: 0, maxBet: 100000, allowSpectators: true, timeoutMs: 300000, rewardMultiplier: 1.5, xpReward: 50 },
    trivia: { minPlayers: 1, maxPlayers: 20, minBet: 0, maxBet: 50000, allowSpectators: true, timeoutMs: 60000, rewardMultiplier: 2, xpReward: 30 },
    wordle: { minPlayers: 1, maxPlayers: 1, minBet: 0, maxBet: 10000, allowSpectators: false, timeoutMs: 300000, rewardMultiplier: 3, xpReward: 40 },
    blackjack: { minPlayers: 1, maxPlayers: 7, minBet: 100, maxBet: 50000, allowSpectators: true, timeoutMs: 60000, rewardMultiplier: 2.5, xpReward: 35 },
    connect4: { minPlayers: 2, maxPlayers: 2, minBet: 0, maxBet: 100000, allowSpectators: true, timeoutMs: 300000, rewardMultiplier: 2, xpReward: 40 },
};
class GameHandler {
    client;
    economyHandler;
    sessions = new Map();
    playerSessions = new Map(); // userId -> sessionId
    constructor(client) {
        this.client = client;
        this.economyHandler = client.economyHandler;
    }
    // ============================================
    // Core Session Management
    // ============================================
    createSession(type, guildId, channelId, hostId, bet = 0) {
        const config = DEFAULT_CONFIGS[type];
        const session = {
            id: `${type}-${guildId}-${channelId}-${Date.now()}`,
            type,
            guildId,
            channelId,
            hostId,
            players: [],
            status: 'waiting',
            bet,
            pot: 0,
            state: this.getInitialState(type),
            createdAt: new Date(),
            maxPlayers: config.maxPlayers,
            minPlayers: config.minPlayers,
        };
        this.sessions.set(session.id, session);
        this.playerSessions.set(hostId, session.id);
        return session;
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getSessionByChannel(channelId) {
        for (const session of this.sessions.values()) {
            if (session.channelId === channelId && session.status !== 'finished') {
                return session;
            }
        }
        return undefined;
    }
    getPlayerSession(userId) {
        const sessionId = this.playerSessions.get(userId);
        return sessionId ? this.sessions.get(sessionId) : undefined;
    }
    getInitialState(type) {
        switch (type) {
            case 'uno':
                return { deck: [], discardPile: [], currentPlayerIndex: 0, direction: 1, currentColor: null, drawStack: 0, unoCalled: false };
            case 'trivia':
                return { currentQuestion: null, questionIndex: 0, answers: {}, scores: {} };
            case 'wordle':
                return { targetWord: '', guesses: [], maxGuesses: 6 };
            case 'blackjack':
                return { deck: [], dealerHand: [], currentPlayerIndex: 0, phase: 'betting' };
            case 'connect4':
                return { board: Array(6).fill(null).map(() => Array(7).fill(null)), currentPlayer: 0, winner: null };
        }
        return {};
    }
    async joinSession(sessionId, user) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return { success: false, message: 'الجلسة غير موجودة' };
        if (session.status !== 'waiting')
            return { success: false, message: 'اللعبة بدأت بالفعل' };
        if (session.players.length >= session.maxPlayers)
            return { success: false, message: 'اللعبة مكتملة' };
        if (session.players.some(p => p.userId === user.id))
            return { success: false, message: 'أنت منضم بالفعل' };
        const config = DEFAULT_CONFIGS[session.type];
        if (session.bet > 0) {
            const profile = await this.economyHandler.getProfile(session.guildId, user.id);
            if (profile.balance < session.bet) {
                return { success: false, message: `رصيد غير كافي. المطلوب: ${session.bet}` };
            }
        }
        const player = {
            userId: user.id,
            username: user.username,
            score: 0,
            data: this.getInitialPlayerData(session.type),
            status: 'active',
            joinedAt: new Date(),
        };
        session.players.push(player);
        this.playerSessions.set(user.id, sessionId);
        // Deduct bet if any
        if (session.bet > 0) {
            await this.economyHandler.removeBalance(session.guildId, user.id, session.bet, 'balance');
            session.pot += session.bet;
        }
        return { success: true, message: `انضممت للعبة! (${session.players.length}/${session.maxPlayers})` };
    }
    async leaveSession(sessionId, userId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return { success: false, message: 'الجلسة غير موجودة' };
        if (session.status !== 'waiting')
            return { success: false, message: 'لا يمكن المغادرة بعد بدء اللعبة' };
        const playerIndex = session.players.findIndex(p => p.userId === userId);
        if (playerIndex === -1)
            return { success: false, message: 'أنت غير منضم' };
        const player = session.players[playerIndex];
        session.players.splice(playerIndex, 1);
        this.playerSessions.delete(userId);
        // Refund bet if any
        if (session.bet > 0) {
            await this.economyHandler.addBalance(session.guildId, userId, session.bet, 'balance');
            session.pot -= session.bet;
        }
        return { success: true, message: 'غادرت اللعبة. تم استرداد رهانك.' };
    }
    async startGame(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return { success: false, message: 'الجلسة غير موجودة' };
        if (session.status !== 'waiting')
            return { success: false, message: 'اللعبة ليست في انتظار' };
        if (session.players.length < session.minPlayers)
            return { success: false, message: `يحتاج ${session.minPlayers} لاعبين على الأقل` };
        session.status = 'active';
        session.startedAt = new Date();
        this.initializeGame(session);
        return { success: true, message: 'بدأت اللعبة!' };
    }
    initializeGame(session) {
        switch (session.type) {
            case 'uno':
                this.initializeUno(session);
                break;
            case 'trivia':
                this.initializeTrivia(session);
                break;
            case 'wordle':
                this.initializeWordle(session);
                break;
            case 'blackjack':
                this.initializeBlackjack(session);
                break;
            case 'connect4':
                this.initializeConnect4(session);
                break;
        }
    }
    // ============================================
    // UNO Implementation
    // ============================================
    initializeUno(session) {
        const deck = [];
        // Create deck: 0-9 each color (1 zero, 2 of 1-9), action cards, wilds
        for (const color of ['red', 'blue', 'green', 'yellow']) {
            deck.push({ color, value: '0', type: 'number' });
            for (let i = 1; i <= 9; i++) {
                deck.push({ color, value: String(i), type: 'number' });
                deck.push({ color, value: String(i), type: 'number' });
            }
            ['skip', 'reverse', 'draw2'].forEach(action => {
                deck.push({ color, value: action, type: 'action' });
                deck.push({ color, value: action, type: 'action' });
            });
        }
        // Wild cards
        for (let i = 0; i < 4; i++)
            deck.push({ color: 'wild', value: 'wild', type: 'wild' });
        for (let i = 0; i < 4; i++)
            deck.push({ color: 'wild', value: 'draw4', type: 'wild' });
        // Shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        // Deal 7 cards each
        const state = { deck, discardPile: [], currentPlayerIndex: 0, direction: 1, currentColor: null, drawStack: 0, unoCalled: new Set() };
        session.state = state;
        // Deal 7 cards to each player
        for (const player of session.players) {
            player.data.hand = deck.splice(0, 7);
        }
        // First discard
        state.discardPile.push(deck.pop());
        while (state.discardPile[0].type === 'wild' || state.discardPile[0].type === 'action') {
            deck.push(state.discardPile.pop());
            state.discardPile.push(deck.pop());
        }
    }
    // ============================================
    // Trivia Implementation
    // ============================================
    triviaQuestions = [
        { question: 'ما عاصمة مصر؟', answer: 'القاهرة', category: 'جغرافيا', difficulty: 'easy' },
        { question: 'كم عدد كواكب المجموعة الشمسية؟', answer: '8', category: 'علوم', difficulty: 'easy' },
        { question: 'من رسم الموناليزا؟', answer: 'ليوناردو دافنشي', category: 'فن', difficulty: 'medium' },
        { question: 'ما أكبر محيط في العالم؟', answer: 'المحيط الهادئ', category: 'جغرافيا', difficulty: 'easy' },
        { question: 'في أي سنة هبط الإنسان على القمر؟', answer: '1969', category: 'تاريخ', difficulty: 'medium' },
        { question: 'ما العنصر الكيميائي للذهب؟', answer: 'Au', category: 'علوم', difficulty: 'easy' },
        { question: 'من كتب رواية البؤساء؟', answer: 'فيكتور هوجو', category: 'أدب', difficulty: 'medium' },
        { question: 'ما أسرع حيوان في العالم؟', answer: 'الفهد', category: 'علوم', difficulty: 'easy' },
        { question: 'في أي قارة تقع مصر؟', answer: 'أفريقيا', category: 'جغرافيا', difficulty: 'easy' },
        { question: 'ما أطول نهر في العالم؟', answer: 'نهر النيل', category: 'جغرافيا', difficulty: 'easy' },
        { question: 'من اخترع المصباح الكهربائي؟', answer: 'توماس إديسون', category: 'علوم', difficulty: 'medium' },
        { question: 'ما عاصمة اليابان؟', answer: 'طوكيو', category: 'جغرافيا', difficulty: 'easy' },
        { question: 'ما أكبر دولة في العالم مساحة؟', answer: 'روسيا', category: 'جغرافيا', difficulty: 'easy' },
        { question: 'كم عدد أضلاع المثلث؟', answer: '3', category: 'رياضيات', difficulty: 'easy' },
        { question: 'ما الغاز الذي نتنفسه؟', answer: 'الأكسجين', category: 'علوم', difficulty: 'easy' },
    ];
    initializeTrivia(session) {
        // Shuffle questions
        const questions = [...this.triviaQuestions].sort(() => Math.random() - 0.5);
        session.state = {
            questions: questions.slice(0, 10),
            currentIndex: 0,
            scores: {},
            answered: new Set(),
            timeLeft: 30
        };
        // Initialize scores
        for (const player of session.players) {
            session.state.scores[player.userId] = 0;
        }
    }
    // ============================================
    // Wordle Implementation
    // ============================================
    wordleWords = [
        'كتاب', 'قلم', 'مدرسة', 'منزل', 'حديقة', 'شجرة', 'نهر', 'بحر', 'جبل', 'سماء',
        'شمس', 'قمر', 'نجمة', 'سحابة', 'مطر', 'ثلج', 'رياح', 'نار', 'ماء', 'هواء',
        'تفاح', 'موز', 'برتقال', 'عنب', 'بطيخ', 'فراولة', 'تفاح', 'كمثرى', 'تين', 'بلح',
        'سيارة', 'قطار', 'طائرة', 'سفينة', 'دراجة', 'حافلة', 'شاحنة', 'دراجة', 'مترو', 'ترام'
    ];
    initializeWordle(session) {
        const word = this.wordleWords[Math.floor(Math.random() * this.wordleWords.length)];
        session.state = { targetWord: word, guesses: [], maxGuesses: 6, gameOver: false, won: false };
    }
    // ============================================
    // Blackjack Implementation
    // ============================================
    initializeBlackjack(session) {
        const deck = this.createBlackjackDeck();
        session.state = {
            deck: this.shuffleDeck(deck),
            dealerHand: [],
            playerHands: {},
            currentPlayerIndex: 0,
            phase: 'betting',
            dealerUpCard: null,
            insuranceOffered: false
        };
        // Initialize player hands
        for (const player of session.players) {
            session.state.playerHands[player.userId] = { cards: [], bet: session.bet, doubled: false, stood: false, busted: false, blackjack: false };
        }
    }
    createBlackjackDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        for (const suit of suits) {
            for (const value of values) {
                deck.push({ suit, value, points: this.getCardPoints(value) });
            }
        }
        return deck;
    }
    getCardPoints(value) {
        if (['J', 'Q', 'K'].includes(value))
            return 10;
        if (value === 'A')
            return 11;
        return parseInt(value);
    }
    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }
    // ============================================
    // Connect4 Implementation
    // ============================================
    initializeConnect4(session) {
        session.state = {
            board: Array(6).fill(null).map(() => Array(7).fill(null)),
            currentPlayer: 0,
            winner: null,
            moves: 0
        };
    }
    // ============================================
    // Player Data Initialization
    // ============================================
    getInitialPlayerData(type) {
        switch (type) {
            case 'uno': return { hand: [] };
            case 'trivia': return { answers: {}, score: 0 };
            case 'wordle': return { guesses: [] };
            case 'blackjack': return { hand: [], bet: 0, doubled: false, stood: false, busted: false, blackjack: false };
            case 'connect4': return { color: null };
        }
        return {};
    }
    // ============================================
    // Cleanup
    // ============================================
    endGame(sessionId, winnerId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return;
        session.status = 'finished';
        session.finishedAt = new Date();
        session.winnerId = winnerId;
        // Clean up player sessions
        for (const player of session.players) {
            this.playerSessions.delete(player.userId);
        }
        // Handle rewards
        if (winnerId) {
            this.distributeRewards(session, winnerId);
        }
        // Clean up after delay
        setTimeout(() => this.sessions.delete(sessionId), 60000);
    }
    async distributeRewards(session, winnerId) {
        const config = DEFAULT_CONFIGS[session.type];
        const winner = session.players.find(p => p.userId === winnerId);
        if (!winner)
            return;
        // Economy rewards
        if (session.bet > 0) {
            await this.economyHandler.addBalance(session.guildId, winnerId, session.pot, 'balance');
        }
        // XP rewards
        const xpGain = Math.floor(config.xpReward * config.rewardMultiplier);
        // TODO: Add XP to leveling system
    }
    // Cleanup expired sessions
    cleanup() {
        const now = Date.now();
        for (const [id, session] of this.sessions.entries()) {
            if (session.status === 'waiting' && now - session.createdAt.getTime() > 300000) { // 5 min
                this.endGame(session.id);
            }
            else if (session.status === 'active' && session.startedAt && now - session.startedAt.getTime() > 3600000) { // 1 hour
                this.endGame(session.id);
            }
        }
    }
}
exports.GameHandler = GameHandler;
exports.default = GameHandler;
//# sourceMappingURL=GameHandler.js.map