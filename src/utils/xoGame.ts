// ============================================
// لعبة XO (إكس أو) — حالة مشتركة بين الأمر وزر اللاعبين
// ============================================

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export interface XoGame {
  id: string;
  players: [string, string]; // [لاعب X، لاعب O]
  board: (string | null)[]; // 9 خانات: 'X' | 'O' | null
  turn: 0 | 1;
  expiresAt: number;
}

const games = new Map<string, XoGame>();
const GAME_TTL = 3 * 60 * 1000; // 3 دقائق لكل لعبة

export function createXoGame(p1: string, p2: string): XoGame {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
  const game: XoGame = {
    id,
    players: [p1, p2],
    board: Array(9).fill(null),
    turn: 0,
    expiresAt: Date.now() + GAME_TTL,
  };
  games.set(id, game);
  return game;
}

export function getXoGame(id: string): XoGame | null {
  const game = games.get(id);
  if (!game) return null;
  if (Date.now() > game.expiresAt) {
    games.delete(id);
    return null;
  }
  return game;
}

export function endXoGame(id: string): void {
  games.delete(id);
}

/** فائز؟ 'X' | 'O' | 'تعادل' | null (اللعبة مستمرة) */
export function checkWinner(board: (string | null)[]): string | null {
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // صفوف
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // أعمدة
    [0, 4, 8], [2, 4, 6], // قطري
  ];
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(cell => cell) ? 'تعادل' : null;
}

/** بناء أزرار اللوحة 3×3 */
export function renderXoBoard(game: XoGame, gameOver = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const v = game.board[i];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`xo:${game.id}:${i}`)
          .setLabel(v || '·')
          .setStyle(
            v === 'X' ? ButtonStyle.Primary : v === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary
          )
          .setDisabled(!!v || gameOver)
      );
    }
    rows.push(row);
  }
  return rows;
}
