"use strict";
// ============================================
// Liberty City Bot - Jail Command (سجن عضو)
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
const models_1 = require("../../models");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('JailCommand');
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('jail')
        .setDescription('سجن عضو (منعه من رؤية/الكتابة في كل الرومات إلا روم السجن)')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .addUserOption(o => o.setName('user').setDescription('العضو المراد سجنه').setRequired(true))
        .addChannelOption(o => o.setName('jail_channel')
        .setDescription('روم السجن (الذي سيبقى العضو قادراً على رؤيته والكتابة فيه)')
        .addChannelTypes(discord_js_1.ChannelType.GuildText)
        .setRequired(false))
        .addStringOption(o => o.setName('reason').setDescription('سبب السجن').setRequired(false))
        .addStringOption(o => o.setName('duration').setDescription('مدة السجن (مثال: 10m, 1h, 1d). فارغ = دائم').setRequired(false)),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageRoles],
    async execute(interaction) {
        const client = interaction.client;
        const guild = interaction.guild;
        const member = interaction.options.getMember('user');
        const jailChannel = interaction.options.getChannel('jail_channel');
        const reason = interaction.options.getString('reason') || 'سجن عبر الأمر';
        const duration = interaction.options.getString('duration');
        if (!member) {
            await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
            return;
        }
        // لا يمكن سجن نفسك
        if (member.id === interaction.user.id) {
            await interaction.reply({ content: '❌ لا يمكنك سجن نفسك', ephemeral: true });
            return;
        }
        // لا يمكن سجن مالك السيرفر (إلا لو كان المنفذ هو المالك نفسه)
        if (member.id === guild.ownerId && interaction.user.id !== guild.ownerId) {
            await interaction.reply({ content: '❌ لا يمكن سجن مالك السيرفر', ephemeral: true });
            return;
        }
        // التحقق من صلاحيات البوت
        if (!guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles) ||
            !guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ content: '❌ البوت يحتاج صلاحية إدارة الرتب والقنوات', ephemeral: true });
            return;
        }
        // التحقق من أن رتبة البوت أعلى من رتبة العضو
        if (guild.members.me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
            return;
        }
        // التحقق من أن رتبة المنفذ أعلى من رتبة العضو (المالك يستثنى)
        const executorMember = interaction.member;
        const isOwner = interaction.user.id === guild.ownerId;
        if (!isOwner && executorMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
            return;
        }
        await interaction.deferReply();
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            // تحديد روم السجن
            let targetJailChannel = jailChannel;
            if (!targetJailChannel) {
                // محاولة استخدام روم السجن من الإعدادات
                const settingsJailChannelId = settings.jail?.channelId;
                if (settingsJailChannelId) {
                    targetJailChannel = guild.channels.cache.get(settingsJailChannelId);
                }
            }
            if (!targetJailChannel) {
                await interaction.editReply({ content: '❌ لم يتم تحديد روم السجن. استخدم الخيار `jail_channel` أو أضف روم سجن في الإعدادات (`/settings` → الترحيب/السجن)' });
                return;
            }
            // التحقق من أن البوت يستطيع إدارة روم السجن
            const botPermsInJail = targetJailChannel.permissionsFor(guild.members.me);
            if (!botPermsInJail?.has(discord_js_1.PermissionFlagsBits.ViewChannel) || !botPermsInJail?.has(discord_js_1.PermissionFlagsBits.SendMessages)) {
                await interaction.editReply({ content: '❌ البوت لا يملك صلاحية رؤية/إرسال رسائل في روم السجن المحدد' });
                return;
            }
            // إنشاء/جلب رول "السجن"
            let jailRole = guild.roles.cache.find(r => r.name === '🔒 جايـل' || r.name === 'Jail');
            if (!jailRole) {
                jailRole = await guild.roles.create({
                    name: '🔒 جايـل',
                    color: 0x555555,
                    reason: 'رول السجن التلقائي',
                    permissions: [],
                });
            }
            // التحقق من أن رتبة البوت أعلى من رول السجن
            if (guild.members.me.roles.highest.comparePositionTo(jailRole) <= 0) {
                await interaction.editReply({ content: '❌ رتبة البوت يجب أن تكون أعلى من رول السجن' });
                return;
            }
            // 🔒 إزالة جميع رولات العضو (عدا @everyone) وإعطاء رول السجن فقط
            // هذا ضروري لأن Discord يُعطي أولوية للـ ALLOW من أي رول آخر
            const currentRoles = member.roles.cache
                .filter(r => r.id !== guild.id) // استبعاد @everyone
                .map(r => r.id);
            // إزالة الرولات الحالية
            if (currentRoles.length > 0) {
                await member.roles.remove(currentRoles, `سجن: ${reason}`);
            }
            // إضافة رول السجن
            await member.roles.add(jailRole, reason);
            // تخزين بيانات السجن في قاعدة البيانات
            const { JailData } = await Promise.resolve().then(() => __importStar(require('../../models')));
            await JailData.findOneAndUpdate({ guildId: guild.id, userId: member.id }, {
                guildId: guild.id,
                userId: member.id,
                previousRoles: currentRoles,
                jailRoleId: jailRole.id,
                jailedBy: interaction.user.id,
                reason,
                jailedAt: new Date(),
                duration: duration ? parseDuration(duration) : null,
                jailChannelId: targetJailChannel.id,
            }, { upsert: true, new: true });
            // إعداد الصلاحيات: منع رؤية جميع القنوات إلا روم السجن
            const channels = guild.channels.cache.filter(c => c.type === discord_js_1.ChannelType.GuildText || c.type === discord_js_1.ChannelType.GuildVoice);
            for (const channel of channels.values()) {
                if (channel.id === targetJailChannel.id)
                    continue;
                try {
                    await channel.permissionOverwrites.edit(jailRole, {
                        ViewChannel: false,
                        SendMessages: false,
                        Connect: false,
                    }, { reason: `سجن ${member.user.tag}` });
                }
                catch (e) {
                    // تجاهل الأخطاء في القنوات الفردية
                }
            }
            // السماح بالرؤية في روم السجن
            try {
                await targetJailChannel.permissionOverwrites.edit(jailRole, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true,
                }, { reason: `سجن ${member.user.tag}` });
            }
            catch (e) {
                // تجاهل
            }
            // جدولة الإفراج التلقائي إن وُجدت مدة
            if (duration) {
                const ms = parseDuration(duration);
                if (ms) {
                    setTimeout(async () => {
                        try {
                            await unjailUser(guild, member.id, jailRole, currentRoles, 'انتهت مدة السجن');
                        }
                        catch (e) {
                            logger.error('Auto unjail failed:', e);
                        }
                    }, ms);
                }
            }
            // الرد
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🔒 تم سجن العضو')
                .setColor(embeds_1.Colors.error)
                .addFields({ name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true }, { name: '🔒 روم السجن', value: `${targetJailChannel}`, inline: true }, { name: '🛡️ المنفذ', value: `${interaction.user}`, inline: true }, { name: '📝 السبب', value: reason, inline: false }, { name: '⏱️ المدة', value: duration || 'دائم (يحتاج إفراج يدوي)', inline: true })
                .setTimestamp()
                .setFooter({ text: `Liberty City | ${guild.name}` });
            await interaction.editReply({ embeds: [embed] });
            // تسجيل في السجلات
            try {
                const settings = await (0, models_1.getGuildSettings)(guild.id);
                if (settings.logging?.enabled && settings.logging.channelId) {
                    const logChannel = guild.channels.cache.get(settings.logging.channelId);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = new discord_js_1.EmbedBuilder()
                            .setTitle('🔒 سجن عضو')
                            .setColor(embeds_1.Colors.error)
                            .addFields({ name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true }, { name: '🔒 روم السجن', value: `${targetJailChannel}`, inline: true }, { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }, { name: '📝 السبب', value: reason, inline: false })
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
                    }
                }
            }
            catch { }
            // إرسال رسالة في روم السجن
            try {
                await targetJailChannel.send({
                    content: `<@${member.id}> 🔒 **تم سجنك**\n**السبب:** ${reason}\n**المدة:** ${duration || 'دائم'}\n\nأنت الآن في سجن السيرفر. يمكنك التحدث هنا فقط. احترم القوانين لتفرج عنك.`
                }).catch(() => { });
            }
            catch { }
        }
        catch (error) {
            logger.error('Jail command failed:', error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر' });
        }
    },
};
function parseDuration(str) {
    const match = str.match(/^(\d+)([smhd])$/i);
    if (!match)
        return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return value * (multipliers[unit] || 0);
}
async function unjailUser(guild, userId, jailRole, previousRoles, reason) {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member)
            return;
        // إزالة رول السجن
        if (member.roles.cache.has(jailRole.id)) {
            await member.roles.remove(jailRole, reason);
        }
        // استعادة الرولات السابقة
        for (const roleId of previousRoles) {
            const role = guild.roles.cache.get(roleId);
            if (role && !member.roles.cache.has(roleId)) {
                try {
                    await member.roles.add(role, reason);
                }
                catch { }
            }
        }
        // تنظيف بيانات السجن
        const { JailData } = await Promise.resolve().then(() => __importStar(require('../../models')));
        await JailData.findOneAndDelete({ guildId: guild.id, userId });
        logger.info(`Auto-unjail: ${userId} in ${guild.name}`);
    }
    catch (error) {
        logger.error('Unjail failed:', error);
    }
}
exports.default = command;
//# sourceMappingURL=jail.js.map