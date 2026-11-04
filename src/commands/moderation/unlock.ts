// ============================================
// Omni Bot - Unlock Command (فتح الروم)
// يفتح الروم الحالي فقط — لا يقفله.
// للقفل استخدم /lock أو اختصاره المستقل.
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('فتح الروم الحالي — إعادة الكتابة للجميع')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageChannels],

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel as any;

    if (
      !channel ||
      !('permissionOverwrites' in channel) ||
      ![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channel.type)
    ) {
      await interaction.reply({
        content: '❌ هذا الأمر يعمل فقط في قنوات نصية/إعلان/منتدى',
        ephemeral: true,
      });
      return;
    }

    const everyone = interaction.guild!.roles.everyone;
    const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
    const isLocked = overwrite ? overwrite.deny.has(PermissionFlagsBits.SendMessages) : false;

    if (!isLocked) {
      await interaction.reply({
        content: `🔓 ${channel} مفتوح بالفعل — استخدم \`/lock\` لقفله`,
        ephemeral: true,
      });
      return;
    }

    try {
      // 🔓 فتح — إزالة منع الكتابة (يستعيد الإعداد الطبيعي للروم)
      await channel.permissionOverwrites.edit(
        everyone,
        { SendMessages: null, SendMessagesInThreads: null, AddReactions: null },
        { reason: `فتح الروم بواسطة ${interaction.user.tag}` }
      );
      await interaction.reply(`🔓 تم فتح ${channel} — الكتابة متاحة للجميع مرة ثانية`);
    } catch (error: any) {
      await interaction.reply({
        content: `❌ فشل فتح الروم: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
