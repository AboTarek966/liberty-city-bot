// ============================================
// Omni Bot - Built-in Web Dashboard
// ============================================
// لوحة تحكم ويب كاملة تُخدم من نفس Express الخاص بالبوت (المنفذ العام).
// المصادقة: كود دخول يُرسل بالخاص لمالك البوت + كلمة مرور اختيارية (DASHBOARD_PASSWORD).
// كل مسارات /api محمية عبر webAuth.apiGuard — لا وصول بدون جلسة أو مفتاح خدمة.

import { Express, Request, Response } from 'express';
import express from 'express';
import path from 'path';
import fs from 'fs';
import type { OmniClient } from '../OmniClient';
import { createLogger } from '../utils/helpers';
import { getBotOwnerIds } from '../utils/botOwner';
import {
  apiGuard,
  clearSessionCookie,
  clientIp,
  consumeOAuthState,
  consumeLoginCode,
  createOAuthState,
  createSession,
  destroySession,
  getAllActiveSessions,
  getSession,
  issueLoginCode,
  listPersistedSessions,
  logAuth,
  markOAuthVerified,
  oauthRedirect,
  oauthRequired,
  passwordLoginEnabled,
  passwordMatches,
  rateLimit,
  requireSession,
  requireVerifiedSession,
  revokeActiveSession,
  tokenHash,
  setSessionCookie,
} from '../utils/webAuth';

const logger = createLogger('WebDashboard');

export class WebDashboard {
  private client: OmniClient;
  private assetsDir: string;

  constructor(client: OmniClient) {
    this.client = client;
    // مسار الأصول: حسب مجلد التشغيل ثم بجوار ملف البوت (out/handlers → assets)
    const candidates = [
      path.resolve(process.cwd(), 'assets', 'dashboard'),
      path.resolve(__dirname, '..', '..', 'assets', 'dashboard'),
    ];
    this.assetsDir =
      candidates.find((dir) => {
        try {
          return fs.existsSync(path.join(dir, 'index.html'));
        } catch {
          return false;
        }
      }) || candidates[0];
  }

  /** Guard يُركّب على /api قبل الراوتر في OmniClient */
  apiGuard() {
    return apiGuard(this.client);
  }

  /** يُركّب مسارات اللوحة (صفحة + أصول + مصادقة + واجهات جلسة) */
  attach(app: Express): void {
    // ---------- الأصول الثابتة ----------
    app.use(
      '/dashboard/assets',
      express.static(this.assetsDir, {
        index: false,
        maxAge: 0,
        etag: true,
      })
    );

    const sendIndex = (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(path.join(this.assetsDir, 'index.html'));
    };
    app.get('/dashboard', sendIndex);
    app.get('/dashboard/', sendIndex);

    // ---------- حالة المصادقة ----------
    app.get('/dashboard/auth/status', (req: Request, res: Response) => {
      const session = getSession(req);
      res.json({
        authenticated: Boolean(session),
        user: session
          ? { username: session.username || 'المالك', authMethod: session.authMethod, oauthVerified: Boolean(session.oauthVerified), sessionId: session.id }
          : null,
        oauthRequired: oauthRequired(),
        login: {
          password: passwordLoginEnabled(),
          code: this.client.isReady(),
          oauth: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
          requireOAuth: oauthRequired(),
        },
      });
    });

    // ---------- دخول بكلمة مرور ----------
    app.post('/dashboard/auth/password', (req: Request, res: Response) => {
      const ip = clientIp(req);
      if (!rateLimit(`pw:${ip}`, 8, 15 * 60 * 1000)) {
        res.status(429).json({ error: 'محاولات كثيرة — انتظر 15 دقيقة' });
        return;
      }
      if (!passwordLoginEnabled()) {
        res.status(400).json({ error: 'كلمة المرور غير مضبوطة على السيرفر' });
        return;
      }
      const { password } = req.body || {};
      if (!passwordMatches(String(password || ''))) {
        logAuth('password-fail', `ip=${ip}`);
        res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
        return;
      }
      const { token } = createSession({ username: 'المالك', authMethod: 'password', req });
      setSessionCookie(res, token);
      logAuth('password-ok', `ip=${ip}`);
      res.json({ ok: true, oauthRequired: oauthRequired() });
    });

    // ---------- OAuth (Discord) ----------
    app.get('/dashboard/auth/oauth/start', (req: Request, res: Response) => {
      const redirect = oauthRedirect(req);
      if (!redirect) {
        res.status(500).json({ error: 'تعذّر تحديد رابط العودة' });
        return;
      }
      const session = getSession(req);
      if (!session) {
        res.status(401).json({ error: 'سجّل دخولك بكلمة المرور أو الكود أولاً' });
        return;
      }
      const state = createOAuthState(session.id);
      const clientId = process.env.DISCORD_CLIENT_ID || '';
      const url = new URL('https://discord.com/oauth2/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('redirect_uri', redirect);
      url.searchParams.set('scope', 'identify');
      url.searchParams.set('state', state);
      url.searchParams.set('prompt', 'consent');
      res.redirect(url.toString());
    });

    app.get('/dashboard/auth/oauth/callback', async (req: Request, res: Response) => {
      const code = String(req.query.code || '');
      const state = String(req.query.state || '');
      const flow = consumeOAuthState(state);
      if (!code || !flow) {
        res.redirect('/dashboard?error=oauth_state');
        return;
      }
      const clientId = process.env.DISCORD_CLIENT_ID || '';
      const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';
      const redirect = oauthRedirect(req);
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
        if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
        const tokenData: any = await tokenRes.json();
        const meRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (!meRes.ok) throw new Error(`me ${meRes.status}`);
        const me: any = await meRes.json();
        const owners = await getBotOwnerIds(this.client);
        if (!owners.includes(me.id)) {
          res.redirect('/dashboard?error=oauth_owner');
          return;
        }
        const updated = markOAuthVerified(flow.sessionId, me.id, me.username || 'مالك ديسكورد');
        if (!updated) {
          res.redirect('/dashboard?error=session_expired');
          return;
        }
        logAuth('oauth-ok', `user=${me.id} session=${flow.sessionId}`);
        res.redirect('/dashboard?oauth=1');
      } catch (e: any) {
        logger.warn(`Dashboard OAuth failed: ${e?.message || e}`);
        res.redirect('/dashboard?error=oauth_failed');
      }
    });

    // ---------- طلب كود دخول (بالخاص) ----------
    app.post('/dashboard/auth/code', async (req: Request, res: Response) => {
      const ip = clientIp(req);
      if (!rateLimit(`code-req:${ip}`, 3, 10 * 60 * 1000) || !rateLimit('code-req:global', 5, 10 * 60 * 1000)) {
        res.status(429).json({ error: 'طلبات كثيرة — انتظر قليلاً' });
        return;
      }
      if (!this.client.isReady()) {
        res.status(503).json({ error: 'البوت غير متصل بديسكورد حالياً' });
        return;
      }
      try {
        const owners = await getBotOwnerIds(this.client);
        if (!owners.length) {
          res.status(500).json({ error: 'تعذّر تحديد مالك البوت' });
          return;
        }
        const { code, expiresAt } = issueLoginCode();
        let sent = 0;
        for (const ownerId of owners) {
          try {
            const user = await this.client.users.fetch(ownerId);
            await user.send(
              `🔐 **كود دخول لوحة التحكم:** \`${code}\`\n` +
                `صالح لمدة 10 دقائق. إذا لم تطلبه، تجاهل هذه الرسالة.`
            );
            sent += 1;
          } catch {
            // الخاص مغلق لهذا المالك — نجرّب الباقي
          }
        }
        logAuth('code-request', `ip=${ip} sent=${sent}`);
        if (sent === 0) {
          res.status(502).json({ error: 'تعذّر إرسال الكود — تأكد أن الخاص مفتوح للبوت' });
          return;
        }
        res.json({ ok: true, sent, expiresInSeconds: Math.floor((expiresAt - Date.now()) / 1000) });
      } catch (e: any) {
        logger.warn(`code request failed: ${e?.message || e}`);
        res.status(500).json({ error: 'فشل إرسال الكود' });
      }
    });

    // ---------- التحقق من الكود ----------
    app.post('/dashboard/auth/code/verify', (req: Request, res: Response) => {
      const ip = clientIp(req);
      if (!rateLimit(`code-verify:${ip}`, 10, 15 * 60 * 1000)) {
        res.status(429).json({ error: 'محاولات كثيرة — انتظر 15 دقيقة' });
        return;
      }
      const { code } = req.body || {};
      if (!consumeLoginCode(String(code || ''))) {
        logAuth('code-fail', `ip=${ip}`);
        res.status(401).json({ error: 'الكود غير صحيح أو منتهي الصلاحية' });
        return;
      }
      const { token } = createSession({ username: 'المالك', authMethod: 'code', req });
      setSessionCookie(res, token);
      logAuth('code-ok', `ip=${ip}`);
      res.json({ ok: true, oauthRequired: oauthRequired() });
    });

    // ---------- خروج ----------
    app.post('/dashboard/auth/logout', (req: Request, res: Response) => {
      destroySession(req);
      clearSessionCookie(res);
      res.json({ ok: true });
    });
    app.get('/dashboard/auth/logout', (req: Request, res: Response) => {
      destroySession(req);
      clearSessionCookie(res);
      res.redirect('/dashboard');
    });

    // ---------- واجهات الجلسة ----------
    app.get('/dashboard/api/me', requireSession, (req: Request, res: Response) => {
      const session = getSession(req)!;
      res.json({
        username: session.username || 'المالك',
        userId: session.userId || null,
        authMethod: session.authMethod,
        oauthVerified: Boolean(session.oauthVerified),
        sessionId: session.id,
        createdAt: session.createdAt,
      });
    });

    app.get('/dashboard/api/sessions', requireSession, async (req: Request, res: Response) => {
      try {
        const current = getSession(req)!;
        const active = getAllActiveSessions();
        const persisted = await listPersistedSessions();
        const byHash = new Map(persisted.map((d: any) => [d.tokenHash, d]));
        const merged = [
          ...active.map((a) => {
            const doc: any = byHash.get(tokenHash(a.sessionId));
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
            .filter((d: any) => !active.some((a) => tokenHash(a.sessionId) === d.tokenHash))
            .map((d: any) => ({
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
      } catch (error) {
        logger.error('Failed to list dashboard sessions:', error);
        res.status(500).json({ error: 'تعذر تحميل قائمة الجلسات' });
      }
    });

    app.delete('/dashboard/api/sessions/:sessionId', requireSession, async (req: Request, res: Response) => {
      const current = getSession(req)!;
      const targetId = String(req.params.sessionId || '');
      if (!targetId) {
        res.status(400).json({ error: 'معرف الجلسة مطلوب' });
        return;
      }
      const revoked = revokeActiveSession(targetId);
      if (!revoked) {
        res.status(404).json({ error: 'الجلسة غير موجودة أو منتهية' });
        return;
      }
      logAuth('session-revoke', `actor=${current.id} target=${targetId}`);
      if (targetId === current.id) clearSessionCookie(res);
      res.json({ ok: true, revoked: true, currentRevoked: targetId === current.id });
    });

    app.delete('/dashboard/api/sessions', requireSession, async (req: Request, res: Response) => {
      const current = getSession(req)!;
      const keepCurrent = String(req.query.keepCurrent || 'true') !== 'false';
      const active = getAllActiveSessions().filter((s) => !keepCurrent || s.sessionId !== current.id);
      for (const session of active) revokeActiveSession(session.sessionId);
      logAuth('sessions-clear', `actor=${current.id} revoked=${active.length} keepCurrent=${keepCurrent}`);
      res.json({ ok: true, revoked: active.length, keptCurrent: keepCurrent });
    });

    app.post('/dashboard/api/sessions/logout-all', requireSession, async (req: Request, res: Response) => {
      const current = getSession(req)!;
      const active = getAllActiveSessions();
      for (const session of active) revokeActiveSession(session.sessionId);
      destroySession(req);
      clearSessionCookie(res);
      logAuth('logout-all', `actor=${current.id} revoked=${active.length}`);
      res.json({ ok: true, revoked: active.length });
    });

    app.get('/dashboard/api/guilds', requireVerifiedSession, (_req: Request, res: Response) => {
      const guilds = this.client.guilds.cache
        .map((g: any) => ({
          id: g.id,
          name: g.name,
          icon: typeof g.iconURL === 'function' ? g.iconURL({ size: 128 }) : null,
          memberCount: g.memberCount ?? null,
        }))
        .sort((a: any, b: any) => (b.memberCount || 0) - (a.memberCount || 0));
      res.json({ guilds });
    });

    logger.info(`Web dashboard attached at /dashboard (assets: ${this.assetsDir})`);
  }
}
