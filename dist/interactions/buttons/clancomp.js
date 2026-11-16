"use strict";
// ============================================
// Omni Bot - ⚔️ لوحة أزرار مسابقات العشائر
//    customId: clancomp:start | clancomp:cancel | clancomp:standings | clancomp:status
//    أزرار إدارة/عرض المسابقة — نفس سياسة /clan (إدارة محصورة، العرض متاح).
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildClanCompPanel = buildClanCompPanel;
const discord_js_1 = require("discord.js");
const clanPerms_1 = require("../../utils/clanPerms");
const models_1 = require("../../models");
const ActivityTracker_1 = require("../../handlers/ActivityTracker");
const COLOR = 0x3b82f6;
function fmtScore(s) {
    const h = Math.floor(s.voiceMinutes / 60);
    const m = s.voiceMinutes % 60;
    return `💬 ${s.messages} رسالة · 🔊 ${h}س ${m}د · 🎙️ ${s.voiceJoins} انضمام`;
}
const periodDateKey = (period) => {
    const now = new Date();
    if (period === 'day')
        return (0, ActivityTracker_1.getDayKey)(now);
    if (period === 'week')
        return (0, ActivityTracker_1.getWeekKey)(now);
    if (period === 'month')
        return (0, ActivityTracker_1.getMonthKey)(now);
    return 'all';
};
async function clanScore(guildId, memberIds, period) {
    const date = periodDateKey(period);
    const docs = await ActivityTracker_1.ActivityStats.find({ guildId, userId: { $in: memberIds }, period, date }).lean();
    return docs.reduce((acc, d) => {
        acc.messages += d.messages || 0;
        acc.voiceMinutes += d.voiceMinutes || 0;
        acc.voiceJoins += d.voiceJoins || 0;
        return acc;
    }, { messages: 0, voiceMinutes: 0, voiceJoins: 0 });
}
function buildStartRow() {
    const start = new discord_js_1.ButtonBuilder()
        .setCustomId('clancomp:start')
        .setLabel('بدء مسابقة')
        .setEmoji('▶️')
        .setStyle(discord_js_1.ButtonStyle.Success);
    const standings = new discord_js_1.ButtonBuilder()
        .setCustomId('clancomp:standings')
        .setLabel('الترتيب الحالي')
        .setEmoji('📊')
        .setStyle(discord_js_1.ButtonStyle.Primary);
    const status = new discord_js_1.ButtonBuilder()
        .setCustomId('clancomp:status')
        .setLabel('الحالة')
        .setEmoji('📋')
        .setStyle(discord_js_1.ButtonStyle.Secondary);
    const cancel = new discord_js_1.ButtonBuilder()
        .setCustomId('clancomp:cancel')
        .setLabel('إلغاء المسابقة')
        .setEmoji('🛑')
        .setStyle(discord_js_1.ButtonStyle.Danger);
    return new discord_js_1.ActionRowBuilder().addComponents(start, standings, status, cancel);
}
/** بناء لوحة المسابقة — تُستخدم من /clan comp */
function buildClanCompPanel() {
    return buildStartRow();
}
const handler = {
    id: 'clancomp',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        const guild = interaction.guild;
        const userId = interaction.user.id;
        const action = interaction.customId.split(':')[1] || '';
        // ===== الحالة / الترتيب: عرض فقط =====
        if (action === 'status' || action === 'standings') {
            const battle = await models_1.ClanBattle.findOne({ guildId: guild.id, status: 'active' }).lean();
            if (!battle) {
                await interaction.reply({
                    content: '💤 لا توجد مسابقة نشطة حالياً — اضغط «بدء مسابقة» من اللوحة',
                    ephemeral: true,
                });
                return;
            }
            const clans = await models_1.Clan.find({ _id: { $in: battle.clanIds } }).lean();
            if (action === 'status') {
                const remainingMs = Math.max(0, new Date(battle.endsAt).getTime() - Date.now());
                const rDays = Math.floor(remainingMs / 86_400_000);
                const rHours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
                const rMin = Math.floor((remainingMs % 3_600_000) / 60_000);
                const embed = new discord_js_1.EmbedBuilder()
                    .setColor(COLOR)
                    .setTitle(`⚔️ ${battle.name} — جارية`)
                    .addFields({ name: '👥 العشائر', value: clans.map((c) => `**${c.name}** (${c.members.length})`).join('\n') || 'لا توجد' }, { name: '⏱️ الوقت المتبقي', value: `${rDays} يوم ${rHours} ساعة ${rMin} دقيقة` }, { name: '📅 تنتهي', value: `<t:${Math.floor(new Date(battle.endsAt).getTime() / 1000)}:F>` }, { name: '📣 قناة الإعلان', value: battle.channelId ? `<#${battle.channelId}>` : 'لم تحدد' })
                    .setTimestamp();
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
            // standings
            const entries = [];
            for (const clan of clans) {
                const [day, week, month] = await Promise.all([
                    clanScore(guild.id, clan.members, 'day'),
                    clanScore(guild.id, clan.members, 'week'),
                    clanScore(guild.id, clan.members, 'month'),
                ]);
                const allMsg = month.messages, allVoice = month.voiceMinutes, allJoins = month.voiceJoins;
                const score = allMsg + allVoice * 10;
                entries.push({
                    name: clan.name,
                    score,
                    line: `**${clan.name}** — نقاط: ${score}\n` +
                        `• اليوم: ${fmtScore(day)}\n• الأسبوع: ${fmtScore(week)}\n• الشهر: ${fmtScore(month)}`,
                });
            }
            entries.sort((a, b) => b.score - a.score);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(COLOR)
                .setTitle('📊 الترتيب الحالي — مسابقة العشائر')
                .setDescription(entries.map((e, i) => `${i + 1}. ${e.line}`).join('\n\n').slice(0, 4000) || 'لا توجد بيانات بعد')
                .setFooter({ text: 'النقاط = رسائل + (دقائق فويس × 10) — خلال الشهر الحالي' })
                .setTimestamp();
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        // ===== start / cancel: تحتاج صلاحية إدارة =====
        const allowed = await (0, clanPerms_1.canManageClans)(guild, userId, interaction.member, interaction.client).catch(() => false);
        if (!allowed) {
            await interaction.reply({ content: (0, clanPerms_1.clanAccessDeniedMessage)(), ephemeral: true });
            return;
        }
        if (action === 'start') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder: ARBuilder } = require('discord.js');
            const modal = new ModalBuilder().setCustomId('clancomp:startmodal').setTitle('⚔️ بدء مسابقة عشائرية');
            const clansInput = new TextInputBuilder()
                .setCustomId('clans')
                .setLabel('أسماء العشائر المتنافسة (مفصولة بفاصلة)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(200)
                .setPlaceholder('مثال: صقور الصحراء، أشبال المدينة');
            const daysInput = new TextInputBuilder()
                .setCustomId('days')
                .setLabel('عدد أيام المسابقة (1-30)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(2)
                .setPlaceholder('7');
            const nameInput = new TextInputBuilder()
                .setCustomId('name')
                .setLabel('اسم المسابقة (اختياري)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setMaxLength(48)
                .setPlaceholder('مسابقة عشائرية');
            const row1 = new ARBuilder().addComponents(clansInput);
            const row2 = new ARBuilder().addComponents(daysInput);
            const row3 = new ARBuilder().addComponents(nameInput);
            modal.addComponents(row1, row2, row3);
            await interaction.showModal(modal);
            return;
        }
        if (action === 'cancel') {
            const active = await models_1.ClanBattle.findOne({ guildId: guild.id, status: 'active' });
            if (!active) {
                await interaction.reply({ content: '💤 لا توجد مسابقة نشطة لإلغائها', ephemeral: true });
                return;
            }
            active.status = 'cancelled';
            await active.save();
            await interaction.reply({ content: `✅ تم إلغاء المسابقة «${active.name}»`, ephemeral: true });
            return;
        }
        await interaction.reply({ content: '❌ زر غير معروف', ephemeral: true });
    },
};
exports.default = handler;
//# sourceMappingURL=clancomp.js.map