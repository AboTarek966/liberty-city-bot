// ============================================
// Liberty City Bot - Tug of War (سحب الحبل)
// فريقان — الحبل يتحرك حتى يصل أحدهما إلى خط النهاية
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { sleep, shuffle } from '../../utils/gameUtil';

const GOAL = 10; // |-GOAL .. 0 .. +GOAL| — الفريق الأحمر يفوز عند -GOAL

/** شريط الحبل: 🔴 يسار (أ) — 🔵 يمين (ب) */
function ropeLine(pos: number): string {
  const a = Math.max(0, GOAL - pos);
  const b = Math.max(0, GOAL + pos);
  return `🔴${'⬛'.repeat(a)}🔶${'⬛'.repeat(b)}🔵`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('tug')
    .setDescription('🧱 سحب الحبل — فريقان، وحبل واحد لا يرحم!')
    .addUserOption(opt => opt.setName('user').setDescription('مشارك').setRequired(false))
    .addUserOption(opt => opt.setName('user2').setDescription('مشارك ثانٍ').setRequired(false))
    .addUserOption(opt => opt.setName('user3').setDescription('مشارك ثالث').setRequired(false))
    .addUserOption(opt => opt.setName('user4').setDescription('مشارك رابع').setRequired(false))
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const ids: string[] = [];
    for (const key of ['user', 'user2', 'user3', 'user4']) {
      const u = interaction.options.getUser(key) as User | null;
      if (u && !u.bot && !ids.includes(u.id)) ids.push(u.id);
    }
    if (!ids.includes(interaction.user.id)) ids.unshift(interaction.user.id);

    if (ids.length < 2) {
      const members = interaction.guild!.members.cache.filter(m => !m.user.bot && m.id !== interaction.user.id);
      for (const id of shuffle(members.map(m => m.id)).slice(0, 5)) {
        if (!ids.includes(id)) ids.push(id);
        if (ids.length >= 4) break;
      }
    }

    if (ids.length < 2) {
      await interaction.editReply({ content: '❌ سحب الحبل يحتاج لاعبين على الأقل' });
      return;
    }

    const shuffled = shuffle(ids);
    const half = Math.ceil(shuffled.length / 2);
    const teamA = shuffled.slice(0, half);
    const teamB = shuffled.slice(half);
    const line = (members: string[]) => members.map(m => `<@${m}>`).join(' + ');

    let pos = 0;
    const status = (phase: string) =>
      `${phase} • 🔴 **${line(teamA)}** • ${ropeLine(pos)} • **${line(teamB)}** 🔵`;

    await interaction.editReply({ content: status('استعدوا!') }).catch(() => {});
    await sleep(1000);

    let round = 0;
    while (Math.abs(pos) < GOAL && round < 25) {
      round++;
      // قوة السحب تتذبذب — أحياناً ينفلت الحبل فجأة
      const swing = [-3, -2, -1, 1, 2, 3][Math.floor(Math.random() * 6)];
      pos += swing;

      await interaction.editReply({ content: status(`الجولة ${round}`) }).catch(() => {});
      await sleep(750);
    }

    const teamAWin = pos <= -GOAL;
    const winner = teamAWin ? teamA : teamB;
    const winnerEmoji = teamAWin ? '🔴' : '🔵';

    await interaction.editReply({
      content:
        `🏆 ${winnerEmoji} فريق **${teamAWin ? 'الأحمر' : 'الأزرق'}** سحب الحبل! • ` +
        `${line(winner)} • النتيجة النهائية: ${ropeLine(pos)}`,
    }).catch(() => {});
  },
};

export default command;
