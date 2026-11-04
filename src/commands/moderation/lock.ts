// ============================================
// Liberty City Bot - Lock Command (قفل الروم)
// يقفل الروم الحالي فقط — لا يفتحه.
// لفتح الروم استخدم /unlock أو اختصاره المستقل.
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
    .setName('lock')
    .setDescription('قفل الروم الحالي — منع الكتابة للجميع ما عدا الإدارة')
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

    if (isLocked) {
      await interaction.reply({
        content: `🔒 ${channel} مقفول بالفعل — استخدم \`/unlock\` لفتحه`,
        ephemeral: true,
      });
      return;
    }

    try {
      // 🔒 قفل — منع @everyone من الكتابة (من معه أدنمنستريتر يتجاوز القفل تلقائياً)
      await channel.permissionOverwrites.edit(
        everyone,
        { SendMessages: false, SendMessagesInThreads: false, AddReactions: false },
        { reason: `قفل الروم بواسطة ${interaction.user.tag}` }
      );
      await interaction.reply(
        `🔒 تم قفل ${channel} — الكتابة ممنوعة للجميع **ما عدا الإدارة (أدنمنستريتر)**\nلفتحه استخدم \`/unlock\``
      );
    } catch (error: any) {
      await interaction.reply({
        content: `❌ فشل قفل الروم: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
