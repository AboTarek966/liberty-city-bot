import { LibertyClient } from '../LibertyClient';
export interface GameSession {
    id: string;
    type: 'uno' | 'trivia' | 'wordle' | 'blackjack' | 'connect4';
    guildId: string;
    channelId: string;
    hostId: string;
    players: GamePlayer[];
    status: 'waiting' | 'active' | 'finished' | 'cancelled';
    bet: number;
    pot: number;
    state: any;
    createdAt: Date;
    startedAt?: Date;
    finishedAt?: Date;
    winnerId?: string;
    maxPlayers: number;
    minPlayers: number;
}
export interface GamePlayer {
    userId: string;
    username: string;
    score: number;
    data: any;
    status: 'active' | 'folded' | 'won' | 'lost' | 'draw';
    joinedAt: Date;
}
export interface GameConfig {
    minPlayers: number;
    maxPlayers: number;
    minBet: number;
    maxBet: number;
    allowSpectators: boolean;
    timeoutMs: number;
    rewardMultiplier: number;
    xpReward: number;
}
export declare class GameHandler {
    private client;
    private economyHandler;
    private sessions;
    private playerSessions;
    constructor(client: LibertyClient);
    createSession(type: GameSession['type'], guildId: string, channelId: string, hostId: string, bet?: number): GameSession;
    getSession(sessionId: string): GameSession | undefined;
    getSessionByChannel(channelId: string): GameSession | undefined;
    getPlayerSession(userId: string): GameSession | undefined;
    private getInitialState;
    joinSession(sessionId: string, user: {
        id: string;
        username: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    leaveSession(sessionId: string, userId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    startGame(sessionId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private initializeGame;
    private initializeUno;
    private triviaQuestions;
    private initializeTrivia;
    private wordleWords;
    private initializeWordle;
    private initializeBlackjack;
    private createBlackjackDeck;
    private getCardPoints;
    private shuffleDeck;
    private initializeConnect4;
    private getInitialPlayerData;
    endGame(sessionId: string, winnerId?: string): void;
    private distributeRewards;
    cleanup(): void;
}
export default GameHandler;
//# sourceMappingURL=GameHandler.d.ts.map