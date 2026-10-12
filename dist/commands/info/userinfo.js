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
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`👤 معلومات: ${target.tag}`)
            .setColor(embeds_1.Colors.primary)
            .setThumbnail(target.displayAvatarURL({ size: 512 }))
            .addFields({
            name: '🆔 المعرف',
            value: `\`${target.id}\``,
            inline: true,
        }, {
            name: '🤖 هل هو بوت؟',
            value: target.bot ? 'نعم 🤖' : 'لا 👤',
            inline: true,
        }, {
            name: '📅 إنشاء الحساب',
            value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`,
            inline: true,
        })
            .setFooter({ text: 'Liberty City Bot' })
            .setTimestamp();
        if (member) {
            embed.addFields({
                name: '📥 انضم للسيرفر',
                value: member.joinedTimestamp
                    ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
                    : 'غير معروف',
                inline: true,
            }, {
                name: '🎭 أعلى رتبة',
                value: member.roles.highest.id !== interaction.guildId
                    ? `${member.roles.highest}`
                    : 'لا يوجد',
                inline: true,
            }, {
                name: `🎭 الأدوار [${member.roles.cache.size - 1}]`,
                value: member.roles.cache
                    .filter(r => r.id !== interaction.guildId)
                    .map(r => r.toString())
                    .slice(0, 10)
                    .join(' ') || 'لا يوجد',
                inline: false,
            });
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
                embed.addFields({
                    name: '🔑 صلاحيات رئيسية',
                    value: keyPerms.join(', '),
                    inline: false,
                });
            }
        }
        await interaction.reply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=userinfo.js.map