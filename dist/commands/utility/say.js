"use strict";
// ============================================
// Liberty City Bot - Say Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('say')
        .setDescription('إرسال نص باسم البوت')
        .addStringOption(option => option
        .setName('text')
        .setDescription('النص المراد إرساله')
        .setRequired(true)
        .setMaxLength(2000))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.ManageMessages],
    async execute(interaction) {
        const text = interaction.options.getString('text', true);
        if (!interaction.guild || !interaction.channel) {
            await interaction.reply({ content: '❌ هذا الأمر يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        // إرسال النص مباشرة (بدون رد على الأمر حتى لا يظهر المنشن)
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '✅ تم الإرسال', ephemeral: true });
        }
        const channel = interaction.channel;
        if (channel && typeof channel.send === 'function') {
            await channel.send({ content: text }).catch(() => { });
        }
    },
};
exports.default = command;
//# sourceMappingURL=say.js.map