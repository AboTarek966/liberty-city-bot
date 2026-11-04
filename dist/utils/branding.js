"use strict";
// ============================================
// Omni Bot - Branding Helpers
// ============================================
// اسم البوت العام = Omni، لكن أي نص يظهر داخل سيرفر
// يستخدم اسم السيرفر تلقائياً (مثال: سيرفر Respect → Respect).
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOT_NAME = void 0;
exports.serverName = serverName;
exports.brand = brand;
exports.BOT_NAME = 'Omni';
/** اسم السيرفر إن وُجد، وإلا اسم البوت العام */
function serverName(guild) {
    const name = guild?.name ? String(guild.name).trim() : '';
    return name || exports.BOT_NAME;
}
/** علامة موحّدة: اسم السيرفر • القسم، مع Omni كبديل خارج السيرفرات */
function brand(guild, suffix) {
    const name = serverName(guild);
    return suffix ? `${name} • ${suffix}` : name;
}
//# sourceMappingURL=branding.js.map