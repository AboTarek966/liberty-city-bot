"use strict";
// ============================================
// Omni Bot - 🏆 /clantop — توب العشائر (صورة)
// — مرادف لـ /clan leaderboard ويشتغل من الاختصارات (/alias)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const ActivityTracker_1 = require("../../handlers/ActivityTracker");
const clanImage_1 = require("../../utils/clanImage");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('ClanTop');
function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function weekKey(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function periodDate(period) {
    const now = new Date();
    if (period === 'day')
        return dayKey(now);
    if (period === 'week')
        return weekKey(now);
    if (period === 'month')
        return monthKey(now);
    return 'all';
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('clantop')
        .setDescription('🛡️ توب العشائر — صورة بأفضل عشائر السيرفر')
        .addStringOption((o) => o
        .setName('period')
        .setDescription('الفترة الزمنية')
        .addChoices({ name: 'الكلي', value: 'total' }, { name: 'الشهر', value: 'month' }, { name: 'الأسبوع', value: 'week' }, { name: 'اليوم', value: 'day' }))
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        await interaction.deferReply();
        const period = (interaction.options.getString('period') || 'total');
        const date = periodDate(period);
        const clans = await models_1.Clan.find({ guildId: interaction.guild.id, active: true }).lean();
        const entries = [];
        for (const clan of clans) {
            const docs = await ActivityTracker_1.ActivityStats.find({ guildId: interaction.guild.id, userId: { $in: clan.members }, period, date }).lean();
            let messages = 0, voiceMinutes = 0;
            for (const doc of docs) {
                messages += doc.messages || 0;
                voiceMinutes += doc.voiceMinutes || 0;
            }
            entries.push({
                name: clan.name,
                ownerId: clan.ownerId,
                memberCount: clan.members.length,
                messages,
                voiceMinutes,
                color: clan.color,
            });
        }
        entries.sort((a, b) => (b.messages + b.voiceMinutes * 10) - (a.messages + a.voiceMinutes * 10));
        let image = null;
        try {
            image = await (0, clanImage_1.renderClanLeaderboard)(interaction.guild.name, entries.slice(0, 6));
        }
        catch (err) {
            logger.warn(`render failed: ${err?.message || err}`);
        }
        if (image) {
            const file = new discord_js_1.AttachmentBuilder(image, { name: 'clantop.png' });
            await interaction.editReply({ content: '🛡️ توب العشائر', files: [file] });
        }
        else {
            const lines = entries.length
                ? entries.slice(0, 6).map((e, i) => `${i + 1}. **${e.name}** — رسائل ${e.messages} · صوت ${e.voiceMinutes}د · أعضاء ${e.memberCount}`).join('\n')
                : 'لا توجد عشائر بعد.';
            await interaction.editReply({ content: `🛡️ توب العشائر\n${lines}` });
        }
    },
};
exports.default = command;
//# sourceMappingURL=clantop.js.map