"use strict";
// ============================================
// Omni Bot - 👑 إنشاء رتب الإدارة + الفواصل (مرة واحدة / idempotent)
// /createstaffroles — نفس منطق الإنشاء التلقائي عند الإقلاع
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const helpers_1 = require("../../utils/helpers");
const staffRoles_1 = require("../../utils/staffRoles");
const logger = (0, helpers_1.createLogger)('StaffRoles');
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('createstaffroles')
        .setDescription('👑 إنشاء رتب الإدارة + الفواصل بالترتيب (مرة واحدة — قابل للتكرار بأمان)')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    cooldown: 5,
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.guild) {
            await interaction.editReply({ content: '❌ يعمل في السيرفر فقط.' });
            return;
        }
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const isOwner = interaction.guild.ownerId === interaction.user.id;
        const isAdmin = member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) ?? false;
        if (!isOwner && !isAdmin) {
            await interaction.editReply({ content: '⛔ هذا الأمر لمالك السيرفر أو من يملك Administrator فقط.' });
            return;
        }
        const result = await (0, staffRoles_1.ensureStaffRoles)(interaction.guild);
        const orderLines = result.finalOrder
            .map((r, i) => `${String(i + 1).padStart(2, ' ')}. <@&${r.roleId}> \`${r.name}\``)
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle(result.skipped ? '👑 رتب الإدارة جاهزة بالفعل' : '👑 تم تجهيز رتب الإدارة')
            .addFields({ name: '🆕 تم إنشاؤها', value: result.created.length ? result.created.map((n) => `• ${n}`).join('\n').slice(0, 1024) : 'لا شيء (كانت موجودة)', inline: false }, { name: '♻️ محدّثة', value: result.reused.length ? String(result.reused.length) : '0', inline: true }, { name: '❌ فشلت', value: result.failed.length ? result.failed.join('\n').slice(0, 1024) : 'لا شيء ✅', inline: false }, { name: '📈 أعلى رتبة للبوت', value: `\`${result.botHighestName}\` (#${result.botHighestPosition})`, inline: true }, { name: '📋 الترتيب النهائي (من الأعلى)', value: orderLines.slice(0, 1024) || 'فارغ', inline: false })
            .setDescription('الرتب الجديدة تحت رتبة البوت العليا مباشرة.\nلو عايز الرتب فوق بعضها في قائمة الأعضاء — ارفع رول البوت أعلى (من Server Settings → Roles).')
            .setFooter({ text: 'Made by Omni' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=createstaffroles.js.map