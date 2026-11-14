// ============================================
// Omni Bot - Built-in Web Dashboard Auth
// ============================================
// جلسات داخل الذاكرة + كوكي موقّع + كود دخول يُرسل بالخاص لمالك البوت.
// الهدف: تأمين منفذ Express العام المكشوف للإنترنت — لا وصول لأي API بدون جلسة.

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createLogger } from './helpers';

const logger = createLogger('WebAuth');

export const SESSION_COOKIE = 'omni_dash';
export const CSRF_HEADER = 'x-omni-csrf';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // أسبوع
const CODE_TTL_MS = 10 * 60 * 1000; // 10 دقائق

// السر يستخدم لتوقيع الكوكي (مستقر عبر عمليات التشغيل إذا ضُبط DASHBOARD_SECRET)
const COOKIE_SECRET =
  process.env.DASHBOARD_SECRET || crypto.randomBytes(32).toString('hex');

export interface WebSession {
  id: string;
  /** owner = دخول مالك البوت (كلمة مرور/كود) · user = دخول عام بديسكورد */
  mode: 'owner' | 'user';
  userId?: string;
  username?: string;
  avatar?: string;
  /** هل صاحب الجلسة مالك البوت نفسه؟ (وصول كامل للسيرفرات) */
  isBotOwner?: boolean;
  authMethod: 'password' | 'code' | 'oauth' | 'password+oauth' | 'code+oauth';
  oauthVerified: boolean;
  createdAt: number;
  lastSeen: number;
  lastActivityPersistedAt?: number;
  lastPath?: string;
  requestCount?: number;
}

export type GuildAccessLevel = 'owner' | 'admin' | 'staff' | 'member';

export interface GuildAccess {
  level: GuildAccessLevel;
  isOwner: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  roleNames: string[];
  /** وصول إداري كامل لأن المستخدم مالك البوت (حتى لو مش عضو) */
  viaBotOwner?: boolean;
}

const sessions = new Map<string, WebSession>();

// تنظيف دوري للجلسات المنتهية
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastSeen > SESSION_TTL_MS) sessions.delete(id);
  }
}, 60 * 60 * 1000);
cleanupTimer.unref?.();

// --------------------------------------------
// Helpers
// --------------------------------------------
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  try {
    return crypto.timingSafeEqual(ha, hb);
  } catch {
    return false;
  }
}

function sign(sessionId: string): string {
  return crypto.createHmac('sha256', COOKIE_SECRET).update(sessionId).digest('hex');
}

export function tokenHash(sessionId: string): string {
  return crypto.createHash('sha256').update(sessionId).digest('hex');
}

export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

const COUNTRY_NAMES: Record<string, string> = {
  AE: 'الإمارات', SA: 'السعودية', EG: 'مصر', KW: 'الكويت', QA: 'قطر',
  BH: 'Bahrain', OM: 'عُمان', IQ: 'العراق', JO: 'الأردن', LB: 'لبنان',
};
export function parseDevice(ua = '') {
  const normalized = String(ua || '').toLowerCase();
  const isTablet = /ipad|tablet|kindle/.test(normalized);
  const isMobile = !isTablet && /iphone|android.*mobile|mobile/.test(normalized);
  const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
  const browserName = /edg\//.test(normalized) ? 'Edge' : /chrome\//.test(normalized) ? 'Chrome' : /firefox\//.test(normalized) ? 'Firefox' : /safari\//.test(normalized) ? 'Safari' : /opera\//.test(normalized) ? 'Opera' : 'المتصفح';
  const osName = /windows/.test(normalized) ? 'Windows' : /mac os x|macintosh/.test(normalized) ? 'macOS' : /android/.test(normalized) ? 'Android' : /iphone|ipad|ipod/.test(normalized) ? 'iOS' : /linux/.test(normalized) ? 'Linux' : 'نظام غير معروف';
  const deviceName = isMobile ? 'جوال' : isTablet ? 'تابلت' : 'جهاز';
  return { deviceName, deviceType, browserName, osName };
}

function countryFromRequest(req: Request): { countryCode?: string; countryName?: string } {
  const code = String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country'] || '').trim().toUpperCase();
  if (!code || code === 'XX' || code === 'XX-') return {};
  return { countryCode: code, countryName: COUNTRY_NAMES[code] || code };
}

async function storeAudit(session: WebSession, req?: Request, authMethod: WebSession['authMethod'] = 'password') {
  try {
    const { DashboardSession } = await import('../models/DashboardSession');
    const device = req ? parseDevice(String(req.headers['user-agent'] || '')) : { deviceName: 'جهاز', deviceType: 'desktop', browserName: 'المتصفح', osName: 'نظام غير معروف' };
    const country = req ? countryFromRequest(req) : {};
    await DashboardSession.findOneAndUpdate(
      { tokenHash: tokenHash(session.id) },
      {
        $setOnInsert: {
          tokenHash: tokenHash(session.id),
          userId: session.userId,
          username: session.username,
          authMethod,
          ip: req ? clientIp(req) : 'unknown',
          userAgent: String(req?.headers['user-agent'] || '').slice(0, 512),
          createdAt: new Date(session.createdAt),
        },
        $set: {
          ...country,
          ...device,
          oauthVerified: Boolean(session.oauthVerified),
          lastPath: req?.path,
          requestCount: session.requestCount || 0,
          lastSeenAt: new Date(session.lastSeen),
          revokedAt: undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch { /* تسجيل نشاط الجلسة اختياري */ }
}

async function touchAudit(session: WebSession, path?: string) {
  try {
    const { DashboardSession } = await import('../models/DashboardSession');
    await DashboardSession.updateOne(
      { tokenHash: tokenHash(session.id), revokedAt: { $exists: false } },
      {
        $set: { lastSeenAt: new Date(session.lastSeen), lastPath: path || session.lastPath, requestCount: session.requestCount || 0 },
        $inc: { requestCount: 0 },
      }
    );
  } catch { /* تجاهل */ }
}

async function revokeAudit(sessionId: string) {
  try {
    const { DashboardSession } = await import('../models/DashboardSession');
    await DashboardSession.updateOne({ tokenHash: tokenHash(sessionId) }, { $set: { revokedAt: new Date() } });
  } catch { /* تجاهل */ }
}

async function markAuditVerified(sessionId: string, userId: string, username: string, authMethod: WebSession['authMethod'] = 'password+oauth') {
  try {
    const { DashboardSession } = await import('../models/DashboardSession');
    // الموديل يقبل oauth فقط — لا نخزّن القيم المركبة password+oauth/code+oauth
    const auditMethod = String(authMethod).includes('oauth') ? 'oauth' : authMethod;
    await DashboardSession.updateOne({ tokenHash: tokenHash(sessionId) }, {
      $set: { oauthVerified: true, userId, username, authMethod: auditMethod, lastSeenAt: new Date() },
    });
  } catch { /* تجاهل */ }
}

export function getAllActiveSessions() {
  return Array.from(sessions.values())
    .filter((s) => Date.now() - s.lastSeen <= SESSION_TTL_MS)
    .map((s) => ({
      sessionId: s.id,
      userId: s.userId,
      username: s.username,
      authMethod: s.authMethod,
      oauthVerified: s.oauthVerified,
      requestCount: s.requestCount || 0,
      lastPath: s.lastPath || null,
      lastSeenAt: s.lastSeen,
      createdAt: s.createdAt,
    }))
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function listPersistedSessions() {
  try {
    const { DashboardSession } = await import('../models/DashboardSession');
    const docs = await DashboardSession.find({}).sort({ lastSeenAt: -1 }).limit(200).lean();
    return docs.map((d: any) => ({...d, id: d._id?.toString?.() || d.id}));
  } catch {
    return [];
  }
}

export function markOAuthVerified(
  sessionId: string,
  userId: string,
  username: string,
  extra: { avatar?: string; isBotOwner?: boolean } = {}
): WebSession | null {
  const session = sessions.get(sessionId);
  if (!session || Date.now() - session.lastSeen > SESSION_TTL_MS) return null;
  session.userId = userId;
  session.username = username;
  if (extra.avatar) session.avatar = extra.avatar;
  if (typeof extra.isBotOwner === 'boolean') session.isBotOwner = extra.isBotOwner;
  session.oauthVerified = true;
  session.authMethod =
    session.authMethod === 'code'
      ? 'code+oauth'
      : session.authMethod === 'password'
        ? 'password+oauth'
        : 'oauth';
  session.lastSeen = Date.now();
  void markAuditVerified(sessionId, userId, username, session.authMethod);
  return session;
}

export function oauthRequired(): boolean {
  const v = String(process.env.DASHBOARD_REQUIRE_OAUTH || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** سر عميل Discord — يدعم الاسم القديم المستخدم في الاستضافة */
export function discordClientSecret(): string {
  return process.env.DISCORD_CLIENT_SECRET || process.env.DASHBOARD_OAUTH2_SECRET || '';
}

export function oauthConfigured(): boolean {
  // Client ID وحده كافٍ لـOAuth (Code flow عند وجود Secret، وإلا Implicit flow)
  return Boolean(process.env.DISCORD_CLIENT_ID);
}

export function oauthRedirect(req: Request): string {
  const forced = String(
    process.env.DISCORD_REDIRECT_URI ||
      process.env.DISCORD_OAUTH_REDIRECT_URI ||
      process.env.DASHBOARD_OAUTH_REDIRECT_URI ||
      ''
  ).trim();
  if (forced) return forced;
  // خلف بروكسي الاستضافة: نعتمد على الترويسات forwarded حتى يطلع https صح
  const host = String(
    req.headers['x-forwarded-host'] || req.get('host') || ''
  )
    .split(',')[0]
    .trim();
  if (!host) return '';

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  // Discord يطلب HTTPS لأي دومين غير localhost — حتى لو البروكسي مش بيبعت forwarded-proto
  const proto = forwardedProto === 'https' || forwardedProto === 'http'
    ? forwardedProto
    : isLocal
      ? 'http'
      : 'https';
  return `${proto}://${host}/dashboard/auth/oauth/callback`;
}

// --------------------------------------------
// صلاحيات المستخدم داخل كل سيرفر — للوحة العامة
// --------------------------------------------
const ACCESS_TTL_MS = 60 * 1000;
const accessCache = new Map<string, { access: GuildAccess | null; expiresAt: number }>();
const accessPending = new Map<string, Promise<GuildAccess | null>>();

/**
 * 💡 تلميح من OAuth: قائمة السيرفرات اللي المستخدم عضو فيها وصلاحياته فيها
 * (تأتي من GET /users/@me/guilds لحظة تسجيل الدخول — أسرع من كاش الأعضاء
 * وبتشتغل حتى لو العضو مش محمّل في الكاش، وده اللي يخلي اللوحة تتوسّع لأي عدد سيرفرات).
 */
interface OAuthGuildHint {
  owner: boolean;
  admin: boolean;
}

const OAUTH_HINTS_TTL_MS = 15 * 60 * 1000;
const oauthGuildHints = new Map<string, { guilds: Map<string, OAuthGuildHint>; expiresAt: number }>();

/** يخزّن سيرفرات المستخدم من رد ديسكورد (owner/admin عبر ManageGuild أو Administrator) */
export function rememberOAuthGuilds(
  userId: string,
  guilds: Array<{ id: string; owner?: boolean; permissions?: string | number }>
): void {
  if (!userId || !Array.isArray(guilds)) return;
  const map = new Map<string, OAuthGuildHint>();
  for (const g of guilds) {
    if (!g?.id) continue;
    let perms = 0n;
    try {
      perms = BigInt(String(g.permissions ?? '0'));
    } catch {
      perms = 0n;
    }
    const admin = Boolean(g.owner) || (perms & 0x8n) !== 0n || (perms & 0x20n) !== 0n;
    map.set(String(g.id), { owner: Boolean(g.owner), admin });
  }
  oauthGuildHints.set(userId, { guilds: map, expiresAt: Date.now() + OAUTH_HINTS_TTL_MS });
  // مسح أي كاش وصول قديم لهذا المستخدم عشان التلميحات الجديدة تاخد مفعولها
  for (const key of accessCache.keys()) {
    if (key.endsWith(`:${userId}`)) accessCache.delete(key);
  }
}

function oauthHintFor(userId: string, guildId: string): OAuthGuildHint | null {
  const entry = oauthGuildHints.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    oauthGuildHints.delete(userId);
    return null;
  }
  return entry.guilds.get(guildId) || null;
}

/**
 * 🔍 مستوى وصول عضو ديسكورد في سيرفر:
 *  - owner: صاحب السيرفر (التاج)
 *  - admin: Administrator / ManageGuild / رولات إدارة التذاكر
 *  - staff: رولات الدعم / صلاحيات إشراف (ManageMessages, Kick, Ban, Timeout)
 *  - member: عضو عادي
 * null = ليس عضواً في السيرفر
 */
export async function resolveGuildAccess(
  client: any,
  userId: string,
  guildId: string
): Promise<GuildAccess | null> {
  if (!userId || !guildId) return null;
  const cacheKey = `${guildId}:${userId}`;
  const cached = accessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.access;
  const pending = accessPending.get(cacheKey);
  if (pending) return pending;

  const load = (async (): Promise<GuildAccess | null> => {
    try {
      const guild = client?.guilds?.cache?.get(guildId);
      if (!guild) return null;

      // 💡 تلميح OAuth أولاً: لو المستخدم داخل السيرفر فعلاً مش محتاجين نضرب Discord API
      const hint = oauthHintFor(userId, guildId);

      let member = guild.members?.cache?.get(userId) || null;
      if (!member && !hint && typeof guild.members?.fetch === 'function') {
        member = await guild.members.fetch(userId).catch(() => null);
      }
      if (!member && !hint) return null;

      let ticketAdminIds: string[] = [];
      let ticketSupportIds: string[] = [];
      try {
        const { getGuildSettings } = await import('../models');
        const settings: any = await getGuildSettings(guildId);
        ticketAdminIds = Array.isArray(settings?.tickets?.adminRoleIds)
          ? settings.tickets.adminRoleIds
          : [];
        ticketSupportIds = Array.isArray(settings?.tickets?.supportRoleIds)
          ? settings.tickets.supportRoleIds
          : [];
      } catch {
        /* تعذّر قراءة الإعدادات — نعتمد على صلاحيات ديسكورد فقط */
      }

      const hasAnyRole = (ids: string[]) => ids.some((id) => member?.roles?.cache?.has?.(id));
      const perms = member?.permissions;
      const hasPerm = (name: string) => {
        try {
          return Boolean(perms?.has?.(name as any));
        } catch {
          return false;
        }
      };

      const hasTicketAdmin = hasAnyRole(ticketAdminIds);
      const isOwner = Boolean(hint?.owner) || String(guild.ownerId) === String(userId);
      const isAdmin =
        isOwner || Boolean(hint?.admin) || hasPerm('Administrator') || hasPerm('ManageGuild') || hasTicketAdmin;
      const isStaff =
        isAdmin ||
        hasAnyRole(ticketSupportIds) ||
        hasPerm('ManageMessages') ||
        hasPerm('KickMembers') ||
        hasPerm('BanMembers') ||
        hasPerm('ModerateMembers');

      const level: GuildAccessLevel = isOwner
        ? 'owner'
        : isAdmin
          ? 'admin'
          : isStaff
            ? 'staff'
            : 'member';

      const roleNames = member
        ? [...(member.roles?.cache?.values?.() || [])]
            .filter((r: any) => String(r.id) !== String(guild.id))
            .sort((a: any, b: any) => (b.position || 0) - (a.position || 0))
            .map((r: any) => r.name)
            .filter(Boolean)
            .slice(0, 12)
        : [];

      return { level, isOwner, isAdmin, isStaff, roleNames };
    } catch {
      return null;
    }
  })();

  accessPending.set(cacheKey, load);
  try {
    const access = await load;
    accessCache.set(cacheKey, { access, expiresAt: Date.now() + ACCESS_TTL_MS });
    return access;
  } finally {
    accessPending.delete(cacheKey);
  }
}

export const oauthFlows = new Map<string, { sessionId?: string; expiresAt: number }>();
export function createOAuthState(sessionId?: string): string {
  const state = crypto.randomBytes(32).toString('hex');
  oauthFlows.set(state, { sessionId, expiresAt: Date.now() + 10 * 60 * 1000 });
  return state;
}
export function consumeOAuthState(state: string) {
  const flow = oauthFlows.get(state);
  oauthFlows.delete(state);
  if (!flow) return null;
  if (Date.now() > flow.expiresAt) return null;
  return flow;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function readToken(req: Request): string {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE] || '';
}

export function getSession(req: Request): WebSession | null {
  const token = readToken(req);
  if (!token) return null;
  const [id, sig] = token.split('.');
  if (!id || !sig) return null;
  if (!safeEqual(sign(id), sig)) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.lastSeen > SESSION_TTL_MS) {
    sessions.delete(id);
    return null;
  }
  session.lastSeen = Date.now();
  session.requestCount = (session.requestCount || 0) + 1;
  session.lastPath = req.path || session.lastPath;
  if (!session.lastActivityPersistedAt || Date.now() - session.lastActivityPersistedAt > 60_000) {
    session.lastActivityPersistedAt = Date.now();
    void touchAudit(session, req.path);
  }
  return session;
}

export function createSession(
  init: Partial<WebSession> & { authMethod?: WebSession['authMethod']; req?: Request } = {}
): { token: string; session: WebSession } {
  const id = crypto.randomBytes(24).toString('hex');
  const session: WebSession = {
    id,
    mode: init.mode === 'user' ? 'user' : 'owner',
    userId: init.userId,
    username: init.username,
    avatar: init.avatar,
    isBotOwner: Boolean(init.isBotOwner),
    authMethod: init.authMethod || 'password',
    oauthVerified: Boolean(init.oauthVerified),
    createdAt: Date.now(),
    lastSeen: Date.now(),
    lastPath: init.req?.path,
    requestCount: 0,
  };
  sessions.set(id, session);
  if (init.req) void storeAudit(session, init.req, session.authMethod);
  return { token: `${id}.${sign(id)}`, session };
}

export function destroySession(req: Request): void {
  const token = readToken(req);
  if (!token) return;
  const [id] = token.split('.');
  if (!id) return;
  sessions.delete(id);
  void revokeAudit(id);
}

export function revokeActiveSession(sessionId: string): boolean {
  if (!sessions.has(sessionId)) return false;
  sessions.delete(sessionId);
  void revokeAudit(sessionId);
  return true;
}

export function setSessionCookie(res: Response, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000
    )}`
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

// --------------------------------------------
// Rate limiting (in-memory)
// --------------------------------------------
const buckets = new Map<string, number[]>();
const rateCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, times] of buckets) {
    const alive = times.filter((t) => now - t < 60 * 60 * 1000);
    if (alive.length === 0) buckets.delete(key);
    else buckets.set(key, alive);
  }
}, 10 * 60 * 1000);
rateCleanup.unref?.();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const times = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (times.length >= max) {
    buckets.set(key, times);
    return false;
  }
  times.push(now);
  buckets.set(key, times);
  return true;
}

// --------------------------------------------
// Login codes (تُرسل بالخاص لمالك البوت)
// --------------------------------------------
interface PendingCode {
  code: string;
  expiresAt: number;
}
let pendingCode: PendingCode | null = null;

export function issueLoginCode(): PendingCode {
  const code = String(crypto.randomInt(100000, 999999));
  pendingCode = { code, expiresAt: Date.now() + CODE_TTL_MS };
  return pendingCode;
}

export function consumeLoginCode(input: string): boolean {
  if (!pendingCode) return false;
  if (Date.now() > pendingCode.expiresAt) {
    pendingCode = null;
    return false;
  }
  const ok = safeEqual(String(input || '').trim(), pendingCode.code);
  if (ok) pendingCode = null;
  return ok;
}

export function passwordLoginEnabled(): boolean {
  return Boolean(process.env.DASHBOARD_PASSWORD);
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD || '';
  if (!expected) return false;
  return safeEqual(String(input || ''), expected);
}

// --------------------------------------------
// API guard — يحمي كل /api/*
// --------------------------------------------
export interface WebAuthContext {
  kind: 'key' | 'session';
  mode: 'owner' | 'user';
  sessionId?: string;
  userId?: string;
  username?: string;
  isBotOwner?: boolean;
  guildAccess?: GuildAccess;
}

/**
 * Guard يُركّب على /api قبل الراوتر:
 *  1) مفتاح خدمة عبر X-Dashboard-Key (للوحة الخارجية/الأتمتة)
 *  2) جلسة داشبورد صالحة + ترويسة CSRF للطلبات المُعدِّلة
 * كذلك يتحقق أن البوت عضو فعلاً في السيرفر المطلوب، وأن المستخدم
 * عضو/ستاف/أدمن فيه قبل السماح بأي وصول لإعداداته.
 */
export function apiGuard(client: any) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.method === 'OPTIONS') {
        next();
        return;
      }

      // 1) مفتاح الخدمة
      const expectedKey = process.env.DASHBOARD_API_KEY || '';
      const givenKey = String(req.headers['x-dashboard-key'] || '');
      if (expectedKey && givenKey && safeEqual(expectedKey, givenKey)) {
        (req as any).webAuth = { kind: 'key', mode: 'owner' } as WebAuthContext;
        // فحص عضوية البوت بالسيرفر المطلوب
        const match = req.path.match(/^\/guilds\/([^/]+)/);
        if (match && !client.guilds.cache.has(match[1])) {
          res.status(404).json({ error: 'البوت غير موجود في هذا السيرفر' });
          return;
        }
        next();
        return;
      }

      // 2) جلسة الداشبورد
      const session = getSession(req);
      if (!session) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      // CSRF: الطلبات المُعدِّلة من المتصفح يجب أن تحمل ترويسة مخصصة
      const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      if (mutating && req.headers[CSRF_HEADER] !== '1') {
        res.status(403).json({ error: 'csrf' });
        return;
      }

      const match = req.path.match(/^\/guilds\/([^/]+)/);
      if (match && !client.guilds.cache.has(match[1])) {
        res.status(404).json({ error: 'البوت غير موجود في هذا السيرفر' });
        return;
      }

      const ctx: WebAuthContext = {
        kind: 'session',
        mode: session.mode,
        sessionId: session.id,
        userId: session.userId,
        username: session.username,
        isBotOwner: Boolean(session.isBotOwner),
      };

      // 🔐 جلسة مالك البوت (كلمة مرور/كود) أو مالك البوت نفسه → وصول كامل
      const fullAccess = session.mode === 'owner' || Boolean(session.isBotOwner);

      if (match && !fullAccess) {
        const guildId = match[1];
        const access = await resolveGuildAccess(client, session.userId || '', guildId);
        if (!access) {
          res.status(403).json({
            error: 'not_member',
            message: 'أنت لست عضواً في هذا السيرفر',
          });
          return;
        }
        if (access.level === 'member') {
          res.status(403).json({
            error: 'staff_only',
            message: 'لوحة الإعدادات متاحة للإدارة والستاف فقط — حسابك عضو عادي',
          });
          return;
        }
        ctx.guildAccess = access;
      }

      (req as any).webAuth = ctx;

      if (oauthRequired() && !session.oauthVerified) {
        res.status(403).json({ error: 'oauth_required', message: 'وثّق تسجيل دخولك بـ Discord قبل استخدام اللوحة' });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: 'auth_check_failed' });
    }
  };
}

/**
 * Middleware لمسارات /dashboard/api — يتطلب جلسة (المفتاح لا يكفي هنا).
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  (req as any).webSession = session;
  next();
}

export function requireVerifiedSession(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (oauthRequired() && !session.oauthVerified) {
    res.status(403).json({ error: 'oauth_required', message: 'وثّق تسجيل دخولك بـ Discord قبل استخدام اللوحة' });
    return;
  }
  (req as any).webSession = session;
  next();
}

/** جلسات إدارة الأجهزة/الجلسات — لمالك البوت فقط */
export function requireOwnerSession(req: Request, res: Response, next: NextFunction): void {
  const session = getSession(req);
  if (!session) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (session.mode !== 'owner' && !session.isBotOwner) {
    res.status(403).json({ error: 'owner_only', message: 'هذه الصفحة متاحة لمالك البوت فقط' });
    return;
  }
  (req as any).webSession = session;
  next();
}

/**
 * 🛡️ إجراءات إدارة السيرفر (إعدادات/حماية/اقتصاد/أوامر) — للإدارة فقط.
 * يقرأ نتيجة apiGuard من req.webAuth: جلسة المالك/مفتاح الخدمة = وصول كامل،
 * وإلا لازم يكون مستوى المستخدم في السيرفر admin على الأقل.
 */
export function requireGuildAdmin(req: Request, res: Response, next: NextFunction): void {
  const ctx = (req as any).webAuth as WebAuthContext | undefined;
  if (!ctx) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (ctx.kind === 'key' || ctx.mode === 'owner' || ctx.isBotOwner) {
    next();
    return;
  }
  if (ctx.guildAccess?.isAdmin) {
    next();
    return;
  }
  res.status(403).json({
    error: 'admin_only',
    message: 'هذا الإجراء متاح لإدارة السيرفر فقط — تحتاج صلاحية «إدارة السيرفر» أو رول إدارة',
  });
}

/** 👑 إجراءات مالك السيرفر فقط (مثل إخراج البوت من السيرفر) */
export function requireGuildOwner(req: Request, res: Response, next: NextFunction): void {
  const ctx = (req as any).webAuth as WebAuthContext | undefined;
  if (!ctx) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (ctx.kind === 'key' || ctx.mode === 'owner' || ctx.isBotOwner) {
    next();
    return;
  }
  if (ctx.guildAccess?.isOwner) {
    next();
    return;
  }
  res.status(403).json({
    error: 'owner_only',
    message: 'هذا الإجراء متاح لمالك السيرفر فقط 👑',
  });
}

export function logAuth(event: string, detail = ''): void {
  logger.info(`[${event}] ${detail}`.trim());
}
