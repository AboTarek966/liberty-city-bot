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
  mode: 'owner';
  userId?: string;
  username?: string;
  createdAt: number;
  lastSeen: number;
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
  return session;
}

export function createSession(init: Partial<WebSession> = {}): { token: string; session: WebSession } {
  const id = crypto.randomBytes(24).toString('hex');
  const session: WebSession = {
    id,
    mode: 'owner',
    userId: init.userId,
    username: init.username,
    createdAt: Date.now(),
    lastSeen: Date.now(),
  };
  sessions.set(id, session);
  return { token: `${id}.${sign(id)}`, session };
}

export function destroySession(req: Request): void {
  const token = readToken(req);
  if (!token) return;
  const [id] = token.split('.');
  if (id) sessions.delete(id);
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

export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
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
  mode: 'owner' | 'key';
  userId?: string;
  username?: string;
}

/**
 * Guard يُركّب على /api قبل الراوتر:
 *  1) مفتاح خدمة عبر X-Dashboard-Key (للوحة الخارجية/الأتمتة)
 *  2) جلسة داشبورد صالحة + ترويسة CSRF للطلبات المُعدِّلة
 * كذلك يتحقق أن البوت عضو فعلاً في السيرفر المطلوب (يمنع إنشاء وثائق وهمية).
 */
export function apiGuard(client: any) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    // 1) مفتاح الخدمة
    const expectedKey = process.env.DASHBOARD_API_KEY || '';
    const givenKey = String(req.headers['x-dashboard-key'] || '');
    if (expectedKey && givenKey && safeEqual(expectedKey, givenKey)) {
      (req as any).webAuth = { mode: 'key' } as WebAuthContext;
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

    (req as any).webAuth = {
      mode: 'owner',
      userId: session.userId,
      username: session.username,
    } as WebAuthContext;
    next();
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

export function logAuth(event: string, detail = ''): void {
  logger.info(`[${event}] ${detail}`.trim());
}
