"use strict";
// ============================================
// Omni Bot - 🧹 /ticketreset — تصفير نقاط التذاكر
// مستقل عن /resetstats (إحصائيات الرسائل/الفويس).
// الصلاحيات: إدارة السيرفر فقط. تأكيد صريح مطلوب.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('TicketReset');
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ticketreset')
        .setDescription('🧹 تصفير نقاط التذاكر وسجل الزمن — عملية نهائية')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addStringOption((o) => o
        .setName('scope')
        .setDescription('ما الذي تريد تصفيره؟')
        .setRequired(true)
        .addChoices({ name: 'كل شيء — النقاط + السجل الزمني', value: 'all' }, { name: 'النقاط فقط — تحتفظ بالسجل الزمني', value: 'points' }, { name: 'السجل الزمني فقط — تحتفظ بالنقاط', value: 'log' }))
        .addStringOption((o) => o
        .setName('confirm')
        .setDescription('اكتب «نقطة» (أو نعم) للتأكيد — العملية نهائية')
        .setRequired(true)
        .setMaxLength(32))
        .addUserOption((o) => o.setName('user').setDescription('اختياري — تصفير نقاط عضو بعينه فقط').setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.guild || !interaction.member) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        // تأكيد صريح
        const confirm = String(interaction.options.getString('confirm', true) || '').trim().toLowerCase();
        if (!['نقطة', 'نعم', 'yes', 'reset'].includes(confirm)) {
            await interaction.reply({
                content: '❌ اكتب «نقطة» في حقل confirm — هذه العملية نهائية ولا يمكن التراجع عنها.',
                ephemeral: true,
            });
            return;
        }
        const scope = interaction.options.getString('scope', true);
        const target = interaction.options.getUser('user');
        await interaction.deferReply({ ephemeral: true });
        try {
            const settings = await (0, models_1.getGuildSettings)(interaction.guild.id);
            const tickets = settings.tickets || {};
            const report = [];
            if (scope === 'all' || scope === 'points') {
                const claimStats = tickets.claimStats ?? new Map();
                const before = claimStats.size;
                if (target) {
                    const userBefore = claimStats.get(target.id) ?? 0;
                    if (!claimStats.has(target.id)) {
                        report.push(`ℹ️ **${target.tag}** ليس لديه نقاط أصلاً`);
                        tickets.claimStats = claimStats;
                    }
                    else {
                        claimStats.set(target.id, 0);
                        tickets.claimStats = claimStats;
                        settings.markModified('tickets.claimStats');
                        report.push(`📊 أُصفّرت نقاط **${target.tag}** (كانت **${userBefore}** نقطة)`);
                        settings.markModified('tickets');
                    }
                }
                else {
                    tickets.claimStats = new Map(); // نخليها Map جديدة فاضية — تضمن الحفظ
                    settings.markModified('tickets.claimStats');
                    settings.markModified('tickets');
                    report.push(`📊 تصفير كل النقاط — أُزيلت **${before}** سجلات`);
                }
            }
            if (scope === 'all' || scope === 'log') {
                const claimLog = Array.isArray(tickets.claimLog) ? tickets.claimLog : [];
                const before = claimLog.length;
                if (target) {
                    const filtered = claimLog.filter((e) => e?.userId !== target.id);
                    tickets.claimLog = filtered;
                    report.push(`📅 أُزيلت **${before - filtered.length}** سجل لعضو ${target.tag}`);
                }
                else {
                    tickets.claimLog = [];
                    report.push(`📅 أُزيل كل السجل الزمني — **${before}** سجل`);
                }
                settings.markModified('tickets.claimLog');
                settings.markModified('tickets');
            }
            settings.tickets = tickets;
            await settings.save();
            (0, models_1.invalidateGuildSettings)(interaction.guild.id);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xed4245)
                .setTitle('🧹 تم تصفير التذاكر')
                .setDescription(report.length ? report.join('\n') : 'لا شيء تأثر (كان فارغاً بالفعل).')
                .setFooter({ text: `تم بواسطة: ${interaction.user.tag}` })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        }
        catch (err) {
            logger.error(`ticketreset failed: ${err?.message || err}`);
            await interaction.editReply({ content: `❌ حدث خطأ: ${err?.message || 'غير معروف'}` });
        }
    },
};
exports.default = command;
//# sourceMappingURL=ticketreset.js.map