"use strict";
// ============================================
// Liberty City Bot - AFK Command (وضع عدم الوجود)
// /afk [السبب] — تفعيل أو إلغاء وضع AFK
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const afk_1 = require("../../utils/afk");
const helpers_1 = require("../../utils/helpers");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('afk')
        .setDescription('وضع عدم الوجود (AFK) — يُلغى تلقائياً عند أول رسالة منك')
        .addStringOption(option => option
        .setName('reason')
        .setDescription('سبب غيابك (سيظهر لمن يذكرك)')
        .setRequired(false)
        .setMaxLength(100)),
    cooldown: 3,
    async execute(interaction) {
        await interaction.deferReply();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;
        const reason = interaction.options.getString('reason')?.trim();
        const existing = await (0, afk_1.getAFK)(guildId, userId);
        // كنت AFK → إلغاء
        if (existing) {
            await (0, afk_1.removeAFK)(guildId, userId);
            const duration = (0, helpers_1.formatDuration)(Date.now() - existing.since, { compact: true });
            await interaction.editReply({ content: `👋 أهلاً بعودتك — كنت غائباً لمدة ${duration}` });
            return;
        }
        // تفعيل AFK
        const finalReason = reason || 'غائب حالياً';
        await (0, afk_1.setAFK)(guildId, userId, finalReason);
        await interaction.editReply({
            content: `💤 تم تفعيل AFK — السبب: ${finalReason} (يُلغى تلقائياً عند أول رسالة)`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=afk.js.map