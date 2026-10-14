// ============================================
// Liberty City Bot - Fishing (صيد السمك)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { sleep, weightedPick } from '../../utils/gameUtil';

interface Catch {
  emoji: string;
  name: string;
  weight: number;
  points: number;
  reaction: string;
}

// الوزن يحدد الندرة — الحيتان والقروش نادرة جداً
const CATCHES: Catch[] = [
  { emoji: '🐟', name: 'سمكة صغيرة', weight: 26, points: 5, reaction: 'صيد عادي' },
  { emoji: '🐠', name: 'سمكة ملوّنة', weight: 18, points: 12, reaction: 'جميلة!' },
  { emoji: '🐡', name: 'سمكة منفخة', weight: 14, points: 18, reaction: 'انتبه لا تنفخ!' },
  { emoji: '🦐', name: 'جمبري', weight: 12, points: 10, reaction: 'شهي مع الرز' },
  { emoji: '🦑', name: 'حبار', weight: 10, points: 25, reaction: 'يلوّث الماء!' },
  { emoji: '🦀', name: 'سلطعون', weight: 8, points: 30, reaction: 'يمسكك بمخالبه' },
  { emoji: '👢', name: 'حذاء قديم', weight: 5, points: 1, reaction: 'محد طلبها' },
  { emoji: '🥫', name: 'علبة صدئة', weight: 4, points: 0, reaction: 'أثره من قديم' },
  { emoji: '🐬', name: 'دولفين', weight: 3, points: 70, reaction: 'رفيق البحار!' },
  { emoji: '🦈', name: 'قرش!', weight: 1.5, points: 150, reaction: 'ارجع للقارب بسرعة!' },
  { emoji: '🐋', name: 'حوت أزرق', weight: 0.5, points: 400, reaction: 'أضخم كائن على الأرض!' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('🎣 صيد السمك — ارمِ الطعم وشوف ماذا تُصطاد اليوم!')
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    await interaction.editReply({ content: '🎣 رميت الطعم في الماء...' }).catch(() => {});
    await sleep(850);
    await interaction.editReply({ content: '🎣 الحبل يهتز! شيء أمسك الطعم...' }).catch(() => {});
    await sleep(850);

    const c = weightedPick(CATCHES);
    await interaction.editReply({
      content:
        `${c.emoji} **${c.name}** — ${c.reaction} • ` +
        `نقاط: **${c.points}** • <@${interaction.user.id}> ${c.points >= 100 ? '⚡' : '🎣'}`,
    });
  },
};

export default command;
