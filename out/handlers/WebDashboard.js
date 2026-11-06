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
const helpers_1 = require("../utils/helpers");
const botOwner_1 = require("../utils/botOwner");
const webAuth_1 = require("../utils/webAuth");
const logger = (0, helpers_1.createLogger)('WebDashboard');
class WebDashboard {
    client;
    assetsDir;
    constructor(client) {
        this.client = client;
        this.assetsDir = path_1.default.resolve(process.cwd(), 'assets', 'dashboard');
    }
    /** Guard يُركّب على /api قبل الراوتر في OmniClient */
    apiGuard() {
        return (0, webAuth_1.apiGuard)(this.client);
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
            res.json({
                authenticated: Boolean(session),
                user: session ? { username: session.username || 'المالك' } : null,
                login: {
                    password: (0, webAuth_1.passwordLoginEnabled)(),
                    code: this.client.isReady(),
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
            const { token } = (0, webAuth_1.createSession)({ username: 'المالك' });
            (0, webAuth_1.setSessionCookie)(res, token);
            (0, webAuth_1.logAuth)('password-ok', `ip=${ip}`);
            res.json({ ok: true });
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
            const { token } = (0, webAuth_1.createSession)({ username: 'المالك' });
            (0, webAuth_1.setSessionCookie)(res, token);
            (0, webAuth_1.logAuth)('code-ok', `ip=${ip}`);
            res.json({ ok: true });
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
            res.json({ username: session.username || 'المالك', createdAt: session.createdAt });
        });
        app.get('/dashboard/api/guilds', webAuth_1.requireSession, (_req, res) => {
            const guilds = this.client.guilds.cache
                .map((g) => ({
                id: g.id,
                name: g.name,
                icon: typeof g.iconURL === 'function' ? g.iconURL({ size: 128 }) : null,
                memberCount: g.memberCount ?? null,
            }))
                .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
            res.json({ guilds });
        });
        logger.info(`Web dashboard attached at /dashboard (assets: ${this.assetsDir})`);
    }
}
exports.WebDashboard = WebDashboard;
//# sourceMappingURL=WebDashboard.js.map