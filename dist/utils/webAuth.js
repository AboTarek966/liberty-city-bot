"use strict";
// ============================================
// Omni Bot - Built-in Web Dashboard Auth
// ============================================
// جلسات داخل الذاكرة + كوكي موقّع + كود دخول يُرسل بالخاص لمالك البوت.
// الهدف: تأمين منفذ Express العام المكشوف للإنترنت — لا وصول لأي API بدون جلسة.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthFlows = exports.CSRF_HEADER = exports.SESSION_COOKIE = void 0;
exports.safeEqual = safeEqual;
exports.tokenHash = tokenHash;
exports.clientIp = clientIp;
exports.parseDevice = parseDevice;
exports.getAllActiveSessions = getAllActiveSessions;
exports.listPersistedSessions = listPersistedSessions;
exports.markOAuthVerified = markOAuthVerified;
exports.oauthRequired = oauthRequired;
exports.discordClientSecret = discordClientSecret;
exports.oauthConfigured = oauthConfigured;
exports.oauthRedirect = oauthRedirect;
exports.resolveGuildAccess = resolveGuildAccess;
exports.createOAuthState = createOAuthState;
exports.consumeOAuthState = consumeOAuthState;
exports.parseCookies = parseCookies;
exports.getSession = getSession;
exports.createSession = createSession;
exports.destroySession = destroySession;
exports.revokeActiveSession = revokeActiveSession;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
exports.rateLimit = rateLimit;
exports.issueLoginCode = issueLoginCode;
exports.consumeLoginCode = consumeLoginCode;
exports.passwordLoginEnabled = passwordLoginEnabled;
exports.passwordMatches = passwordMatches;
exports.apiGuard = apiGuard;
exports.requireSession = requireSession;
exports.requireVerifiedSession = requireVerifiedSession;
exports.requireOwnerSession = requireOwnerSession;
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
function tokenHash(sessionId) {
    return crypto_1.default.createHash('sha256').update(sessionId).digest('hex');
}
function clientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length)
        return fwd.split(',')[0].trim();
    return req.socket?.remoteAddress || 'unknown';
}
const COUNTRY_NAMES = {
    AE: 'الإمارات', SA: 'السعودية', EG: 'مصر', KW: 'الكويت', QA: 'قطر',
    BH: 'Bahrain', OM: 'عُمان', IQ: 'العراق', JO: 'الأردن', LB: 'لبنان',
};
function parseDevice(ua = '') {
    const normalized = String(ua || '').toLowerCase();
    const isTablet = /ipad|tablet|kindle/.test(normalized);
    const isMobile = !isTablet && /iphone|android.*mobile|mobile/.test(normalized);
    const deviceType = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
    const browserName = /edg\//.test(normalized) ? 'Edge' : /chrome\//.test(normalized) ? 'Chrome' : /firefox\//.test(normalized) ? 'Firefox' : /safari\//.test(normalized) ? 'Safari' : /opera\//.test(normalized) ? 'Opera' : 'المتصفح';
    const osName = /windows/.test(normalized) ? 'Windows' : /mac os x|macintosh/.test(normalized) ? 'macOS' : /android/.test(normalized) ? 'Android' : /iphone|ipad|ipod/.test(normalized) ? 'iOS' : /linux/.test(normalized) ? 'Linux' : 'نظام غير معروف';
    const deviceName = isMobile ? 'جوال' : isTablet ? 'تابلت' : 'جهاز';
    return { deviceName, deviceType, browserName, osName };
}
function countryFromRequest(req) {
    const code = String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country'] || '').trim().toUpperCase();
    if (!code || code === 'XX' || code === 'XX-')
        return {};
    return { countryCode: code, countryName: COUNTRY_NAMES[code] || code };
}
async function storeAudit(session, req, authMethod = 'password') {
    try {
        const { DashboardSession } = await Promise.resolve().then(() => __importStar(require('../models/DashboardSession')));
        const device = req ? parseDevice(String(req.headers['user-agent'] || '')) : { deviceName: 'جهاز', deviceType: 'desktop', browserName: 'المتصفح', osName: 'نظام غير معروف' };
        const country = req ? countryFromRequest(req) : {};
        await DashboardSession.findOneAndUpdate({ tokenHash: tokenHash(session.id) }, {
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
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    catch { /* تسجيل نشاط الجلسة اختياري */ }
}
async function touchAudit(session, path) {
    try {
        const { DashboardSession } = await Promise.resolve().then(() => __importStar(require('../models/DashboardSession')));
        await DashboardSession.updateOne({ tokenHash: tokenHash(session.id), revokedAt: { $exists: false } }, {
            $set: { lastSeenAt: new Date(session.lastSeen), lastPath: path || session.lastPath, requestCount: session.requestCount || 0 },
            $inc: { requestCount: 0 },
        });
    }
    catch { /* تجاهل */ }
}
async function revokeAudit(sessionId) {
    try {
        const { DashboardSession } = await Promise.resolve().then(() => __importStar(require('../models/DashboardSession')));
        await DashboardSession.updateOne({ tokenHash: tokenHash(sessionId) }, { $set: { revokedAt: new Date() } });
    }
    catch { /* تجاهل */ }
}
async function markAuditVerified(sessionId, userId, username, authMethod = 'password+oauth') {
    try {
        const { DashboardSession } = await Promise.resolve().then(() => __importStar(require('../models/DashboardSession')));
        // الموديل يقبل oauth فقط — لا نخزّن القيم المركبة password+oauth/code+oauth
        const auditMethod = String(authMethod).includes('oauth') ? 'oauth' : authMethod;
        await DashboardSession.updateOne({ tokenHash: tokenHash(sessionId) }, {
            $set: { oauthVerified: true, userId, username, authMethod: auditMethod, lastSeenAt: new Date() },
        });
    }
    catch { /* تجاهل */ }
}
function getAllActiveSessions() {
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
async function listPersistedSessions() {
    try {
        const { DashboardSession } = await Promise.resolve().then(() => __importStar(require('../models/DashboardSession')));
        const docs = await DashboardSession.find({}).sort({ lastSeenAt: -1 }).limit(200).lean();
        return docs.map((d) => ({ ...d, id: d._id?.toString?.() || d.id }));
    }
    catch {
        return [];
    }
}
function markOAuthVerified(sessionId, userId, username, extra = {}) {
    const session = sessions.get(sessionId);
    if (!session || Date.now() - session.lastSeen > SESSION_TTL_MS)
        return null;
    session.userId = userId;
    session.username = username;
    if (extra.avatar)
        session.avatar = extra.avatar;
    if (typeof extra.isBotOwner === 'boolean')
        session.isBotOwner = extra.isBotOwner;
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
function oauthRequired() {
    const v = String(process.env.DASHBOARD_REQUIRE_OAUTH || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
}
/** سر عميل Discord — يدعم الاسم القديم المستخدم في الاستضافة */
function discordClientSecret() {
    return process.env.DISCORD_CLIENT_SECRET || process.env.DASHBOARD_OAUTH2_SECRET || '';
}
function oauthConfigured() {
    // Client ID وحده كافٍ لـOAuth (Code flow عند وجود Secret، وإلا Implicit flow)
    return Boolean(process.env.DISCORD_CLIENT_ID);
}
function oauthRedirect(req) {
    const forced = String(process.env.DISCORD_REDIRECT_URI ||
        process.env.DISCORD_OAUTH_REDIRECT_URI ||
        process.env.DASHBOARD_OAUTH_REDIRECT_URI ||
        '').trim();
    if (forced)
        return forced;
    // خلف بروكسي الاستضافة: نعتمد على الترويسات forwarded حتى يطلع https صح
    const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
        .split(',')[0]
        .trim();
    if (!host)
        return '';
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
const accessCache = new Map();
const accessPending = new Map();
/**
 * 🔍 مستوى وصول عضو ديسكورد في سيرفر:
 *  - owner: صاحب السيرفر (التاج)
 *  - admin: Administrator / ManageGuild / رولات إدارة التذاكر
 *  - staff: رولات الدعم / صلاحيات إشراف (ManageMessages, Kick, Ban, Timeout)
 *  - member: عضو عادي
 * null = ليس عضواً في السيرفر
 */
async function resolveGuildAccess(client, userId, guildId) {
    if (!userId || !guildId)
        return null;
    const cacheKey = `${guildId}:${userId}`;
    const cached = accessCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now())
        return cached.access;
    const pending = accessPending.get(cacheKey);
    if (pending)
        return pending;
    const load = (async () => {
        try {
            const guild = client?.guilds?.cache?.get(guildId);
            if (!guild)
                return null;
            let member = guild.members?.cache?.get(userId) || null;
            if (!member && typeof guild.members?.fetch === 'function') {
                member = await guild.members.fetch(userId).catch(() => null);
            }
            if (!member)
                return null;
            const isOwner = String(guild.ownerId) === String(userId);
            let ticketAdminIds = [];
            let ticketSupportIds = [];
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../models')));
                const settings = await getGuildSettings(guildId);
                ticketAdminIds = Array.isArray(settings?.tickets?.adminRoleIds)
                    ? settings.tickets.adminRoleIds
                    : [];
                ticketSupportIds = Array.isArray(settings?.tickets?.supportRoleIds)
                    ? settings.tickets.supportRoleIds
                    : [];
            }
            catch {
                /* تعذّر قراءة الإعدادات — نعتمد على صلاحيات ديسكورد فقط */
            }
            const hasAnyRole = (ids) => ids.some((id) => member.roles?.cache?.has?.(id));
            const perms = member.permissions;
            const hasPerm = (name) => {
                try {
                    return Boolean(perms?.has?.(name));
                }
                catch {
                    return false;
                }
            };
            const hasTicketAdmin = hasAnyRole(ticketAdminIds);
            const isAdmin = isOwner || hasPerm('Administrator') || hasPerm('ManageGuild') || hasTicketAdmin;
            const isStaff = isAdmin ||
                hasAnyRole(ticketSupportIds) ||
                hasPerm('ManageMessages') ||
                hasPerm('KickMembers') ||
                hasPerm('BanMembers') ||
                hasPerm('ModerateMembers');
            const level = isOwner
                ? 'owner'
                : isAdmin
                    ? 'admin'
                    : isStaff
                        ? 'staff'
                        : 'member';
            const roleNames = [...(member.roles?.cache?.values?.() || [])]
                .filter((r) => String(r.id) !== String(guild.id))
                .sort((a, b) => (b.position || 0) - (a.position || 0))
                .map((r) => r.name)
                .filter(Boolean)
                .slice(0, 12);
            return { level, isOwner, isAdmin, isStaff, roleNames };
        }
        catch {
            return null;
        }
    })();
    accessPending.set(cacheKey, load);
    try {
        const access = await load;
        accessCache.set(cacheKey, { access, expiresAt: Date.now() + ACCESS_TTL_MS });
        return access;
    }
    finally {
        accessPending.delete(cacheKey);
    }
}
exports.oauthFlows = new Map();
function createOAuthState(sessionId) {
    const state = crypto_1.default.randomBytes(32).toString('hex');
    exports.oauthFlows.set(state, { sessionId, expiresAt: Date.now() + 10 * 60 * 1000 });
    return state;
}
function consumeOAuthState(state) {
    const flow = exports.oauthFlows.get(state);
    exports.oauthFlows.delete(state);
    if (!flow)
        return null;
    if (Date.now() > flow.expiresAt)
        return null;
    return flow;
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
    session.requestCount = (session.requestCount || 0) + 1;
    session.lastPath = req.path || session.lastPath;
    if (!session.lastActivityPersistedAt || Date.now() - session.lastActivityPersistedAt > 60_000) {
        session.lastActivityPersistedAt = Date.now();
        void touchAudit(session, req.path);
    }
    return session;
}
function createSession(init = {}) {
    const id = crypto_1.default.randomBytes(24).toString('hex');
    const session = {
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
    if (init.req)
        void storeAudit(session, init.req, session.authMethod);
    return { token: `${id}.${sign(id)}`, session };
}
function destroySession(req) {
    const token = readToken(req);
    if (!token)
        return;
    const [id] = token.split('.');
    if (!id)
        return;
    sessions.delete(id);
    void revokeAudit(id);
}
function revokeActiveSession(sessionId) {
    if (!sessions.has(sessionId))
        return false;
    sessions.delete(sessionId);
    void revokeAudit(sessionId);
    return true;
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
 * كذلك يتحقق أن البوت عضو فعلاً في السيرفر المطلوب، وأن المستخدم
 * عضو/ستاف/أدمن فيه قبل السماح بأي وصول لإعداداته.
 */
function apiGuard(client) {
    return async (req, res, next) => {
        try {
            if (req.method === 'OPTIONS') {
                next();
                return;
            }
            // 1) مفتاح الخدمة
            const expectedKey = process.env.DASHBOARD_API_KEY || '';
            const givenKey = String(req.headers['x-dashboard-key'] || '');
            if (expectedKey && givenKey && safeEqual(expectedKey, givenKey)) {
                req.webAuth = { kind: 'key', mode: 'owner' };
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
            const ctx = {
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
            req.webAuth = ctx;
            if (oauthRequired() && !session.oauthVerified) {
                res.status(403).json({ error: 'oauth_required', message: 'وثّق تسجيل دخولك بـ Discord قبل استخدام اللوحة' });
                return;
            }
            next();
        }
        catch {
            res.status(500).json({ error: 'auth_check_failed' });
        }
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
function requireVerifiedSession(req, res, next) {
    const session = getSession(req);
    if (!session) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    if (oauthRequired() && !session.oauthVerified) {
        res.status(403).json({ error: 'oauth_required', message: 'وثّق تسجيل دخولك بـ Discord قبل استخدام اللوحة' });
        return;
    }
    req.webSession = session;
    next();
}
/** جلسات إدارة الأجهزة/الجلسات — لمالك البوت فقط */
function requireOwnerSession(req, res, next) {
    const session = getSession(req);
    if (!session) {
        res.status(401).json({ error: 'unauthorized' });
        return;
    }
    if (session.mode !== 'owner' && !session.isBotOwner) {
        res.status(403).json({ error: 'owner_only', message: 'هذه الصفحة متاحة لمالك البوت فقط' });
        return;
    }
    req.webSession = session;
    next();
}
function logAuth(event, detail = '') {
    logger.info(`[${event}] ${detail}`.trim());
}
//# sourceMappingURL=webAuth.js.map