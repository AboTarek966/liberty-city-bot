// ============================================
// Liberty City Bot - Profile Command (بطاقة العضو)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { UserProfile, Warning } from '../../models';
import { getXpProgress, calculateLevel, formatNumber } from '../../utils/helpers';

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

    // بيانات العرض
    const balance = profile?.balance ?? 0;
    const bank = profile?.bank ?? 0;
    const reputation = profile?.reputation ?? 0;

    const rankText = rank > 0 ? ` • الترتيب \`#${rank}\`` : '';
    const content =
      `👤 **${member.displayName}** — 🏆 المستوى **${level}** (${progress.current}/${progress.next} XP)` +
      ` • 💵 ${formatNumber(balance)} محفظة • 🏦 ${formatNumber(bank)} بنك` +
      ` • ⭐ ${formatNumber(reputation)} سمعة • ⚠️ ${warnCount} تحذير${rankText}`;

    await interaction.editReply({ content });
  },
};

export default command;
