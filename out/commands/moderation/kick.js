"use strict";
// ============================================
// Liberty City Bot - Kick Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('kick')
        .setDescription('طرد عضو من السيرفر')
        .addUserOption(option => option
        .setName('user')
        .setDescription('العضو المراد طرده')
        .setRequired(true))
        .addStringOption(option => option
        .setName('reason')
        .setDescription('سبب الطرد')
        .setRequired(false))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.KickMembers)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.KickMembers],
    async execute(interaction) {
        const client = interaction.client;
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';
        await interaction.deferReply({ ephemeral: true });
        const member = interaction.guild?.members.cache.get(target.id);
        if (!member) {
            await interaction.editReply({
                content: '❌ العضو غير موجود في السيرفر',
            });
            return;
        }
        // Check if bot can kick
        if (!member.kickable) {
            await interaction.editReply({
                content: '❌ لا أستطيع طرد هذا العضو. تأكد أن رتبتي أعلى من رتبته',
            });
            return;
        }
        // Check if target is the owner
        if (target.id === interaction.guild?.ownerId) {
            await interaction.editReply({
                content: '❌ لا يمكنك طرد مالك السيرفر',
            });
            return;
        }
        // Check if target is the moderator themselves
        if (target.id === interaction.user.id) {
            await interaction.editReply({
                content: '❌ لا يمكنك طرد نفسك',
            });
            return;
        }
        try {
            const result = await client.moderationHandler.kick({
                guild: interaction.guild,
                moderator: interaction.guild.members.cache.get(interaction.user.id),
                target,
                reason,
            });
            await interaction.editReply({
                content: `👢 **${target.tag}** تم طرده | ${reason}`,
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
//# sourceMappingURL=kick.js.map