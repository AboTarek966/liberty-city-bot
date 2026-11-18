"use strict";
// ============================================
// Omni Bot - 🛍️ متجر Omni (أدوات مشتركة)
// ============================================
// المتجر وثيقة (Singleton) واحدة مشتركة لكل السيرفرات (مفتاح main).
// يدعم أنواعاً متعددة: بروجيكت / بوت / أداة / رتبة / خدمة / أخرى.
// الخصم: ProBot يأخذ نسبة من كل تحويل — لذلك أمر الدفع يُعرض بمبلغ
// (السعر الصافي ÷ (1 - الضريبة)) حتى يصل البائع كامل السعر الصافي.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VISIBLE_STORE_TYPE_CHOICES = exports.VISIBLE_STORE_TYPES = exports.STORE_TYPE_CHOICES = exports.STORE_TYPES = exports.STORE_PAGE_SIZE = exports.DEFAULT_PAYEE_ID = exports.DEFAULT_STORE_NAME = exports.DEFAULT_PROBOT_PREFIX = exports.DEFAULT_TAX_PERCENT = exports.STORE_KEY = void 0;
exports.normalizeStoreType = normalizeStoreType;
exports.normalizeStoreFilter = normalizeStoreFilter;
exports.storeTypeMeta = storeTypeMeta;
exports.storeTypeLabel = storeTypeLabel;
exports.normalizeItemEmoji = normalizeItemEmoji;
exports.storeItemEmoji = storeItemEmoji;
exports.deliveryFilesSummary = deliveryFilesSummary;
exports.hasDeliveryFiles = hasDeliveryFiles;
exports.normalizeImageUrl = normalizeImageUrl;
exports.normalizeStock = normalizeStock;
exports.stockSuffix = stockSuffix;
exports.isItemInStock = isItemInStock;
exports.getStore = getStore;
exports.getStoreLean = getStoreLean;
exports.canManageStore = canManageStore;
exports.computeTransferAmount = computeTransferAmount;
exports.formatCredits = formatCredits;
exports.formatShort = formatShort;
exports.priceLine = priceLine;
exports.normalizeDiscountPercent = normalizeDiscountPercent;
exports.getEffectivePrice = getEffectivePrice;
exports.projectPriceLine = projectPriceLine;
exports.parseDiscountPercent = parseDiscountPercent;
exports.buildTransferCommand = buildTransferCommand;
exports.parsePrice = parsePrice;
exports.shortId = shortId;
exports.isProbotCommandLike = isProbotCommandLike;
exports.computeStoreView = computeStoreView;
exports.getStoreName = getStoreName;
exports.buildStoreEmbed = buildStoreEmbed;
exports.buildStoreSelect = buildStoreSelect;
exports.buildStoreComponents = buildStoreComponents;
exports.findProject = findProject;
exports.findProjectByName = findProjectByName;
exports.projectCount = projectCount;
exports.storeTypeStats = storeTypeStats;
const crypto_1 = __importDefault(require("crypto"));
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const botOwner_1 = require("./botOwner");
exports.STORE_KEY = 'main';
exports.DEFAULT_TAX_PERCENT = 5;
exports.DEFAULT_PROBOT_PREFIX = '!';
exports.DEFAULT_STORE_NAME = 'متجر Omni';
/** المستلم الافتراضي لتحويلات ProBot (مالك المتجر) — يقدر يتغير من /project config payee */
exports.DEFAULT_PAYEE_ID = process.env.STORE_PAYEE_ID || '1342238662368296980';
/** عدد العناصر في كل صفحة داخل المتجر */
exports.STORE_PAGE_SIZE = 20;
exports.STORE_TYPES = [
    {
        key: 'project',
        label: 'بروجيكت',
        plural: 'البروجيكتات',
        emoji: '🛠️',
        color: 0x3498db,
        aliases: ['project', 'projects', 'بروجيكت', 'بروجكت', 'مشروع', 'مشاريع', 'برمجة'],
    },
    {
        key: 'bot',
        label: 'بوت',
        plural: 'البوتات',
        emoji: '🤖',
        color: 0x9b59b6,
        aliases: ['bot', 'bots', 'بوت', 'بوتات', 'روبوت', 'روبوتات'],
    },
    {
        key: 'tool',
        label: 'أداة',
        plural: 'الأدوات',
        emoji: '🧰',
        color: 0xe67e22,
        aliases: ['tool', 'tools', 'أداة', 'اداة', 'أدوات', 'ادوات', 'سكربت', 'سكربتات'],
    },
    {
        key: 'role',
        label: 'رتبة',
        plural: 'الرتب',
        emoji: '🏷️',
        color: 0xf1c40f,
        aliases: ['role', 'roles', 'رتبة', 'رتبه', 'رتب', 'رول', 'رولات'],
    },
    {
        key: 'service',
        label: 'خدمة',
        plural: 'الخدمات',
        emoji: '🧑‍🔧',
        color: 0x1abc9c,
        aliases: ['service', 'services', 'خدمة', 'خدمه', 'خدمات', 'تصميم', 'إدارة'],
    },
    {
        key: 'other',
        label: 'أخرى',
        plural: 'المتنوعات',
        emoji: '📦',
        color: 0x95a5a6,
        aliases: ['other', 'misc', 'أخرى', 'اخرى', 'متنوع', 'متنوعات', 'أخري'],
    },
    {
        key: 'ad',
        label: 'إعلان',
        plural: 'الإعلانات',
        emoji: '📢',
        color: 0xe74c3c,
        aliases: ['ad', 'ads', 'advert', 'إعلان', 'اعلان', 'إعلانات', 'اعلانات'],
    },
];
/** كل الأنواع كخيارات جاهزة لأوامر السلاش */
exports.STORE_TYPE_CHOICES = exports.STORE_TYPES.map((t) => ({
    name: `${t.emoji} ${t.label}`,
    value: t.key,
}));
/** الأقسام الظاهرة في واجهة المتجر — بترتيب الأزرار: بروجيكتات ← بوتات ← أدوات ← رتب ← إعلانات */
exports.VISIBLE_STORE_TYPES = [
    { key: 'project', shortPlural: 'بروجيكتات' },
    { key: 'bot', shortPlural: 'بوتات' },
    { key: 'tool', shortPlural: 'أدوات' },
    { key: 'role', shortPlural: 'رتب' },
    { key: 'ad', shortPlural: 'إعلانات' },
];
/** خيارات /store — الأقسام الأربعة فقط (بلا خدمة/أخرى) */
exports.VISIBLE_STORE_TYPE_CHOICES = exports.VISIBLE_STORE_TYPES.map(({ key }) => {
    const meta = exports.STORE_TYPES.find((t) => t.key === key);
    return { name: `${meta.emoji} ${meta.plural.replace(/^ال/, '')}`, value: meta.key };
});
/** تحويل أي نص/قيمة إلى نوع عنصر صالح (الافتراضي project للعناصر القديمة) */
function normalizeStoreType(value, fallback = 'project') {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw)
        return fallback;
    const direct = exports.STORE_TYPES.find((t) => t.key === raw || t.aliases.includes(raw));
    return direct?.key ?? fallback;
}
/** تحويل فلتر المتجر (all أو نوع محدد) */
function normalizeStoreFilter(value) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw || raw === 'all' || raw === 'كل' || raw === 'الكل')
        return 'all';
    const found = exports.STORE_TYPES.find((t) => t.key === raw || t.aliases.includes(raw));
    return found?.key ?? 'all';
}
/** ميتاداتا نوع العنصر */
function storeTypeMeta(type) {
    const key = normalizeStoreType(type);
    return exports.STORE_TYPES.find((t) => t.key === key) ?? exports.STORE_TYPES[0];
}
/** نص نوع العنصر مع الإيموجي: 🛠️ بروجيكت */
function storeTypeLabel(type) {
    const meta = storeTypeMeta(type);
    return `${meta.emoji} ${meta.label}`;
}
/** تنقية إيموجي العنصر — يقبل unicode أو <:name:id> */
function normalizeItemEmoji(input) {
    const raw = String(input ?? '').trim();
    if (!raw)
        return undefined;
    // إيموجي مخصص <:name:id> أو <a:name:id>
    if (/^<a?:[A-Za-z0-9_~]{2,32}:\d{15,22}>$/.test(raw))
        return raw;
    // إيموجي عادي (يسمح بالمركّب مثل 🧑‍🔧)
    if (raw.length <= 10 && /\p{Extended_Pictographic}/u.test(raw) && !raw.includes('<'))
        return raw;
    return undefined;
}
/** إيموجي العنصر المعروض (المخصص أو إيموجي النوع) */
function storeItemEmoji(item) {
    return normalizeItemEmoji(item.emoji) || storeTypeMeta(item.type).emoji;
}
/** ملخص الملفات المرفقة للعرض في الرسائل — الاسم + الحجم */
function deliveryFilesSummary(files) {
    const list = Array.isArray(files) ? files.filter((f) => f?.path) : [];
    if (!list.length)
        return 'بدون ملفات';
    const fmt = (b) => {
        if (!b)
            return '';
        if (b >= 1024 * 1024)
            return ` (${(b / 1024 / 1024).toFixed(1)}MB)`;
        if (b >= 1024)
            return ` (${Math.round(b / 1024)}KB)`;
        return ` (${b}B)`;
    };
    return list.map((f, i) => `> ${i + 1}. ${f?.name || 'ملف'}${fmt(f?.size)}`).join('\n');
}
/** هل يوجد ملفات مرفقة بالعنصر؟ */
function hasDeliveryFiles(item) {
    return !!item && Array.isArray(item.deliveryFiles) && item.deliveryFiles.some((f) => f?.path);
}
/** تنقية رابط الصورة — undefined = فارغ • null = رابط غير صالح */
function normalizeImageUrl(input) {
    const raw = String(input ?? '').trim();
    if (!raw)
        return undefined;
    if (!/^https?:\/\/\S+$/i.test(raw))
        return null;
    return raw.slice(0, 400);
}
/** تنقية الكمية: غير محدد = غير محدود */
function normalizeStock(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0)
        return undefined;
    return Math.min(999_999, n);
}
/** سطر الكمية (فراغ لو غير محدودة) */
function stockSuffix(item) {
    if (item.stock === undefined || item.stock === null)
        return '';
    if (item.stock <= 0)
        return ' • ⛔ نفدت الكمية';
    return ` • 📦 متاح ${item.stock}`;
}
/** هل العنصر متوفر للبيع؟ */
function isItemInStock(item) {
    return item.stock === undefined || item.stock === null || item.stock > 0;
}
/** قراءة وثيقة المتجر (تنشئها عند أول استخدام) مع تحديث الإعدادات الافتراضية */
async function getStore(createIfMissing = true) {
    try {
        let doc = await models_1.Store.findOne({ key: exports.STORE_KEY });
        if (!doc && createIfMissing) {
            doc = await models_1.Store.create({
                key: exports.STORE_KEY,
                name: exports.DEFAULT_STORE_NAME,
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
/** نسبة خصم صالحة (0 = بدون خصم) */
function normalizeDiscountPercent(value) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n <= 0)
        return 0;
    return Math.min(99, Math.max(0, n));
}
/** السعر الصافي الفعلي للعنصر بعد خصم العرض (إن وجد) */
function getEffectivePrice(project) {
    const base = Math.max(1, Math.floor(Number(project.price) || 0));
    const discount = normalizeDiscountPercent(project.discountPercent);
    if (!discount)
        return base;
    return Math.max(1, Math.ceil((base * (100 - discount)) / 100));
}
/** سطر عرض السعر مع الخصم إن وجد */
function projectPriceLine(project) {
    const base = Math.max(1, Math.floor(Number(project.price) || 0));
    const discount = normalizeDiscountPercent(project.discountPercent);
    const effective = getEffectivePrice(project);
    if (!discount)
        return priceLine(effective);
    return `~~${priceLine(base)}~~ → ${priceLine(effective)} (**خصم ${discount}%**)`;
}
/** تحليل نسبة خصم من نص مثل "25" أو "%25" أو "25%" — يرجع 0 لإزالة الخصم، null إذا غير مفهوم */
function parseDiscountPercent(input) {
    const raw = String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[٪\s]/g, '');
    if (!raw)
        return null;
    if (raw === '0' || raw === 'none' || raw === 'لا' || raw === 'بدون' || raw === 'off' || raw === 'remove')
        return 0;
    const cleaned = raw.replace(/%/g, '');
    if (!/^\d{1,2}$/.test(cleaned))
        return null;
    const n = Number(cleaned);
    if (!Number.isFinite(n))
        return null;
    if (n < 0 || n > 99)
        return null;
    return n;
}
/** بناء أمر تحويل الكريديت (ProBot/Credit) — الصيغة المطلوبة */
function buildTransferCommand(payeeId, amount) {
    return `#credit ${payeeId} ${Math.max(0, Math.floor(amount))}`;
}
/** يحوّل نص سعر إلى رقم: 10m / 500k / 10 مليون / 10,000,000 */
function parsePrice(input) {
    const raw = String(input || '')
        .trim()
        .toLowerCase()
        .replace(/[,،\s_']/g, '');
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
/** معرّف قصير للطلب/العنصر (مرتبط بروابط الأزرار) */
function shortId(len = 6) {
    return crypto_1.default.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}
/** يتحقق إن النص يشبه أمر تحويل كريديت */
function isProbotCommandLike(text, _prefix) {
    const t = String(text || '').trim().toLowerCase();
    return /^(?:#?credit)\s+\d+\s+\d+#?$/.test(t) || /^!pay\b/i.test(t) || /^pay\s/i.test(t);
}
/** حساب حالة العرض (تصفية + تقسيم صفحات) — الوضع الافتراضي: بروجيكتات */
function computeStoreView(store, opts = {}) {
    const raw = String(opts.type ?? '').trim().toLowerCase();
    const filter = (!raw ? 'project' : normalizeStoreFilter(opts.type));
    const all = (store.projects || []).filter((p) => p.enabled);
    const typeOrder = new Map(exports.STORE_TYPES.map((t, i) => [t.key, i]));
    const sortByType = (a, b) => (typeOrder.get(normalizeStoreType(a.type)) ?? 99) - (typeOrder.get(normalizeStoreType(b.type)) ?? 99);
    const filtered = (filter === 'all' ? all : all.filter((p) => normalizeStoreType(p.type) === filter)).slice().sort(sortByType);
    const totalPages = Math.max(1, Math.ceil(filtered.length / exports.STORE_PAGE_SIZE));
    const rawPage = Math.floor(Number(opts.page));
    const page = Math.min(totalPages - 1, Math.max(0, Number.isFinite(rawPage) ? rawPage : 0));
    const items = filtered.slice(page * exports.STORE_PAGE_SIZE, page * exports.STORE_PAGE_SIZE + exports.STORE_PAGE_SIZE);
    return { filter, all, filtered, items, page, totalPages, pageSize: exports.STORE_PAGE_SIZE };
}
/** اسم المتجر المعروض */
function getStoreName(store) {
    return (store.name || '').trim() || exports.DEFAULT_STORE_NAME;
}
/** بناء إمبد المتجر (العرض الرئيسي) */
function buildStoreEmbed(store, opts = {}) {
    const view = computeStoreView(store, opts);
    const name = getStoreName(store);
    const lines = [];
    if (view.filter !== 'all') {
        const meta = storeTypeMeta(view.filter);
        lines.push(`> 🔎 **تصفية:** ${meta.emoji} ${meta.plural} — \`${view.filtered.length}\` عنصر`);
    }
    if (view.items.length) {
        for (const meta of exports.STORE_TYPES) {
            const group = view.items.filter((p) => normalizeStoreType(p.type) === meta.key);
            if (!group.length)
                continue;
            lines.push(`\n**${meta.emoji} ${meta.plural}** — \`${group.length}\``);
            for (const item of group) {
                const desc = item.description?.trim();
                lines.push(`> ${storeItemEmoji(item)} **${item.name}** — 💰 ${projectPriceLine(item)}${stockSuffix(item)}`);
                if (desc)
                    lines.push(`> ┗ ${desc.slice(0, 90)}`);
            }
        }
    }
    else if (view.all.length) {
        lines.push('لا توجد عناصر في هذا القسم حالياً — جرّب قسماً آخر من الأزرار بالأسفل.');
    }
    else {
        lines.push('المتجر فارغ حالياً — ترقّب الجديد عاجلاً.');
    }
    const tax = Number(store.taxPercent ?? exports.DEFAULT_TAX_PERCENT);
    const payee = store.payeeId;
    const intro = (store.description || '').trim();
    const parts = [
        intro ? `${intro}\n` : null,
        '**اختر العنصر اللي تبيه من القائمة بالأسفل**، وبنرسل لك أمر الدفع بالكريديت 👇',
        lines.join('\n'),
        '',
        view.items.length
            ? `> 💸 **الأسعار صافية** — ProBot ياخذ **${tax}%** من كل تحويل، فبنعرض لك المبلغ اللازم حتى يوصل البائع السعر كامل.`
            : null,
        payee ? `> 💳 **الدفع يروح لـ <@${payee}>** عبر أمر \`credit\`.` : null,
        '> 🛒 تقدر تفلتر حسب النوع من أزرار الأقسام، وتتنقل بين الصفحات لو المتجر كبير.',
    ].filter(Boolean);
    let description = parts.join('\n');
    if (description.length > 4000)
        description = `${description.slice(0, 3990)}…`;
    const footerParts = [`${name} • ${view.filtered.length} عنصر`];
    if (view.totalPages > 1)
        footerParts.push(`صفحة ${view.page + 1}/${view.totalPages}`);
    return new discord_js_1.EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`🛍️ ${name}`)
        .setDescription(description)
        .setFooter({ text: `${footerParts.join(' • ')} • credit` })
        .setTimestamp();
}
/** بناء قائمة الاختيار (select) لعناصر الصفحة الحالية */
function buildStoreSelect(store, opts = {}) {
    const view = computeStoreView(store, opts);
    if (!view.items.length)
        return null;
    const options = view.items.slice(0, 25).map((p) => {
        const meta = storeTypeMeta(p.type);
        const discount = normalizeDiscountPercent(p.discountPercent);
        const effective = getEffectivePrice(p);
        const stock = p.stock;
        const stockText = stock === undefined || stock === null
            ? ''
            : stock <= 0
                ? ' • نفدت'
                : ` • ${stock} متاح`;
        return {
            label: `${p.name.slice(0, 42)} — ${formatShort(effective)}${discount ? ` (-${discount}%)` : ''}${stockText}`.slice(0, 100),
            value: p.id,
            description: (p.description?.trim() ||
                `${meta.label} • ${discount ? `خصم ${discount}%` : 'متاح للشراء'}`).slice(0, 100),
            emoji: storeItemEmoji(p),
        };
    });
    const placeholder = view.filter === 'all'
        ? '🛒 اختر عنصر للشراء...'
        : `🛒 اختر ${storeTypeMeta(view.filter).label} للشراء...`;
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
        .setCustomId('store:select')
        .setPlaceholder(placeholder)
        .addOptions(options));
    return [row];
}
/**
 * كل مكونات واجهة المتجر:
 * قائمة الاختيار + أزرار الأقسام (بوت/أداة/رتبة...) + أزرار التنقل بين الصفحات
 */
function buildStoreComponents(store, opts = {}) {
    const view = computeStoreView(store, opts);
    const rows = [];
    const select = buildStoreSelect(store, opts);
    if (select?.length)
        rows.push(...select);
    // 🔎 أزرار الفلترة — ٤ أقسام ثابتة فقط (بروجيكتات ← بوتات ← أدوات ← رتب) — بلا زر «الكل»
    if (view.all.length) {
        const filters = exports.VISIBLE_STORE_TYPES.map(({ key, shortPlural }) => {
            const meta = exports.STORE_TYPES.find((t) => t.key === key);
            const count = view.all.filter((p) => normalizeStoreType(p.type) === key).length;
            return { key: key, label: `${shortPlural} (${count})`, emoji: meta.emoji, count };
        });
        for (let i = 0; i < filters.length; i += 5) {
            const row = new discord_js_1.ActionRowBuilder();
            for (const f of filters.slice(i, i + 5)) {
                row.addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`store:nav:${f.key}:0`)
                    .setLabel(f.label.slice(0, 80))
                    .setEmoji(f.emoji)
                    .setStyle(view.filter === f.key ? discord_js_1.ButtonStyle.Primary : discord_js_1.ButtonStyle.Secondary)
                    .setDisabled(f.count === 0));
            }
            rows.push(row);
        }
    }
    // 📄 أزرار التنقل بين الصفحات
    if (view.totalPages > 1) {
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`store:nav:${view.filter}:${view.page - 1}`)
            .setLabel('السابق')
            .setEmoji('◀️')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(view.page <= 0), new discord_js_1.ButtonBuilder()
            .setCustomId('store:pageinfo')
            .setLabel(`صفحة ${view.page + 1} / ${view.totalPages}`)
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(true), new discord_js_1.ButtonBuilder()
            .setCustomId(`store:nav:${view.filter}:${view.page + 1}`)
            .setLabel('التالي')
            .setEmoji('▶️')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setDisabled(view.page >= view.totalPages - 1)));
    }
    return rows;
}
/** إيجاد العنصر بالمعرّف */
function findProject(store, projectId) {
    return (store.projects || []).find((p) => p.id === projectId);
}
/** إيجاد العنصر بالاسم (غير حساس لحالة الأحرف) */
function findProjectByName(store, name) {
    const q = String(name || '').trim().toLowerCase();
    return (store.projects || []).find((p) => p.name.toLowerCase() === q);
}
/** عدد العناصر المضافة (فعّالة + معطلة) */
function projectCount(store) {
    return (store.projects || []).length;
}
/** إحصائيات حسب النوع */
function storeTypeStats(store) {
    return exports.STORE_TYPES.map((meta) => {
        const group = (store.projects || []).filter((p) => normalizeStoreType(p.type) === meta.key);
        return {
            meta,
            total: group.length,
            enabled: group.filter((p) => p.enabled).length,
            sales: group.reduce((sum, p) => sum + (p.sales || 0), 0),
        };
    }).filter((s) => s.total > 0);
}
//# sourceMappingURL=store.js.map