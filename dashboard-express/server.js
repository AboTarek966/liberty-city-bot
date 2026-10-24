require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;
const BOT_API_URL = process.env.BOT_API_URL || 'http://localhost:3000';
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'liberty-city-dashboard-secret';

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
  cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 * 7 }
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

// Helper: exchange code for tokens
async function exchangeCode(code) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: DISCORD_REDIRECT_URI
  });
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  if (!res.ok) throw new Error('Token exchange failed');
  return res.json();
}

// Helper: refresh access token
async function refreshToken(refreshToken) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });
  if (!res.ok) throw new Error('Token refresh failed');
  return res.json();
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
      error: req.query.error || null
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
  const { code, state } = req.query;
  if (!code || state !== req.session.oauthState) {
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
    console.error('OAuth error:', err);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
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

app.get('/dashboard/:guildId', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const guild = req.session.guilds.find(g => g.id === guildId);
  if (!guild) return res.redirect('/dashboard');
  
  req.session.selectedGuild = guildId;
  
  // Fetch guild settings
  let settings = {};
  try {
    const res = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/settings`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    if (res.ok) settings = await res.json();
  } catch {}
  
  // Fetch guild stats
  let stats = { memberCount: 0, channelCount: 0, roleCount: 0 };
  try {
    const res = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/stats`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    if (res.ok) stats = await res.json();
  } catch {}
  
  res.render('guild', { guild, settings, stats, activePage: null });
});

// Helper: fetch settings/stats for guild sub-pages
async function guildPageData(req, res, guildId, page) {
  const guild = req.session.guilds.find(g => g.id === guildId);
  if (!guild) return res.redirect('/dashboard');
  req.session.selectedGuild = guildId;
  
  let settings = {};
  try {
    const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/settings`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    if (r.ok) settings = await r.json();
  } catch {}
  
  let stats = {};
  try {
    const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/stats`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    if (r.ok) stats = await r.json();
  } catch {}
  
  let tickets = [];
  try {
    const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/tickets`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    if (r.ok) tickets = await r.json();
  } catch {}
  
  let members = [];
  try {
    const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/members`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    if (r.ok) members = await r.json();
  } catch {}
  
  let logs = [];
  try {
    const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/logs`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    if (r.ok) logs = await r.json();
  } catch {}
  
  let economy = {};
  try {
    const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/economy`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    if (r.ok) economy = await r.json();
  } catch {}
  
  res.render(page, { guild, settings, stats, tickets, members, logs, economy, activePage: page });
}

app.get('/dashboard/:guildId/protection', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'protection'));
app.get('/dashboard/:guildId/ai', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'ai'));
app.get('/dashboard/:guildId/tickets', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'tickets'));
app.get('/dashboard/:guildId/members', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'members'));
app.get('/dashboard/:guildId/settings', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'settings'));
app.get('/dashboard/:guildId/logs', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'logs'));
app.get('/dashboard/:guildId/economy', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'economy'));
app.get('/dashboard/:guildId/welcome', requireAuth, (req, res) => guildPageData(req, res, req.params.guildId, 'welcome'));

app.post('/api/guilds/:guildId/settings', requireAuth, async (req, res) => {
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
    
    const res2 = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${req.session.accessToken}`
      },
      body: JSON.stringify(body)
    });
    if (res2.ok) {
      return res.json(await res2.json());
    }
    return res.status(500).json({ error: 'Failed to update' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/guilds', requireAuth, (req, res) => {
  res.json({ guilds: req.session.guilds });
});

// Proxy routes to bot API
const proxyRoutes = [
  ['get', '/api/guilds/:guildId/tickets'],
  ['post', '/api/guilds/:guildId/tickets/:ticketId/claim'],
  ['post', '/api/guilds/:guildId/tickets/:ticketId/close'],
  ['get', '/api/guilds/:guildId/members'],
  ['post', '/api/guilds/:guildId/members/:memberId/warn'],
  ['post', '/api/guilds/:guildId/members/:memberId/kick'],
  ['post', '/api/guilds/:guildId/members/:memberId/ban'],
  ['get', '/api/guilds/:guildId/logs'],
  ['get', '/api/guilds/:guildId/economy'],
  ['post', '/api/guilds/:guildId/economy/give'],
  ['post', '/api/guilds/:guildId/economy/reset'],
  ['get', '/api/guilds/:guildId/shop'],
  ['post', '/api/guilds/:guildId/shop'],
  ['delete', '/api/guilds/:guildId/shop/:itemId'],
  ['get', '/api/guilds/:guildId/welcome'],
  ['post', '/api/guilds/:guildId/protection/:feature'],
  ['post', '/api/guilds/:guildId/ai/:feature'],
  ['post', '/api/guilds/:guildId/leave'],
];

proxyRoutes.forEach(([method, route]) => {
  app[method](route, requireAuth, async (req, res) => {
    try {
      const resp = await fetch(`${BOT_API_URL}${req.path}`, {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${req.session.accessToken}`
        },
        body: method !== 'get' ? JSON.stringify(req.body) : undefined
      });
      res.status(resp.status);
      res.json(await resp.json());
    } catch (err) {
      res.status(502).json({ error: 'Bot API unavailable' });
    }
  });
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
  console.log(`🌐 Dashboard running on http://localhost:${PORT}`);
  console.log(`🔗 OAuth: http://localhost:${PORT}/auth/discord`);
});