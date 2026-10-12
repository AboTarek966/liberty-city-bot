import { ActionRowBuilder, ButtonBuilder } from 'discord.js';
export interface XoGame {
    id: string;
    players: [string, string];
    board: (string | null)[];
    turn: 0 | 1;
    expiresAt: number;
}
export declare function createXoGame(p1: string, p2: string): XoGame;
export declare function getXoGame(id: string): XoGame | null;
export declare function endXoGame(id: string): void;
/** فائز؟ 'X' | 'O' | 'تعادل' | null (اللعبة مستمرة) */
export declare function checkWinner(board: (string | null)[]): string | null;
/** بناء أزرار اللوحة 3×3 */
export declare function renderXoBoard(game: XoGame, gameOver?: boolean): ActionRowBuilder<ButtonBuilder>[];
//# sourceMappingURL=xoGame.d.ts.map