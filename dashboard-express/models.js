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

// Deep-merge update on top of the stored settings document (2 levels, mirrors bot)
async function saveSettings(guildId, update = {}) {
  try {
    if (await botApiHealthy()) {
      const r = await fetch(`${BOT_API_URL}/api/guilds/${guildId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
        timeout: 5000
      });
      if (r.ok) return { ok: true, data: await r.json() };
    }
  } catch {}
  try {
    if (!(await ensureConnected())) return { ok: false, error: 'Database unavailable' };
    let doc = await GuildSettings.findOne({ guildId });
    if (!doc) doc = new GuildSettings({ guildId });
    const raw = doc;
    for (const [key, value] of Object.entries(update)) {
      if (key.startsWith('$')) continue;
      // _direct:<path> → استبدال كامل للعنصر في المسار (للخرائط مثل leveling.levelRoles)
      if (key.startsWith('_direct:')) {
        const path = key.slice(8).split('.');
        let node = raw;
        for (let i = 0; i < path.length - 1; i++) {
          if (!node[path[i]] || typeof node[path[i]] !== 'object' || Array.isArray(node[path[i]])) node[path[i]] = {};
          node = node[path[i]];
        }
        node[path[path.length - 1]] = value;
        raw.markModified(path[0]);
        continue;
      }
      const current = raw[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
        for (const [subKey, subValue] of Object.entries(value)) {
          const subCurrent = current[subKey];
          if (subValue && typeof subValue === 'object' && !Array.isArray(subValue) && subCurrent && typeof subCurrent === 'object' && !Array.isArray(subCurrent)) {
            raw[key][subKey] = { ...subCurrent, ...subValue };
          } else {
            raw[key][subKey] = subValue;
          }
        }
        raw.markModified(key);
      } else {
        raw[key] = value;
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!Array.isArray(raw[k])) raw[k] = [];
        raw[k].push(v);
        raw.markModified(k);
      }
    }
    if (update.$pull) {
      for (const [k, cond] of Object.entries(update.$pull)) {
        if (!Array.isArray(raw[k])) continue;
        raw[k] = raw[k].filter(item => !Object.keys(cond).every(c => item[c] === cond[c]));
        raw.markModified(k);
      }
    }
    await raw.save();
    return { ok: true, data: raw.toObject() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  ensureConnected,
  getSettings,
  saveSettings,
  botApiHealthy,
  dbReady: () => mongoose.connection.readyState === 1,
  models: { GuildSettings, Ticket, ModerationCase, UserProfile, DashboardCommand },
};
