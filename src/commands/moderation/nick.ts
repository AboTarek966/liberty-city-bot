// ============================================
// Liberty City Bot - Nick Command
// تغيير الاسم المستعار لعضو (يحتاج صلاحية إدارية)
// يُستخدم عبر السلاش أو الاختصار (مثال: "تغييرnick @user الاسم")
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('تغيير الاسم المستعار لعضو (يحتاج إداري)')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد تغيير اسمه')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('nickname')
        .setDescription('الاسم الجديد (اتركه فارغاً لإرجاع الاسم الأصلي)')
        .setRequired(false)
        .setMaxLength(32)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const target = await guild.members.fetch(targetUser.id).catch(() => null);
    if (!target) {
      await interaction.reply({ content: '❌ العضو غير موجود في هذا السيرفر', ephemeral: true });
      return;
    }

    const newNick = interaction.options.getString('nickname')?.trim() || null;

    // 🚫 لا يمكن تغيير اسم البوت نفسه
    if (target.id === interaction.client.user?.id) {
      await interaction.reply({ content: '❌ لا يمكن تغيير اسمي', ephemeral: true });
      return;
    }

    // 🚫 لا يمكن تغيير اسم مالك السيرفر
    if (target.id === guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكن تغيير اسم مالك السيرفر', ephemeral: true });
      return;
    }

    // ⚠️ البوت نفسه يحتاج صلاحية إدارة الأسماء
    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({
        content: '❌ ليس لدي صلاحية **إدارة الأسماء** (Manage Nicknames) — فعّلها من إعدادات الرولات',
        ephemeral: true,
      });
      return;
    }

    // ⚠️ التسلسل الهرمي: رتبة البوت يجب أن تكون أعلى من رتبة الهدف
    if (me.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
      await interaction.reply({
        content: '❌ رتبتي أقل من (أو تساوي) رتبة هذا العضو — ارفع رتبتي أولاً',
        ephemeral: true,
      });
      return;
    }

    // ⚠️ صاحب السيرفر يتجاوز فحص التسلسل، غيره لا يغيّر اسم من رتبته equal أو أعلى
    if (guild.ownerId !== interaction.user.id) {
      const executor = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (executor && executor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
        await interaction.reply({
          content: '❌ لا يمكنك تغيير اسم عضو رتبته equal أو أعلى من رتبتك',
          ephemeral: true,
        });
        return;
      }
    }

    const oldNick = target.nickname || target.user.username;

    try {
      await target.setNickname(newNick, `تغيير الاسم بواسطة ${interaction.user.tag}`);
      const display = newNick || target.user.username;
      await interaction.reply({
        content: `🏷️ تم تغيير اسم **${target.user.tag}**:\n\`${oldNick}\` ← \`${display}\``,
        ephemeral: true,
      });
    } catch (error: any) {
      await interaction.reply({
        content: `❌ فشل تغيير الاسم: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};

export default command;
