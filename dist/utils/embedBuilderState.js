"use strict";
// ============================================
// Liberty City Bot - Embed Builder (State + UI)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.EB_COLOR_PRESETS = exports.EB_MAIN_CONTENT = exports.EB_FOOTER_TEXT = exports.EB_PLACEHOLDER_DESCRIPTION = exports.EB_PLACEHOLDER_TITLE = exports.EB_MAX_FIELDS = exports.EB_MODAL_PREFIX = exports.EB_BUTTON_PREFIX = void 0;
exports.parseHexColor = parseHexColor;
exports.getDefaultColor = getDefaultColor;
exports.createSession = createSession;
exports.getSession = getSession;
exports.touchSession = touchSession;
exports.deleteSession = deleteSession;
exports.buildPreviewEmbed = buildPreviewEmbed;
exports.buildMainComponents = buildMainComponents;
exports.renderMain = renderMain;
exports.renderColorView = renderColorView;
exports.renderFieldDeleteView = renderFieldDeleteView;
const discord_js_1 = require("discord.js");
const embeds_1 = require("./embeds");
// --------------------------------------------
// Constants
// --------------------------------------------
const SESSION_TTL = 10 * 60 * 1000; // ⏳ مدة صلاحية الجلسة: 10 دقائق
exports.EB_BUTTON_PREFIX = 'eb|';
exports.EB_MODAL_PREFIX = 'ebm|';
exports.EB_MAX_FIELDS = 25;
exports.EB_PLACEHOLDER_TITLE = '✨ منشئ الإمبد';
exports.EB_PLACEHOLDER_DESCRIPTION = '💡 ابدأ بإضافة العنوان أو الوصف';
exports.EB_FOOTER_TEXT = 'Liberty City Embed Builder';
exports.EB_MAIN_CONTENT = '🛠️ لوحة إنشاء الإمبد — استخدم الأزرار أدناه';
exports.EB_COLOR_PRESETS = [
    { label: 'أسود', emoji: '⚫', hex: '#000000' },
    { label: 'أبيض', emoji: '⚪', hex: '#FFFFFF' },
    { label: 'أزرق ديسكورد', emoji: '🟣', hex: '#5865F2' },
    { label: 'أزرق البوت', emoji: '🔵', hex: '#00D4FF' },
    { label: 'أخضر', emoji: '🟢', hex: '#57F287' },
    { label: 'أحمر', emoji: '🔴', hex: '#ED4245' },
    { label: 'برتقالي', emoji: '🟠', hex: '#FAA61A' },
    { label: 'ذهبي', emoji: '🟡', hex: '#FEE75C' },
    { label: 'بنفسجي', emoji: '🟪', hex: '#9B59B6' },
    { label: 'وردي', emoji: '🌸', hex: '#EB459E' },
];
// --------------------------------------------
// Color Helpers
// --------------------------------------------
function parseHexColor(input) {
    const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
    if (!match)
        return null;
    return parseInt(match[1], 16);
}
const DEFAULT_COLOR = parseHexColor(String(embeds_1.Colors.primary ?? '')) ?? 0x00d4ff;
function getDefaultColor() {
    return DEFAULT_COLOR;
}
// --------------------------------------------
// State Store (In-Memory, TTL + Lazy Cleanup)
// --------------------------------------------
const sessions = new Map();
function createSession(userId, channelId) {
    const session = {
        data: { color: DEFAULT_COLOR, fields: [] },
        expiresAt: Date.now() + SESSION_TTL,
    };
    if (channelId)
        session.channelId = channelId;
    sessions.set(userId, session);
    return session;
}
function getSession(userId) {
    const session = sessions.get(userId);
    if (!session)
        return null;
    if (session.expiresAt <= Date.now()) {
        sessions.delete(userId); // ⏳ تنظيف كسول للجلسة منتهية الصلاحية
        return null;
    }
    return session;
}
function touchSession(userId) {
    const session = sessions.get(userId);
    if (session)
        session.expiresAt = Date.now() + SESSION_TTL;
}
function deleteSession(userId) {
    sessions.delete(userId);
}
// --------------------------------------------
// Preview Builder
// --------------------------------------------
function buildPreviewEmbed(data) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor(data.color)
        .setTitle(data.title?.trim() || exports.EB_PLACEHOLDER_TITLE)
        .setDescription(data.description?.trim() || exports.EB_PLACEHOLDER_DESCRIPTION)
        .setFooter({ text: exports.EB_FOOTER_TEXT });
    if (data.thumbnail)
        embed.setThumbnail(data.thumbnail);
    if (data.image)
        embed.setImage(data.image);
    if (data.fields.length > 0) {
        embed.addFields(data.fields.map(field => ({
            name: field.name,
            value: field.value,
            inline: field.inline,
        })));
    }
    return embed;
}
function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
function builderButton(id, emoji, label, style) {
    return new discord_js_1.ButtonBuilder()
        .setCustomId(`${exports.EB_BUTTON_PREFIX}${id}`)
        .setEmoji(emoji)
        .setLabel(label)
        .setStyle(style);
}
function backButton() {
    return builderButton('back', '↩️', 'رجوع', discord_js_1.ButtonStyle.Secondary);
}
function row(...components) {
    return new discord_js_1.ActionRowBuilder().addComponents(...components);
}
function buildMainComponents() {
    return [
        row(builderButton('title', '📝', 'العنوان', discord_js_1.ButtonStyle.Primary), builderButton('description', '📄', 'الوصف', discord_js_1.ButtonStyle.Primary), builderButton('color', '🎨', 'اللون', discord_js_1.ButtonStyle.Secondary)),
        row(builderButton('image', '🖼️', 'الصورة', discord_js_1.ButtonStyle.Secondary), builderButton('thumbnail', '🔍', 'الصورة المصغّرة', discord_js_1.ButtonStyle.Secondary), builderButton('addfield', '➕', 'إضافة حقل', discord_js_1.ButtonStyle.Success)),
        row(builderButton('delfield', '🗑️', 'حذف حقل', discord_js_1.ButtonStyle.Danger), builderButton('refresh', '👁️', 'تحديث المعاينة', discord_js_1.ButtonStyle.Secondary), builderButton('send', '📤', 'إرسال للقناة', discord_js_1.ButtonStyle.Success), builderButton('cancel', '🗑️', 'إلغاء', discord_js_1.ButtonStyle.Danger)),
    ];
}
// --------------------------------------------
// Views
// --------------------------------------------
function renderMain(data, status) {
    return {
        content: status || exports.EB_MAIN_CONTENT,
        embeds: [buildPreviewEmbed(data)],
        components: buildMainComponents(),
    };
}
function renderColorView(data) {
    const select = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`${exports.EB_BUTTON_PREFIX}color-select`)
        .setPlaceholder('🎨 اختر لون الإمبد...')
        .addOptions(...exports.EB_COLOR_PRESETS.map(preset => ({
        label: `${preset.emoji} ${preset.label}`,
        description: preset.hex,
        value: preset.hex,
    })), {
        label: '🔢 لون مخصص (HEX)',
        description: 'أدخل قيمة HEX يدوياً مثل #5865F2',
        value: 'custom',
    });
    return {
        content: '🎨 اختر لون الإمبد من القائمة:',
        embeds: [buildPreviewEmbed(data)],
        components: [row(select), row(backButton())],
    };
}
function renderFieldDeleteView(data) {
    const select = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId(`${exports.EB_BUTTON_PREFIX}field-select`)
        .setPlaceholder('🗑️ اختر الحقل المراد حذفه...')
        .addOptions(...data.fields.map((field, index) => {
        const option = {
            label: truncate(`${index + 1}. ${field.name}`, 100),
            value: String(index),
        };
        if (field.value)
            option.description = truncate(field.value, 100);
        return option;
    }));
    return {
        content: `🗑️ اختر الحقل المراد حذفه (${data.fields.length}/${exports.EB_MAX_FIELDS}):`,
        embeds: [buildPreviewEmbed(data)],
        components: [row(select), row(backButton())],
    };
}
//# sourceMappingURL=embedBuilderState.js.map