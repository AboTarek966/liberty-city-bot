// ============================================
// Omni Bot - Branding Helpers
// ============================================
// اسم البوت العام = Omni، لكن أي نص يظهر داخل سيرفر
// يستخدم اسم السيرفر تلقائياً (مثال: سيرفر Respect → Respect).

export const BOT_NAME = 'Omni';

type GuildLike = { name?: string | null } | null | undefined;

/** اسم السيرفر إن وُجد، وإلا اسم البوت العام */
export function serverName(guild?: GuildLike): string {
  const name = guild?.name ? String(guild.name).trim() : '';
  return name || BOT_NAME;
}

/** علامة موحّدة: اسم السيرفر • القسم، مع Omni كبديل خارج السيرفرات */
export function brand(guild?: GuildLike, suffix?: string): string {
  const name = serverName(guild);
  return suffix ? `${name} • ${suffix}` : name;
}
