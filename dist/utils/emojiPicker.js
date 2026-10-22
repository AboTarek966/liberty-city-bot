"use strict";
// ============================================
// Liberty City Bot - 🎨 منتقي الإيموجي للأوامر المخصصة
// قايمة اختيار إيموجي (إيموجي السيرفر ثم الشائعة) — مثل قائمة ديسكورد
// عند الاختيار يُفتح نافذة إضافة الأمر والرد يبدأ بالإيموجي جاهزاً
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEmojiSelectRows = buildEmojiSelectRows;
exports.flipEmojiPage = flipEmojiPage;
exports.resolveEmojiChoice = resolveEmojiChoice;
exports.buildCommandAddModal = buildCommandAddModal;
const discord_js_1 = require("discord.js");
/** إيموجي يونيكود الشائعة (بعد إيموجي السيرفر) */
const COMMON = [
    ['😀', 'ضحكة'], ['😂', 'ضحك بدموع'], ['🔥', 'نار'], ['❤️', 'قلب'], ['✅', 'نعم'],
    ['❌', 'لا'], ['⭐', 'نجمة'], ['👍', 'إعجاب'], ['🙏', 'شكراً'], ['😭', 'بكاء'],
    ['😎', 'كوول'], ['🎉', 'مناسبة'], ['😡', 'غضب'], ['🤔', 'تفكير'], ['💀', 'موت من الضحك'],
    ['🛡️', 'درع'], ['👑', 'تاج'], ['📌', 'مهم'], ['💬', 'كلام'], ['🚀', 'سرعة'],
];
const PAGE_SIZE = 23; // + حتى خيارين تنقل = 25 (حد ديسكورد)
const pageState = new Map(); // `${userId}:${scope}` → رقم الصفحة
function allItems(guild) {
    const guildEmojis = [...guild.emojis.cache.values()].map((e) => ({
        label: `:${e.name}:`.substring(0, 100),
        value: `gid:${e.id}`,
        emoji: { id: e.id, name: e.name || undefined, animated: !!e.animated },
    }));
    const common = COMMON.map(([ch, desc]) => ({
        label: `${ch} ${desc}`.substring(0, 100),
        value: `uni:${ch}`,
        emoji: { name: ch },
    }));
    return [...guildEmojis, ...common];
}
/** صفوف قائمة اختيار الإيموجي (بترقيم صفحات — تُحدَّث على نفس الرسالة) */
function buildEmojiSelectRows(guild, scope, userId) {
    const items = allItems(guild);
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const key = `${userId}:${scope}`;
    let page = pageState.get(key) ?? 0;
    if (page >= totalPages)
        page = totalPages - 1;
    pageState.set(key, page);
    const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const options = slice.map((it) => ({
        label: it.label,
        value: it.value,
        ...(it.emoji ? { emoji: it.emoji } : {}),
    }));
    if (page > 0)
        options.push({ label: '⬅️ الصفحة السابقة', value: 'page:prev' });
    if (page < totalPages - 1)
        options.push({ label: '➡️ المزيد من الإيموجي', value: 'page:next' });
    const select = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`settings_sel:cmdemoji:${scope}`)
        .setPlaceholder(`😀 اختر إيموجي (صفحة ${page + 1}/${totalPages}) — إيموجي السيرفر أولاً ثم الشائعة`)
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options);
    return [new discord_js_1.ActionRowBuilder().addComponents(select)];
}
/** تبديل الصفحة (+1/-1) وإعادة الصفوف */
function flipEmojiPage(guild, scope, userId, delta) {
    const key = `${userId}:${scope}`;
    const cur = pageState.get(key) ?? 0;
    pageState.set(key, Math.max(0, cur + delta));
    return buildEmojiSelectRows(guild, scope, userId);
}
/** تحويل قيمة الاختيار إلى نص جاهز داخل الرد */
function resolveEmojiChoice(guild, value) {
    if (value.startsWith('gid:')) {
        const id = value.slice(4);
        const e = guild.emojis.cache.get(id);
        if (!e || !e.name)
            return null;
        return `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
    }
    if (value.startsWith('uni:'))
        return value.slice(4);
    return null;
}
/** نافذة إضافة الأمر — الرد يبدأ بالإيموجي المختار (prefill) */
function buildCommandAddModal(scope, prefill = '') {
    const isAdmin = scope === 'admin';
    const nameInput = new discord_js_1.TextInputBuilder()
        .setCustomId('name')
        .setLabel('اسم الأمر (الكلمة التي تُكتب في الشات)')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(true);
    const contentInput = new discord_js_1.TextInputBuilder()
        .setCustomId('content')
        .setLabel('رد البوت (حتى 1900 حرف) — {user} {server}')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setMaxLength(1900)
        .setRequired(true);
    if (prefill)
        contentInput.setValue(prefill.substring(0, 1900));
    return new discord_js_1.ModalBuilder()
        .setCustomId(`settings_modal:commands:add:${scope}`)
        .setTitle(isAdmin ? '🔒 أمر للإداريين فقط' : '🔓 أمر للجميع')
        .addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput), new discord_js_1.ActionRowBuilder().addComponents(contentInput));
}
//# sourceMappingURL=emojiPicker.js.map