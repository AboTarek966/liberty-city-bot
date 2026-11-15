import type { OmniClient } from '../OmniClient';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
export interface RoulettePlayer {
    id: string;
    username: string;
    avatarUrl?: string;
    /** true لو ده بوت (مش إنسان) */
    isBot?: boolean;
}
export type RoulettePhase = 'lobby' | 'spinning' | 'choosing' | 'done';
export interface RouletteGame {
    id: string;
    guildId: string;
    channelId: string;
    messageId?: string;
    phase: RoulettePhase;
    players: RoulettePlayer[];
    avatarBuffers: (Buffer | null)[];
    chooserId?: string;
    choiceMessageId?: string;
    choiceTimer?: NodeJS.Timeout;
    startTimer?: NodeJS.Timeout;
}
export declare const rouletteGames: Map<string, RouletteGame>;
export declare const MAX_ROULETTE_PLAYERS = 25;
/** الحد الأدنى لعدد اللاعبين قبل بدأ اللعبة */
export declare const MIN_ROULETTE_PLAYERS = 4;
export declare function lobbyEmbed(game: RouletteGame, startText?: string): EmbedBuilder;
export declare function lobbyRow(game: RouletteGame): ActionRowBuilder<ButtonBuilder>[];
export declare function startRouletteGame(client: OmniClient, gameId: string): Promise<void>;
export declare function runRouletteRound(client: OmniClient, game: RouletteGame): Promise<void>;
export declare function resolveKick(client: OmniClient, game: RouletteGame, targetId: string): Promise<{
    ok: boolean;
    reason?: string;
}>;
export declare function eliminatePlayer(client: OmniClient, game: RouletteGame, targetId: string, reason: 'kick' | 'timeout'): Promise<void>;
/**
 * 🤖 يضيف بوتات السيرفر كمشاركين لتكملة الحد الأدنى 4 لاعبين.
 * يفعل واحد لكل بوت متاح؛ ويرفض لو العدد مكتمل.
 */
export declare function addBotsToLobby(client: any, gameId: string): {
    ok: boolean;
    message: string;
    added: string[];
};
export declare function addToRouletteLobby(gameId: string, player: RoulettePlayer): {
    ok: boolean;
    reason?: string;
    game?: RouletteGame;
};
export declare function removeFromRouletteLobby(gameId: string, userId: string): {
    ok: boolean;
    reason?: string;
    game?: RouletteGame;
};
//# sourceMappingURL=rouletteGame.d.ts.map