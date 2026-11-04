// ============================================
// Liberty City Bot - Ticket Message Templates
// ============================================
// رسالة الترحيب الافتراضية + استبدال المتغيرات.
// المتغيرات المدعومة: {user} {ticket} {type} {server}

export const DEFAULT_TICKET_WELCOME_MESSAGE =
  'مرحباً {user} — تم إنشاء تذكرتك بنجاح ✅\n' +
  '🎫 رقم التذكرة: {ticket}\n' +
  '🏷️ النوع: {type}';

export interface TicketWelcomeVars {
  user: string;
  ticket: string;
  type: string;
  server: string;
}

export function renderTicketWelcome(template: string, vars: TicketWelcomeVars): string {
  return String(template || '')
    .replace(/\{user\}/g, vars.user)
    .replace(/\{ticket\}/g, vars.ticket)
    .replace(/\{type\}/g, vars.type)
    .replace(/\{server\}/g, vars.server);
}
