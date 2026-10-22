"use strict";
// ============================================
// Liberty City Bot - 👑 أزرار موافقة/رفض مالك السيرفر على إطفاء الحماية
//    customId: ownappr:yes:{field} | ownappr:no:{field}
//    يقرّر فقط صاحب تاج الملكية (مالك السيرفر).
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../../models");
const ownerApproval_1 = require("../../utils/ownerApproval");
const handler = {
    id: 'ownappr',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        // 👑 يحق القرار فقط لمالك السيرفر (صاحب تاج الملكية)
        if (interaction.user.id !== interaction.guild.ownerId) {
            await interaction.reply({
                content: '👑 يحق الموافقة على إطفاء الحماية **فقط لمالك السيرفر** (صاحب التاج)',
                ephemeral: true,
            });
            return;
        }
        const parts = interaction.customId.split(':'); // [ownappr, yes|no, field]
        const verdict = parts[1];
        const field = parts[2];
        const label = ownerApproval_1.PROTECTION_LABELS[field] || field;
        const pending = (0, ownerApproval_1.takePending)(interaction.guild.id, field);
        if (!pending) {
            await interaction.update({
                content: `⏰ انتهت صلاحية طلب إيقاف **${label}** (5 دقائق) — أرسل الطلب من جديد من الإعدادات`,
                embeds: [],
                components: [],
            });
            return;
        }
        if (verdict === 'no') {
            await interaction.update({
                content: `❌ رفض مالك السيرفر ${interaction.user} طلب إيقاف **${label}** — الحماية تبقى مفعّلة ✅\nطلبه: <@${pending.requestedBy}>`,
                embeds: [],
                components: [],
            });
            return;
        }
        // ✅ موافقة → تُطبَّق الإطفاء فوراً
        try {
            const settings = await (0, models_1.getGuildSettings)(interaction.guild.id);
            const prot = settings.protection;
            if (field === 'ownerApproval') {
                prot.ownerApproval = false; // خيار الموافقة نفسه — بوليان مستقل
            }
            else {
                if (!prot[field])
                    prot[field] = { enabled: false };
                prot[field].enabled = false;
            }
            await settings.save();
            // 💾 مزامنة مؤقتات خاصة فور الإطفاء (نفس ما تفعله أزرار اللوحة بعد الحفظ)
            const client = interaction.client;
            if (field === 'autoBackup') {
                await client.securityHandler?.syncAutoBackup(interaction.guild, false).catch(() => { });
            }
            else if (field === 'autoScan') {
                await client.securityHandler?.syncAutoScan(interaction.guild).catch(() => { });
            }
            else if (field === 'inviteTracker') {
                await client.inviteTrackerHandler?.cacheGuildInvites(interaction.guild).catch(() => { });
            }
            await interaction.update({
                content: `✅ وافق مالك السيرفر ${interaction.user} — تم إيقاف **${label}** فوراً\nطلبها: <@${pending.requestedBy}> (${pending.requestedByTag})`,
                embeds: [],
                components: [],
            });
        }
        catch (error) {
            await interaction
                .update({ content: '❌ حدث خطأ أثناء تطبيق الموافقة — الحماية كما كانت', embeds: [], components: [] })
                .catch(() => { });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ownerApprovalBtn.js.map