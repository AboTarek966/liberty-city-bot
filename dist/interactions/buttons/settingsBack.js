"use strict";
// ============================================
// Settings Panel - Back to Home Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const settingsPanel_1 = require("../../utils/settingsPanel");
const handler = {
    id: 'settings_back',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ هذا الزر يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        if (!(0, settingsPanel_1.canManageSettings)(interaction)) {
            await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
            return;
        }
        await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل
        const panel = await (0, settingsPanel_1.buildPanel)('home', interaction.guild, interaction.user.id);
        await interaction.editReply({
            embeds: panel.embeds,
            components: panel.components,
        });
    },
};
exports.default = handler;
//# sourceMappingURL=settingsBack.js.map