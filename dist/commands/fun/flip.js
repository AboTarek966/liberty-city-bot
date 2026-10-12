"use strict";
// ============================================
// Liberty City Bot - Flip Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('flip')
        .setDescription('🪙 اقلب العملة — كتابة أم وجه؟'),
    cooldown: 3,
    async execute(interaction) {
        const isHeads = Math.random() < 0.5;
        await interaction.reply({
            content: isHeads
                ? `🪙 **الوجه!** — العملة سقطت على الوجه 😏`
                : `✍️ **الكتابة!** — العملة سقطت على الكتابة ✨`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=flip.js.map