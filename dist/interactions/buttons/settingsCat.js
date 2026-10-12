"use strict";
// ============================================
// Settings Panel - Category Navigation Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const settingsPanel_1 = require("../../utils/settingsPanel");
const handler = {
    id: 'settings_cat',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ هذا الزر يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        // 🔐 فحص الوصول: الصلاحيات + جلسة كلمة المرور
        // (عند انتهاء الجلسة تُفتح نافذة كلمة المرور تلقائياً بدل خطأ ميت)
        const access = (0, settingsPanel_1.checkSettingsAccess)(interaction);
        if (access === 'noperm') {
            await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
            return;
        }
        if (access === 'needpassword') {
            await interaction.showModal((0, settingsPanel_1.buildSettingsPasswordModal)());
            return;
        }
        await interaction.deferUpdate();
        const category = (interaction.customId.split(':')[1] || 'home');
        // 🛡️ حماية: أي خطأ في بناء اللوحة يظهر رسالة بدل صمت تام
        try {
            const panel = await (0, settingsPanel_1.buildPanel)(category, interaction.guild, interaction.user.id);
            await interaction.editReply({
                embeds: panel.embeds,
                components: panel.components,
            });
        }
        catch (error) {
            await interaction
                .editReply({ content: `❌ فشل فتح القسم \`${category}\` — ${error.message}` })
                .catch(() => { });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=settingsCat.js.map