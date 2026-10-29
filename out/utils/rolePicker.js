"use strict";
// ============================================
// Liberty City Bot - Role Picker (لوحة اختيار الرولات)
// برو-بوت ستايل: قائمة تعددية + أزرار (السابق/التالي/تحديد/إلغاء)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRolePickerState = createRolePickerState;
exports.getRolePickerState = getRolePickerState;
exports.deleteRolePickerState = deleteRolePickerState;
exports.getSelectedRoleIds = getSelectedRoleIds;
exports.getGrantableRoles = getGrantableRoles;
exports.getPickerRoles = getPickerRoles;
exports.buildRolePicker = buildRolePicker;
const discord_js_1 = require("discord.js");
const PAGE_SIZE = 25; // حد خيارات قائمة Discord
const TTL = 30 * 60 * 1000; // مدة صلاحية اللوحة (30 دقيقة)
const states = new Map();
function cleanup() {
    const now = Date.now();
    for (const [k, v] of states) {
        if (now - v.createdAt > TTL)
            states.delete(k);
    }
}
function createRolePickerState(userId, targetId, reason, roleIds, title) {
    cleanup();
    const sid = Math.random().toString(36).slice(2, 10);
    const state = {
        sid,
        userId,
        targetId,
        page: 0,
        reason,
        selections: new Map(),
        createdAt: Date.now(),
        ...(roleIds && roleIds.length ? { roleIds } : {}),
        ...(title ? { title } : {}),
    };
    states.set(sid, state);
    return state;
}
function getRolePickerState(sid) {
    cleanup();
    return states.get(sid);
}
function deleteRolePickerState(sid) {
    states.delete(sid);
}
// كل الرولات المختارة عبر كل الصفحات (بدون تكرار)
function getSelectedRoleIds(state) {
    const set = new Set();
    for (const ids of state.selections.values()) {
        for (const id of ids)
            set.add(id);
    }
    return [...set];
}
// الرولات التي يستطيع المنفذ إعطاؤها (مفلترة حسب الصلاحيات)
function getGrantableRoles(guild, executor) {
    const isOwner = executor.id === guild.ownerId;
    const botTop = guild.members.me?.roles.highest.position ?? 0;
    const execTop = executor.roles.highest.position;
    return [
        ...guild.roles.cache
            .filter(r => r.id !== guild.id && // بدون @everyone
            !r.managed && // بدون رولات مُدارة
            r.position < botTop && // أقل من رتبة البوت
            (isOwner || r.position < execTop))
            .sort((a, b) => b.position - a.position) // الأعلى أولاً
            .values(),
    ];
}
// الرولات المعروضة في اللوحة (قائمة محددة أو كل الرولات القابلة للإعطاء)
function getPickerRoles(state, guild, executor) {
    if (state.roleIds && state.roleIds.length) {
        return state.roleIds
            .map(id => guild.roles.cache.get(id))
            .filter((r) => !!r && r.id !== guild.id && !r.managed)
            .sort((a, b) => b.position - a.position);
    }
    return getGrantableRoles(guild, executor);
}
// بناء محتوى اللوحة (الرسالة + الأزرار)
function buildRolePicker(state, guild, executor) {
    const roles = getPickerRoles(state, guild, executor);
    const totalPages = Math.max(1, Math.ceil(roles.length / PAGE_SIZE));
    if (state.page > totalPages - 1)
        state.page = totalPages - 1;
    if (state.page < 0)
        state.page = 0;
    const pageRoles = roles.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);
    const selectedOnPage = state.selections.get(state.page) ?? [];
    const total = getSelectedRoleIds(state).length;
    const content = state.title
        ? `${state.title}\nالمحدد حاليا: ${total}`
        : `✅ <@${state.targetId}> اختر رتبة أو أكثر لإضامتها\nالمحدد حاليا: ${total}`;
    const components = [];
    // قائمة الرولات (الصفحة الحالية)
    if (pageRoles.length > 0) {
        const select = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`rolepick:${state.sid}:${state.page}`)
            .setPlaceholder('🎭 اختر رتبة أو أكثر')
            .setMinValues(0)
            .setMaxValues(pageRoles.length)
            .setOptions(pageRoles.map(r => ({
            label: (r.name || 'رول بدون اسم').replace(/[\n\r]/g, ' ').substring(0, 100),
            value: r.id,
            default: selectedOnPage.includes(r.id),
        })));
        components.push(new discord_js_1.ActionRowBuilder().addComponents(select));
    }
    // أزرار التحكم
    components.push(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`rolepick_btn:${state.sid}:prev`)
        .setLabel('السابق')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('◀')
        .setDisabled(state.page <= 0), new discord_js_1.ButtonBuilder()
        .setCustomId(`rolepick_btn:${state.sid}:next`)
        .setLabel('التالي')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('▶')
        .setDisabled(state.page >= totalPages - 1), new discord_js_1.ButtonBuilder()
        .setCustomId(`rolepick_btn:${state.sid}:confirm`)
        .setLabel('تحديد')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('✅'), new discord_js_1.ButtonBuilder()
        .setCustomId(`rolepick_btn:${state.sid}:cancel`)
        .setLabel('إلغاء')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('❌')));
    return { content, components };
}
//# sourceMappingURL=rolePicker.js.map