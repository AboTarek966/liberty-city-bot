// ============================================
// Settings Panel - Category Navigation Button
// ============================================

import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { buildPanel, canManageSettings, SettingsCategory, isPasswordVerified, setPasswordVerified, getSettingsPassword } from '../../utils/settingsPanel';
import { getGuildSettings } from '../../models';

const handler: ButtonHandler = {
  id: 'settings_cat',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الزر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    // التحقق من صلاحيات الإدارة أولاً
    const member = interaction.member as any;
    const perms = member?.permissions;
    const hasAdminPerms = !!perms && (
      perms.has(PermissionFlagsBits.ManageGuild) ||
      perms.has(PermissionFlagsBits.Administrator)
    );
    
    if (!hasAdminPerms) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }

    // التحقق من كلمة المرور
    const userId = interaction.user.id;
    if (!isPasswordVerified(userId)) {
      // عرض مودال إدخال كلمة المرور
      const settings = await getGuildSettings(interaction.guild.id);
      const password = settings.settingsPassword || '7421';
      
      const modal = new ModalBuilder()
        .setCustomId('settings_modal:password')
        .setTitle('🔐 التحقق من كلمة المرور')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('value')
              .setLabel('أدخل كلمة مرور لوحة الإعدادات')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('••••••••')
              .setRequired(true)
              .setMaxLength(20)
          )
        );
      
      await interaction.showModal(modal);
      return;
    }

    await interaction.deferUpdate();

    const category = (interaction.customId.split(':')[1] || 'home') as SettingsCategory;
    // 🛡️ حماية: أي خطأ في بناء اللوحة يظهر رسالة بدل صمت تام
    try {
      const panel = await buildPanel(category, interaction.guild, interaction.user.id);
      await interaction.editReply({
        embeds: panel.embeds,
        components: panel.components as any,
      });
    } catch (error: any) {
      await interaction
        .editReply({ content: `❌ فشل فتح القسم \`${category}\` — ${error.message}` })
        .catch(() => {});
    }
  },
};

export default handler;
