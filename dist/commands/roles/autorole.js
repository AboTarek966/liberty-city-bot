"use strict";
// ============================================
// Liberty City Bot - Autorole Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('autorole')
        .setDescription('🎖️ الرول التلقائي — يُعطى تلقائياً لكل عضو جديد')
        .addSubcommand(sub => sub
        .setName('set')
        .setDescription('تعيين رول تلقائي للأعضاء الجدد')
        .addRoleOption(opt => opt
        .setName('role')
        .setDescription('الرول الذي سيُعطى تلقائياً')
        .setRequired(true)))
        .addSubcommand(sub => sub
        .setName('off')
        .setDescription('إيقاف الرول التلقائي'))
        .addSubcommand(sub => sub
        .setName('status')
        .setDescription('عرض حالة الرول التلقائي'))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.ManageRoles],
    async execute(interaction) {
        const client = interaction.client;
        const subcommand = interaction.options.getSubcommand();
        const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
        await interaction.deferReply({ ephemeral: true });
        if (subcommand === 'set') {
            const role = interaction.options.getRole('role', true);
            const member = interaction.guild.members.cache.get(client.user.id);
            if (member && role.position >= member.roles.highest.position) {
                await interaction.editReply({
                    content: '❌ لا يمكن استخدام رول أعلى من رتبة البوت! اختر رولاً أدناه.',
                });
                return;
            }
            settings.autorole.enabled = true;
            settings.autorole.roleId = role.id;
            await settings.save();
            await interaction.editReply({ content: `✅ تم تفعيل الرول التلقائي — ${role} يُعطى لكل عضو جديد` });
            return;
        }
        if (subcommand === 'off') {
            settings.autorole.enabled = false;
            await settings.save();
            await interaction.editReply({ content: '✅ تم إيقاف الرول التلقائي' });
            return;
        }
        // status
        const roleId = settings.autorole?.roleId;
        const role = roleId ? interaction.guild.roles.cache.get(roleId) : null;
        await interaction.editReply({
            content: `🎖️ الرول التلقائي: ${settings.autorole?.enabled ? '✅ مفعّل' : '❌ معطّل'} • الرول: ${role ? `${role}` : roleId ? `\`${roleId}\` (محذوف)` : 'غير محدد'}`,
        });
    },
};
exports.default = command;
//# sourceMappingURL=autorole.js.map