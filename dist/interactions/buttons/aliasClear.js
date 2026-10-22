"use strict";
// ============================================
// Liberty City Bot - Alias Clear Buttons
// أزرار تأكيد/إلغاء حذف جميع الاختصارات (/alias clear)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const aliasCache_1 = require("../../utils/aliasCache");
const handler = {
    id: 'alias:clear',
    async execute(interaction) {
        const parts = interaction.customId.split(':'); // alias:clear:confirm|cancel:userId
        const action = parts[2];
        const ownerId = parts[3];
        // 🔒 الزر مخصص لمن أطلق الأمر فقط
        if (interaction.user.id !== ownerId) {
            await interaction.reply({
                content: '❌ هذا التأكيد مخصص لمن أطلق الأمر فقط',
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        if (action === 'cancel') {
            await interaction.update({ content: '✅ تم إلغاء الحذف — الاختصارات كما هي', components: [] });
            return;
        }
        if (action === 'confirm') {
            const result = await models_1.CommandAlias.deleteMany({ guildId: interaction.guildId });
            (0, aliasCache_1.invalidateAliasCache)(interaction.guildId);
            await interaction.update({
                content: `🗑️ تم حذف **${result.deletedCount}** اختصار بنجاح`,
                components: [],
            });
            return;
        }
        await interaction.update({ components: [] });
    },
};
exports.default = handler;
//# sourceMappingURL=aliasClear.js.map