"use strict";
// ============================================
// Omni Bot - 🛡️ العشائر (Clans)
// ============================================
// /clan create name:... owner:... members:...
// /clan addmember name:... user:...
// /clan removemember name:... user:...
// /clan delete name:...
// /clan list
// /clan info name:...
// /clan leaderboard [period]
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
const ActivityTracker_1 = require("../../handlers/ActivityTracker");
const clanImage_1 = require("../../utils/clanImage");
const helpers_1 = require("../../utils/helpers");
const clanPerms_1 = require("../../utils/clanPerms");
const clancomp_1 = require("../../interactions/buttons/clancomp");
const logger = (0, helpers_1.createLogger)('Clan');
const DEFAULT_COLOR = 0x3498db;
const MAX_CLANS_PER_GUILD = 15;
const clanEmoji = (name) => {
    const emojis = ['🛡️', '⚔️', '🏹', '🔥', '🌟', '⚡', '🍀', '🦅', '🐉', '🐯', '🐺', '👑'];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return emojis[hash % emojis.length];
};
function parseMemberIds(input, guild) {
    const ids = new Set();
    const mention = /<@!?(\d{17,20})>/g;
    let m;
    while ((m = mention.exec(input)) !== null)
        ids.add(m[1]);
    const bare = /(?<!\d)(\d{17,20})(?!\d)/g;
    while ((m = bare.exec(input)) !== null)
        ids.add(m[1]);
    return [...ids];
}
async function resolveMemberIds(input, guild) {
    const ids = parseMemberIds(input, guild);
    const valid = [];
    for (const id of ids) {
        if (guild?.members?.cache?.has(id))
            valid.push(id);
        else {
            const fetched = await guild?.members?.fetch?.(id).catch(() => null);
            if (fetched)
                valid.push(id);
        }
    }
    return [...new Set(valid)];
}
function periodDate(period) {
    const now = new Date();
    if (period === 'day') {
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    if (period === 'week') {
        const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
        const dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
    }
    if (period === 'month')
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return 'all';
}
async function clanScore(guildId, memberIds, period) {
    const date = periodDate(period);
    const docs = await ActivityTracker_1.ActivityStats.find({ guildId, userId: { $in: memberIds }, period, date }).lean();
    let messages = 0;
    let voiceMinutes = 0;
    let voiceJoins = 0;
    for (const doc of docs) {
        messages += doc.messages || 0;
        voiceMinutes += doc.voiceMinutes || 0;
        voiceJoins += doc.voiceJoins || 0;
    }
    return { messages, voiceMinutes, voiceJoins };
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('clan')
        .setDescription('🛡️ إدارة العشائر — متتبع تفاعلاتها داخل السيرفر')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((sub) => sub
        .setName('create')
        .setDescription('✨ إنشاء عشيرة جديدة واحدة فقط (إدارة)')
        .addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true).setMaxLength(32))
        .addUserOption((o) => o.setName('owner').setDescription('مسؤول العشيرة (قائد)').setRequired(true))
        .addStringOption((o) => o.setName('members').setDescription('أعضاء العشيرة (منشن أو معرفات، مفصولة بمسافات)').setRequired(true))
        .addIntegerOption((o) => o.setName('color').setDescription('لون تمييز العشيرة (hex number، اختياري)').setMinValue(0x000000).setMaxValue(0xffffff)))
        .addSubcommand((sub) => sub
        .setName('addmember')
        .setDescription('➕ إضافة أعضاء للعشيرة')
        .addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true))
        .addStringOption((o) => o.setName('members').setDescription('الأعضاء المراد إضافتهم (منشن أو معرفات)').setRequired(true)))
        .addSubcommand((sub) => sub
        .setName('removemember')
        .setDescription('➖ إزالة أعضاء من العشيرة')
        .addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true))
        .addStringOption((o) => o.setName('members').setDescription('الأعضاء المراد إزالتهم (منشن أو معرفات)').setRequired(true)))
        .addSubcommand((sub) => sub.setName('delete').setDescription('🗑️ حذف العشيرة').addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true)))
        .addSubcommand((sub) => sub.setName('list').setDescription('📋 عرض كل العشائر'))
        .addSubcommand((sub) => sub.setName('info').setDescription('👤 معلومات عشيرة').addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true)))
        .addSubcommand((sub) => sub
        .setName('mystats')
        .setDescription('📊 إحصائياتك داخل عشيرتك (رسائل/فويس/ترتيب)')
        .addStringOption((o) => o
        .setName('period')
        .setDescription('الفترة الزمنية')
        .addChoices({ name: 'اليوم', value: 'day' }, { name: 'الأسبوع', value: 'week' }, { name: 'الشهر', value: 'month' }, { name: 'الكلي', value: 'total' })))
        .addSubcommand((sub) => sub.setName('comp').setDescription('⚔️ لوحة التحكم السريع في المسابقة (أزرار: بدء/إلغاء/ترتيب/حالة)'))
        .addSubcommand((sub) => sub
        .setName('leaderboard')
        .setDescription('🏆 لوحة أفضل العشائر (صورة)')
        .addStringOption((o) => o
        .setName('period')
        .setDescription('الفترة الزمنية')
        .addChoices({ name: 'الكلي', value: 'total' }, { name: 'الشهر', value: 'month' }, { name: 'الأسبوع', value: 'week' }, { name: 'اليوم', value: 'day' })))
        .addSubcommand((sub) => sub
        .setName('competition')
        .setDescription('⚔️ بدء مسابقة بين عشائر محددة (بعدد أيام محدد)')
        .addStringOption((o) => o
        .setName('clans')
        .setDescription('أسماء العشائر المتنافسة (افصل بفاصلة)')
        .setRequired(true)
        .setMaxLength(200))
        .addIntegerOption((o) => o
        .setName('days')
        .setDescription('عدد أيام المسابقة')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(30))
        .addChannelOption((o) => o
        .setName('channel')
        .setDescription('القناة التي يُنشر فيها إعلان الفائز')
        .setRequired(true)
        .addChannelTypes(discord_js_1.ChannelType.GuildText))
        .addStringOption((o) => o
        .setName('name')
        .setDescription('اسم المسابقة (اختياري)')
        .setMaxLength(48)))
        .addSubcommand((sub) => sub.setName('comp-cancel').setDescription('🛑 إلغاء المسابقة الجارية'))
        .addSubcommand((sub) => sub.setName('comp-status').setDescription('📡 عرض تفاصيل المسابقة الجارية'))
        .addSubcommand((sub) => sub
        .setName('settings')
        .setDescription('⚙️ عرض/تغيير إعدادات مسابقة العشائر')
        .addChannelOption((o) => o
        .setName('channel')
        .setDescription('قناة إعلان الفائز (للتحديث)'))
        .addIntegerOption((o) => o
        .setName('days')
        .setDescription('المدة الافتراضية بالأيام — 1..30')
        .setMinValue(1)
        .setMaxValue(30))),
    cooldown: 5,
    async execute(interaction) {
        if (!interaction.guild || !interaction.member) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild;
        // 🔒 إدارة/فعاليات العشائر: أدمنستريتور + أعلى رول (أو مالك البوت/مالك السيرفر)
        const READ_ONLY_SUBS = new Set(['list', 'info', 'leaderboard', 'comp-status', 'mystats']);
        if (!READ_ONLY_SUBS.has(sub)) {
            const member = interaction.member instanceof discord_js_1.GuildMember
                ? interaction.member
                : await guild.members.fetch(interaction.user.id).catch(() => null);
            const allowed = await (0, clanPerms_1.canManageClans)(guild, interaction.user.id, member, interaction.client).catch(() => false);
            if (!allowed) {
                await interaction.reply({ content: (0, clanPerms_1.clanAccessDeniedMessage)(), ephemeral: true });
                return;
            }
        }
        // ===== create =====
        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: false });
            const name = (interaction.options.getString('name', true) || '').trim();
            if (!name || name.length > 32) {
                await interaction.editReply({ content: '❌ اسم العشيرة غير صالح (حد 32 حرفاً)' });
                return;
            }
            const owner = interaction.options.getUser('owner', true);
            const membersInput = interaction.options.getString('members', true);
            const colorOpt = interaction.options.getInteger('color');
            const color = colorOpt === null || colorOpt === undefined ? DEFAULT_COLOR : Number(colorOpt);
            const memberIds = await resolveMemberIds(membersInput, guild);
            if (!memberIds.length) {
                await interaction.editReply({ content: '❌ لم أتعرف على أي أعضاء في القائمة — اكتب منشن أو معرفات مفصولة بمسافات' });
                return;
            }
            if (memberIds.length > 50) {
                await interaction.editReply({ content: '❌ الحد الأقصى 50 عضواً لكل عشيرة' });
                return;
            }
            if (!memberIds.includes(owner.id))
                memberIds.unshift(owner.id);
            const existing = await models_1.Clan.countDocuments({ guildId: guild.id, active: true });
            if (existing >= MAX_CLANS_PER_GUILD) {
                await interaction.editReply({ content: `❌ حد السيرفر (${MAX_CLANS_PER_GUILD} عشيرة) — احذف واحدة أولاً` });
                return;
            }
            const clash = await models_1.Clan.findOne({ guildId: guild.id, name });
            if (clash) {
                await interaction.editReply({ content: `❌ عشيرة باسم «${name}» موجودة بالفعل` });
                return;
            }
            const taken = await models_1.Clan.find({ guildId: guild.id, active: true, members: { $in: memberIds } }).lean();
            if (taken.length) {
                const names = taken.map((t) => `«${t.name}»`).join('، ');
                await interaction.editReply({ content: `❌ بعض الأعضاء موجودون بالفعل في ${names} — عضو لا يمكن أن ينتمي لأكثر من عشيرة` });
                return;
            }
            const clan = await models_1.Clan.create({
                guildId: guild.id,
                name,
                ownerId: owner.id,
                members: memberIds,
                color,
                description: '',
                active: true,
            });
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(color)
                .setTitle(`${clanEmoji(name)} «${name}»`)
                .setDescription('تم إنشاء العشيرة بنجاح ✅')
                .addFields({ name: '👑 المسؤول', value: `<@${owner.id}>`, inline: true }, { name: '👥 عدد الأعضاء', value: String(memberIds.length), inline: true })
                .setFooter({ text: 'احسب رسائل وفويس تلقائياً — /clan leaderboard' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // ===== addmember =====
        if (sub === 'addmember') {
            await interaction.deferReply({ ephemeral: true });
            const name = interaction.options.getString('name', true).trim();
            const membersInput = interaction.options.getString('members', true);
            const clan = await models_1.Clan.findOne({ guildId: guild.id, name, active: true });
            if (!clan) {
                await interaction.editReply({ content: `❌ لا توجد عشيرة باسم «${name}»` });
                return;
            }
            const ids = await resolveMemberIds(membersInput, guild);
            if (!ids.length) {
                await interaction.editReply({ content: '❌ لم أجد أعضاء صالحين في المدخل' });
                return;
            }
            const before = new Set(clan.members);
            const added = [];
            for (const id of ids) {
                if (before.has(id))
                    continue;
                const elsewhere = await models_1.Clan.exists({ guildId: guild.id, active: true, members: id });
                if (elsewhere)
                    continue;
                before.add(id);
                added.push(id);
            }
            if (!added.length) {
                await interaction.editReply({ content: 'ℹ️ لا توجد إضافات — الأعضاء موجودون أو في عشائر أخرى' });
                return;
            }
            clan.members = [...before];
            await clan.save();
            await interaction.editReply({ content: `✅ أُضيف ${added.length} عضو لعشيرة «${name}»` });
            return;
        }
        // ===== removemember =====
        if (sub === 'removemember') {
            await interaction.deferReply({ ephemeral: true });
            const name = interaction.options.getString('name', true).trim();
            const membersInput = interaction.options.getString('members', true);
            const clan = await models_1.Clan.findOne({ guildId: guild.id, name, active: true });
            if (!clan) {
                await interaction.editReply({ content: `❌ لا توجد عشيرة باسم «${name}»` });
                return;
            }
            const ids = new Set(parseMemberIds(membersInput, guild));
            const before = clan.members.length;
            clan.members = clan.members.filter((id) => !ids.has(id));
            const removed = before - clan.members.length;
            if (removed <= 0) {
                await interaction.editReply({ content: 'ℹ️ لم أجد أي عضو من المدخل داخل العشيرة' });
                return;
            }
            await clan.save();
            await interaction.editReply({ content: `✅ أُزيل ${removed} عضو من عشيرة «${name}»` });
            return;
        }
        // ===== delete =====
        if (sub === 'delete') {
            await interaction.deferReply({ ephemeral: true });
            const name = interaction.options.getString('name', true).trim();
            const clan = await models_1.Clan.findOne({ guildId: guild.id, name, active: true });
            if (!clan) {
                await interaction.editReply({ content: `❌ لا توجد عشيرة باسم «${name}»` });
                return;
            }
            await clan.deleteOne();
            await interaction.editReply({ content: `🗑️ تم حذف عشيرة «${name}» نهائياً` });
            return;
        }
        // ===== mystats =====
        if (sub === 'mystats') {
            await interaction.deferReply({ ephemeral: true });
            const period = (interaction.options.getString('period') || 'month');
            const memberId = interaction.user.id;
            // العشيرة التي ينتمي إليها المستخدم
            const clan = await models_1.Clan.findOne({ guildId: guild.id, active: true, members: memberId }).lean();
            if (!clan) {
                await interaction.editReply({ content: '❌ أنت مش مشترك في أي عشيرة — اطلب من الإدارة إضافتك بـ `/clan addmember`' });
                return;
            }
            const now = new Date();
            const date = period === 'day' ? (0, ActivityTracker_1.getDayKey)(now)
                : period === 'week' ? (0, ActivityTracker_1.getWeekKey)(now)
                    : period === 'month' ? (0, ActivityTracker_1.getMonthKey)(now)
                        : 'all';
            const docs = await ActivityTracker_1.ActivityStats.find({ guildId: guild.id, userId: { $in: clan.members }, period, date }).lean();
            const perMember = new Map();
            for (const d of docs) {
                const cur = perMember.get(d.userId) || { messages: 0, voiceMinutes: 0, voiceJoins: 0 };
                cur.messages += d.messages || 0;
                cur.voiceMinutes += d.voiceMinutes || 0;
                cur.voiceJoins += d.voiceJoins || 0;
                perMember.set(d.userId, cur);
            }
            const mine = perMember.get(memberId) || { messages: 0, voiceMinutes: 0, voiceJoins: 0 };
            const scoreOf = (s) => s.messages + s.voiceMinutes * 10;
            // الترتيب داخل العشيرة
            const ranked = [...perMember.entries()]
                .map(([uid, s]) => ({ uid, score: scoreOf(s) }))
                .sort((a, b) => b.score - a.score);
            const rank = ranked.findIndex((r) => r.uid === memberId) + 1;
            const totalScore = ranked.reduce((a, b) => a + b.score, 0);
            const avgPerMember = clan.members.length ? Math.round(totalScore / clan.members.length) : 0;
            const top1 = ranked[0];
            const periodLabel = { day: 'اليوم', week: 'الأسبوع', month: 'الشهر', total: 'الكلي' }[period];
            const h = Math.floor(mine.voiceMinutes / 60);
            const m = mine.voiceMinutes % 60;
            const lines = [
                `**${clanEmoji(clan.name)} ${clan.name}** — ${periodLabel}`,
                '',
                `💬 الرسائل: **${mine.messages}**`,
                `🔊 الفويس: **${h}س ${m}د** (${mine.voiceMinutes} دقيقة)`,
                `🎙️ مرات الانضمام للفويس: **${mine.voiceJoins}**`,
                `⭐ نقاطك: **${scoreOf(mine)}** (رسائل + دقائق فويس × 10)`,
                `🏆 ترتيبك داخل العشيرة: **${rank > 0 ? rank : '—'} من ${clan.members.length}**`,
                `📈 متوسط العشيرة: ${avgPerMember} نقطة`,
            ];
            if (top1 && top1.uid !== memberId) {
                lines.push(`🥇 المتصدر: <@${top1.uid}> (${top1.score})`);
            }
            else if (top1) {
                lines.push('🥇 أنت المتصدر حالياً! 🎉');
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(clan.color || DEFAULT_COLOR)
                .setTitle('📊 إحصائياتي في العشيرة')
                .setDescription(lines.join('\n'))
                .setFooter({ text: 'يُحسب من نشاط الرسائل والفويس داخل السيرفر' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // ===== comp (لوحة أزرار سريعة للمسابقة) =====
        if (sub === 'comp') {
            await interaction.deferReply({ ephemeral: true });
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x3b82f6)
                .setTitle('⚔️ لوحة مسابقة العشائر')
                .setDescription('أزرار سريعة بدلاً من أوامر طويلة:\n' +
                '• **▶️ بدء مسابقة** — نافذة فيها أسماء العشائر وعدد الأيام واسم المسابقة\n' +
                '• **📊 الترتيب الحالي** — نقاط العشائر خلال الشهر\n' +
                '• **📋 الحالة** — الوقت المتبقي وقناة الإعلان\n' +
                '• **🛑 إلغاء المسابقة** — لمن يملك صلاحية إدارة العشائر فقط')
                .setFooter({ text: 'أكمل القنوات الافتراضية من /clan settings' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed], components: [(0, clancomp_1.buildClanCompPanel)()] });
            return;
        }
        // ===== list =====
        if (sub === 'list') {
            await interaction.deferReply({ ephemeral: false });
            const clans = await models_1.Clan.find({ guildId: guild.id, active: true }).sort({ createdAt: 1 }).lean();
            if (!clans.length) {
                await interaction.editReply({ content: '📭 لا توجد عشائر بعد — ابدأ بـ `/clan create`' });
                return;
            }
            const lines = clans.map((c, i) => `${i + 1}. ${clanEmoji(c.name)} **${c.name}** — ${c.members.length} عضو`);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x3b82f6)
                .setTitle(`🛡️ عشائر ${guild.name}`)
                .setDescription(lines.join('\n'))
                .setFooter({ text: `${clans.length} عشيرة` })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // ===== info =====
        if (sub === 'info') {
            await interaction.deferReply({ ephemeral: false });
            const name = interaction.options.getString('name', true).trim();
            const clan = await models_1.Clan.findOne({ guildId: guild.id, name, active: true }).lean();
            if (!clan) {
                await interaction.editReply({ content: `❌ لا توجد عشيرة باسم «${name}»` });
                return;
            }
            const [today, week, month, total] = await Promise.all([
                clanScore(guild.id, clan.members, 'day'),
                clanScore(guild.id, clan.members, 'week'),
                clanScore(guild.id, clan.members, 'month'),
                clanScore(guild.id, clan.members, 'total'),
            ]);
            const fmtScore = (label, s) => `**${label}:** 💬 ${s.messages} رسالة · 🔊 ${Math.floor(s.voiceMinutes / 60)}س ${s.voiceMinutes % 60}د`;
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(clan.color || DEFAULT_COLOR)
                .setTitle(`🛡️ «${clan.name}»`)
                .addFields({ name: '👑 المسؤول', value: `<@${clan.ownerId}>`, inline: true }, { name: '👥 الأعضاء', value: String(clan.members.length), inline: true }, {
                name: '📊 إحصائيات التفاعل',
                value: [fmtScore('اليوم', today), fmtScore('الأسبوع', week), fmtScore('الشهر', month), fmtScore('الكلي', total)].join('\n'),
            })
                .setTimestamp();
            const memberList = clan.members.slice(0, 25).map((id) => `<@${id}>`).join(' • ');
            if (memberList)
                embed.addFields({ name: '👥 أعضاء', value: memberList.slice(0, 1024) });
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // ===== settings =====
        if (sub === 'settings') {
            await interaction.deferReply({ ephemeral: true });
            const { getGuildSettings, invalidateGuildSettings } = await Promise.resolve().then(() => __importStar(require('../../models')));
            const settings = await getGuildSettings(guild.id);
            const clansCfg = settings?.clans || {};
            const chOpt = interaction.options.getChannel('channel');
            const daysOpt = interaction.options.getInteger('days');
            if (chOpt)
                settings.clans = { ...clansCfg, battleChannelId: chOpt.id };
            if (daysOpt)
                settings.clans = { ...settings.clans, battleDurationDays: daysOpt };
            if (chOpt || daysOpt) {
                try {
                    await settings.save();
                    invalidateGuildSettings(guild.id);
                }
                catch { /* تجاهل */ }
            }
            const after = settings.clans || {};
            const battleCh = after.battleChannelId ? `<#${after.battleChannelId}>` : 'غير محددة';
            const days = after.battleDurationDays ?? 7;
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('⚙️ إعدادات مسابقة العشائر')
                .addFields({ name: '📣 قناة إعلان الفائز', value: battleCh, inline: true }, { name: '⏱️ المدة الافتراضية', value: `${days} يوم`, inline: true })
                .setFooter({ text: 'الإعدادات تُطبّق على مسابقات العشائر' });
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // ===== competition =====
        if (sub === 'competition') {
            await interaction.deferReply({ ephemeral: false });
            const { getGuildSettings, invalidateGuildSettings, ClanBattle, Clan } = await Promise.resolve().then(() => __importStar(require('../../models')));
            const clansStr = (interaction.options.getString('clans', true) || '').trim();
            const days = interaction.options.getInteger('days', true);
            const channel = interaction.options.getChannel('channel', true);
            const nameInput = (interaction.options.getString('name') || '').trim();
            const battleName = nameInput || 'مسابقة عشائرية';
            // parse clans by name (comma or Arabic comma)
            const rawNames = clansStr.split(/[,،]\s*/).map(s => s.trim()).filter(Boolean);
            if (rawNames.length < 2) {
                await interaction.editReply({ content: '❌ اكتب عشيرتين على الأقل مفصولة بفاصلة' });
                return;
            }
            const allClans = await Clan.find({ guildId: guild.id, active: true }).lean();
            const picked = [];
            const missing = [];
            for (const n of rawNames) {
                const found = allClans.find(c => c.name.toLowerCase() === n.toLowerCase());
                if (found)
                    picked.push(found);
                else
                    missing.push(n);
            }
            if (missing.length) {
                await interaction.editReply({ content: `❌ لم أجد العشائر: ${missing.map(m => `«${m}»`).join('، ')}` });
                return;
            }
            const clanIds = picked.map(p => String(p._id));
            // cancel any active battle
            const active = await ClanBattle.findOne({ guildId: guild.id, status: 'active' });
            if (active) {
                await interaction.editReply({ content: '❌ هناك مسابقة نشطة حالياً — ألغها أولاً بـ `/clan comp-cancel`' });
                return;
            }
            const duration = Math.max(1, Math.min(30, days || 7));
            const startsAt = new Date();
            const endsAt = new Date(startsAt.getTime() + duration * 24 * 60 * 60 * 1000);
            const battle = await ClanBattle.create({
                guildId: guild.id,
                name: battleName,
                clanIds,
                durationDays: duration,
                startsAt,
                endsAt,
                channelId: channel.id,
                status: 'active',
            });
            const mentions = picked.map(p => `**${p.name}** (${p.members.length} عضو)`).join('\n');
            await interaction.editReply({
                content: `⚔️ بدأت «${battleName}»!\n\nالعشائر المتنافسة:\n${mentions}\n\n⏰ المدة: ${duration} يوم\n📅 تنتهي: ${endsAt.toLocaleString('ar')}\n📣 إعلان الفائز في: <#${channel.id}>`,
            });
            return;
        }
        // ===== comp-cancel =====
        if (sub === 'comp-cancel') {
            await interaction.deferReply({ ephemeral: true });
            const { ClanBattle } = await Promise.resolve().then(() => __importStar(require('../../models')));
            const active = await ClanBattle.findOne({ guildId: guild.id, status: 'active' });
            if (!active) {
                await interaction.editReply({ content: '💤 لا توجد مسابقة نشطة لإلغائها' });
                return;
            }
            active.status = 'cancelled';
            await active.save();
            await interaction.editReply({ content: `✅ تم إلغاء المسابقة «${active.name}»` });
            return;
        }
        // ===== comp-status =====
        if (sub === 'comp-status') {
            await interaction.deferReply({ ephemeral: false });
            const { ClanBattle, Clan } = await Promise.resolve().then(() => __importStar(require('../../models')));
            const battle = await ClanBattle.findOne({ guildId: guild.id, status: 'active' }).lean();
            if (!battle) {
                await interaction.editReply({ content: '💤 لا توجد مسابقة نشطة حالياً' });
                return;
            }
            const clans = await Clan.find({ _id: { $in: battle.clanIds } }).lean();
            const now = Date.now();
            const remainingMs = Math.max(0, new Date(battle.endsAt).getTime() - now);
            const rDays = Math.floor(remainingMs / 86_400_000);
            const rHours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
            const rMin = Math.floor((remainingMs % 3_600_000) / 60_000);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0x3b82f6)
                .setTitle(`⚔️ ${battle.name} — جارية`)
                .addFields({ name: '👥 العشائر', value: clans.map(c => `**${c.name}** — ${c.members.length} عضو`).join('\n') || 'لا توجد' }, { name: '⏱️ الوقت المتبقي', value: `${rDays} يوم ${rHours} ساعة ${rMin} دقيقة` }, { name: '📅 تنتهي', value: `<t:${Math.floor(new Date(battle.endsAt).getTime() / 1000)}:F>` }, { name: '📣 قناة الإعلان', value: battle.channelId ? `<#${battle.channelId}>` : 'لم تحدد' })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        // ===== leaderboard =====
        if (sub === 'leaderboard') {
            await interaction.deferReply({ ephemeral: false });
            const period = (interaction.options.getString('period') || 'total');
            const clans = await models_1.Clan.find({ guildId: guild.id, active: true }).lean();
            const entries = [];
            for (const clan of clans) {
                const stats = await clanScore(guild.id, clan.members, period);
                entries.push({
                    name: clan.name,
                    ownerId: clan.ownerId,
                    memberCount: clan.members.length,
                    messages: stats.messages,
                    voiceMinutes: stats.voiceMinutes,
                    color: clan.color,
                });
            }
            entries.sort((a, b) => (b.messages + b.voiceMinutes * 10) - (a.messages + a.voiceMinutes * 10));
            const top = entries.slice(0, 6);
            let image = null;
            try {
                image = await (0, clanImage_1.renderClanLeaderboard)(guild.name, top);
            }
            catch (err) {
                logger.warn(`clan leaderboard render failed: ${err?.message || err}`);
            }
            const periodLabel = { day: 'اليوم', week: 'الأسبوع', month: 'الشهر', total: 'الكلي' }[period];
            if (image) {
                const file = new discord_js_1.AttachmentBuilder(image, { name: 'clans.png' });
                await interaction.editReply({
                    content: `🏆 أفضل العشائر — ${periodLabel}`,
                    files: [file],
                });
            }
            else {
                // فشل الرسم — رد نصي
                const lines = top.length
                    ? top.map((e, i) => `${i + 1}. **${e.name}** — 💬 ${e.messages} · 🔊 ${e.voiceMinutes}m · 👥 ${e.memberCount}`).join('\n')
                    : 'لا توجد عشائر بعد.';
                await interaction.editReply({ content: `🏆 أفضل العشائر — ${periodLabel}\n${lines}` });
            }
            return;
        }
    },
};
exports.default = command;
//# sourceMappingURL=clan.js.map