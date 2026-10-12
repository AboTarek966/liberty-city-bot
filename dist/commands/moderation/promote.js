"use strict";
// ============================================
// Liberty City Bot - Promote Command (ترقية رول)
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
        .setName('promote')
        .setDescription('ترقية عضو للرول التالي في هرمية الرتب')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .addUserOption(o => o.setName('user').setDescription('العضو المراد ترقيته').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('رول محدد للترقية إليه (اختياري - وإلا للرول التالي)').setRequired(false))
        .addStringOption(o => o.setName('reason').setDescription('سبب الترقية').setRequired(false)),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageRoles],
    async execute(interaction) {
        const executorMember = interaction.member;
        const client = interaction.client;
        const guild = interaction.guild;
        const member = interaction.options.getMember('user');
        const targetRole = interaction.options.getRole('role');
        const reason = interaction.options.getString('reason') || 'ترقية عبر الأمر';
        if (!member) {
            await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
            return;
        }
        // لا يمكن ترقية نفسك
        if (member.id === interaction.user.id) {
            await interaction.reply({ content: '❌ لا يمكنك ترقية نفسك', ephemeral: true });
            return;
        }
        // لا يمكن ترقية مالك السيرفر (إلا لو كان المنفذ هو المالك نفسه)
        if (member.id === guild.ownerId && interaction.user.id !== guild.ownerId) {
            await interaction.reply({ content: '❌ لا يمكنك ترقية مالك السيرفر', ephemeral: true });
            return;
        }
        // التحقق من صلاحيات البوت
        if (!guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({ content: '❌ البوت لا يملك صلاحية إدارة الرتب', ephemeral: true });
            return;
        }
        // التحقق من أن رتبة البوت أعلى من رتبة العضو
        if (guild.members.me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
            return;
        }
        // التحقق من أن رتبة المنفذ أعلى من رتبة العضو (المالك يستثنى)
        const isOwner = interaction.user.id === guild.ownerId;
        if (!isOwner && executorMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
            return;
        }
        let newRole = null;
        if (targetRole) {
            // ترقية لرول محدد
            newRole = targetRole;
            // التحقق من أن رتبة البوت أعلى من الرول المستهدف
            if (guild.members.me.roles.highest.comparePositionTo(newRole) <= 0) {
                await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من الرول المستهدف', ephemeral: true });
                return;
            }
            // التحقق من أن رتبة المنفذ أعلى من الرول المستهدف
            if (!isOwner && executorMember.roles.highest.comparePositionTo(newRole) <= 0) {
                await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من الرول المستهدف', ephemeral: true });
                return;
            }
            // التحقق من أن العضو لا يملك الرول بالفعل
            if (member.roles.cache.has(newRole.id)) {
                await interaction.reply({ content: `❌ العضو يملك رول ${newRole} بالفعل`, ephemeral: true });
                return;
            }
        }
        else {
            // ترقية تلقائية للرول التالي في الهرمية (التدرج الطبيعي)
            const botTopRole = guild.members.me.roles.highest;
            const executorTopRole = executorMember.roles.highest;
            const memberTopRole = member.roles.highest;
            const isOwner = interaction.user.id === guild.ownerId;
            // ابحث عن جميع الرتب فوق رتبة العضو الحالية
            const higherRoles = guild.roles.cache
                .filter(r => r.position > memberTopRole.position && // أعلى من رتبة العضو الحالية
                r.position < botTopRole.position && // أقل من رتبة البوت
                r.id !== guild.id && // ليس @everyone
                !r.managed // ليس رول مدار (بوتات)
            )
                // للمالك: لا قيود إضافية. لغير المالك: لا يتجاوز رتبته
                .filter(r => isOwner || r.position <= executorTopRole.position)
                .sort((a, b) => a.position - b.position); // الأقرب لرتبة العضو الحالية أولاً (التدرج الطبيعي)
            if (higherRoles.size === 0) {
                await interaction.reply({
                    content: '❌ لا يوجد رول أعلى متاح للترقية (الرتبة التالية أعلى من رتبة البوت)',
                    ephemeral: true
                });
                return;
            }
            // أخذ أول رول = الرتبة التالية مباشرة في الهرمية
            newRole = higherRoles.first();
        }
        // إضافة الرول
        try {
            await member.roles.add(newRole, `${reason} | بواسطة ${interaction.user.tag}`);
        }
        catch (error) {
            await interaction.reply({ content: '❌ فشل إضافة الرول — تحقق من صلاحيات البوت', ephemeral: true });
            return;
        }
        // الرد — رسالة نصية بسيطة وسريعة
        await interaction.reply({ content: `✅ **${member}** تمت ترقيته إلى ${newRole}` });
        // تسجيل في السجلات (خلفية — لا يؤخر الرد)
        try {
            const settings = await (await Promise.resolve().then(() => __importStar(require('../../models')))).getGuildSettings(guild.id);
            if (settings.logging?.enabled && settings.logging.channelId) {
                const logChannel = guild.channels.cache.get(settings.logging.channelId);
                if (logChannel && logChannel.isTextBased()) {
                    const logEmbed = new discord_js_1.EmbedBuilder()
                        .setTitle('⬆️ ترقية عضو')
                        .setColor(embeds_1.Colors.success)
                        .addFields({ name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true }, { name: '🎭 الرول', value: `${newRole}`, inline: true }, { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }, { name: '📝 السبب', value: reason, inline: false })
                        .setTimestamp();
                    await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
                }
            }
        }
        catch {
            // تجاهل أخطاء السجل
        }
    },
};
exports.default = command;
//# sourceMappingURL=promote.js.map