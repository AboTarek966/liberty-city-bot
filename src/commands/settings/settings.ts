// ============================================
// Omni Bot - Settings Command (UI Panel)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { OmniClient } from '../../OmniClient';
import { buildPanel } from '../../utils/settingsPanel';
import { getGuildSettings } from '../../models';

/** هل يملك هذا المستخدم صلاحية استخدام لوحة الإعدادات؟ — مالك السيرفر فقط + من سمح له */
export function isSettingsAllowed(guild: any, userId: string, allowlist: string[]): boolean {
  if (!guild || !userId) return false;
  if (guild.ownerId === userId) return true;
  return Array.isArray(allowlist) && allowlist.map(String).includes(String(userId));
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('🎛️ لوحة إعدادات السيرفر — واجهة سهلة وجميلة لكل الإعدادات')
    .setDMPermission(false),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    const settings = await getGuildSettings(guild.id).catch(() => null);
    const allowlist: string[] =
      settings && Array.isArray((settings as any)?.settingsAllowlist)
        ? (settings as any).settingsAllowlist.map(String)
        : [];

    // المالك دائماً مسموح له — غيره فقط من أضافه هو عبر /settings-access
    if (!isSettingsAllowed(guild, interaction.user.id, allowlist)) {
      await interaction.reply({
        content:
          '❌ **الإعدادات محصورة بمالك السيرفر فقط** — حتى لو كانت رتبتك أعلى رول في السيرفر.\n' +
          '> 👑 المالك يملك السماح لك عبر الأمر `/settings-access add @أنت` ثم تفتح الإعدادات مرة أخرى.',
        ephemeral: true,
      });
      return;
    }

    // فتح اللوحة مباشرة — كلمة المرور تُطلب تلقائياً عند الضغط على أي زر للتعديل
    // (الأزرار تعرض نافذة كلمة المرور، وهذا يعمل حتى لو فُتحت اللوحة من الاختصار)
    const panel = await buildPanel('home', guild, interaction.user.id);

    await interaction.reply({
      embeds: panel.embeds,
      components: panel.components as any,
      ephemeral: true,
    });
  },
};

export default command;
