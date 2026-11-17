"use strict";
// ============================================
// Omni Bot - 🛍️ متجر البروجيكتات (أدوات مشتركة)
// ============================================
// المتجر وثيقة (Singleton) واحدة مشتركة لكل السيرفرات (مفتاح main).
// الخصم: ProBot يأخذ نسبة من كل تحويل — لذلك أمر الدفع يُعرض بمبلغ
// (السعر الصافي ÷ (1 - الضريبة)) حتى يصل البائع كامل السعر الصافي.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PAYEE_ID = exports.DEFAULT_PROBOT_PREFIX = exports.DEFAULT_TAX_PERCENT = exports.STORE_KEY = void 0;
exports.getStore = getStore;
exports.getStoreLean = getStoreLean;
exports.canManageStore = canManageStore;
exports.computeTransferAmount = computeTransferAmount;
exports.formatCredits = formatCredits;
exports.formatShort = formatShort;
exports.priceLine = priceLine;
exports.buildTransferCommand = buildTransferCommand;
exports.parsePrice = parsePrice;
exports.shortId = shortId;
exports.isProbotCommandLike = isProbotCommandLike;
exports.buildStoreEmbed = buildStoreEmbed;
exports.buildStoreSelect = buildStoreSelect;
exports.findProject = findProject;
exports.projectCount = projectCount;
const crypto_1 = __importDefault(require("crypto"));
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const botOwner_1 = require("./botOwner");
exports.STORE_KEY = 'main';
exports.DEFAULT_TAX_PERCENT = 5;
exports.DEFAULT_PROBOT_PREFIX = '!';
/** المستلم الافتراضي لتحويلات ProBot (مالك المتجر) — يقدر يتغير من /project config payee */
exports.DEFAULT_PAYEE_ID = process.env.STORE_PAYEE_ID || '1342238662368296980';
/** قراءة وثيقة المتجر (تنشئها عند أول استخدام) مع تحديث الإعدادات الافتراضية */
async function getStore(createIfMissing = true) {
    try {
        let doc = await models_1.Store.findOne({ key: exports.STORE_KEY });
        if (!doc && createIfMissing) {
            doc = await models_1.Store.create({
                key: exports.STORE_KEY,
                payeeId: exports.DEFAULT_PAYEE_ID,
                probotPrefix: exports.DEFAULT_PROBOT_PREFIX,
                taxPercent: exports.DEFAULT_TAX_PERCENT,
                projects: [],
                managerIds: [],
            });
        }
        // ترحيل: لو المستلم لسه فاضي أو كان افتراضي قديم (DEVELOPER_USER_ID) نحدّثه للمستلم المعتمد
        if (doc) {
            const legacyDefault = process.env.DEVELOPER_USER_ID;
            const needsMigration = !doc.payeeId || (!!legacyDefault && doc.payeeId === legacyDefault && doc.payeeId !== exports.DEFAULT_PAYEE_ID);
            if (needsMigration) {
                doc.payeeId = exports.DEFAULT_PAYEE_ID;
                await doc.save().catch(() => { });
            }
        }
        return doc;
    }
    catch (error) {
        return null;
    }
}
/** نفس القراءة لكن كـ lean (للقوائم السريعة) — قد ترجع null */
async function getStoreLean() {
    try {
        return await models_1.Store.findOne({ key: exports.STORE_KEY }).lean();
    }
    catch {
        return null;
    }
}
/** هل هذا المستخدم يدير المتجر؟ (مالك البوت أو مدير مسجل) */
async function canManageStore(client, userId) {
    if (await (0, botOwner_1.isBotOwner)(client, userId))
        return true;
    const doc = await getStore(false);
    if (!doc)
        return false;
    return (doc.managerIds || []).includes(userId);
}
/** بيانات الأمر المطلوب من المشتري تنفيذه في (ProBot) */
function computeTransferAmount(price, taxPercent) {
    const tax = Math.max(0, Math.min(25, Number(taxPercent) || 0));
    if (tax <= 0)
        return Math.ceil(price);
    return Math.ceil(price / (1 - tax / 100));
}
/** تنسيق رقم بفواصل آلاف (10,000,000) */
function formatCredits(n) {
    if (!Number.isFinite(n))
        return '0';
    return Math.floor(n).toLocaleString('en-US');
}
/** تنسيق مختصر للسعر (10M / 500K) — يُستخدم في القوائم */
function formatShort(n) {
    if (!Number.isFinite(n) || n <= 0)
        return '0';
    if (n >= 1_000_000 && n % 1_000_000 === 0)
        return `${n / 1_000_000}M`;
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)
        return `${Math.floor(n / 1_000)}K`;
    return String(Math.floor(n));
}
/** سطر سعر كامل: 10,000,000 (10M) */
function priceLine(n) {
    return `\`${formatCredits(n)}\` (${formatShort(n)})`;
}
/** بناء أمر تحويل الكريديت (ProBot/Credit) — الصيغة المطلوبة */
function buildTransferCommand(payeeId, amount) {
    return `credit ${payeeId} ${Math.max(0, Math.floor(amount))}#`;
}
/** يحوّل نص سعر إلى رقم: 10m / 500k / 10 مليون / 10,000,000 */
function parsePrice(input) {
    const raw = String(input || '').trim().toLowerCase().replace(/[,،\s_']/g, '');
    if (!raw)
        return null;
    const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)(b|m|k|مليون|الميلون|ألف|آلاف)?$/);
    if (!match) {
        const fallback = Number(raw.replace(/[^0-9]/g, ''));
        return Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : null;
    }
    const base = Number(match[1]);
    if (!Number.isFinite(base))
        return null;
    const unit = match[2] || '';
    let value = base;
    if (unit === 'b')
        value = base * 1_000_000_000;
    else if (unit === 'm' || unit === 'مليون' || unit === 'الميلون')
        value = base * 1_000_000;
    else if (unit === 'k' || unit === 'ألف' || unit === 'آلاف')
        value = base * 1_000;
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}
/** معرّف قصير للطلب/البروجيكت (مرتبط بروابط الأزرار) */
function shortId(len = 6) {
    return crypto_1.default.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}
/** يتحقق إن النص يشبه أمر تحويل كريديت */
function isProbotCommandLike(text, _prefix) {
    const t = String(text || '').trim().toLowerCase();
    return /^(?:#?credit)\s+\d+\s+\d+#?$/.test(t) || /^!pay\b/i.test(t) || /^pay\s/i.test(t);
}
/** بناء إمبد المتجر (العرض الرئيسي) */
function buildStoreEmbed(store) {
    const projects = (store.projects || []).filter((p) => p.enabled);
    const lines = projects.length
        ? projects.map((p, i) => {
            const desc = p.description?.trim() ? `\n    ┗ ${p.description.trim().slice(0, 100)}` : '';
            return `**${i + 1}.** 📦 **${p.name}** — 💰 ${priceLine(p.price)} كريديت${desc}`;
        }).join('\n')
        : 'المتجر فارغ حالياً — ترقّب الجديد عاجلاً.';
    const tax = Number(store.taxPercent ?? exports.DEFAULT_TAX_PERCENT);
    const prefix = store.probotPrefix || exports.DEFAULT_PROBOT_PREFIX;
    const payee = store.payeeId;
    return new discord_js_1.EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🛍️ متجر بروجيكتات Omni')
        .setDescription('**اختر البروجيكت اللي تبيه من القائمة بالأسفل**، وبنرسل لك أمر الدفع بالكريديت 👇\n\n' +
        lines +
        '\n\n' +
        `> 💸 **الأسعار موضع طلب تحويل صافي** — ProBot يديق **${tax}%** من كل تحويل، ` +
        'ولهذا بنعرض لك أمر التحويل **بالمبلغ اللازم** حتى يوصلك البائع السعر الصافي كامل**.\n' +
        (payee ? `> 💳 **الدفع يروح لـ <@${payee}>** عبر أمر \`credit\`.\n` : '') +
        `> ⚡ بعد ما تدفع، دوس \`دفعت\` داخل شاشة التأكيد ونوصلك إيصال فور التسليم.`)
        .setFooter({ text: `Omni Store • credit` })
        .setTimestamp();
}
/** بناء قائمة الاختيار (select) للمشاريع المفعّلة */
function buildStoreSelect(store) {
    const projects = (store.projects || []).filter((p) => p.enabled);
    const options = projects.slice(0, 25).map((p) => ({
        label: `${p.name.slice(0, 60)} — ${formatShort(p.price)} كريديت`.slice(0, 100),
        value: p.id,
        description: (p.description?.trim() || 'بروجيكت جاهز للتسليم').slice(0, 100),
        emoji: '📦',
    }));
    if (!options.length)
        return null;
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId('store:select')
        .setPlaceholder('🛒 اختر بروجيكت للشراء...')
        .addOptions(options));
    return [row];
}
/** إيجاد البروجيكت بالمعرّف (غير حساس لحالة الأحرف) */
function findProject(store, projectId) {
    return (store.projects || []).find((p) => p.id === projectId);
}
/** عدد البروجيكتات المضافة (فعّالة + معطلة) */
function projectCount(store) {
    return (store.projects || []).length;
}
//# sourceMappingURL=store.js.map