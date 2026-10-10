// ============================================
// Liberty City Bot - Profile Command (بطاقة العضو)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { UserProfile, Warning } from '../../models';
import { getXpProgress, calculateLevel, formatDuration, formatNumber } from '../../utils/helpers';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('👤 عرض بطاقة العضو — المستوى، الرصيد، الإنجازات')
    .addUserOption(option =>
      option.setName('user').setDescription('العضو (افتراضياً: أنت)').setRequired(false)
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user') || interaction.user;

    await interaction.deferReply();

    const member: GuildMember | null =
      interaction.guild!.members.cache.get(target.id) ||
      (await interaction.guild!.members.fetch(target.id).catch(() => null));

    if (!member) {
      await interaction.editReply({ content: '❌ لم يتم العثور على العضو في السيرفر' });
      return;
    }

    // بيانات المستخدم
    const [profile, warnCount, rank] = await Promise.all([
      UserProfile.findOne({ userId: target.id, guildId: interaction.guildId! }),
      Warning.countDocuments({ userId: target.id, guildId: interaction.guildId! }).catch(() => 0),
      client.levelingHandler.getRank(target.id, interaction.guildId!),
    ]);

    const xp = profile?.xp || 0;
    const level = calculateLevel(xp);
    const progress = getXpProgress(xp);

    // شريط التقدم
    const filled = Math.round(progress.progress / 10);
    const bar = '█'.repeat(filled) + '▒'.repeat(10 - filled);

    // إنشاء ملف شخصي جديد في العرض إن لم يوجد (بدون كتابة في القاعدة)
    const balance = profile?.balance ?? 0;
    const bank = profile?.bank ?? 0;
    const messagesSent = profile?.messagesSent ?? 0;
    const voiceTime = profile?.voiceTime ?? 0; // بالدقائق
    const reputation = profile?.reputation ?? 0;

    const joinedAt = member.joinedTimestamp
      ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
      : 'غير معروف';
    const createdAt = `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`;

    // أعلى رتبة
    const topRole =
      member.roles.cache
        .filter(r => r.id !== interaction.guildId)
        .sort((a, b) => b.position - a.position)
        .first()?.toString() || 'بدون رتب';

    const color = member.displayHexColor !== '#000000' ? member.displayHexColor : '#00D4FF';

    const embed = new EmbedBuilder()
      .setTitle(`👤 بطاقة ${member.displayName}`)
      .setColor(color)
      .setThumbnail(member.displayAvatarURL({ size: 256 }))
      .setDescription(
        `> ${topRole}\n` +
          `> ${target.bot ? '🤖 بوت' : '✅ عضو'} • \`#${rank > 0 ? rank : '—'}\` في الترتيب`
      )
      .addFields(
        {
          name: '🏆 المستوى',
          value: `**${level}**\n\`${bar}\` ${progress.current}/${progress.next} XP`,
          inline: true,
        },
        {
          name: '💰 الرصيد',
          value: `💵 المحفظة: **${formatNumber(balance)}**\n🏦 البنك: **${formatNumber(bank)}**`,
          inline: true,
        },
        {
          name: '📊 النشاط',
          value: `💬 الرسائل: **${formatNumber(messagesSent)}**\n⏱️ الصوت: **${formatDuration(voiceTime * 60000, { compact: true })}**`,
          inline: true,
        },
        {
          name: '⭐ السمعة',
          value: `**${formatNumber(reputation)}**`,
          inline: true,
        },
        {
          name: '⚠️ التحذيرات',
          value: `**${warnCount}**`,
          inline: true,
        },
        {
          name: '📅 التاريخ',
          value: `📥 انضم: ${joinedAt}\n🎂 الحساب: ${createdAt}`,
          inline: false,
        }
      )
      .setFooter({ text: `ID: ${target.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
