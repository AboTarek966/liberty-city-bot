// ============================================
// Liberty City Bot - Settings Command (UI Panel)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { buildPanel } from '../../utils/settingsPanel';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('🎛️ لوحة إعدادات السيرفر — واجهة سهلة وجميلة لكل الإعدادات')
    .setDMPermission(false),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as any;
    const perms = member?.permissions;
    const hasAdminPerms = !!perms && (
      perms.has(PermissionFlagsBits.ManageGuild) ||
      perms.has(PermissionFlagsBits.Administrator)
    );

    // المالك دائماً مسموح له (حتى لو لم تظهر له الصلاحية صراحةً)
    const isOwner = interaction.user.id === interaction.guild?.ownerId;

    // إذا لم يكن لديه صلاحيات إدارية ولا هو المالك → ارفض
    if (!hasAdminPerms && !isOwner) {
      await interaction.reply({
        content: '❌ تحتاج صلاحية **إدارة السيرفر** لفتح الإعدادات',
        ephemeral: true,
      });
      return;
    }

    // فتح اللوحة مباشرة — كلمة المرور تُطلب تلقائياً عند الضغط على أي زر للتعديل
    // (الأزرار تعرض نافذة كلمة المرور، وهذا يعمل حتى لو فُتحت اللوحة من الاختصار)
    const panel = await buildPanel('home', interaction.guild!, interaction.user.id);

    await interaction.reply({
      embeds: panel.embeds,
      components: panel.components as any,
      ephemeral: true,
    });
  },
};

export default command;
