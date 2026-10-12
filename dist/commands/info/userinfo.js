"use strict";
// ============================================
// Liberty City Bot - User Info Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('عرض معلومات عضو')
        .addUserOption(option => option
        .setName('user')
        .setDescription('العضو (الافتراضي: أنت)')
        .setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild?.members.cache.get(target.id);
        const lines = [
            `${target.bot ? '🤖' : '👤'} **${target.tag}** — \`${target.id}\``,
            `📅 إنشاء الحساب: <t:${Math.floor(target.createdTimestamp / 1000)}:R>`,
        ];
        if (member) {
            lines.push(`📥 انضم: ${member.joinedTimestamp
                ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
                : 'غير معروف'}`);
            lines.push(`🎭 أعلى رتبة: ${member.roles.highest.id !== interaction.guildId
                ? `${member.roles.highest}`
                : 'لا يوجد'} • أدوار [${member.roles.cache.size - 1}]`);
            // Add permissions summary
            const keyPerms = [];
            if (member.permissions.has('Administrator'))
                keyPerms.push('👑 مدير');
            if (member.permissions.has('ManageGuild'))
                keyPerms.push('⚙️ إدارة سيرفر');
            if (member.permissions.has('BanMembers'))
                keyPerms.push('🔨 حظر');
            if (member.permissions.has('KickMembers'))
                keyPerms.push('👢 طرد');
            if (member.permissions.has('ManageMessages'))
                keyPerms.push('💬 إدارة رسائل');
            if (keyPerms.length > 0) {
                lines.push(`🔑 ${keyPerms.join(' • ')}`);
            }
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`👤 معلومات: ${target.tag}`)
            .setColor(embeds_1.Colors.primary)
            .setThumbnail(target.displayAvatarURL({ size: 512 }))
            .setDescription(lines.join('\n'));
        await interaction.reply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=userinfo.js.map