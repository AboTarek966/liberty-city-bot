"use strict";
// ============================================
// Liberty City Bot - RoleAdd Command (إضافة رول)
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('roleadd')
        .setDescription('إضافة رول لعضو')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .addUserOption(o => o.setName('user').setDescription('العضو المراد إضافة الرول له').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('الرول المراد إضافته').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(false)),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageRoles],
    async execute(interaction) {
        const client = interaction.client;
        const guild = interaction.guild;
        const member = interaction.options.getMember('user');
        const role = interaction.options.getRole('role', true);
        const reason = interaction.options.getString('reason') || 'إضافة رول';
        if (!member) {
            await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
            return;
        }
        // لا يمكن تعديل رولات مالك السيرفر (إلا لو كان المنفذ هو المالك نفسه)
        if (member.id === guild.ownerId && interaction.user.id !== guild.ownerId) {
            await interaction.reply({ content: '❌ لا يمكن تعديل رولات مالك السيرفر', ephemeral: true });
            return;
        }
        if (member.roles.cache.has(role.id)) {
            await interaction.reply({ content: `❌ العضو يملك رول ${role} بالفعل`, ephemeral: true });
            return;
        }
        const executorMember = interaction.member;
        const isOwner = interaction.user.id === guild.ownerId;
        if (!isOwner && executorMember.roles.highest.comparePositionTo(role) <= 0) {
            await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من الرول المضاف', ephemeral: true });
            return;
        }
        if (guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
            await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من الرول المضاف', ephemeral: true });
            return;
        }
        try {
            await member.roles.add(role, `${reason} | بواسطة ${interaction.user.tag}`);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('➕ تم إضافة الرول')
                .setColor(embeds_1.Colors.success)
                .addFields({ name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true }, { name: '🎭 الرول', value: `${role}`, inline: true }, { name: '🛡️ المنفذ', value: `${interaction.user}`, inline: true }, { name: '📝 السبب', value: reason, inline: false })
                .setTimestamp()
                .setFooter({ text: `Liberty City | ${guild.name}` });
            await interaction.reply({ embeds: [embed] });
            // Log
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../../models')));
                const settings = await getGuildSettings(guild.id);
                if (settings.logging?.enabled && settings.logging.channelId) {
                    const logChannel = guild.channels.cache.get(settings.logging.channelId);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = new discord_js_1.EmbedBuilder()
                            .setTitle('➕ إضافة رول')
                            .setColor(embeds_1.Colors.success)
                            .addFields({ name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true }, { name: '🎭 الرول', value: `${role}`, inline: true }, { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }, { name: '📝 السبب', value: reason, inline: false })
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
                    }
                }
            }
            catch { }
        }
        catch (error) {
            await interaction.reply({ content: '❌ فشل إضافة الرول — تحقق من صلاحيات البوت', ephemeral: true });
        }
    },
};
exports.default = command;
//# sourceMappingURL=roleadd.js.map