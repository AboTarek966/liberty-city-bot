require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || process.env.DASHBOARD_PORT || 3001;
const BOT_API_URL = process.env.BOT_API_URL || '';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'liberty-city-dashboard-secret';
const IS_PROD = process.env.NODE_ENV === 'production';

if (IS_PROD) app.set('trust proxy', 1); // behind Koyeb/HTTPS proxy

// ===== Data layer: standalone models (bot API first, MongoDB direct fallback) =====
const dashboardModels = require('./models');
const { getSettings, saveSettings, ensureConnected, botApiHealthy, dbReady } = dashboardModels;
const { GuildSettings, Ticket, ModerationCase, UserProfile, DashboardCommand } = dashboardModels.models;

(async () => {
  if (await ensureConnected()) {
    console.log('🗄️  Dashboard connected to MongoDB (direct access)');
  }
})();

// ===== Remote command queue (used when bot is on another host) =====
// Writes a DashboardCommand document; the bot (running elsewhere) polls the
// collection, executes the command and stores the result in the same document.
async function runCommand(guildId, command, payload = {}, waitMs = 30000) {
  try {
    const okDb = await ensureConnected();
    if (!okDb) throw new Error('database unavailable');
    const doc = await DashboardCommand.create({ guildId, command, payload, status: 'pending' });
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 900));
      const d = await DashboardCommand.findById(doc._id).lean();
      if (!d) throw new Error('command lost');
      if (d.status === 'done') return { ok: true, result: d.result };
      if (d.status === 'failed') return { ok: false, error: d.error || 'command failed' };
    }
    return { ok: false, error: 'timeout — البوت قد يكون غير متصل' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function queueResponse(res, result, okMessage = 'تم التنفيذ') {
  if (result.ok) return res.json({ success: true, ...(result.result || {}) });
  return res.status(502).json({ error: result.error || 'fail' });
}

// NOTE: view data helpers re-exported for guildPageData

if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
  console.warn('⚠️ DISCORD_CLIENT_ID/SECRET not set - OAuth will not work');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: IS_PROD, maxAge: 1000 * 60 * 60 * 24 * 7, sameSite: 'lax' }
}));

// Helper: get user's guilds from Discord
async function fetchUserGuilds(accessToken) {
  const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch guilds');
  return res.json();
}

// Helper: get user info from Discord
async function fetchUserInfo(accessToken) {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

// --------------------------------------------
// Discord token endpoint — robust caller
// بعض بروتوكول Cloudflare يحجب IP بداتاسنتر عند POST /oauth2/token (429 blocked)
// الحل: رؤوس شبيهة بالمتصفح + إعادة محاولات + مضيف بديل
// --------------------------------------------
const TOKEN_ENDPOINTS = [
  'https://discord.com/api',
  'https://discordapp.com/api',
];

const OAUTH_HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

const waitMs = (ms) => new Promise(r => setTimeout(r, ms));

async function discordTokenCall(logTag, params) {
  for (const [hostIdx, base] of TOKEN_ENDPOINTS.entries()) {
    const maxTries = hostIdx === 0 ? 3 : 2;
    for (let attempt = 1; attempt <= maxTries; attempt++) {
      try {
        const res = await fetch(`${base}/oauth2/token`, {
          method: 'POST',
          headers: OAUTH_HEADERS,
          body: params
        });
        if (res.ok) return res.json();
        const bodyTxt = await res.text().catch(() => '');
        console.error(`Token ${logTag} blocked/failed: host=${base} attempt=${attempt}/${maxTries} status=${res.status} body=${bodyTxt.slice(0, 220).replace(/\s+/g, ' ')}`);
        // 429 / 5xx → قابلة لإعادة المحاولة. 4xx الأخرى خطأ دائم — أبلغ فورًا
        if (res.status === 429 || res.status >= 500) {
          if (attempt < maxTries) { await waitMs(2000 * attempt); continue; }
          break; // جرب المضيف التالي
        }
        const err = new Error(`Discord ${logTag} error ${res.status}`);
        err.discordBody = bodyTxt.slice(0, 250);
        throw err;
      } catch (e) {
        if (e.discordBody) throw e;
        if (hostIdx === TOKEN_ENDPOINTS.length - 1 && attempt === maxTries) {
          throw new Error(`Token ${logTag} failed after all attempts — Cloudflare/Fetch blocked (try again shortly): ${e.message}`);
        }
      }
    }
  }
  throw new Error(`Token ${logTag} blocked by Cloudflare on all endpoints — أعد المحاولة بعد قليل`);
}

// Helper: exchange code for tokens
async function exchangeCode(code) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: DISCORD_REDIRECT_URI
  });
  return discordTokenCall('exchange', params);
}

// Helper: refresh access token
async function refreshToken(refreshToken) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  return discordTokenCall('refresh', params);
}

// Middleware: require auth
function requireAuth(req, res, next) {
  if (!req.session.accessToken) {
    return res.redirect('/auth/discord');
  }
  next();
}

// Middleware: attach user to locals
app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.guilds = req.session.guilds || [];
  res.locals.selectedGuild = req.session.selectedGuild || null;
  res.locals.clientId = DISCORD_CLIENT_ID;
  next();
});

// Routes
app.get('/', (req, res) => {
  if (req.session.accessToken) {
    res.redirect('/dashboard');
  } else {
    res.render('login', {
      clientId: DISCORD_CLIENT_ID,
      redirectUri: DISCORD_REDIRECT_URI,
      error: req.query.error || null,
      detail: req.query.detail || null
    });
  }
});

app.get('/auth/discord', (req, res) => {
  const scope = 'identify guilds guilds.members.read';
  const state = Math.random().toString(36).substring(7);
  req.session.oauthState = state;
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code, state, error: oauthError, error_description: oauthErrorDesc } = req.query;
  if (oauthError) {
    // Discord sent the user back with an OAuth-level error (access_denied, etc.)
    const known = ['access_denied', 'invalid_state', 'auth_failed', 'missing_client'];
    const key = known.includes(oauthError) ? oauthError : 'auth_failed';
    console.error(`OAuth-level error from Discord: ${oauthError} — ${oauthErrorDesc || ''}`);
    return res.redirect(`/?error=${key}&detail=${encodeURIComponent(oauthErrorDesc || oauthError)}`);
  }
  if (!code) return res.redirect('/?error=invalid_state');
  if (state !== req.session.oauthState) {
    return res.redirect('/?error=invalid_state');
  }
  try {
    const tokens = await exchangeCode(code);
    const user = await fetchUserInfo(tokens.access_token);
    const guilds = await fetchUserGuilds(tokens.access_token);

    // Filter guilds where user has admin perms or is owner
    const adminGuilds = guilds
      .filter(g => (g.permissions & 0x8) === 0x8 || g.owner)
      .map(g => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner }));

    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.user = user;
    req.session.guilds = adminGuilds;
    req.session.selectedGuild = adminGuilds[0]?.id || null;
    delete req.session.oauthState;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth error:', err.message, err.discordBody ? `| body=${err.discordBody}` : '');
    const detail = (err.discordBody || err.message || 'unknown').slice(0, 180);
    res.redirect(`/?error=auth_failed&detail=${encodeURIComponent(detail)}`);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Dev login: allows local testing without Discord OAuth (enabled only in development)
app.get('/auth/dev', async (req, res) => {
  if (process.env.NODE_ENV !== 'development' && process.env.DEV_LOGIN !== '1') {
    return res.status(404).send('Not found');
  }
  try {
    const user = { id: 'dev-user', username: 'Ahmad', discriminator: '0000', avatar: null };
    let guilds = [];
    try {
      const r = await fetch('https://discord.com/api/v10/guilds', {
        headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
      });
      if (r.ok) {
        const raw = await r.json();
        guilds = raw.map(g => ({ id: g.id, name: g.name, icon: g.icon, owner: false }));
      }
    } catch {}
    if (guilds.length === 0) {
      guilds = [{ id: '1481739211143909499', name: 'Liberty City', icon: null, owner: true }];
    }
    req.session.accessToken = 'dev';
    req.session.user = user;
    req.session.guilds = guilds;
    req.session.selectedGuild = guilds[0]?.id || null;
    res.redirect('/dashboard');
  } catch (err) {
    res.redirect('/?error=dev_failed');
  }
});

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    // Fetch bot stats
    let botStats = { totalGuilds: 0, totalUsers: 0 };
    try {
      const res = await fetch(`${BOT_API_URL}/api/dashboard/stats`);
      if (res.ok) botStats = await res.json();
    } catch {}
    
    res.render('dashboard', { botStats, activePage: 'dashboard' });
  } catch (err) {
    console.error(err);
    res.render('dashboard', { botStats: { totalGuilds: 0, totalUsers: 0 }, activePage: 'dashboard' });
  }
});

app.get('/dashboard/:guildId', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'guild'));

// Helper: fetch settings/stats for guild sub-pages (bot API if online, else DB-direct)
async function guildPageData(req, res, guildId, page) {
  const guild = req.session.guilds.find(g => g.id === guildId);
  if (!guild) return res.redirect('/dashboard');
  req.session.selectedGuild = guildId;

  const settings = await getSettings(guildId);
  const online = await botApiHealthy();

  let stats = { memberCount: guild.approximate_member_count || guild.memberCount || null };
  try {
    if (online) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/stats`, { timeout: 4000 });
      if (r.ok) stats = await r.json();
    }
  } catch {}

  let tickets = [];
  try {
    if (online) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/tickets`, { timeout: 4000 });
      if (r.ok) tickets = await r.json();
    }
    if (!tickets.length && dbReady()) {
      tickets = await Ticket.find({ guildId }).sort({ createdAt: -1 }).limit(200).lean();
    }
  } catch {}

  let members = null;
  try {
    if (online) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/members`, { timeout: 8000 });
      if (r.ok) {
        const arr = await r.json();
        if (Array.isArray(arr)) members = { total: arr.length, list: arr };
        else members = arr;
      }
    } else if (dbReady()) {
      const profiles = await UserProfile.find({ guildId }).sort({ totalXp: -1 }).limit(0).lean();
      // Bot offline: only DB profiles (no live presence). The members page offers a refresh via the command queue.
      members = { total: profiles.length, list: profiles.map(p => ({ id: p.userId, username: null, xp: p.xp || 0, level: p.level || 0, presence: 'unknown', roles: [], joinedAt: null, bot: false, dbProfile: true })) };
    }
  } catch {}
  if (!members) members = { total: 0, list: [] };

  let logs = { logs: [], page: 1, pages: 1 };
  try {
    if (online) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/logs`, { timeout: 4000 });
      if (r.ok) logs = await r.json();
    }
    if (!(logs.logs || []).length && dbReady()) {
      const cases = await ModerationCase.find({ guildId }).sort({ createdAt: -1 }).limit(200).lean();
      logs = { logs: cases, page: 1, pages: 1 };
    }
  } catch {}

  let economy = [];
  try {
    if (online) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/economy`, { timeout: 4000 });
      if (r.ok) economy = await r.json();
    }
    if (!economy.length && dbReady()) {
      economy = await UserProfile.find({ guildId }).sort({ balance: -1 }).limit(200).lean();
    }
  } catch {}

  res.render(page, { guild, settings, stats, tickets, members, logs, economy, activePage: page, botOnline: online });
}

app.get('/dashboard/:guildId/protection', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'protection'));
app.get('/dashboard/:guildId/ai', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'ai'));
app.get('/dashboard/:guildId/tickets', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'tickets'));
app.get('/dashboard/:guildId/members', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'members'));
app.get('/dashboard/:guildId/settings', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'settings'));
app.get('/dashboard/:guildId/logs', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'logs'));
app.get('/dashboard/:guildId/economy', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'economy'));
app.get('/dashboard/:guildId/welcome', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'welcome'));

async function settingsUpdateHandler(req, res) {
  const { guildId } = req.params;
  const guild = req.session.guilds.find(g => g.id === guildId);
  if (!guild) return res.status(403).json({ error: 'No access' });

  try {
    // Handle special push/pull operations for arrays
    const body = { ...req.body };
    if (body._pushCmd) { body.$push = { customCommands: body._pushCmd }; delete body._pushCmd; }
    if (body._pullCmd) { body.$pull = { customCommands: { name: body._pullCmd } }; delete body._pullCmd; }
    if (body._pushTag) { body.$push = { ...(body.$push||{}), tags: body._pushTag }; delete body._pushTag; }
    if (body._pullTag) { body.$pull = { ...(body.$pull||{}), tags: { name: body._pullTag } }; delete body._pullTag; }

    // Handle feature-level updates: { featureId, ...keys } → { protection: { featureId: {...keys} } }
    if (body.featureId) {
      const featureId = body.featureId;
      delete body.featureId;
      const featureKeys = { ...body };
      delete featureKeys.protection;
      body.protection = { ...(body.protection || {}), [featureId]: featureKeys };
    }

    const result = await saveSettings(guildId, body);
    if (result.ok) return res.json(result.data || { success: true });
    return res.status(500).json({ error: result.error || 'Failed to update' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

app.post('/api/guilds/:guildId/settings', settingsUpdateHandler);
app.patch('/api/guilds/:guildId/settings', settingsUpdateHandler);

app.get('/api/user/guilds', requireAuth, (req, res) => {
  res.json({ guilds: req.session.guilds });
});

// ===== Live bot actions via the remote command queue =====
// The dashboard may be hosted apart from the bot; the bot polls the
// DashboardCommand collection and executes queued commands.

// Tickets: list from DB, detail enriched from DB, actions via queue
app.get('/api/guilds/:guildId/tickets', requireAuth, async (req, res) => {
  try {
    const online = await botApiHealthy();
    if (online) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${req.params.guildId}/tickets`, { timeout: 5000 });
      if (r.ok) return res.json(await r.json());
    }
    if (!dbReady()) return res.status(502).json({ error: 'Database unavailable' });
    const list = await Ticket.find({ guildId: req.params.guildId }).sort({ createdAt: -1 }).limit(200).lean();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guilds/:guildId/tickets/:ticketId', requireAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(502).json({ error: 'Database unavailable' });
    const t = await Ticket.findById(req.params.ticketId).lean() ||
      await Ticket.findOne({ guildId: req.params.guildId, channelId: req.params.ticketId }).lean();
    if (!t) return res.status(404).json({ error: 'not found' });
    res.json({ conversation: [], transcript: t.transcript || '', ...t });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const TICKET_ACTIONS = { claim: 'ticket_claim', unclaim: 'ticket_unclaim', close: 'ticket_close', delete: 'ticket_delete', reply: 'ticket_reply' };
app.post('/api/guilds/:guildId/tickets/:ticketId/:action', requireAuth, async (req, res) => {
  const cmd = TICKET_ACTIONS[req.params.action];
  if (!cmd) return res.status(400).json({ error: 'unknown action' });
  queueResponse(res, await runCommand(req.params.guildId, cmd, {
    ticketId: req.params.ticketId,
    actor: (req.session.user || {}).username || null,
    ...req.body,
  }));
});

// Members: live data via queue (bot fetches from Discord)
app.get('/api/guilds/:guildId/members', requireAuth, async (req, res) => {
  try {
    const online = await botApiHealthy();
    if (online) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${req.params.guildId}/members`, { timeout: 15000 });
      if (r.ok) {
        const arr = await r.json();
        if (Array.isArray(arr)) return res.json({ total: arr.length, list: arr });
        return res.json(arr);
      }
    }
    const result = await runCommand(req.params.guildId, 'members_list', {}, 30000);
    if (!result.ok) {
      // Fallback: DB profiles (offline-friendly)
      if (dbReady()) {
        const profiles = await UserProfile.find({ guildId: req.params.guildId }).sort({ totalXp: -1 }).limit(1000).lean();
        return res.json({
          total: profiles.length,
          list: profiles.map(p => ({ id: p.userId, username: null, xp: p.xp || 0, level: p.level || 0, presence: 'unknown', roles: [], joinedAt: null, bot: false, dbProfile: true, balance: p.balance || 0 }))
        });
      }
      return res.status(502).json({ error: result.error });
    }
    const list = result.result.members || result.result.list || result.result || [];
    res.json({ total: Array.isArray(list) ? list.length : 0, list });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/guilds/:guildId/members/:memberId', requireAuth, async (req, res) => {
  const result = await runCommand(req.params.guildId, 'member_get', { userId: req.params.memberId });
  if (result.ok) return res.json(result.result || {});
  // Fallback: warnings from DB only
  try {
    const warnings = dbReady() ? await ModerationCase.find({ guildId: req.params.guildId, targetId: req.params.memberId }).sort({ createdAt: -1 }).lean() : [];
    res.json({ id: req.params.memberId, warnings, error: result.error });
  } catch (e) { res.json({ id: req.params.memberId, warnings: [] }); }
});

const MEMBER_ACTIONS = { warn: 'member_warn', kick: 'member_kick', ban: 'member_ban', timeout: 'member_timeout' };
app.post('/api/guilds/:guildId/members/:memberId/:action', requireAuth, async (req, res) => {
  const cmd = MEMBER_ACTIONS[req.params.action];
  if (!cmd) return res.status(400).json({ error: 'unknown action' });
  queueResponse(res, await runCommand(req.params.guildId, cmd, {
    userId: req.params.memberId,
    actor: (req.session.user || {}).username || null,
    ...req.body,
  }));
});

app.post('/api/guilds/:guildId/members/:memberId/roles', requireAuth, async (req, res) => {
  queueResponse(res, await runCommand(req.params.guildId, 'member_addrole', {
    userId: req.params.memberId, roleId: req.body.roleId,
    actor: (req.session.user || {}).username || null,
  }));
});

app.delete('/api/guilds/:guildId/members/:memberId/roles', requireAuth, async (req, res) => {
  queueResponse(res, await runCommand(req.params.guildId, 'member_removerole', {
    userId: req.params.memberId, roleId: req.body.roleId,
    actor: (req.session.user || {}).username || null,
  }));
});

app.post('/api/guilds/:guildId/members/bulk', requireAuth, async (req, res) => {
  const { action, userIds = [], ...rest } = req.body || {};
  const map = { addRole: 'member_addrole', removeRole: 'member_removerole', timeout: 'member_timeout', kick: 'member_kick', ban: 'member_ban', warn: 'member_warn' };
  const cmd = map[action];
  if (!cmd || !Array.isArray(userIds)) return res.status(400).json({ error: 'unknown bulk action' });
  let success = 0, failed = 0;
  for (const userId of userIds) {
    const r = await runCommand(req.params.guildId, cmd, { userId, actor: (req.session.user || {}).username || null, ...rest }, 25000);
    if (r.ok) success++; else failed++;
  }
  res.json({ success, failed });
});

app.get('/api/guilds/:guildId/roles', requireAuth, async (req, res) => {
  const result = await runCommand(req.params.guildId, 'roles_list', {});
  if (result.ok) return res.json(result.result.roles || result.result || []);
  return res.status(502).json({ error: result.error });
});

// Economy: reads + give/reset directly from the shared database
app.get('/api/guilds/:guildId/economy', requireAuth, async (req, res) => {
  try {
    const online = await botApiHealthy();
    if (online) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${req.params.guildId}/economy`, { timeout: 5000 });
      if (r.ok) return res.json(await r.json());
    }
    if (!dbReady()) return res.json([]);
    const list = await UserProfile.find({ guildId: req.params.guildId }).sort({ balance: -1 }).limit(200).lean();
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/guilds/:guildId/economy/give', requireAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(502).json({ error: 'Database unavailable' });
    const { userId, amount } = req.body || {};
    if (!userId || !amount) return res.status(400).json({ error: 'userId & amount required' });
    await UserProfile.updateOne(
      { userId, guildId: req.params.guildId },
      { $inc: { balance: Number(amount) }, $setOnInsert: { xp: 0, level: 0, bank: 0, totalXp: 0, messagesSent: 0, voiceTime: 0 } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/guilds/:guildId/economy/reset', requireAuth, async (req, res) => {
  try {
    if (!dbReady()) return res.status(502).json({ error: 'Database unavailable' });
    const filter = req.body?.userId ? { userId: req.body.userId, guildId: req.params.guildId } : { guildId: req.params.guildId };
    await UserProfile.updateMany(filter, { $set: { balance: 0, bank: 0 } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Shop: stored in GuildSettings — direct DB
app.get('/api/guilds/:guildId/shop', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings(req.params.guildId);
    res.json(settings.shop?.items || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/guilds/:guildId/shop', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings(req.params.guildId);
    settings.shop = settings.shop || { enabled: true, items: [] };
    items = settings.shop.items || [];
    items.push(req.body);
    const r = await saveSettings(req.params.guildId, { shop: { ...settings.shop, items } });
    if (r.ok) return res.json(items);
    res.status(500).json({ error: r.error });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/guilds/:guildId/shop/:itemId', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings(req.params.guildId);
    if (!settings.shop) return res.json([]);
    const items = (settings.shop.items || []).filter(i => i.id !== req.params.itemId);
    const r = await saveSettings(req.params.guildId, { shop: { ...settings.shop, items } });
    if (r.ok) return res.json(items);
    res.status(500).json({ error: r.error });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bot leave guild — via queue
app.post('/api/guilds/:guildId/leave', requireAuth, async (req, res) => {
  queueResponse(res, await runCommand(req.params.guildId, 'guild_leave', {}));
});

// Health probe for the client UI (is the reachable bot online?)
app.get('/api/bot-status', async (req, res) => {
  res.json({ online: await botApiHealthy() });
});

app.post('/api/select-guild', requireAuth, (req, res) => {
  const { guildId } = req.body;
  const guild = req.session.guilds.find(g => g.id === guildId);
  if (!guild) return res.status(400).json({ error: 'Invalid guild' });
  req.session.selectedGuild = guildId;
  res.json({ success: true });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`🌐 Dashboard running on port ${PORT}`);
  console.log(`🔗 OAuth redirect: ${DISCORD_REDIRECT_URI}`);
});