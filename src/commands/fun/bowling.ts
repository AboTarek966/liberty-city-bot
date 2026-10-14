// ============================================
// Liberty City Bot - Bowling (بولينغ)
// ثلاث كرات لكسر كل الأعمدة
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { sleep, ratingLine } from '../../utils/gameUtil';

const ROLLS = 3;
const PINS = 10;

function pinsLine(down: number): string {
  return '🔵'.repeat(down) + '⚪'.repeat(PINS - down);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('bowling')
    .setDescription('🎳 بولينغ — ثلاث كرات لكسر الأعمدة العشرة!')
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let down = 0;
    const log: string[] = [];

    await interaction.editReply({ content: `🎳 الملعب: ${pinsLine(0)}` }).catch(() => {});

    for (let roll = 1; roll <= ROLLS && down < PINS; roll++) {
      await sleep(800);
      const remaining = PINS - down;
      const knocked = Math.floor(Math.random() * (remaining + 1));
      down += knocked;

      const note =
        knocked === 10 ? ' **سترايك!**' :
        knocked === 0 ? ' أخطأ تماماً' : '';
      log.push(`كرة ${roll}: ${knocked}${note}`);

      await interaction.editReply({
        content: `🎳 ${log.join(' | ')} • ${pinsLine(down)}`,
      }).catch(() => {});
    }

    const perfect = down === PINS;
    await interaction.editReply({
      content:
        `🎳 <@${interaction.user.id}> — ${log.join(' | ')} • ` +
        `الأعمدة: **${down}/${PINS}** • ${perfect ? '🏆 كلها وقعت!' : ratingLine(down * 10)}`,
    });
  },
};

export default command;
