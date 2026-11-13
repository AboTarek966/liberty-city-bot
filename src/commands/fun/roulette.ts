// ============================================
// Omni Bot - Roulette (روليت)
// يختار شخصاً عشوائياً من المذكورين (أو من الأعضاء النشطين)
// وعجلة الحظ تظهر كصورة متحركة GIF وتستقر على الضحية
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { renderWheelOfFortuneGif, fetchAvatarBuffer, WheelSegmentInput } from '../../utils/wheelOfFortune';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('🔫 لعبة الروليت — عجلة الحظ تختار ضحية عشوائية من المشاركين!')
    .addUserOption(opt =>
      opt.setName('user').setDescription('أول مشارك').setRequired(false)
    )
    .addUserOption(opt => opt.setName('user2').setDescription('مشارك ثانٍ').setRequired(false))
    .addUserOption(opt => opt.setName('user3').setDescription('مشارك ثالث').setRequired(false))
    .addUserOption(opt => opt.setName('user4').setDescription('مشارك رابع').setRequired(false))
    .addUserOption(opt => opt.setName('user5').setDescription('مشارك خامس').setRequired(false))
    .setDMPermission(false),

  cooldown: 8,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    // جمع المشاركين (من المنشونات) أو اختيار عشوائي من الأعضاء
    const players: Array<{ id: string; username: string; avatarUrl?: string }> = [];
    const mentionMap = new Map<string, { id: string; username: string; avatarUrl?: string }>();
    for (const name of ['user', 'user2', 'user3', 'user4', 'user5']) {
      const u = interaction.options.getUser(name);
      if (u && !u.bot && !mentionMap.has(u.id)) {
        mentionMap.set(u.id, {
          id: u.id,
          username: u.username,
          avatarUrl: u.displayAvatarURL({ extension: 'png', size: 64 }),
        });
      }
    }
    players.push(...mentionMap.values());

    if (players.length < 2) {
      const members = interaction.guild!.members.cache.filter(m => !m.user.bot);
      const shuffled = shuffleArray([...members.values()]);
      players.length = 0;
      for (const m of shuffled.slice(0, 5)) {
        players.push({
          id: m.id,
          username: m.user.username,
          avatarUrl: m.user.displayAvatarURL({ extension: 'png', size: 64 }),
        });
      }
    }

    if (players.length < 2) {
      await interaction.editReply({ content: '❌يحتاج الروليت شخصين على الأقل' });
      return;
    }

    // قرار الفائز منذ البداية — العجلة ستتوقف عليه
    const victimIndex = Math.floor(Math.random() * players.length);
    const victim = players[victimIndex];
    const survivors = players.filter((_, i) => i !== victimIndex);

    // حمّل الآفاتارات بالتوازي (مع مهلة قصيرة — لا توقف اللعبة عند الفشل)
    const avatarBuffers = await Promise.all(
      players.map((p) => (p.avatarUrl ? fetchAvatarBuffer(p.avatarUrl) : Promise.resolve(null)))
    );

    const segments: WheelSegmentInput[] = players.map((p, i) => ({
      label: p.username.slice(0, 12),
      image: avatarBuffers[i],
    }));

    const playersLine = players.map(p => `🔘 <@${p.id}>`).join(' • ');

    let gifBuffer: Buffer | null = null;
    try {
      gifBuffer = await renderWheelOfFortuneGif({
        title: 'روليت',
        subtitle: 'من ستصيبه البارودة؟',
        segments,
        winnerIndex: victimIndex,
        hubText: 'OMNI',
      });
    } catch (err: any) {
      // لو فشل التوليد — تكملة اللعبة نصياً بدون الصورة
      console.warn(`[Roulette] wheel gif failed: ${err?.message || err}`);
    }

    if (gifBuffer) {
      const file = new AttachmentBuilder(gifBuffer, { name: 'roulette.gif' });
      await interaction.editReply({
        content: `🔫 **لعبة الروليت!** • المشاركون: ${playersLine}\nالعجلة تدور... 🔊`,
        files: [file],
      });
      // انتظر حتى تنتهي حركة العجلة ثم أعلن النتيجة
      await new Promise(r => setTimeout(r, 2700));
      await interaction.editReply({
        content:
          `🔫 **لعبة الروليت!** • المشاركون: ${playersLine}\n` +
          `💥 البارودة أصابت! 💀 الضحية: <@${victim.id}> • ` +
          `الناجون: ${survivors.map(s => `✅ <@${s.id}>`).join(' • ') || 'لا أحد'} • ` +
          `_جرّب حظك مرة أخرى!_`,
      });
    } else {
      await interaction.editReply({
        content: `🔫 لعبة الروليت! • المشاركون: ${playersLine} • البارودة تدور...`,
      });
      await new Promise(r => setTimeout(r, 1500));
      await interaction.editReply({
        content: `🔫 اللعبة تدور... 🔊 جرررررخ...`,
      }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
      await interaction.editReply({
        content:
          `💥 البارودة أصابت! 💀 الضحية: <@${victim.id}> • ` +
          `الناجون: ${survivors.map(s => `✅ <@${s.id}>`).join(' • ') || 'لا أحد'} • ` +
          `_جرّب حظك مرة أخرى!_`,
      });
    }
  },
};

// خلط عشوائي مبسّط
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default command;
