"use strict";
// ============================================
// Omni Bot - Dismiss Command (فصل إداري)
// ============================================
// أي عضو يملك Administrator يقدر يفصل أي إداري فوراً:
// يسحب كل رولات الإدارة (صلاحيات إدارية/إشرافية) من العضو.
//
// القيود الواقعية من ديسكورد:
// - مالك السيرفر مستثنى (لا يمكن المساس به).
// - الرولات الأعلى من رول البوت لا يمكن سحبها.
// - رولات البوتات/التكاملات (Managed) لا يمكن سحبها.
//
// الأوامر المتاحة عبر الاختصارات (/alias) — الاختصار يُحدَّد من قائمة علياس.
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const botOwner_1 = require("../../utils/botOwner");
const logger = (0, helpers_1.createLogger)('DismissAdmin');
// 🛡️ أي رول يملك أحد هذه الصلاحيات يُعدّ "رول إدارة" ويُسحب عند الفصل
const ADMIN_PERMISSIONS = [
    discord_js_1.PermissionFlagsBits.Administrator,
    discord_js_1.PermissionFlagsBits.ManageGuild,
    discord_js_1.PermissionFlagsBits.ManageRoles,
    discord_js_1.PermissionFlagsBits.ManageChannels,
    discord_js_1.PermissionFlagsBits.KickMembers,
    discord_js_1.PermissionFlagsBits.BanMembers,
    discord_js_1.PermissionFlagsBits.ModerateMembers,
    discord_js_1.PermissionFlagsBits.ManageMessages,
    discord_js_1.PermissionFlagsBits.ManageWebhooks,
    discord_js_1.PermissionFlagsBits.ManageNicknames,
    discord_js_1.PermissionFlagsBits.ManageThreads,
    discord_js_1.PermissionFlagsBits.ManageEvents,
    discord_js_1.PermissionFlagsBits.ViewAuditLog,
];
/** هل هذا الرول رول إدارة؟ (بدون @everyone وبدون رولات التكاملات) */
function isAdminRole(role) {
    if (!role || role.id === role.guild.id)
        return false;
    if (role.managed)
        return false;
    return ADMIN_PERMISSIONS.some((perm) => role.permissions.has(perm));
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('dismiss')
        .setDescription('🧹 فصل إداري — سحب كل رولات الإدارة من عضو فوراً')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator)
        .addUserOption((o) => o.setName('user').setDescription('العضو المراد فصله (منشن أو اختيار)').setRequired(true))
        .addStringOption((o) => o.setName('reason').setDescription('سبب الفصل (اختياري)').setRequired(false).setMaxLength(300)),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.Administrator],
    // لا تُسجل عالمياً: ديسكورد يحد التطبيق بـ100 أمر عالمي — هذا الأمر يُسجل لكل سيرفر فقط
    guildOnly: true,
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({ content: '❌ هذا الأمر داخل السيرفر فقط', ephemeral: true });
            return;
        }
        const executor = interaction.member;
        const isOwner = interaction.user.id === guild.ownerId || (0, botOwner_1.isEnvBotOwner)(interaction.user.id);
        const hasAdmin = isOwner || !!executor?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator);
        if (!hasAdmin) {
            await interaction.reply({
                content: '⛔ هذا الأمر لمن يملك صلاحية **Administrator** فقط.',
                ephemeral: true,
            });
            return;
        }
        const targetUser = interaction.options.getUser('user', true);
        const member = interaction.options.getMember('user') ||
            (await guild.members.fetch(targetUser.id).catch(() => null));
        if (!member) {
            await interaction.reply({
                content: `❌ **${targetUser.tag}** ليس موجوداً في السيرفر.`,
                ephemeral: true,
            });
            return;
        }
        if (member.user.bot) {
            await interaction.reply({ content: '❌ لا يمكن فصل بوت.', ephemeral: true });
            return;
        }
        if (member.id === guild.ownerId) {
            await interaction.reply({
                content: '❌ لا يمكن فصل مالك السيرفر — مالك السيرفر مستثنى بحكم ديسكورد.',
                ephemeral: true,
            });
            return;
        }
        const me = guild.members.me;
        if (!me) {
            await interaction.reply({ content: '❌ تعذر الوصول إلى عضوية البوت.', ephemeral: true });
            return;
        }
        if (!me.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({
                content: '❌ البوت لا يملك صلاحية **Manage Roles** لسحب الرولات.',
                ephemeral: true,
            });
            return;
        }
        await interaction.deferReply();
        const reason = (interaction.options.getString('reason') || 'فصل إداري').slice(0, 300);
        const auditReason = `فصل إداري | ${reason} | بواسطة ${interaction.user.tag}`.slice(0, 512);
        const adminRoles = member.roles.cache.filter(isAdminRole);
        if (adminRoles.size === 0) {
            await interaction.editReply({
                content: `ℹ️ **${member.user.tag}** لا يملك أي رول إدارة في هذا السيرفر.`,
            });
            return;
        }
        const botPosition = me.roles.highest.position;
        const removable = adminRoles.filter((role) => role.position < botPosition && role.editable);
        const blocked = adminRoles.filter((role) => !removable.has(role.id));
        const removed = [];
        const failed = [];
        for (const role of removable.values()) {
            try {
                await member.roles.remove(role, auditReason);
                removed.push(role);
            }
            catch (error) {
                failed.push(role);
                logger.warn(`تعذر سحب الرول «${role.name}» من ${member.user.tag}: ${error?.message || error}`);
            }
        }
        // قراءة الحالة النهائية بعد السحب (للتأكد أن العضو لم يبقَ إدارياً)
        const fresh = await guild.members.fetch(member.id).catch(() => member);
        const remainingAdmin = fresh.roles.cache.filter(isAdminRole);
        const roleList = (roles, empty) => roles.length ? roles.map((r) => `«${r.name}»`).join('، ') : empty;
        const removedNames = removed.map((r) => `«${r.name}»`).join('، ');
        const blockedNames = [...blocked.values(), ...failed].map((r) => `«${r.name}»`).join('، ');
        const remainingNames = remainingAdmin.map((r) => `«${r.name}»`).join('، ');
        // 💬 رد عادي مثل رسالة التايم أوت / الكتم (بدون إمبد)
        const lines = [
            `🧹 **${member.user.tag}** تم فصله من الإدارة — سُحبت ${removed.length} رول${removedNames ? ` (${removedNames})` : ''} | ${reason}`,
        ];
        if (blockedNames) {
            lines.push(`⚠️ تعذر سحب ${blockedNames} — رتّب رول البوت أعلى من هذه الرولات`);
        }
        if (remainingAdmin.size) {
            lines.push(`🚨 ما زال يملك رولات إدارة أعلى من البوت: ${remainingNames} — رتّب رول البوت ثم كرّر الأمر`);
        }
        await interaction.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } });
        // 📋 الإمبد للسجل فقط (بنفس نمط سجلات التايم أوت/الرولات)
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🧹 فصل إداري')
            .setColor(remainingAdmin.size ? embeds_1.Colors.warning : embeds_1.Colors.error)
            .setDescription(remainingAdmin.size
            ? `تم سحب الرولات القابلة للسحب من **${member.user.tag}**، لكن ما زال يملك رول إدارة أعلى من رول البوت.`
            : `تم فصل **${member.user.tag}** من الإدارة وسحب كل رولات الإدارة القابلة للسحب.`)
            .addFields({ name: '👤 العضو', value: `**${member.user.tag}** \`${member.id}\``, inline: true }, { name: '🛡️ المنفذ', value: `**${interaction.user.tag}** \`${interaction.user.id}\``, inline: true }, { name: '📝 السبب', value: reason, inline: false }, {
            name: `✅ الرولات المسحوبة (${removed.length})`,
            value: roleList(removed, 'لا يوجد'),
            inline: false,
        })
            .setTimestamp()
            .setFooter({ text: `${guild.name} • Dismiss Admin` });
        if (blocked.size || failed.length) {
            embed.addFields({
                name: `⚠️ رولات لم تُسحب (${blocked.size + failed.length})`,
                value: `${blockedNames}\n` +
                    '> هذه الرولات أعلى من رول البوت أو غير قابلة للتعديل — اسحب رول البوت فوقها لحماية كاملة.',
                inline: false,
            });
        }
        if (remainingAdmin.size) {
            embed.addFields({
                name: '🚨 تحذير',
                value: `العضو ما زال يملك رولات إدارة من: ${remainingNames}\n` +
                    '> رتّب رول البوت أعلى من هذه الرولات ثم كرّر الأمر.',
                inline: false,
            });
        }
        // 📋 سجل العملية في قناة السجلات (أو قناة حماية إن لم تُفعّل السجلات)
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            const logId = settings?.logging?.enabled && settings.logging.channelId
                ? settings.logging.channelId
                : settings?.protection?.logChannel;
            const logChannel = logId ? guild.channels.cache.get(logId) : null;
            if (logChannel && logChannel.isTextBased()) {
                await logChannel.send({ embeds: [embed] }).catch(() => { });
            }
        }
        catch {
            /* السجل اختياري — لا نوقف العملية */
        }
    },
};
exports.default = command;
//# sourceMappingURL=dismiss.js.map