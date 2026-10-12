"use strict";
// ============================================
// Liberty City Bot - Autorole Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
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
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('✅ تم تفعيل الرول التلقائي')
                .setColor(embeds_1.Colors.success)
                .setDescription(`${role} سيُعطى تلقائياً لكل عضو جديد ينضم للسيرفر 🎉\n\n` +
                `جرّب بإنشاء حساب جديد أو اطلب من أحد الانضمام!`)
                .setFooter({ text: 'Liberty City Autorole' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
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
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🎖️ حالة الرول التلقائي')
            .setColor(settings.autorole?.enabled ? embeds_1.Colors.success : embeds_1.Colors.error)
            .addFields({
            name: '⚡ الحالة',
            value: settings.autorole?.enabled ? '✅ مفعّل' : '❌ معطّل',
            inline: true,
        }, {
            name: '📛 الرول',
            value: role ? `${role}` : roleId ? `\`${roleId}\` (محذوف)` : 'غير محدد',
            inline: true,
        })
            .setFooter({ text: 'Liberty City Autorole' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=autorole.js.map