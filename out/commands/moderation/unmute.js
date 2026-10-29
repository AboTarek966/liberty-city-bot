"use strict";
// ============================================
// Liberty City Bot - Unmute Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('unmute')
        .setDescription('إلغاء كتم عضو')
        .addUserOption(option => option
        .setName('user')
        .setDescription('العضو المراد إلغاء كتمه')
        .setRequired(true))
        .addStringOption(option => option
        .setName('reason')
        .setDescription('سبب إلغاء الكتم')
        .setRequired(false))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.ModerateMembers],
    async execute(interaction) {
        const client = interaction.client;
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';
        await interaction.deferReply({ ephemeral: true });
        const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
        if (!member) {
            await interaction.editReply({ content: '❌ العضو غير موجود في السيرفر' });
            return;
        }
        try {
            const moderator = await interaction.guild.members.fetch(interaction.user.id);
            const result = await client.moderationHandler.unmute({
                guild: interaction.guild,
                moderator,
                target: member,
                reason,
            });
            await interaction.editReply({ content: result.simpleMsg });
        }
        catch (error) {
            await interaction.editReply({ content: `❌ حدث خطأ: ${error.message}` });
        }
    },
};
exports.default = command;
//# sourceMappingURL=unmute.js.map