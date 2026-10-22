// ============================================
// Liberty City Bot - Lock Command (قفل/فتح الروم)
// تبديل: ضغطة تقفل الروم الحالي (الكتابة للجميع ممنوعة
// ما عدا من معه أدنمنستريتر) وضغطة تفتحه مرة ثانية
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
    .setDescription('قفل/فتح الروم الحالي — القفل يمنع الكتابة للجميع ما عدا الإدارة')
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

    try {
      if (isLocked) {
        // 🔓 فتح — إزالة منع الكتابة (يستعيد الإعداد الطبيعي للرومة)
        await channel.permissionOverwrites.edit(
          everyone,
          { SendMessages: null, SendMessagesInThreads: null, AddReactions: null },
          { reason: `فتح الروم بواسطة ${interaction.user.tag}` }
        );
        await interaction.reply(`🔓 تم فتح ${channel} — الكتابة متاحة للجميع مرة ثانية`);
      } else {
        // 🔒 قفل — منع @everyone من الكتابة (من معه أدنمنستريتر يتجاوز القفل تلقائياً)
        await channel.permissionOverwrites.edit(
          everyone,
          { SendMessages: false, SendMessagesInThreads: false, AddReactions: false },
          { reason: `قفل الروم بواسطة ${interaction.user.tag}` }
        );
        await interaction.reply(
          `🔒 تم قفل ${channel} — الكتابة ممنوعة للجميع **ما عدا الإدارة (أدنمنستريتر)**\nاكتب الأمر مرة ثانية أو استخدم الاختصار لفتحه`
        );
      }
    } catch (error: any) {
      await interaction.reply({
        content: `❌ فشل تغيير صلاحيات الرومة: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
