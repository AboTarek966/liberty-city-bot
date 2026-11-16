"use strict";
// ============================================
// 👑 بوابة موافقة المالك — إطفاء الحماية بموافقة صاحب التاج
//    خيار جديد في الإعدادات ← الحماية: "موافقة المالك 👑"
//    • مفعّل (الافتراضي): أي محاولة إطفاء حماية (من اللوحة أو /protection)
//      تُرسل طلباً لمالك السيرفر (صاحب تاج الملكية) — يوافق ✅ فيُطفى فوراً،
//      أو يرفض ❌ فتبقى الحماية. لا شيء يُطفى بدون نقرته.
//    • المالك يطفى بنفسه مباشرة (هو صاحب التاج أصلاً).
//    • 🛠️ مطوّر البوت (DEVELOPER_USER_ID) يطفى بنفسه أيضاً ويملك أزرار
//      الموافقة ✅/❌ — المالك والمطوّر هما الأساسيان وحدهما.
//    • من يقدّرون "طلب" الإطفاء: المالك + المطوّر فقط.
//      🚫 الوايت ليست لم تعد تمنح أي حق — لا طلب ولا موافقة.
//      (إن لم يكن DEVELOPER_USER_ID مضبوطاً يُسمح لمن عنده صلاحية
//      الإعدادات أن يطلب — لكن الموافقة تبقى للمالك/المطوّر.)
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
exports.PROTECTION_LABELS = void 0;
exports.protectionFieldLabel = protectionFieldLabel;
exports.approvalEnabled = approvalEnabled;
exports.hasHighestServerRole = hasHighestServerRole;
exports.canDirectlyDisableProtection = canDirectlyDisableProtection;
exports.canRequestProtectionOff = canRequestProtectionOff;
exports.gateProtectionOff = gateProtectionOff;
exports.requestOwnerApproval = requestOwnerApproval;
exports.takePending = takePending;
exports.detectProtectionOffField = detectProtectionOffField;
exports.findApprovalChannel = findApprovalChannel;
exports.gateDashboardProtectionOff = gateDashboardProtectionOff;
const discord_js_1 = require("discord.js");
/** أسماء الميزات للعرض في رسائل الطلب والموافقة */
exports.PROTECTION_LABELS = {
    ownerApproval: 'خيار موافقة المالك 👑',
    antiRaid: 'مضاد الرويد 🛡️',
    antiSpam: 'مضاد السبام 🚫',
    antiLink: 'مضاد الروابط 🔗',
    antiInvite: 'مضاد الدعوات 📨',
    antiMention: 'مضاد المنشنز 📣',
    antiCaps: 'مضاد الكابس 🔠',
    antiEmoji: 'مضاد الإيموجي 😀',
    antiExplicit: 'مضاد المحتوى الإباحي 🔞',
    antiNuke: 'مضاد النيوك 💣',
    antiBot: 'مضاد البوتات 🤖',
    antiBotAbuse: 'مكافحة الإساءة للبوت 🚫',
    antiAdmin: 'مراقبة الأدمن ⚠️',
    autoBackup: 'النسخ التلقائي 💾',
    autoScan: 'الفحص الدوري 🔍',
    inviteTracker: 'تتبع الدعوات 📬',
    punishmentTracker: 'تتبع العقوبات 🔄',
    aiAutoMod: 'الأوتو مود الذكي 🤖',
    lockdown: 'وضع الطوارئ 🔒',
    blocknames: 'مسح الاسم المشبوه ☢️',
    autoMod: 'الأوتو مود 🔇',
    zalgo: 'مكافحة Zalgo 🌀',
    scamFilter: 'فلتر الاحتيال 🕵️',
    all: 'كل الحماية 🛡️',
};
/** 🎯 اسم الحماية للعرض — يدعم استثناءات القنوات بصيغة chan:<channelId>:<check> */
function protectionFieldLabel(field) {
    if (field.startsWith('chan:')) {
        const [, channelId, check] = field.split(':');
        const checkLabel = exports.PROTECTION_LABELS[check] || check || 'حماية';
        return `${checkLabel} في القناة <#${channelId}>`;
    }
    return exports.PROTECTION_LABELS[field] || field;
}
/** الطلبات المعلّقة — في الذاكرة (إعادة التشغيل تلغيها = الحماية تبقى مفعّلة = آمن) */
const PENDING = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 دقائق
/** الخيار مفعّل ما لم يُعطَّل صراحة — undefined = مفعّل (آمن افتراضياً) */
function approvalEnabled(settings) {
    return settings?.protection?.ownerApproval !== false;
}
/** هل العضو يحمل أعلى رول موجود في السيرفر؟ */
function hasHighestServerRole(guild, member) {
    if (!guild || !member)
        return false;
    const top = guild.roles.highest;
    return !!top && member.roles.cache.has(top.id);
}
/** من يقدر يطفي الحماية مباشرة (بدون طلب موافقة): مالك البوت أو حامل أعلى رول */
async function canDirectlyDisableProtection(guild, userId, member, client) {
    // "انا" = مالك البوت (التطبيق/DEVELOPER_USER_ID/OWNER_ID)
    if (client) {
        try {
            const { isBotOwner } = await Promise.resolve().then(() => __importStar(require('./botOwner')));
            if (await isBotOwner(client, userId))
                return true;
        }
        catch { /* تجاهل */ }
    }
    else {
        const devId = process.env.DEVELOPER_USER_ID;
        const ownerId = process.env.OWNER_ID;
        if (devId && userId === devId)
            return true;
        if (ownerId && userId === ownerId)
            return true;
    }
    let m = member;
    if (!m)
        m = await guild.members.fetch(userId).catch(() => null);
    return hasHighestServerRole(guild, m);
}
/** من يقدّر "طلب" إطفاء الحماية (أي شخص لديه وصول للإعدادات يمكنه الطلب، والقرار للمخوّلين) */
function canRequestProtectionOff(settings, guild, userId) {
    // السماح بتقديم الطلب — البوابة/الموافقة هي التي تقيّد التنفيذ
    return true;
}
/**
 * بوابة "إطفاء الحماية" — تُستدعى قبل تطبيق أي إطفاء.
 * تُعيد: null → مسموح بالتطبيق الفوري · نص → مُنع أو أُرسل طلب للمالك (لا يُطبَّق شيء).
 */
async function gateProtectionOff(opts) {
    if (!approvalEnabled(opts.settings))
        return null; // الخيار مطفأ → إطفاء مباشر (القديم)
    // المباشر: مالك البوت (أنا) أو حامل أعلى رول في السيرفر
    const canDirect = await canDirectlyDisableProtection(opts.guild, opts.user.id, opts.member ?? null, opts.client);
    if (canDirect)
        return null;
    const label = protectionFieldLabel(opts.field);
    const sent = await requestOwnerApproval({
        guild: opts.guild,
        channel: opts.channel,
        field: opts.field,
        requestedBy: opts.user,
    });
    return sent === 'sent'
        ? `👑 أُرسل طلب إيقاف **${label}** — **لن يُطفى شيء قبل موافقة مالك البوت أو صاحب أعلى رول** (أزرار ✅/❌ لمدة 5 دقائق)`
        : '❌ تعذّر إرسال طلب الموافقة (لا توجد صلاحية إرسال في هذه القناة)';
}
/** إرسال رسالة الطلب للمالك (منشن + أزرار موافقة/رفض) */
async function requestOwnerApproval(opts) {
    const key = `${opts.guild.id}:${opts.field}`;
    const label = protectionFieldLabel(opts.field);
    const sourceLine = opts.source ? `\n📍 المصدر: **${opts.source}**` : '';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('👑 طلب إطفاء الحماية')
        .setDescription(`**${opts.requestedBy.tag}** يطلب إيقاف **${label}**.${sourceLine}\n\n` +
        `اضغط ✅ **موافقة** لتطبيق الإيقاف فوراً، أو ❌ **رفض** لإبقاء الحماية.\n` +
        `⏰ صالح لمدة 5 دقائق — بعدها يُلغى الطلب تلقائياً.`)
        .setColor(0xf1c40f);
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`ownappr:yes:${opts.field}`)
        .setLabel('موافقة')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('✅'), new discord_js_1.ButtonBuilder()
        .setCustomId(`ownappr:no:${opts.field}`)
        .setLabel('رفض')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('❌'));
    const ch = opts.channel;
    if (!ch || typeof ch.send !== 'function')
        return 'nochannel';
    PENDING.set(key, {
        field: opts.field,
        requestedBy: opts.requestedBy.id,
        requestedByTag: opts.requestedBy.tag,
        expires: Date.now() + TTL_MS,
    });
    try {
        const mentions = new Set();
        // مالك البوت / المطوّر
        const devEnv = process.env.DEVELOPER_USER_ID;
        const ownerEnv = process.env.OWNER_ID;
        if (devEnv)
            mentions.add(`<@${devEnv}>`);
        if (ownerEnv)
            mentions.add(`<@${ownerEnv}>`);
        // أعلى رول في السيرفر (منشن رول ليصل تنبيه لصاحبه/حامليه)
        const topRole = opts.guild.roles?.highest;
        if (topRole && topRole.id !== opts.guild.id)
            mentions.add(`<@&${topRole.id}>`);
        // احتياطي: مالك السيرفر إن كان هو حامل أعلى رول أو لزيادة الوضوح
        if (opts.guild.ownerId)
            mentions.add(`<@${opts.guild.ownerId}>`);
        const content = Array.from(mentions).join(' ').trim() || undefined;
        await ch.send({
            content,
            allowedMentions: { parse: ['users', 'roles'] },
            embeds: [embed],
            components: [row],
        });
        return 'sent';
    }
    catch {
        PENDING.delete(key); // فشل الإرسال → لا طلب معلّق
        return 'nochannel';
    }
}
/** استخراج الطلب (مرة واحدة فقط + انتهاء الصلاحية) */
function takePending(guildId, field) {
    const key = `${guildId}:${field}`;
    const p = PENDING.get(key);
    if (!p)
        return null;
    PENDING.delete(key);
    if (p.expires < Date.now())
        return null; // منتهي → يُعتبر غير موجود
    return p;
}
/**
 * 🔎 استخراج أول حماية مطلوب إطفاؤها من تعديل إعدادات قادم من اللوحة.
 * يدعم المسارات: protection.<feature>.enabled=false
 * وخصائص بوليان مستقلة: ownerApproval / blockMaliciousNames.
 */
function detectProtectionOffField(updates) {
    const patch = updates?.protection;
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        return null;
    const independentFields = ['ownerApproval', 'blockMaliciousNames'];
    for (const key of independentFields) {
        if (patch[key] === false)
            return key === 'blockMaliciousNames' ? 'blocknames' : 'ownerApproval';
    }
    for (const [key, value] of Object.entries(patch)) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            continue;
        if (value.enabled === false)
            return key;
    }
    return null;
}
/** اختيار قناة يرسل فيها البوت طلب موافقة المالك (سجل الحماية ← قناة النظام ← أول قناة نصية) */
function findApprovalChannel(guild, settings) {
    const me = guild.members?.me;
    const canSend = (channel) => {
        if (!channel || typeof channel.send !== 'function')
            return false;
        try {
            if (me && typeof channel.permissionsFor === 'function') {
                const perms = channel.permissionsFor(me);
                if (perms && typeof perms.has === 'function' && !perms.has('SendMessages'))
                    return false;
            }
        }
        catch {
            /* تعذّر حساب الصلاحيات — نجرّب الإرسال */
        }
        return true;
    };
    const configuredId = settings?.protection?.logChannel;
    if (configuredId) {
        const configured = guild.channels?.cache?.get(String(configuredId));
        if (canSend(configured))
            return configured;
    }
    if (canSend(guild.systemChannel))
        return guild.systemChannel;
    const channels = [...(guild.channels?.cache?.values?.() || [])];
    return (channels.find((channel) => canSend(channel) &&
        (channel.type === 0 || channel.type === 5) &&
        typeof channel.isThread === 'function' &&
        !channel.isThread()) || null);
}
/**
 * 👑 بوابة إطفاء الحماية من **لوحة التحكم** تحديداً.
 * تختلف عن بوابة ديسكورد في أنها تطلب موافقة المالك دائماً (حتى لو خيار
 * ownerApproval نفسه مطفأ) لأن تعديل اللوحة يجب ألا يتجاوز مالك السيرفر.
 * الاستثناء الوحيد: مالك السيرفر نفسه أو مطوّر البوت.
 *
 * @returns null = مسموح فوراً · نص = تم إرسال الطلب/مُنع (لا يُطبَّق شيء)
 */
async function gateDashboardProtectionOff(opts) {
    // جلسات قديمة بدون هوية مستخدم (كلمة مرور عامة) — سماح حذر كما كان
    if (!opts.userId)
        return null;
    const member = await opts.guild.members.fetch(String(opts.userId)).catch(() => null);
    const canDirect = await canDirectlyDisableProtection(opts.guild, String(opts.userId), member, opts.client);
    if (canDirect)
        return null;
    if (!member) {
        return '⛔ لازم تكون عضواً في السيرفر عشان تطلب إيقاف الحماية';
    }
    const channel = findApprovalChannel(opts.guild, opts.settings);
    if (!channel) {
        return '❌ مفيش قناة أقدر أبعت فيها طلب الموافقة — حدد قناة سجل للحماية أو اسمح للبوت بالإرسال في قناة';
    }
    const label = protectionFieldLabel(opts.field);
    const sent = await requestOwnerApproval({
        guild: opts.guild,
        channel,
        field: opts.field,
        requestedBy: member.user,
        source: 'لوحة التحكم',
    });
    return sent === 'sent'
        ? `👑 أُرسل طلب إيقاف **${label}** — **لن يُطفأ شيء قبل موافقة مالك البوت أو صاحب أعلى رول** (صلاحية الأزرار 5 دقائق)`
        : '❌ تعذّر إرسال طلب الموافقة — تأكد أن البوت يقدر يرسل في قناة سجل الحماية';
}
//# sourceMappingURL=ownerApproval.js.map