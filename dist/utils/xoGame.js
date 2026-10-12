"use strict";
// ============================================
// لعبة XO (إكس أو) — حالة مشتركة بين الأمر وزر اللاعبين
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createXoGame = createXoGame;
exports.getXoGame = getXoGame;
exports.endXoGame = endXoGame;
exports.checkWinner = checkWinner;
exports.renderXoBoard = renderXoBoard;
const discord_js_1 = require("discord.js");
const games = new Map();
const GAME_TTL = 3 * 60 * 1000; // 3 دقائق لكل لعبة
function createXoGame(p1, p2) {
    const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const game = {
        id,
        players: [p1, p2],
        board: Array(9).fill(null),
        turn: 0,
        expiresAt: Date.now() + GAME_TTL,
    };
    games.set(id, game);
    return game;
}
function getXoGame(id) {
    const game = games.get(id);
    if (!game)
        return null;
    if (Date.now() > game.expiresAt) {
        games.delete(id);
        return null;
    }
    return game;
}
function endXoGame(id) {
    games.delete(id);
}
/** فائز؟ 'X' | 'O' | 'تعادل' | null (اللعبة مستمرة) */
function checkWinner(board) {
    const LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // صفوف
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // أعمدة
        [0, 4, 8], [2, 4, 6], // قطري
    ];
    for (const [a, b, c] of LINES) {
        if (board[a] && board[a] === board[b] && board[a] === board[c])
            return board[a];
    }
    return board.every(cell => cell) ? 'تعادل' : null;
}
/** بناء أزرار اللوحة 3×3 */
function renderXoBoard(game, gameOver = false) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
        const row = new discord_js_1.ActionRowBuilder();
        for (let c = 0; c < 3; c++) {
            const i = r * 3 + c;
            const v = game.board[i];
            row.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`xo:${game.id}:${i}`)
                .setLabel(v || '·')
                .setStyle(v === 'X' ? discord_js_1.ButtonStyle.Primary : v === 'O' ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Secondary)
                .setDisabled(!!v || gameOver));
        }
        rows.push(row);
    }
    return rows;
}
//# sourceMappingURL=xoGame.js.map