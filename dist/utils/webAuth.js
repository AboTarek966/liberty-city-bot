"use strict";
// ============================================
// Omni Bot - Built-in Web Dashboard Auth
// ============================================
// جلسات داخل الذاكرة + كوكي موقّع + كود دخول يُرسل بالخاص لمالك البوت.
// الهدف: تأمين منفذ Express العام المكشوف للإنترنت — لا وصول لأي API بدون جلسة.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSRF_HEADER = exports.SESSION_COOKIE = void 0;
exports.safeEqual = safeEqual;
exports.parseCookies = parseCookies;
exports.getSession = getSession;
exports.createSession = createSession;
exports.destroySession = destroySession;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
exports.rateLimit = rateLimit;
exports.clientIp = clientIp;
exports.issueLoginCode = issueLoginCode;
exports.consumeLoginCode = consumeLoginCode;
exports.passwordLoginEnabled = passwordLoginEnabled;
exports.passwordMatches = passwordMatches;
exports.apiGuard = apiGuard;
exports.requireSession = requireSession;
exports.logAuth = logAuth;
const crypto_1 = __importDefault(require("crypto"));
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('WebAuth');
exports.SESSION_COOKIE = 'omni_dash';
exports.CSRF_HEADER = 'x-omni-csrf';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // أسبوع
const CODE_TTL_MS = 10 * 60 * 1000; // 10 دقائق
// السر يستخدم لتوقيع الكوكي (مستقر عبر عمليات التشغيل إذا ضُبط DASHBOARD_SECRET)
const COOKIE_SECRET = process.env.DASHBOARD_SECRET || crypto_1.default.randomBytes(32).toString('hex');
const sessions = new Map();
// تنظيف دوري للجلسات المنتهية
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastSeen > SESSION_TTL_MS)
            sessions.delete(id);
    }
}, 60 * 60 * 1000);
cleanupTimer.unref?.();
// --------------------------------------------
// Helpers
// --------------------------------------------
function safeEqual(a, b) {
    const ha = crypto_1.default.createHash('sha256').update(String(a)).digest();
    const hb = crypto_1.default.createHash('sha256').update(String(b)).digest();
    try {
        return crypto_1.default.timingSafeEqual(ha, hb);
    }
    catch {
        return false;
    }
}
function sign(sessionId) {
    return crypto_1.default.createHmac('sha256', COOKIE_SECRET).update(sessionId).digest('hex');
}
function parseCookies(header) {
    const out = {};
    if (!header)
        return out;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx <= 0)
            continue;
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        if (!key)
            continue;
        try {
            out[key] = decodeURIComponent(value);
        }
        catch {
            out[key] = value;
        }
    }
    return out;
}
function readToken(req) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[exports.SESSION_COOKIE] || '';
}
function getSession(req) {
    const token = readToken(req);
    if (!token)
        return null;
    const [id, sig] = token.split('.');
    if (!id || !sig)
        return null;
    if (!safeEqual(sign(id), sig))
        return null;
    const session = sessions.get(id);
    if (!session)
        return null;
    if (Date.now() - session.lastSeen > SESSION_TTL_MS) {
        sessions.delete(id);
        return null;
    }
    session.lastSeen = Date.now();
    return session;
}
function createSession(init = {}) {
    const id = crypto_1.default.randomBytes(24).toString('hex');
    const session = {
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
function destroySession(req) {
    const token = readToken(req);
    if (!token)
        return;
    const [id] = token.split('.');
    if (id)
        sessions.delete(id);
}
function setSessionCookie(res, token) {
    res.setHeader('Set-Cookie', `${exports.SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`);
}
function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', `${exports.SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}
// --------------------------------------------
// Rate limiting (in-memory)
// --------------------------------------------
const buckets = new Map();
const rateCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, times] of buckets) {
        const alive = times.filter((t) => now - t < 60 * 60 * 1000);
        if (alive.length === 0)
            buckets.delete(key);
        else
            buckets.set(key, alive);
    }
}, 10 * 60 * 1000);
rateCleanup.unref?.();
function rateLimit(key, max, windowMs) {
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
function clientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length)
        return fwd.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
}
let pendingCode = null;
function issueLoginCode() {
    const code = String(crypto_1.default.randomInt(100000, 999999));
    pendingCode = { code, expiresAt: Date.now() + CODE_TTL_MS };
    return pendingCode;
}
function consumeLoginCode(input) {
    if (!pendingCode)
        return false;
    if (Date.now() > pendingCode.expiresAt) {
        pendingCode = null;
        return false;
    }
    const ok = safeEqual(String(input || '').trim(), pendingCode.code);
    if (ok)
        pendingCode = null;
    return ok;
}
function passwordLoginEnabled() {
    return Boolean(process.env.DASHBOARD_PASSWORD);
}
function passwordMatches(input) {
    const expected = process.env.DASHBOARD_PASSWORD || '';
    if (!expected)
        return false;
    return safeEqual(String(input || ''), expected);
}
/**
 * Guard يُركّب على /api قبل الراوتر:
 *  1) مفتاح خدمة عبر X-Dashboard-Key (للوحة الخارجية/الأتمتة)
 *  2) جلسة داشبورد صالحة + ترويسة CSRF للطلبات المُعدِّلة
 * كذلك يتحقق أن البوت عضو فعلاً في السيرفر المطلوب (يمنع إنشاء وثائق وهمية).
 */
function apiGuard(client) {
    return (req, res, next) => {
        if (req.method === 'OPTIONS') {
            next();
            return;
        }
        // 1) مفتاح الخدمة
        const expectedKey = process.env.DASHBOARD_API_KEY || '';
        const givenKey = String(req.headers['x-dashboard-key'] || '');
        if (expectedKey && givenKey && safeEqual(expectedKey, givenKey)) {
            req.webAuth = { mode: 'key' };
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
        if (mutating && req.headers[exports.CSRF_HEADER] !== '1') {
            res.status(403).json({ error: 'csrf' });
            return;
        }
        const match = req.path.match(/^\/guilds\/([^/]+)/);
        if (match && !client.guilds.cache.has(match[1])) {
            res.status(404).json({ error: 'البوت غير موجود في هذا السيرفر' });
            return;
        }
        req.webAuth = {
            mode: 'owner',
            userId: session.userId,
            username: session.username,
        };
        next();
    };
}
/**
 * Middleware لمسارات /dashboard/api — يتطلب جلسة (المفتاح لا يكفي هنا).
 */
function requireSession(req, res, next) {
    const session = getSession(req);
    if (!session) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    req.webSession = session;
    next();
}
function logAuth(event, detail = '') {
    logger.info(`[${event}] ${detail}`.trim());
}
//# sourceMappingURL=webAuth.js.map