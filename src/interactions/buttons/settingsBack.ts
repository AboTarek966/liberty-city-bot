// ============================================
// Settings Panel - Back to Home Button
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { buildPanel, checkSettingsAccess, buildSettingsPasswordModal } from '../../utils/settingsPanel';

const handler: ButtonHandler = {
  id: 'settings_back',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الزر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const access = checkSettingsAccess(interaction);
    if (access === 'noperm') {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }
    if (access === 'needpassword') {
      // 🔐 انتهت الجلسة → إعادة فتح نافذة كلمة المرور
      await interaction.showModal(buildSettingsPasswordModal());
      return;
    }

    await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل

    const panel = await buildPanel('home', interaction.guild, interaction.user.id);

    await interaction.editReply({
      embeds: panel.embeds,
      components: panel.components as any,
    });
  },
};

export default handler;
