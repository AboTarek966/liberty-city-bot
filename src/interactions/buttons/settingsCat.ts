// ============================================
// Settings Panel - Category Navigation Button
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { buildPanel, checkSettingsAccess, buildSettingsPasswordModal, SettingsCategory } from '../../utils/settingsPanel';

const handler: ButtonHandler = {
  id: 'settings_cat',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الزر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    // 🔐 فحص الوصول: الصلاحيات + جلسة كلمة المرور
    // (عند انتهاء الجلسة تُفتح نافذة كلمة المرور تلقائياً بدل خطأ ميت)
    const access = checkSettingsAccess(interaction);
    if (access === 'noperm') {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }
    if (access === 'needpassword') {
      await interaction.showModal(buildSettingsPasswordModal());
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
