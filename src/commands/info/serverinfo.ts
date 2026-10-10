// ============================================
// Liberty City Bot - Server Info Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('عرض معلومات السيرفر'),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: '❌ هذا الأمر يعمل في السيرفر فقط',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const owner = await guild.fetchOwner();

    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
    const members = guild.members.cache;
    const bots = members.filter(m => m.user.bot).size;
    const humans = members.size - bots;

    const onlineMembers = members.filter(m => m.presence?.status !== 'offline').size;

    const embed = new EmbedBuilder()
      .setTitle(`📊 ${guild.name}`)
      .setColor(Colors.primary)
      .setThumbnail(guild.iconURL({ size: 512 }))
      .setFooter({ text: 'Liberty City Bot' })
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 })!);
    }

    embed.addFields(
      {
        name: '👑 المالك',
        value: `${owner}`,
        inline: true,
      },
      {
        name: '🆔 المعرف',
        value: `\`${guild.id}\``,
        inline: true,
      },
      {
        name: '📅 إنشاء السيرفر',
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
        inline: true,
      },
      {
        name: `👥 الأعضاء [${guild.memberCount}]`,
        value: `🟢 ${onlineMembers} متصل | 👤 ${humans} بشر | 🤖 ${bots} بوت`,
        inline: true,
      },
      {
        name: `📁 القنوات [${textChannels + voiceChannels + categories}]`,
        value: `💬 ${textChannels} نصية | 🔊 ${voiceChannels} صوتية | 📂 ${categories} فئات`,
        inline: true,
      },
      {
        name: `🎭 الأدوار [${guild.roles.cache.size}]`,
        value: guild.roles.cache.size > 0
          ? guild.roles.cache
              .filter(r => r.id !== guild.id)
              .sort((a, b) => b.position - a.position)
              .first(5)
              .map(r => r.toString())
              .join(' ') + (guild.roles.cache.size > 6 ? '...' : '')
          : 'لا يوجد',
        inline: true,
      },
      {
        name: '😀 الإيموجيز',
        value: `${guild.emojis.cache.size}/${guild.emojis.cache.filter(e => !e.animated).size + guild.emojis.cache.filter(e => e.animated).size} (${guild.emojis.cache.filter(e => e.animated).size} متحرك)`,
        inline: true,
      },
      {
        name: '💎 البوست',
        value: `المستوى ${guild.premiumTier} (${guild.premiumSubscriptionCount} بوست)`,
        inline: true,
      },
      {
        name: '🔒 التحقق',
        value: getVerificationLevel(guild.verificationLevel),
        inline: true,
      },
      {
        name: '📢 قناة الترحيب',
        value: guild.publicUpdatesChannelId
          ? `<#${guild.publicUpdatesChannelId}>`
          : 'غير محددة',
        inline: true,
      },
    );

    // Add features
    if (guild.features.length > 0) {
      embed.addFields({
        name: '✨ المميزات',
        value: guild.features.map(f => getFeatureName(f)).join(', ').substring(0, 1000),
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

// --------------------------------------------
// Helper Functions
// --------------------------------------------
function getVerificationLevel(level: number): string {
  const levels = ['لا يوجد', 'منخفض', 'متوسط', 'عالي', 'الأعلى'];
  return levels[level] || 'غير معروف';
}

function getFeatureName(feature: string): string {
  const features: Record<string, string> = {
    ANIMATED_ICON: 'أيقونة متحركة',
    BANNER: 'بانر',
    COMMUNITY: 'مجتمع',
    DISCOVERABLE: 'قابل للاكتشاف',
    FEATURABLE: 'مميز',
    INVITE_SPLASH: 'خلفية دعوة',
    MEMBER_VERIFICATION_GATE_ENABLED: 'بوابة تحقق',
    MORE_EMOJI: 'إيموجيز إضافية',
    NEWS: 'أخبار',
    PARTNERED: 'شريك',
    PREVIEW_ENABLED: 'معاينة',
    ROLE_ICONS: 'أيقونات رتب',
    TICKETED_EVENTS_ENABLED: 'فعاليات تذاكر',
    VANITY_URL: 'رابط مخصص',
    VERIFIED: 'موثق',
    VIP_REGIONS: 'مناطق VIP',
  };
  return features[feature] || feature;
}

export default command;