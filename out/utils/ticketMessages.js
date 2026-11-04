"use strict";
// ============================================
// Liberty City Bot - Ticket Message Templates
// ============================================
// رسالة الترحيب الافتراضية + استبدال المتغيرات.
// المتغيرات المدعومة: {user} {ticket} {type} {server}
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_TICKET_WELCOME_MESSAGE = void 0;
exports.renderTicketWelcome = renderTicketWelcome;
exports.DEFAULT_TICKET_WELCOME_MESSAGE = 'مرحباً {user} — تم إنشاء تذكرتك بنجاح ✅\n' +
    '🎫 رقم التذكرة: {ticket}\n' +
    '🏷️ النوع: {type}';
function renderTicketWelcome(template, vars) {
    return String(template || '')
        .replace(/\{user\}/g, vars.user)
        .replace(/\{ticket\}/g, vars.ticket)
        .replace(/\{type\}/g, vars.type)
        .replace(/\{server\}/g, vars.server);
}
//# sourceMappingURL=ticketMessages.js.map