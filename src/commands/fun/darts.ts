// ============================================
// Liberty City Bot - Darts (رمي السهم)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { sleep, ratingLine } from '../../utils/gameUtil';

/** رمية واحدة على لوح السهم — الوزن يحاكي المسافة عن المركز */
function throwDart(): { score: number; label: string } {
  const r = Math.random();
  if (r < 0.06) return { score: 50, label: '🎯 في القلب!' };
  if (r < 0.16) return { score: 25, label: '🎯 بول خارجي' };
  const n = 1 + Math.floor(Math.random() * 20);
  if (r < 0.34) return { score: n * 3, label: `×3 → ${n}` };
  if (r < 0.56) return { score: n * 2, label: `×2 → ${n}` };
  return { score: n, label: `${n}` };
}

const ATTEMPTS = 3;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('darts')
    .setDescription('🎯 رمي السهم — ثلاث رميات، من يصل إلى القلب؟')
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const rounds: string[] = [];
    let total = 0;

    for (let i = 0; i < ATTEMPTS; i++) {
      await interaction.editReply({ content: `🎯 الرمية ${i + 1}/${ATTEMPTS}... ${rounds.join(' | ') || ''}` }).catch(() => {});
      await sleep(750);
      const d = throwDart();
      total += d.score;
      rounds.push(`${d.label} = **${d.score}**`);
    }

    await interaction.editReply({
      content:
        `🎯 <@${interaction.user.id}> — ${rounds.join(' | ')} • ` +
        `المجموع: **${total}** • ${ratingLine(Math.round((total / 200) * 100))}`,
    });
  },
};

export default command;
