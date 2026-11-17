// ============================================
// Omni Bot - Wheel of Fortune (عجلة الحظ)
// دوّر العجلة كصورة متحركة GIF وشوف ماذا تربح!
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { sleep } from '../../utils/gameUtil';
import { WheelSegmentInput } from '../../utils/wheelOfFortune';
import { renderWheelInWorker } from '../../utils/wheelWorker';

interface Prize {
  name: string;
  /** الاسم الظاهر على العجلة — أحرف لاتينية فقط لأن الاستضافة لا ترسم العربية على الصورة */
  wheel: string;
  weight: number;
  line: string;
}

const PRIZES: Prize[] = [
  { name: 'جوهرة', wheel: 'DIAMOND', weight: 1, line: '🏆 **جاكبوت!** أنت محظوظ اليوم' },
  { name: 'ميدالية ذهبية', wheel: 'GOLD', weight: 3, line: '🔥 رهيب! جائزة نادرة' },
  { name: 'هدية', wheel: 'GIFT', weight: 8, line: '🎉 هدية لطيفة' },
  { name: 'تذكرة', wheel: 'TICKET', weight: 14, line: '🎟️ ربحت تذكرة' },
  { name: 'نجمة', wheel: 'STAR', weight: 18, line: '⭐ نقطة حظ' },
  { name: 'عملة', wheel: 'COIN', weight: 22, line: '🪙 ربحت خمسة ريالات' },
  { name: 'لا شيء', wheel: 'NOTHING', weight: 20, line: '😅 لا شيء هذه المرة' },
  { name: 'دجاجة', wheel: 'CHICKEN', weight: 8, line: '🐔 دجاجة؟ على الأقل شوف!' },
  { name: 'حظ سيء', wheel: 'BAD LUCK', weight: 6, line: '💀 العجلة سرقت فلوسك' },
];

const PRIZE_COLORS = [
  '#dc2626', '#b45309', '#f59e0b', '#16a34a', '#0ea5e9',
  '#f97316', '#475569', '#db2777', '#7c3aed',
];

/** اختيار موزون يُرجع الفهرس — العجلة ستتوقف على نفس القطعة */
function weightedPickIndex(prizes: Prize[]): number {
  const total = prizes.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    roll -= prizes[i].weight;
    if (roll <= 0) return i;
  }
  return prizes.length - 1;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('wheel')
    .setDescription('🍀 عجلة الحظ — دوّرها كصورة متحركة وشوف ماذا تربح!')
    .setDMPermission(false),

  cooldown: 6,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const winIndex = weightedPickIndex(PRIZES);
    const prize = PRIZES[winIndex];

    const segments: WheelSegmentInput[] = PRIZES.map((p, i) => ({
      label: p.wheel,
      color: PRIZE_COLORS[i % PRIZE_COLORS.length],
    }));

    let gifBuffer: Buffer | null = null;
    try {
      // الرندر داخل Worker — GIF لا يتجمّد البوت ولا يستهلك خيطه الرئيسي
      gifBuffer = await renderWheelInWorker(
        {
          title: 'WHEEL OF FATE',
          subtitle: 'SPIN TO WIN',
          segments,
          winnerIndex: winIndex,
          hubText: 'OMNI',
          format: 'gif',
          resultLabel: 'WINNER',
        },
        25000
      );
    } catch (err: any) {
      console.warn(`[Wheel] wheel gif failed: ${err?.message || err}`);
    }

    if (gifBuffer) {
      const file = new AttachmentBuilder(gifBuffer, { name: 'wheel.gif' });
      await interaction.editReply({
        content: `🍀 **عجلة الحظ تدور...** <@${interaction.user.id}> تجهّز؟`,
        files: [file],
      });
      await sleep(2700);
      await interaction.editReply({
        content: `🍀 <@${interaction.user.id}> — النتيجة: **${prize.name}** • ${prize.line}`,
      });
    } else {
      await sleep(1200);
      await interaction.editReply({
        content: `🍀 <@${interaction.user.id}> — النتيجة: **${prize.name}** • ${prize.line}`,
      });
    }
  },
};

export default command;
