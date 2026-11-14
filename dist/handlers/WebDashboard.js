"use strict";
// ============================================
// Omni Bot - Built-in Web Dashboard
// ============================================
// لوحة تحكم ويب كاملة تُخدم من نفس Express الخاص بالبوت (المنفذ العام).
// المصادقة: كود دخول يُرسل بالخاص لمالك البوت + كلمة مرور اختيارية (DASHBOARD_PASSWORD).
// كل مسارات /api محمية عبر webAuth.apiGuard — لا وصول بدون جلسة أو مفتاح خدمة.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebDashboard = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const helpers_1 = require("../utils/helpers");
const botOwner_1 = require("../utils/botOwner");
const webAuth_1 = require("../utils/webAuth");
const logger = (0, helpers_1.createLogger)('WebDashboard');
// صفحة العودة لـOAuth Implicit — تقرأ التوكن من #fragment (لا يصل للسيرفر)
// وترسله مرة واحدة لمسار التحقق ثم تنظّف الرابط من التوكن.
const IMPLICIT_CALLBACK_PAGE = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>اكتمال الدخول — Omni</title>
<style>body{background:#090d16;color:#dbe4f3;font-family:system-ui,Segoe UI,Tahoma,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}main{text-align:center;padding:24px}</style>
</head>
<body>
<main>
  <div style="font-size:46px">🤖</div>
  <h1 style="font-size:19px;margin:10px 0">جارٍ إكمال تسجيل الدخول…</h1>
  <p style="color:#8b9bb4;font-size:13px">لو ما اتحولتش تلقائياً، <a style="color:#22d3ee" href="/dashboard">اضغط هنا</a>.</p>
</main>
<script>
(function () {
  var frag = new URLSearchParams(location.hash.slice(1));
  var query = new URLSearchParams(location.search);
  var err = frag.get('error') || query.get('error');
  var token = frag.get('access_token');
  var state = frag.get('state') || query.get('state');
  if (err) { location.replace('/dashboard?error=access_denied'); return; }
  if (!token || !state) { location.replace('/dashboard?error=oauth_state'); return; }
  try { history.replaceState({}, '', location.pathname); } catch (e) {}
  fetch('/dashboard/auth/oauth/token', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-omni-csrf': '1' },
    body: JSON.stringify({ access_token: token, state: state })
  }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
    location.replace(r.ok && d && d.ok ? '/dashboard?oauth=1' : '/dashboard?error=oauth_failed');
  }); }).catch(function () { location.replace('/dashboard?error=oauth_failed'); });
})();
</script>
</body>
</html>`;
class WebDashboard {
    client;
    assetsDir;
    constructor(client) {
        this.client = client;
        // مسار الأصول: حسب مجلد التشغيل ثم بجوار ملف البوت (out/handlers → assets)
        const candidates = [
            path_1.default.resolve(process.cwd(), 'assets', 'dashboard'),
            path_1.default.resolve(__dirname, '..', '..', 'assets', 'dashboard'),
        ];
        this.assetsDir =
            candidates.find((dir) => {
                try {
                    return fs_1.default.existsSync(path_1.default.join(dir, 'index.html'));
                }
                catch {
                    return false;
                }
            }) || candidates[0];
    }
    /** Guard يُركّب على /api قبل الراوتر في OmniClient */
    apiGuard() {
        return (0, webAuth_1.apiGuard)(this.client);
    }
    /**
     * 🔗 توحيد إنهاء الدخول بين Code flow و Implicit flow:
     * يربط الجلسة الحالية إن وُجدت، أو ينشئ جلسة عامة جديدة ويضبط الكوكي.
     */
    async finalizeOAuthLogin(req, res, flow, me, accessToken) {
        const owners = await (0, botOwner_1.getBotOwnerIds)(this.client);
        const isBotOwner = owners.includes(String(me.id));
        const displayName = me.global_name || me.username || 'مستخدم ديسكورد';
        const avatar = me.avatar
            ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(me.id) >> 22n) % 6n)}.png`;
        // 💡 نجيب سيرفرات المستخدم وصلاحياته من ديسكورد مباشرة ونحفظها كتلميحات
        // (تخلي قائمة السيرفرات فورية وتشتغل مع أي عدد سيرفرات — زي برو بوت)
        if (accessToken) {
            try {
                const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (guildsRes.ok) {
                    const list = (await guildsRes.json());
                    (0, webAuth_1.rememberOAuthGuilds)(String(me.id), Array.isArray(list) ? list : []);
                }
            }
            catch {
                /* تعذّر جلب القائمة — resolveGuildAccess هيرجع لكاش الأعضاء */
            }
        }
        // 🔗 جلسة قديمة (مالك وثّق دخوله) → نربطها بالحساب
        const linked = flow.sessionId
            ? (0, webAuth_1.markOAuthVerified)(flow.sessionId, String(me.id), displayName, { avatar, isBotOwner })
            : null;
        // 🌍 مستخدم جديد → جلسة OAuth مستقلة
        if (!linked) {
            const { token } = (0, webAuth_1.createSession)({
                mode: 'user',
                userId: String(me.id),
                username: displayName,
                avatar,
                isBotOwner,
                authMethod: 'oauth',
                oauthVerified: true,
                req,
            });
            (0, webAuth_1.setSessionCookie)(res, token);
        }
    }
    /** يُركّب مسارات اللوحة (صفحة + أصول + مصادقة + واجهات جلسة) */
    attach(app) {
        // ---------- الأصول الثابتة ----------
        app.use('/dashboard/assets', express_1.default.static(this.assetsDir, {
            index: false,
            maxAge: 0,
            etag: true,
        }));
        const sendIndex = (_req, res) => {
            res.setHeader('Cache-Control', 'no-store');
            res.sendFile(path_1.default.join(this.assetsDir, 'index.html'));
        };
        app.get('/dashboard', sendIndex);
        app.get('/dashboard/', sendIndex);
        // ---------- حالة المصادقة ----------
        app.get('/dashboard/auth/status', (req, res) => {
            const session = (0, webAuth_1.getSession)(req);
            const clientId = process.env.DISCORD_CLIENT_ID || '';
            // رابط إضافة البوت لأي سيرفر جديد (زي برو بوت) — صلاحية Administrator للتبسيط
            const inviteUrl = clientId
                ? `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`
                : null;
            res.json({
                authenticated: Boolean(session),
                user: session
                    ? {
                        id: session.userId || null,
                        username: session.username || (session.mode === 'owner' ? 'المالك' : 'مستخدم ديسكورد'),
                        avatar: session.avatar || null,
                        mode: session.mode,
                        isBotOwner: Boolean(session.isBotOwner),
                        authMethod: session.authMethod,
                        oauthVerified: Boolean(session.oauthVerified),
                        sessionId: session.id,
                    }
                    : null,
                oauthRequired: (0, webAuth_1.oauthRequired)(),
                login: {
                    password: (0, webAuth_1.passwordLoginEnabled)(),
                    code: this.client.isReady(),
                    oauth: (0, webAuth_1.oauthConfigured)(),
                    requireOAuth: (0, webAuth_1.oauthRequired)(),
                    inviteUrl,
                    // الرابط المتوقع للتسجيل في Discord Developer Portal (يساعد في الإعداد)
                    oauthRedirectUri: (0, webAuth_1.oauthRedirect)(req),
                },
            });
        });
        // ---------- دخول بكلمة مرور ----------
        app.post('/dashboard/auth/password', (req, res) => {
            const ip = (0, webAuth_1.clientIp)(req);
            if (!(0, webAuth_1.rateLimit)(`pw:${ip}`, 8, 15 * 60 * 1000)) {
                res.status(429).json({ error: 'محاولات كثيرة — انتظر 15 دقيقة' });
                return;
            }
            if (!(0, webAuth_1.passwordLoginEnabled)()) {
                res.status(400).json({ error: 'كلمة المرور غير مضبوطة على السيرفر' });
                return;
            }
            const { password } = req.body || {};
            if (!(0, webAuth_1.passwordMatches)(String(password || ''))) {
                (0, webAuth_1.logAuth)('password-fail', `ip=${ip}`);
                res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
                return;
            }
            const { token } = (0, webAuth_1.createSession)({ username: 'المالك', authMethod: 'password', req });
            (0, webAuth_1.setSessionCookie)(res, token);
            (0, webAuth_1.logAuth)('password-ok', `ip=${ip}`);
            res.json({ ok: true, oauthRequired: (0, webAuth_1.oauthRequired)() });
        });
        // ---------- OAuth (Discord) ----------
        // 🌍 دخول عام: أي شخص يقدر يسجّل بديسكورد — من غير كلمة مرور أو كود مسبق.
        // • فيه Client Secret → Authorization Code flow (الأكثر أماناً)
        // • مفيش Secret → Implicit flow (محتاج Client ID + Redirect URI فقط)
        app.get('/dashboard/auth/oauth/start', (req, res) => {
            const redirect = (0, webAuth_1.oauthRedirect)(req);
            if (!redirect) {
                res.status(500).json({ error: 'تعذّر تحديد رابط العودة' });
                return;
            }
            const clientId = process.env.DISCORD_CLIENT_ID || '';
            if (!clientId) {
                res.status(503).json({ error: 'OAuth غير مُعدّ بعد: ضع DISCORD_CLIENT_ID في البيئة وأضف Redirect URI في Discord Developer Portal' });
                return;
            }
            const hasSecret = Boolean((0, webAuth_1.discordClientSecret)());
            // لو فيه جلسة موجودة نربط التوثيق بها، وإلا ننشئ جلسة جديدة بعد الرجوع
            const session = (0, webAuth_1.getSession)(req);
            const state = (0, webAuth_1.createOAuthState)(session?.id);
            const url = new URL('https://discord.com/oauth2/authorize');
            url.searchParams.set('client_id', clientId);
            url.searchParams.set('response_type', hasSecret ? 'code' : 'token');
            url.searchParams.set('redirect_uri', redirect);
            // identify = بروفايل المستخدم · guilds = معرفة السيرفرات اللي يقدر يديرها (زي برو بوت)
            url.searchParams.set('scope', 'identify guilds');
            url.searchParams.set('state', state);
            url.searchParams.set('prompt', 'consent');
            res.redirect(url.toString());
        });
        app.get('/dashboard/auth/oauth/callback', async (req, res) => {
            // رفض/خطأ من ديسكورد
            if (req.query.error) {
                res.redirect('/dashboard?error=access_denied');
                return;
            }
            const code = String(req.query.code || '');
            const state = String(req.query.state || '');
            if (!code) {
                // Implicit flow: التوكن في #fragment — السيرفر لا يراه، نرجّع صفحة صغيرة تكمّل الدخول
                res.setHeader('Cache-Control', 'no-store');
                res.type('html').send(IMPLICIT_CALLBACK_PAGE);
                return;
            }
            const flow = (0, webAuth_1.consumeOAuthState)(state);
            if (!flow) {
                res.redirect('/dashboard?error=oauth_state');
                return;
            }
            const clientId = process.env.DISCORD_CLIENT_ID || '';
            const clientSecret = (0, webAuth_1.discordClientSecret)();
            const redirect = (0, webAuth_1.oauthRedirect)(req);
            if (!clientId || !clientSecret || !redirect) {
                res.redirect('/dashboard?error=oauth_config');
                return;
            }
            try {
                const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: clientId,
                        client_secret: clientSecret,
                        grant_type: 'authorization_code',
                        code,
                        redirect_uri: redirect,
                    }),
                });
                if (!tokenRes.ok)
                    throw new Error(`token ${tokenRes.status}`);
                const tokenData = await tokenRes.json();
                const meRes = await fetch('https://discord.com/api/users/@me', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                });
                if (!meRes.ok)
                    throw new Error(`me ${meRes.status}`);
                const me = await meRes.json();
                if (!me?.id)
                    throw new Error('me empty');
                await this.finalizeOAuthLogin(req, res, flow, me, tokenData.access_token);
                (0, webAuth_1.logAuth)('oauth-ok', `user=${me.id} code${flow.sessionId ? ` linked=${flow.sessionId}` : ' public'}`);
                res.redirect('/dashboard?oauth=1');
            }
            catch (e) {
                logger.warn(`Dashboard OAuth failed: ${e?.message || e}`);
                res.redirect('/dashboard?error=oauth_failed');
            }
        });
        // Implicit flow: المتصفح يرسل التوكن هنا بعد قراءته من الـfragment
        app.post('/dashboard/auth/oauth/token', async (req, res) => {
            const ip = (0, webAuth_1.clientIp)(req);
            if (!(0, webAuth_1.rateLimit)(`oauth-token:${ip}`, 10, 10 * 60 * 1000)) {
                res.status(429).json({ error: 'محاولات كثيرة — انتظر قليلاً' });
                return;
            }
            const accessToken = String(req.body?.access_token || '');
            const state = String(req.body?.state || '');
            const flow = (0, webAuth_1.consumeOAuthState)(state);
            if (!accessToken || !flow) {
                res.status(400).json({ error: 'oauth_state' });
                return;
            }
            const clientId = process.env.DISCORD_CLIENT_ID || '';
            try {
                // /oauth2/@me يتحقق من التوكن + التطبيق + السكوب + المستخدم معاً
                const meRes = await fetch('https://discord.com/api/oauth2/@me', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!meRes.ok)
                    throw new Error(`oauth2/me ${meRes.status}`);
                const info = await meRes.json();
                const appId = String(info?.application?.id || '');
                if (clientId && appId && appId !== clientId)
                    throw new Error('app_mismatch');
                const scopes = Array.isArray(info?.scopes) ? info.scopes : [];
                if (scopes.length && !scopes.includes('identify'))
                    throw new Error('missing_identify');
                const me = info?.user;
                if (!me?.id)
                    throw new Error('no_user');
                await this.finalizeOAuthLogin(req, res, flow, me, accessToken);
                (0, webAuth_1.logAuth)('oauth-ok', `user=${me.id} implicit${flow.sessionId ? ` linked=${flow.sessionId}` : ' public'}`);
                res.json({ ok: true });
            }
            catch (e) {
                logger.warn(`Dashboard implicit OAuth failed: ${e?.message || e}`);
                res.status(401).json({ error: 'oauth_failed' });
            }
        });
        // ---------- طلب كود دخول (بالخاص) ----------
        app.post('/dashboard/auth/code', async (req, res) => {
            const ip = (0, webAuth_1.clientIp)(req);
            if (!(0, webAuth_1.rateLimit)(`code-req:${ip}`, 3, 10 * 60 * 1000) || !(0, webAuth_1.rateLimit)('code-req:global', 5, 10 * 60 * 1000)) {
                res.status(429).json({ error: 'طلبات كثيرة — انتظر قليلاً' });
                return;
            }
            if (!this.client.isReady()) {
                res.status(503).json({ error: 'البوت غير متصل بديسكورد حالياً' });
                return;
            }
            try {
                const owners = await (0, botOwner_1.getBotOwnerIds)(this.client);
                if (!owners.length) {
                    res.status(500).json({ error: 'تعذّر تحديد مالك البوت' });
                    return;
                }
                const { code, expiresAt } = (0, webAuth_1.issueLoginCode)();
                let sent = 0;
                for (const ownerId of owners) {
                    try {
                        const user = await this.client.users.fetch(ownerId);
                        await user.send(`🔐 **كود دخول لوحة التحكم:** \`${code}\`\n` +
                            `صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.`);
                        sent += 1;
                    }
                    catch {
                        // الخاص مغلق لهذا المالك — نجرّب الباقي
                    }
                }
                (0, webAuth_1.logAuth)('code-request', `ip=${ip} sent=${sent}`);
                if (sent === 0) {
                    res.status(502).json({ error: 'تعذّر إرسال الكود — تأكد أن الخاص مفتوح للبوت' });
                    return;
                }
                res.json({ ok: true, sent, expiresInSeconds: Math.floor((expiresAt - Date.now()) / 1000) });
            }
            catch (e) {
                logger.warn(`code request failed: ${e?.message || e}`);
                res.status(500).json({ error: 'فشل إرسال الكود' });
            }
        });
        // ---------- التحقق من الكود ----------
        app.post('/dashboard/auth/code/verify', (req, res) => {
            const ip = (0, webAuth_1.clientIp)(req);
            if (!(0, webAuth_1.rateLimit)(`code-verify:${ip}`, 10, 15 * 60 * 1000)) {
                res.status(429).json({ error: 'محاولات كثيرة — انتظر 15 دقيقة' });
                return;
            }
            const { code } = req.body || {};
            if (!(0, webAuth_1.consumeLoginCode)(String(code || ''))) {
                (0, webAuth_1.logAuth)('code-fail', `ip=${ip}`);
                res.status(401).json({ error: 'الكود غير صحيح أو منتهي الصلاحية' });
                return;
            }
            const { token } = (0, webAuth_1.createSession)({ username: 'المالك', authMethod: 'code', req });
            (0, webAuth_1.setSessionCookie)(res, token);
            (0, webAuth_1.logAuth)('code-ok', `ip=${ip}`);
            res.json({ ok: true, oauthRequired: (0, webAuth_1.oauthRequired)() });
        });
        // ---------- خروج ----------
        app.post('/dashboard/auth/logout', (req, res) => {
            (0, webAuth_1.destroySession)(req);
            (0, webAuth_1.clearSessionCookie)(res);
            res.json({ ok: true });
        });
        app.get('/dashboard/auth/logout', (req, res) => {
            (0, webAuth_1.destroySession)(req);
            (0, webAuth_1.clearSessionCookie)(res);
            res.redirect('/dashboard');
        });
        // ---------- واجهات الجلسة ----------
        app.get('/dashboard/api/me', webAuth_1.requireSession, (req, res) => {
            const session = (0, webAuth_1.getSession)(req);
            res.json({
                username: session.username || (session.mode === 'owner' ? 'المالك' : 'مستخدم ديسكورد'),
                userId: session.userId || null,
                avatar: session.avatar || null,
                mode: session.mode,
                isBotOwner: Boolean(session.isBotOwner),
                authMethod: session.authMethod,
                oauthVerified: Boolean(session.oauthVerified),
                sessionId: session.id,
                createdAt: session.createdAt,
            });
        });
        app.get('/dashboard/api/sessions', webAuth_1.requireOwnerSession, async (req, res) => {
            try {
                const current = (0, webAuth_1.getSession)(req);
                const active = (0, webAuth_1.getAllActiveSessions)();
                const persisted = await (0, webAuth_1.listPersistedSessions)();
                const byHash = new Map(persisted.map((d) => [d.tokenHash, d]));
                const merged = [
                    ...active.map((a) => {
                        const doc = byHash.get((0, webAuth_1.tokenHash)(a.sessionId));
                        return {
                            sessionId: a.sessionId,
                            userId: a.userId || doc?.userId || null,
                            username: a.username || doc?.username || 'المالك',
                            authMethod: a.authMethod,
                            oauthVerified: a.oauthVerified,
                            requestCount: a.requestCount,
                            lastPath: a.lastPath,
                            lastSeenAt: a.lastSeenAt,
                            createdAt: a.createdAt,
                            status: 'active',
                            isCurrent: a.sessionId === current.id,
                            ip: doc?.ip || 'unknown',
                            countryName: doc?.countryName || doc?.countryCode || 'غير محدد',
                            deviceName: doc?.deviceName || 'جهاز',
                            deviceType: doc?.deviceType || 'desktop',
                            browserName: doc?.browserName || 'المتصفح',
                            osName: doc?.osName || 'نظام غير معروف',
                            userAgent: doc?.userAgent || '',
                        };
                    }),
                    ...persisted
                        .filter((d) => !active.some((a) => (0, webAuth_1.tokenHash)(a.sessionId) === d.tokenHash))
                        .map((d) => ({
                        sessionId: d.id,
                        userId: d.userId || null,
                        username: d.username || 'المالك',
                        authMethod: d.authMethod,
                        oauthVerified: Boolean(d.oauthVerified),
                        requestCount: d.requestCount || 0,
                        lastPath: d.lastPath || null,
                        lastSeenAt: d.lastSeenAt,
                        createdAt: d.createdAt,
                        status: d.revokedAt ? 'revoked' : 'expired',
                        isCurrent: false,
                        ip: d.ip || 'unknown',
                        countryName: d.countryName || d.countryCode || 'غير محدد',
                        deviceName: d.deviceName || 'جهاز',
                        deviceType: d.deviceType || 'desktop',
                        browserName: d.browserName || 'المتصفح',
                        osName: d.osName || 'نظام غير معروف',
                        userAgent: d.userAgent || '',
                    })),
                ].sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
                res.json({ sessions: merged, currentSessionId: current.id });
            }
            catch (error) {
                logger.error('Failed to list dashboard sessions:', error);
                res.status(500).json({ error: 'تعذر تحميل قائمة الجلسات' });
            }
        });
        app.delete('/dashboard/api/sessions/:sessionId', webAuth_1.requireOwnerSession, async (req, res) => {
            const current = (0, webAuth_1.getSession)(req);
            const targetId = String(req.params.sessionId || '');
            if (!targetId) {
                res.status(400).json({ error: 'معرف الجلسة مطلوب' });
                return;
            }
            const revoked = (0, webAuth_1.revokeActiveSession)(targetId);
            if (!revoked) {
                res.status(404).json({ error: 'الجلسة غير موجودة أو منتهية' });
                return;
            }
            (0, webAuth_1.logAuth)('session-revoke', `actor=${current.id} target=${targetId}`);
            if (targetId === current.id)
                (0, webAuth_1.clearSessionCookie)(res);
            res.json({ ok: true, revoked: true, currentRevoked: targetId === current.id });
        });
        app.delete('/dashboard/api/sessions', webAuth_1.requireOwnerSession, async (req, res) => {
            const current = (0, webAuth_1.getSession)(req);
            const keepCurrent = String(req.query.keepCurrent || 'true') !== 'false';
            const active = (0, webAuth_1.getAllActiveSessions)().filter((s) => !keepCurrent || s.sessionId !== current.id);
            for (const session of active)
                (0, webAuth_1.revokeActiveSession)(session.sessionId);
            (0, webAuth_1.logAuth)('sessions-clear', `actor=${current.id} revoked=${active.length} keepCurrent=${keepCurrent}`);
            res.json({ ok: true, revoked: active.length, keptCurrent: keepCurrent });
        });
        app.post('/dashboard/api/sessions/logout-all', webAuth_1.requireOwnerSession, async (req, res) => {
            const current = (0, webAuth_1.getSession)(req);
            const active = (0, webAuth_1.getAllActiveSessions)();
            for (const session of active)
                (0, webAuth_1.revokeActiveSession)(session.sessionId);
            (0, webAuth_1.destroySession)(req);
            (0, webAuth_1.clearSessionCookie)(res);
            (0, webAuth_1.logAuth)('logout-all', `actor=${current.id} revoked=${active.length}`);
            res.json({ ok: true, revoked: active.length });
        });
        // ---------- قائمة السيرفرات: كل سيرفر البوت فيه + حالة العضو فيه ----------
        app.get('/dashboard/api/guilds', webAuth_1.requireVerifiedSession, async (req, res) => {
            const session = (0, webAuth_1.getSession)(req);
            const fullAccess = session.mode === 'owner' || Boolean(session.isBotOwner);
            const userId = session.userId || '';
            const guilds = [];
            await Promise.all([...this.client.guilds.cache.values()].map(async (g) => {
                try {
                    let access = null;
                    if (fullAccess && !userId) {
                        // جلسة مالك البوت القديمة (كلمة مرور/كود) — وصول كامل
                        access = { level: 'owner', isOwner: true, isAdmin: true, isStaff: true, roleNames: [] };
                    }
                    else if (userId) {
                        access = await (0, webAuth_1.resolveGuildAccess)(this.client, userId, g.id);
                        if (fullAccess) {
                            // مالك البوت (حتى لو مش عضو) — وصول كامل مع إظهار دوره الحقيقي إن وجد
                            access = {
                                level: 'owner',
                                isOwner: Boolean(access?.isOwner),
                                isAdmin: true,
                                isStaff: true,
                                roleNames: access?.roleNames || [],
                                viaBotOwner: !access,
                            };
                        }
                    }
                    if (!access)
                        return; // مش عضو → السيرفر مايظهرش له
                    guilds.push({
                        id: g.id,
                        name: g.name,
                        icon: typeof g.iconURL === 'function' ? g.iconURL({ size: 128 }) : null,
                        memberCount: g.memberCount ?? null,
                        access,
                    });
                }
                catch {
                    /* سيرفر تعذّر فحصه — نتخطاه */
                }
            }));
            guilds.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
            res.json({
                guilds,
                user: {
                    id: userId || null,
                    username: session.username || (session.mode === 'owner' ? 'المالك' : 'مستخدم ديسكورد'),
                    avatar: session.avatar || null,
                    mode: session.mode,
                    isBotOwner: Boolean(session.isBotOwner),
                },
            });
        });
        logger.info(`Web dashboard attached at /dashboard (assets: ${this.assetsDir})`);
    }
}
exports.WebDashboard = WebDashboard;
//# sourceMappingURL=WebDashboard.js.map