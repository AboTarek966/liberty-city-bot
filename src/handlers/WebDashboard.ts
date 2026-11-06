// ============================================
// Omni Bot - Built-in Web Dashboard
// ============================================
// لوحة تحكم ويب كاملة تُخدم من نفس Express الخاص بالبوت (المنفذ العام).
// المصادقة: كود دخول يُرسل بالخاص لمالك البوت + كلمة مرور اختيارية (DASHBOARD_PASSWORD).
// كل مسارات /api محمية عبر webAuth.apiGuard — لا وصول بدون جلسة أو مفتاح خدمة.

import { Express, Request, Response } from 'express';
import express from 'express';
import path from 'path';
import type { OmniClient } from '../OmniClient';
import { createLogger } from '../utils/helpers';
import { getBotOwnerIds } from '../utils/botOwner';
import {
  apiGuard,
  clearSessionCookie,
  clientIp,
  consumeLoginCode,
  createSession,
  destroySession,
  getSession,
  issueLoginCode,
  logAuth,
  passwordLoginEnabled,
  passwordMatches,
  rateLimit,
  requireSession,
  setSessionCookie,
} from '../utils/webAuth';

const logger = createLogger('WebDashboard');

export class WebDashboard {
  private client: OmniClient;
  private assetsDir: string;

  constructor(client: OmniClient) {
    this.client = client;
    this.assetsDir = path.resolve(process.cwd(), 'assets', 'dashboard');
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
        user: session ? { username: session.username || 'المالك' } : null,
        login: {
          password: passwordLoginEnabled(),
          code: this.client.isReady(),
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
      const { token } = createSession({ username: 'المالك' });
      setSessionCookie(res, token);
      logAuth('password-ok', `ip=${ip}`);
      res.json({ ok: true });
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
      const { token } = createSession({ username: 'المالك' });
      setSessionCookie(res, token);
      logAuth('code-ok', `ip=${ip}`);
      res.json({ ok: true });
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
      res.json({ username: session.username || 'المالك', createdAt: session.createdAt });
    });

    app.get('/dashboard/api/guilds', requireSession, (_req: Request, res: Response) => {
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
