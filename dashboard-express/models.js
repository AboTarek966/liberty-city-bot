// ===== Dashboard standalone MongoDB access =====
// Mirrors the bot's Mongoose models so the dashboard can read/write the same
// database directly — required when deployed on free cloud hosting (e.g. Koyeb)
// where the bot's internal API isn't reachable.
const mongoose = require('mongoose');

const { Schema } = mongoose;

// Connection state
let connectingPromise = null;

async function ensureConnected() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return false;
  if (mongoose.connection.readyState === 1) return true;
  if (mongoose.connection.readyState === 2 && connectingPromise) {
    await connectingPromise;
    return mongoose.connection.readyState === 1;
  }
  connectingPromise = (async () => {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  })();
  try {
    await connectingPromise;
    console.log('🗄️  [models] MongoDB connected (dashboard direct access)');
    return true;
  } catch (err) {
    console.warn('⚠️  [models] MongoDB connect failed:', err.message);
    return false;
  } finally {
    connectingPromise = null;
  }
}

// ---- Loose schemas: tolerate full bot documents, only gate what we touch ----
const GuildSettingsSchema = new Schema({
  guildId: { type: String, required: true, index: true },
}, { strict: false, minimize: false });

const TicketSchema = new Schema({
  guildId: { type: String, index: true },
  channelId: String,
  userId: String,
  type: String,
  status: String,
  claimedBy: String,
  priority: String,
  subject: String,
  fields: Array,
  transcript: String,
  createdAt: Date,
  updatedAt: Date,
  closedAt: Date,
  lastActivityAt: Date,
}, { strict: false, minimize: false });

const ModerationCaseSchema = new Schema({
  guildId: { type: String, index: true },
  caseId: Number,
  type: String,
  moderatorId: String,
  targetId: { type: String, index: true },
  reason: String,
  active: Boolean,
  createdAt: Date,
}, { strict: false, minimize: false });

const UserProfileSchema = new Schema({
  userId: { type: String, index: true },
  guildId: { type: String, index: true },
  balance: Number,
  bank: Number,
  xp: Number,
  level: Number,
  totalXp: Number,
  messagesSent: Number,
  voiceTime: Number,
  dailyClaimed: Date,
}, { strict: false, minimize: false });

const DashboardCommandSchema = new Schema({
  guildId: { type: String, required: true, index: true },
  command: String,
  payload: Schema.Types.Mixed,
  status: { type: String, default: 'pending', index: true },
  result: Schema.Types.Mixed,
  error: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { strict: false, minimize: false });

// Use the SAME collection names as the bot (mongoose default pluralization)
const GuildSettings = mongoose.models.GuildSettings || mongoose.model('GuildSettings', GuildSettingsSchema);
const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', TicketSchema);
const ModerationCase = mongoose.models.ModerationCase || mongoose.model('ModerationCase', ModerationCaseSchema);
const UserProfile = mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);
const DashboardCommand = mongoose.models.DashboardCommand || mongoose.model('DashboardCommand', DashboardCommandSchema);

// ---- Settings access: bot API first, DB fallback (with health caching) ----
const BOT_API_URL = process.env.BOT_API_URL || '';
let botApiDownUntil = 0;

async function botApiHealthy() {
  if (!BOT_API_URL) return false;
  if (Date.now() < botApiDownUntil) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    const r = await fetch(`${BOT_API_URL}/health`, { signal: controller.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    botApiDownUntil = Date.now() + 5 * 60 * 1000; // skip for 5 min after a failure
    return false;
  }
}

async function getSettings(guildId) {
  try {
    if (await botApiHealthy()) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/settings`, { timeout: 4000 });
      if (r.ok) return await r.json();
    }
  } catch {}
  try {
    if (!(await ensureConnected())) return {};
    const doc = await GuildSettings.findOne({ guildId }).lean();
    return doc || { guildId };
  } catch (err) {
    console.warn('getSettings DB fallback failed:', err.message);
    return { guildId };
  }
}

// Deep-merge update on top of the stored settings document — RAW collection ops
// (يمرّ فوق كل قيود الموديلات: نفس الكي هو اللي يقرأه البوت + بلا مشاكل strict/mixed)
async function saveSettings(guildId, update = {}) {
  try {
    if (await botApiHealthy()) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
        timeout: 5000
      });
      if (r.ok) {
        await pushSyncCommand(guildId);
        return { ok: true, data: await r.json() };
      }
    }
  } catch {}
  try {
    if (!(await ensureConnected())) return { ok: false, error: 'Database unavailable' };
    const col = GuildSettings.collection;
    const raw = await col.findOne({ guildId: String(guildId) });

    // دمج عميق على مستوى JSON الخام — المفاتيح الغريبة تُستبدل كاملة
    const doc = raw || { guildId: String(guildId), createdAt: new Date() };
    for (const [key, value] of Object.entries(update)) {
      if (key.startsWith('$')) continue;
      if (key.startsWith('_direct:')) {
        setPath(doc, key.slice(8).split('.'), value);
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const cur = doc[key];
        if (!cur || typeof cur !== 'object' || Array.isArray(cur)) doc[key] = value;
        else merged(doc[key], value);
      } else {
        doc[key] = value;
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        const path = k.split('.');
        const arr = getPath(doc, path);
        if (Array.isArray(arr)) {
          arr.push(v);
          setPath(doc, path, arr);
        } else setPath(doc, path, [v]);
      }
    }
    if (update.$pull) {
      for (const [k, cond] of Object.entries(update.$pull)) {
        const path = k.split('.');
        const arr = getPath(doc, path);
        if (Array.isArray(arr)) {
          setPath(doc, path, arr.filter(item => item && typeof item === 'object' && !Object.keys(cond).every(c => item[c] === cond[c])));
        }
      }
    }
    doc.updatedAt = new Date();
    await col.replaceOne({ guildId: String(guildId) }, doc, { upsert: true });

    // 🔄 إبلاغ البوت فوراً (وإلا يظل يقرأ الكاش حتى 30 ثانية)
    await pushSyncCommand(guildId);

    return { ok: true, data: doc };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getPath(obj, path) {
  let n = obj;
  for (const p of path) {
    if (!n || typeof n !== 'object') return undefined;
    n = n[p];
  }
  return n;
}

function setPath(obj, path, value) {
  let n = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const p = path[i];
    if (!n[p] || typeof n[p] !== 'object' || Array.isArray(n[p])) n[p] = /^\d+$/.test(path[i + 1]) ? [] : {};
    n = n[p];
  }
  n[path[path.length - 1]] = value;
}

function merged(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      merged(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

// 🔄 أمر مزامنة سريع — العامل يمسح كاش الإعدادات لدى البوت خلال ثوان (poll كل 4ث)
async function pushSyncCommand(guildId) {
  try {
    await ensureConnected();
    await DashboardCommand.create({ guildId: String(guildId), command: 'settings_sync', payload: {}, status: 'pending', createdAt: new Date(), updatedAt: new Date() });
  } catch {}
}

module.exports = {
  ensureConnected,
  getSettings,
  saveSettings,
  botApiHealthy,
  dbReady: () => mongoose.connection.readyState === 1,
  models: { GuildSettings, Ticket, ModerationCase, UserProfile, DashboardCommand },
};
