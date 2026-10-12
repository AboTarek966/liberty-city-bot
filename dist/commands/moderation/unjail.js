"use strict";
// ============================================
// Liberty City Bot - Unjail Command (إلغاء سجن عضو)
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
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('UnjailCommand');
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('unjail')
        .setDescription('إلغاء سجن عضو (استعادة رولاته)')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageRoles)
        .addUserOption(o => o.setName('user').setDescription('العضو المراد إلغاء سجنه').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('سبب إلغاء السجن').setRequired(false)),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageRoles],
    async execute(interaction) {
        const client = interaction.client;
        const guild = interaction.guild;
        // ⚠️ getMember قد يُرجع كائن خام — نجلب العضو من السيرفر مباشرة
        const targetUser = interaction.options.getUser('user', true);
        const member = await guild.members.fetch(targetUser.id).catch(() => null);
        const reason = interaction.options.getString('reason') || 'إلغاء سجن يدوي';
        if (!member) {
            await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
            return;
        }
        // لا يمكن إلغاء سجن نفسك
        if (member.id === interaction.user.id) {
            await interaction.reply({ content: '❌ لا يمكنك إلغاء سجن نفسك', ephemeral: true });
            return;
        }
        // التحقق من صلاحيات البوت
        if (!guild.members.me?.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({ content: '❌ البوت يحتاج صلاحية إدارة الرتب', ephemeral: true });
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
            // جلب بيانات السجن من قاعدة البيانات
            const { JailData } = await Promise.resolve().then(() => __importStar(require('../../models')));
            const jailData = await JailData.findOne({ guildId: guild.id, userId: member.id });
            if (!jailData) {
                await interaction.editReply({ content: '❌ هذا العضو غير مسجون حالياً' });
                return;
            }
            const jailRole = guild.roles.cache.get(jailData.jailRoleId);
            // إزالة رول السجن (إن كان موجوداً — قد يحذفه بوت آخر)
            if (jailRole && guild.members.me.roles.highest.comparePositionTo(jailRole) > 0) {
                if (member.roles.cache.has(jailRole.id)) {
                    await member.roles.remove(jailRole, reason).catch(() => { });
                }
            }
            // 🔓 حذف صلاحيات العضو المباشرة (member overwrites) من كل الرومات
            // هذه هي الصلاحيات الأساسية التي تمنع العضو من رؤية الرومات
            const { ChannelType } = await Promise.resolve().then(() => __importStar(require('discord.js')));
            const allChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildCategory);
            let removedOverwrites = 0;
            for (const channel of allChannels.values()) {
                try {
                    if (channel.permissionOverwrites?.cache?.has(member.id)) {
                        await channel.permissionOverwrites.delete(member, reason).catch(() => { });
                        removedOverwrites++;
                    }
                }
                catch { }
            }
            // حذف صلاحيات رول السجن أيضاً (إن بقيت)
            if (jailRole) {
                for (const channel of allChannels.values()) {
                    try {
                        if (channel.permissionOverwrites?.cache?.has(jailRole.id)) {
                            await channel.permissionOverwrites.delete(jailRole, reason).catch(() => { });
                        }
                    }
                    catch { }
                }
            }
            // استعادة الرولات السابقة
            const previousRoles = jailData.previousRoles || [];
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
            await JailData.findOneAndDelete({ guildId: guild.id, userId: member.id });
            // الرد — رسالة نصية بسيطة
            await interaction.editReply({ content: `🔓 **${member}** تم إلغاء سجنه واستعادة ${previousRoles.length} رول | ${reason}` });
            // تسجيل في السجلات
            try {
                const settings = await (0, models_1.getGuildSettings)(guild.id);
                if (settings.logging?.enabled && settings.logging.channelId) {
                    const logChannel = guild.channels.cache.get(settings.logging.channelId);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = new discord_js_1.EmbedBuilder()
                            .setTitle('🔓 إلغاء سجن عضو')
                            .setColor(embeds_1.Colors.success)
                            .addFields({ name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true }, { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }, { name: '📝 السبب', value: reason, inline: false })
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
                    }
                }
            }
            catch { }
            // إشعار العضو في الخاص
            try {
                await member.send({
                    embeds: [
                        new discord_js_1.EmbedBuilder()
                            .setTitle('🔓 تم إلغاء سجنك')
                            .setColor(embeds_1.Colors.success)
                            .setDescription(`**السيرفر:** ${guild.name}\n**السبب:** ${reason}\n\nيمكنك الآن الوصول لجميع القنوات حسب رولاتك.`)
                            .setTimestamp(),
                    ],
                }).catch(() => { });
            }
            catch { }
            logger.info(`Manual unjail: ${member.id} by ${interaction.user.id} in ${guild.name}`);
        }
        catch (error) {
            logger.error('Unjail command failed:', error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر' });
        }
    },
};
exports.default = command;
//# sourceMappingURL=unjail.js.map