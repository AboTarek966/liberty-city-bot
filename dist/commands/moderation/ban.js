"use strict";
// ============================================
// Liberty City Bot - Ban Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ban')
        .setDescription('حظر عضو من السيرفر')
        .addUserOption(option => option
        .setName('user')
        .setDescription('العضو المراد حظره')
        .setRequired(true))
        .addStringOption(option => option
        .setName('reason')
        .setDescription('سبب الحظر')
        .setRequired(false))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.BanMembers)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.BanMembers],
    async execute(interaction) {
        const client = interaction.client;
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';
        // Defer reply
        await interaction.deferReply({ ephemeral: true });
        // Get target member
        const member = interaction.guild?.members.cache.get(target.id);
        // Check if bot can ban
        if (member && !member.bannable) {
            await interaction.editReply({
                content: '❌ لا أستطيع حظر هذا العضو. تأكد أن رتبتي أعلى من رتبته',
            });
            return;
        }
        // Check if target is the owner
        if (target.id === interaction.guild?.ownerId) {
            await interaction.editReply({
                content: '❌ لا يمكنك حظر مالك السيرفر',
            });
            return;
        }
        // Check if target is the moderator themselves
        if (target.id === interaction.user.id) {
            await interaction.editReply({
                content: '❌ لا يمكنك حظر نفسك',
            });
            return;
        }
        try {
            const result = await client.moderationHandler.ban({
                guild: interaction.guild,
                moderator: interaction.guild.members.cache.get(interaction.user.id),
                target,
                reason,
            });
            await interaction.editReply({
                embeds: [result.embed],
            });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ حدث خطأ: ${error.message}`,
            });
        }
    },
};
exports.default = command;
//# sourceMappingURL=ban.js.map