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
const rolePicker_1 = require("../../utils/rolePicker");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('roleadd')
        .setDescription('إضافة رول لعضو')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .addUserOption(o => o.setName('user').setDescription('العضو المراد إضافة الرول له').setRequired(true))
        .addRoleOption(o => o
        .setName('role')
        .setDescription('الرول الأول (اتركه فارغاً لفتح لوحة الاختيار)')
        .setRequired(false))
        .addRoleOption(o => o.setName('role2').setDescription('رول إضافي 2').setRequired(false))
        .addRoleOption(o => o.setName('role3').setDescription('رول إضافي 3').setRequired(false))
        .addRoleOption(o => o.setName('role4').setDescription('رول إضافي 4').setRequired(false))
        .addRoleOption(o => o.setName('role5').setDescription('رول إضافي 5').setRequired(false))
        .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(false)),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageRoles],
    async execute(interaction) {
        const client = interaction.client;
        const guild = interaction.guild;
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'إضافة رول';
        // ✅ كل الرولات المحددة في نفس الأمر (role حتى role5)
        const requestedRoles = ['role', 'role2', 'role3', 'role4', 'role5']
            .map(n => interaction.options.getRole(n))
            .filter((r) => r !== null);
        const uniqueRoles = [...new Map(requestedRoles.map(r => [r.id, r])).values()];
        if (!member) {
            await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
            return;
        }
        // لا يمكن تعديل رولات مالك السيرفر (إلا لو كان المنفذ هو المالك نفسه)
        if (member.id === guild.ownerId && interaction.user.id !== guild.ownerId) {
            await interaction.reply({ content: '❌ لا يمكن تعديل رولات مالك السيرفر', ephemeral: true });
            return;
        }
        const executorMember = interaction.member;
        // --------------------------------------------
        // لوحة اختيار الرولات (لم يتم تحديد أي رول)
        // --------------------------------------------
        if (uniqueRoles.length === 0) {
            const grantable = (0, rolePicker_1.getGrantableRoles)(guild, executorMember);
            if (grantable.length === 0) {
                await interaction.reply({
                    content: '❌ لا توجد رولات يمكنك إعطاؤها — تأكد من رتبتك ورتبة البوت',
                    ephemeral: true,
                });
                return;
            }
            const state = (0, rolePicker_1.createRolePickerState)(interaction.user.id, member.id, reason);
            const { content, components } = (0, rolePicker_1.buildRolePicker)(state, guild, executorMember);
            await interaction.reply({ content, components });
            return;
        }
        // --------------------------------------------
        // فحص كل الرولات المحددة
        // --------------------------------------------
        const isOwner = interaction.user.id === guild.ownerId;
        const grantable = [];
        const execBlocked = [];
        const botBlocked = [];
        const alreadyOwned = [];
        for (const role of uniqueRoles) {
            if (member.roles.cache.has(role.id)) {
                alreadyOwned.push(role);
                continue;
            }
            if (!isOwner && executorMember.roles.highest.comparePositionTo(role) <= 0) {
                execBlocked.push(role);
                continue;
            }
            if (guild.members.me.roles.highest.comparePositionTo(role) <= 0) {
                botBlocked.push(role);
                continue;
            }
            grantable.push(role);
        }
        if (grantable.length === 0) {
            let msg = `❌ العضو يملك هذه الرولات بالفعل (${alreadyOwned.length})`;
            if (execBlocked.length)
                msg = '❌ رتبتك يجب أن تكون أعلى من الرول المضاف';
            else if (botBlocked.length)
                msg = '❌ رتبة البوت يجب أن تكون أعلى من الرول المضاف';
            await interaction.reply({ content: msg, ephemeral: true });
            return;
        }
        try {
            await member.roles.add(grantable.map(r => r.id), `${reason} | بواسطة ${interaction.user.tag}`);
            const rolesText = grantable.map(r => `${r}`).join(', ');
            const skippedText = [
                ...execBlocked.map(r => `${r} (أعلى من رتبتك)`),
                ...botBlocked.map(r => `${r} (أعلى من رتبة البوت)`),
                ...alreadyOwned.map(r => `${r} (مملوك بالفعل)`),
            ]
                .slice(0, 10)
                .join('\n');
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(grantable.length > 1 ? '➕ تم إضافة الرولات' : '➕ تم إضافة الرول')
                .setColor(embeds_1.Colors.success)
                .addFields({ name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true }, {
                name: grantable.length > 1 ? '🎭 الرولات' : '🎭 الرول',
                value: rolesText,
                inline: false,
            }, { name: '🛡️ المنفذ', value: `${interaction.user}`, inline: true }, { name: '📝 السبب', value: reason, inline: false }, ...(skippedText
                ? [{ name: '⚠️ تم تخطيها', value: skippedText, inline: false }]
                : []))
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
                            .setTitle(grantable.length > 1 ? '➕ إضافة رولات' : '➕ إضافة رول')
                            .setColor(embeds_1.Colors.success)
                            .addFields({ name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true }, { name: '🎭 الرولات', value: rolesText, inline: false }, { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }, { name: '📝 السبب', value: reason, inline: false }, ...(skippedText
                            ? [{ name: '⚠️ تم تخطيها', value: skippedText, inline: false }]
                            : []))
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