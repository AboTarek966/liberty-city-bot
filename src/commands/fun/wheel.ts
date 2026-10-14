// ============================================
// Liberty City Bot - Wheel of Fortune (عجلة الحظ)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { sleep, weightedPick } from '../../utils/gameUtil';

interface Prize {
  emoji: string;
  name: string;
  weight: number;
  line: string;
}

const PRIZES: Prize[] = [
  { emoji: '💎', name: 'جوهرة', weight: 1, line: '🏆 **جاكبوت!** أنت محظوظ اليوم' },
  { emoji: '🥇', name: 'ميدالية ذهبية', weight: 3, line: '🔥 رهيب! جائزة نادرة' },
  { emoji: '🎁', name: 'هدية', weight: 8, line: '🎉 هدية لطيفة' },
  { emoji: '🎟️', name: 'تذكرة', weight: 14, line: '🎟️ ربحت تذكرة' },
  { emoji: '⭐', name: 'نجمة', weight: 18, line: '⭐ نقطة حظ' },
  { emoji: '🪙', name: 'عملة', weight: 22, line: '🪙 ربحت خمسة ريالات' },
  { emoji: '💤', name: 'لا شيء', weight: 20, line: '😅 لا شيء هذه المرة' },
  { emoji: '🐔', name: 'دجاجة', weight: 8, line: '🐔 دجاجة؟ على الأقل شوف!' },
  { emoji: '😵', name: 'حظ سيء', weight: 6, line: '💀 العجلة سرقت فلوسك' },
];

const SPINNER = ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('wheel')
    .setDescription('🍀 عجلة الحظ — دوّرها وشوف ماذا تربح!')
    .setDMPermission(false),

  cooldown: 6,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const prize = weightedPick(PRIZES);

    // تدوير متحرك — العجلة تتباطأ قبل النتيجة
    for (let i = 0; i < 7; i++) {
      const s = SPINNER[Math.floor(Math.random() * SPINNER.length)];
      await interaction.editReply({ content: `🍀 العجلة تدور... ${s} ${s} ${s}` }).catch(() => {});
      await sleep(450 + i * 130);
    }

    await interaction.editReply({
      content: `🍀 <@${interaction.user.id}> — النتيجة: ${prize.emoji} **${prize.name}** • ${prize.line}`,
    });
  },
};

export default command;
