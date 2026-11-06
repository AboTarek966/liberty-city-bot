'use strict';
/* ============================================
   Omni Dashboard — Frontend (vanilla JS)
   ============================================ */

// ===== Helpers =====
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => (d ? new Date(d).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('ar-EG'));
const fmtDur = (sec) => {
  sec = Number(sec || 0);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d) return `${d}ي ${h}س`;
  if (h) return `${h}س ${m}د`;
  return `${m}د ${sec % 60}ث`;
};

// ===== State =====
const S = {
  guildId: null,
  guilds: [],
  settings: null,
  channels: [],
  page: 'overview',
  ready: false,
};

// ===== API =====
const api = {
  async req(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'x-omni-csrf': '1',
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) {
      showLogin({ password: true, code: true });
      throw new Error('انتهت الجلسة — سجّل الدخول من جديد');
    }
    let data = null;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
    return data;
  },
  get(p) { return this.req(p); },
  post(p, body) { return this.req(p, { method: 'POST', body: JSON.stringify(body || {}) }); },
  patch(p, body) { return this.req(p, { method: 'PATCH', body: JSON.stringify(body || {}) }); },
  del(p) { return this.req(p, { method: 'DELETE' }); },
};

// ===== Toast & Modal =====
let toastTimer = null;
function toast(msg, type = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

let modalOk = null;
function openModal({ title, body, okText = 'تأكيد', danger = false, onOk }) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  const ok = $('#modal-ok');
  ok.textContent = okText;
  ok.className = 'btn ' + (danger ? 'danger' : 'primary');
  modalOk = onOk || null;
  $('#modal').classList.remove('hidden');
}
let pendingConfirmResolve = null;
function closeModal() {
  $('#modal').classList.add('hidden');
  modalOk = null;
  if (pendingConfirmResolve) {
    const r = pendingConfirmResolve;
    pendingConfirmResolve = null;
    r(false);
  }
}
function confirmModal(title, text, okText = 'تأكيد') {
  return new Promise((resolve) => {
    let settled = false;
    pendingConfirmResolve = (v) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    openModal({
      title, body: `<p>${esc(text)}</p>`, okText, danger: true,
      onOk: () => {
        if (pendingConfirmResolve) {
          const r = pendingConfirmResolve;
          pendingConfirmResolve = null;
          settled = true;
          r(true);
        }
        return true;
      },
    });
  });
}
function modalInput(html) {
  const el = $('#modal-body').querySelector('[data-modal-input]');
  return el ? el.value : null;
}

// ===== Field value access =====
function val(path) {
  let n = S.settings || {};
  for (const p of path.split('.')) {
    if (n == null || typeof n !== 'object') return undefined;
    n = n[p];
  }
  return n;
}
function setDeep(obj, path, value) {
  const parts = path.split('.');
  let n = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!n[parts[i]] || typeof n[parts[i]] !== 'object') n[parts[i]] = {};
    n = n[parts[i]];
  }
  n[parts[parts.length - 1]] = value;
}
// طابور حفظ متسلسل — يمنع إرسال PATCH متوازية عند ضغط مفاتيح متعددة بسرعة
let saveChain = Promise.resolve();
function save(path, value) {
  const doSave = async () => {
    const patch = {};
    setDeep(patch, path, value);
    await api.patch(`/api/guilds/${S.guildId}/settings`, patch);
    setDeep(S.settings, path, value);
    toast('تم الحفظ ✓', 'ok');
  };
  const next = saveChain.catch(() => {}).then(doSave);
  saveChain = next.catch(() => {});
  return next;
}

// ===== Field builders =====
function sw(path, label, desc = '') {
  const v = !!val(path);
  return `<label class="sw"><input type="checkbox" data-set="${path}" data-kind="bool" ${v ? 'checked' : ''}><span class="track"></span><span class="lbl">${esc(label)}${desc ? `<em>${esc(desc)}</em>` : ''}</span></label>`;
}
function txt(path, label, ph = '') {
  return `<div class="field"><label>${esc(label)}</label><input class="inp" data-set="${path}" data-kind="text" value="${esc(val(path) ?? '')}" placeholder="${esc(ph)}"></div>`;
}
function num(path, label, opts = {}) {
  const v = val(path);
  const attrs = [opts.min != null ? `min="${opts.min}"` : '', opts.max != null ? `max="${opts.max}"` : '', opts.step != null ? `step="${opts.step}"` : ''].join(' ');
  return `<div class="field"><label>${esc(label)}</label><input type="number" class="inp" data-set="${path}" data-kind="num" value="${esc(v ?? '')}" ${attrs}></div>`;
}
function area(path, label, ph = '') {
  return `<div class="field"><label>${esc(label)}</label><textarea class="inp" data-set="${path}" data-kind="text" placeholder="${esc(ph)}">${esc(val(path) ?? '')}</textarea></div>`;
}
function arr(path, label, ph = 'مفصولة بفواصل') {
  const v = val(path);
  const joined = Array.isArray(v) ? v.join(',') : v || '';
  return `<div class="field"><label>${esc(label)} <em class="dim">(${esc(ph)})</em></label><input class="inp" data-set="${path}" data-kind="array" value="${esc(joined)}"></div>`;
}
function sel(path, label, options) {
  const cur = String(val(path) ?? '');
  return `<div class="field"><label>${esc(label)}</label><select class="inp" data-set="${path}" data-kind="text">${options
    .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === cur ? 'selected' : ''}>${esc(l)}</option>`)
    .join('')}</select></div>`;
}
function chSel(path, label) {
  const cur = String(val(path) ?? '');
  const opts = [['', '— بدون —'], ...S.channels.filter((c) => c.type === 0 || c.type === 5).map((c) => [c.id, `#${c.name}`])];
  return `<div class="field"><label>${esc(label)}</label><select class="inp" data-set="${path}" data-kind="text">${opts
    .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === cur ? 'selected' : ''}>${esc(l)}</option>`)
    .join('')}</select></div>`;
}
function card(title, body, icon = '') {
  return `<div class="card"><div class="card-head"><h3>${icon ? esc(icon) + ' ' : ''}${esc(title)}</h3></div><div class="card-body">${body}</div></div>`;
}

// ===== Screen switching =====
function showLogin(login = {}) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  const codeBlock = $('#login-code-block');
  const passBlock = $('#login-pass-block');
  const noneBlock = $('#login-none');
  const err = $('#login-error');
  err.classList.add('hidden');

  const codeOn = login.code !== false;
  const passOn = !!login.password;
  codeBlock.classList.toggle('hidden', !codeOn);
  passBlock.classList.toggle('hidden', !passOn);
  noneBlock.classList.toggle('hidden', codeOn || passOn);
}

async function startApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const data = await api.get('/dashboard/api/guilds');
  S.guilds = data.guilds || [];
  const select = $('#guild-select');
  select.innerHTML = S.guilds.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
  if (!S.guilds.length) {
    $('#view').innerHTML = '<div class="empty">البوت ليس عضواً في أي سيرفر بعد.</div>';
    return;
  }
  const saved = localStorage.getItem('omni_guild');
  const initial = S.guilds.find((g) => g.id === saved)?.id || S.guilds[0].id;
  select.value = initial;
  select.onchange = () => selectGuild(select.value);

  const page = (location.hash || '#/overview').slice(2) || 'overview';
  S.ready = true;
  renderNav();
  await selectGuild(initial, page);

  // كشف انتهاء الجلسة من السيرفر
  setInterval(async () => {
    try {
      const st = await api.get('/dashboard/auth/status');
      if (!st.authenticated) showLogin(st.login);
    } catch { /* تجاهل */ }
  }, 120000);
}

async function selectGuild(id, page) {
  S.guildId = id;
  S.settings = null;
  S.channels = [];
  localStorage.setItem('omni_guild', id);
  const g = S.guilds.find((x) => x.id === id);
  $('#guild-icon').src = g && g.icon ? g.icon : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  $('#bot-status').textContent = '…';
  $('#bot-status').className = 'chip';
  $('#view').innerHTML = '<div class="empty">…جارٍ التحميل</div>';
  try {
    const [settings, chans] = await Promise.all([
      api.get(`/api/guilds/${id}/settings`),
      api.get(`/api/guilds/${id}/channels`).catch(() => ({ channels: [] })),
    ]);
    S.settings = settings || {};
    S.channels = chans.channels || [];
    $('#bot-status').textContent = '🟢 متصل';
    $('#bot-status').className = 'chip green';
  } catch (e) {
    $('#bot-status').textContent = '⚠️ خطأ';
    $('#bot-status').className = 'chip red';
    $('#view').innerHTML = `<div class="empty">تعذّر تحميل الإعدادات: ${esc(e.message)}</div>`;
    return;
  }
  navigate(page || S.page);
}

function renderNav() {
  const PAGES = [
    ['overview', '🏠', 'نظرة عامة'],
    ['protection', '🛡️', 'الحماية'],
    ['ai', '🤖', 'الذكاء الاصطناعي'],
    ['tickets', '🎫', 'التذاكر'],
    ['members', '👥', 'الأعضاء'],
    ['economy', '💰', 'الاقتصاد'],
    ['welcome', '👋', 'الترحيب والوداع'],
    ['levels', '📈', 'المستويات'],
    ['logs', '📜', 'السجلات'],
    ['knowledge', '📚', 'قاعدة المعرفة'],
    ['general', '⚙️', 'إعدادات عامة'],
  ];
  $('#nav').innerHTML = PAGES.map(
    ([id, icon, label]) => `<button data-page="${id}">${icon} <span>${label}</span></button>`
  ).join('');
  $$('#nav button').forEach((b) => {
    b.onclick = () => navigate(b.dataset.page);
  });
}

function navigate(page) {
  S.page = page;
  location.hash = '#/' + page;
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  render(page);
}

// ===== Router =====
async function render(page) {
  if (!S.ready) return;
  const view = $('#view');
  view.innerHTML = '<div class="empty">…جارٍ التحميل</div>';
  try {
    const html = await (PAGES[page] || PAGES.overview)();
    view.innerHTML = html;
  } catch (e) {
    view.innerHTML = `<div class="empty">⚠️ ${esc(e.message)}</div>`;
  }
}

// ===== Delegated settings persistence =====
document.addEventListener('change', async (e) => {
  const el = e.target.closest('[data-set]');
  if (!el) return;
  const kind = el.dataset.kind;
  let v;
  if (kind === 'bool') v = el.checked;
  else if (kind === 'num') v = el.value === '' ? 0 : Number(el.value);
  else if (kind === 'array') v = el.value.split(',').map((s) => s.trim()).filter(Boolean);
  else v = el.value;
  el.style.borderColor = '';
  try {
    await save(el.dataset.set, v);
    el.style.borderColor = '#22c55e';
  } catch (err) {
    el.style.borderColor = '#f43f5e';
    toast(err.message, 'err');
  } finally {
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
  }
});

// ===== Modal wiring =====
$('#modal-x').onclick = closeModal;
$('#modal-cancel').onclick = () => { closeModal(); };
$('#modal-ok').onclick = async () => {
  if (!modalOk) return closeModal();
  try {
    const ok = await modalOk();
    if (ok !== false) closeModal();
  } catch (e) {
    toast(e.message, 'err');
  }
};
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });

// ============================================
// Pages
// ============================================
const PAGES = {
  // ---------------- Overview ----------------
  async overview() {
    const [info, stats] = await Promise.all([
      api.get('/api/bot/info'),
      api.get(`/api/guilds/${S.guildId}/stats`).catch(() => ({})),
    ]);
    const g = S.guilds.find((x) => x.id === S.guildId) || {};
    return `
      <div class="grid-4 mb">
        <div class="stat-card"><div class="num">${fmtNum(stats.memberCount ?? g.memberCount)}</div><div class="lbl">أعضاء السيرفر</div></div>
        <div class="stat-card"><div class="num">${fmtNum(info.guilds)}</div><div class="lbl">سيرفرات البوت</div></div>
        <div class="stat-card"><div class="num">${info.ping}ms</div><div class="lbl">سرعة الاتصال</div></div>
        <div class="stat-card"><div class="num">${fmtDur(info.uptimeSeconds)}</div><div class="lbl">مدة التشغيل</div></div>
      </div>
      <div class="grid-2">
        ${card('البوت', `<div class="kv">
          <b>الحساب</b><span>${esc(info.user?.tag || '—')}</span>
          <b>الذاكرة</b><span>${fmtNum(info.memoryMB)} MB</span>
          <b>الأوامر</b><span>${fmtNum(info.commands)}</span>
          <b>إجمالي المستخدمين</b><span>${fmtNum(info.users)}</span>
          <b>إجمالي القنوات</b><span>${fmtNum(info.channels)}</span>
        </div>`, '🤖')}
        ${card('هذا السيرفر', `<div class="kv">
          <b>الاسم</b><span>${esc(g.name || '—')}</span>
          <b>المعرف</b><span><code>${esc(S.guildId)}</code></span>
          <b>القنوات</b><span>${fmtNum(stats.channelCount)}</span>
          <b>الرولات</b><span>${fmtNum(stats.roleCount)}</span>
          <b>متصل الآن</b><span>${fmtNum(stats.onlineCount)}</span>
          <b>الحماية</b><span>${val('protection.antiRaid.enabled') ? '🟢 رايد' : '🔴 رايد'} · ${val('protection.antiSpam.enabled') ? '🟢 سبام' : '🔴 سبام'} · ${val('protection.antiNuke.enabled') ? '🟢 تخريب' : '🔴 تخريب'}</span>
        </div>`, '🏰')}
      </div>`;
  },

  // ---------------- Protection ----------------
  async protection() {
    const state = (p) => (val(p) ? '🟢' : '🔴');
    const actions = [['delete', 'حذف'], ['warn', 'تحذير'], ['mute', 'كتم'], ['kick', 'طرد'], ['ban', 'حظر'], ['quarantine', 'حجر']];
    return `
      <div class="banner info">🛡️ التغييرات تُطبَّق فوراً على البوت (مزامنة تلقائية خلال ثوانٍ).</div>
      <div class="grid-2">
        ${card('الرايد والانضمام', `
          ${sw('protection.antiRaid.enabled', 'مكافحة الرايد')}
          ${sw('protection.antiRaid.beastMode.enabled', 'الوضع الوحشي', 'إجراءات مشدّدة للحسابات الجديدة')}
          <div class="grid-3">
            ${num('protection.antiRaid.threshold', 'عدد الداخلين خلال النافذة')}
            ${sel('protection.antiRaid.action', 'الإجراء', actions)}
            ${num('protection.antiRaid.beastMode.minAccountAgeDays', 'أقل عمر حساب (أيام)')}
          </div>
          <div class="sec-title">السبام</div>
          ${sw('protection.antiSpam.enabled', 'مكافحة السبام')}
          <div class="grid-3">
            ${num('protection.antiSpam.maxMessages', 'أقصى رسائل')}
            ${num('protection.antiSpam.timeWindow', 'النافذة (مللي ثانية)', { min: 1000 })}
            ${sel('protection.antiSpam.action', 'الإجراء', actions)}
          </div>`, '🚪')}
        ${card('الروابط والدعوات', `
          ${sw('protection.antiLink.enabled', 'حظر الروابط')}
          ${sel('protection.antiLink.action', 'إجراء الروابط', actions)}
          ${arr('protection.antiLink.whitelist', 'روابط مسموحة')}
          ${arr('protection.antiLink.ignoreRoles', 'رولات مستثناة (IDs)')}
          <div class="sec-title">الدعوات</div>
          ${sw('protection.antiInvite.enabled', 'حظر دعوات السيرفرات')}
          ${arr('protection.antiInvite.ignoreRoles', 'رولات مستثناة (IDs)')}`, '🔗')}
        ${card('المنشن والتكرار', `
          ${sw('protection.antiMention.enabled', 'حظر المنشن الجماعي')}
          <div class="grid-2">${num('protection.antiMention.max', 'أقصى عدد منشن')}${sel('protection.antiMention.action', 'الإجراء', actions)}</div>
          <div class="sec-title">الحروف الكبيرة والإيموجي</div>
          ${sw('protection.antiCaps.enabled', 'حظر الرسائل CAPS')}
          <div class="grid-2">${num('protection.antiCaps.percentage', 'نسبة الحروف %')}${num('protection.antiCaps.minLength', 'أقل طول')}</div>
          ${sw('protection.antiEmoji.enabled', 'حظر الإيموجي المفرط')}
          <div class="grid-2">${num('protection.antiEmoji.max', 'أقصى إيموجي')}${sel('protection.antiEmoji.action', 'الإجراء', actions)}</div>`, '📣')}
        ${card('مكافحة التخريب', `
          ${sw('protection.antiNuke.enabled', 'حماية anti-nuke')}
          <div class="grid-2">
            ${sel('protection.antiNuke.action', 'الإجراء', actions)}
            ${num('protection.antiNuke.threshold', 'حد العمليات')}
          </div>
          ${sw('protection.antiNuke.slowNukeGuard', 'الرصد البطيء', 'اكتشاف التخريب الموزّع على وقت طويل')}
          ${sw('protection.antiNuke.autoRestore', 'الاستعادة التلقائية للقنوات والرولات')}
          ${sw('protection.antiNuke.autoDmRecovery', 'تنبيه المالك بالخاص')}`, '💣')}
        ${card('الحسابات والبوتات', `
          ${sw('protection.antiAlt.enabled', 'كشف الحسابات الوهمية')}
          <div class="grid-2">${num('protection.antiAlt.checkCreationDays', 'أقل عمر حساب (أيام)')}${sel('protection.antiAlt.action', 'الإجراء', actions)}</div>
          ${sw('protection.antiBot.enabled', 'منع دخول البوتات')}
          ${arr('protection.antiBot.whitelist', 'بوتات مسموحة (IDs)')}
          ${sw('protection.antiAdmin.enabled', 'رصد الصلاحيات الخطيرة', 'تنبيه/معاقبة من يمنح Administrator')}`, '🤖')}
        ${card('الفلاتر والصيانة', `
          ${sw('protection.scamFilter.enabled', 'فلتر الاحتيال', 'روابط نصب وعروض وهمية')}
          ${sw('protection.messageScanner.enabled', 'ماسح المرفقات والروابط')}
          ${sw('protection.messageScanner.scanLinks', 'فحص الروابط')}
          ${sw('protection.messageScanner.scanAttachments', 'فحص المرفقات')}
          ${sw('protection.punishmentTracker.enabled', 'تتبع العقوبات المتكررة')}
          ${sw('protection.autoBackup.enabled', 'نسخ احتياطي تلقائي للإعدادات')}
          <div class="grid-2">${num('protection.autoBackup.interval', 'كل كم ساعة')}${num('protection.autoBackup.keep', 'عدد النسخ')}</div>
          ${sw('protection.autoScan.enabled', 'فحص أمني تلقائي دوري')}
          ${num('protection.autoScan.interval', 'كل كم ساعة')}`, '🧹')}
        ${card('متتبع الدعوات والقائمة البيضاء', `
          ${sw('protection.inviteTracker.enabled', 'متتبع الدعوات')}
          <div class="grid-2">${num('protection.inviteTracker.rewardInvites', 'مكافأة الدعوات')}${num('protection.inviteTracker.minInviteAgeHours', 'أقل عمر للحساب (ساعات)')}</div>
          ${arr('protection.inviteTracker.suspiciousInviteAction', 'ملاحظة: يتم ضبط الإجراء من البوت')}
          ${arr('protection.whitelist.userIds', 'قائمة بيضاء عامة (IDs)')}
          ${sw('protection.whitelist.enabled', 'تفعيل القائمة البيضاء')}`, '🎟️')}
      </div>`;
  },

  // ---------------- AI ----------------
  async ai() {
    const info = await api.get('/api/bot/info').catch(() => ({}));
    const cat = ['spam', 'toxicity', 'nsfw', 'scam', 'threat', 'pii', 'raid', 'selfharm'];
    const catAr = { spam: 'سبام', toxicity: 'إساءة', nsfw: 'إباحي', scam: 'احتيال', threat: 'تهديد', pii: 'بيانات شخصية', raid: 'رايد لغوي', selfharm: 'إيذاء ذات' };
    const acts = [['delete', 'حذف'], ['warn', 'تحذير'], ['mute', 'كتم'], ['ban', 'حظر'], ['resources', 'موارد']];
    const sevs = [['info', 'معلوماتي'], ['low', 'منخفض'], ['medium', 'متوسط'], ['high', 'عالي'], ['critical', 'حرج']];
    return `
      <div class="grid-2">
        ${card('الردود الذكية', `
          ${sw('ai.enabled', 'تفعيل الردود')}
          <div class="grid-2">
            ${sel('ai.provider', 'المزوّد', [['openai', 'OpenAI'], ['anthropic', 'Anthropic'], ['both', 'الاثنان']])}
            ${sel('ai.responseLanguage', 'لغة الرد', [['ar', 'العربية'], ['en', 'English'], ['auto', 'تلقائي']])}
          </div>
          <div class="grid-3">
            ${num('ai.temperature', 'الإبداع (0-2)', { step: 0.1 })}
            ${num('ai.maxTokens', 'أقصى توكنز')}
            ${num('ai.cooldown', 'الانتظار (ثواني)')}
          </div>
          ${area('ai.systemPrompt', 'الشخصية (System Prompt)')}
          ${arr('ai.allowedChannels', 'قنوات مسموحة (IDs — فارغ=الكل)')}
          ${arr('ai.ignoredChannels', 'قنوات مستثناة (IDs)')}`, '💬')}
        ${card('أدوات إضافية (تحليل المزاج والتلخيص)', `
          <div class="banner info">الصفحة الحالية للعرض — التشغيل من Discord: <code>/mood</code> و <code>/summarize</code>. مقفولة افتراضياً.</div>
          ${sw('aiInsights.moodEnabled', '📊 تحليل مزاج القنوات', 'تحليل آخر 20-100 رسالة + AI')}
          ${sw('aiInsights.summarizeEnabled', '🔗 تلخيص الروابط والفيديو', 'قراءة الصفحات وتلخيص يوتيوب')}`, '✨')}
        ${card('المترجم الفوري', `
          ${sw('protection.aiTranslator.enabled', 'تفعيل الترجمة التلقائية')}
          <div class="grid-2">
            ${sel('protection.aiTranslator.defaultTargetLang', 'اللغة الافتراضية', [['ar', 'العربية'], ['en', 'الإنجليزية'], ['fr', 'الفرنسية'], ['es', 'الإسبانية'], ['tr', 'التركية']])}
            ${num('protection.aiTranslator.maxLength', 'أقصى طول نص')}
          </div>
          ${sw('protection.aiTranslator.showOriginal', 'إظهار النص الأصلي')}
          ${arr('protection.aiTranslator.autoTranslateChannels', 'قنوات الترجمة التلقائية (IDs)')}`, '🌐')}
        ${card('رقيب المحتوى AI', `
          ${sw('protection.aiAutoMod.enabled', 'تفعيل رقيب المحتوى')}
          <div class="grid-2">
            ${num('protection.aiAutoMod.sensitivity', 'الحساسية (1-10)', { min: 1, max: 10 })}
            ${sw('protection.aiAutoMod.escalation', 'تصعيد تلقائي للمخالفات المتكررة')}
          </div>
          <div class="sec-title">التصنيفات</div>
          ${cat.map((c) => `<div class="sec-title" style="margin:6px 0 2px">${catAr[c]}</div>${sw('protection.aiAutoMod.categories.' + c, 'تفعيل ' + catAr[c])}<div style="max-width:230px">${sel('protection.aiAutoMod.actions.' + c, 'الإجراء', acts)}</div>`).join('')}`, '🧠')}
        ${card('مساعد التذاكر AI', `
          ${sw('protection.aiTicketAssistant.enabled', 'تفعيل المساعد')}
          ${sw('protection.aiTicketAssistant.autoClaim', 'استلام تلقائي')}
          ${sw('protection.aiTicketAssistant.replyToMessages', 'الرد على الرسائل')}
          ${sw('protection.aiTicketAssistant.analyzeOnCreate', 'تحليل عند الإنشاء')}
          ${num('protection.aiTicketAssistant.confidenceThreshold', 'حد الثقة %')}
          ${sw('protection.aiTicketAssistant.requireAdminApprovalForBans', 'موافقة إدارية قبل الحظر')}
          ${sw('protection.aiTicketAssistant.requireAdminApprovalForRoles', 'موافقة قبل الرولات')}
          ${area('protection.aiTicketAssistant.customPersonality', 'شخصية خاصة بالتذاكر')}`, '🎫')}
        ${card('المحقق الأمني الدوري', `
          ${sw('aiInvestigator.enabled', 'تفعيل المحقق')}
          ${sw('aiInvestigator.automatic', 'فحص تلقائي دوري')}
          ${sw('aiInvestigator.scanOnStartup', 'فحص عند بدء التشغيل')}
          <div class="grid-2">
            ${num('aiInvestigator.intervalHours', 'كل كم ساعة (1-168)', { min: 1, max: 168 })}
            ${sel('aiInvestigator.minSeverityToAlert', 'أدنى خطورة للتنبيه', sevs)}
          </div>
          ${chSel('aiInvestigator.alertChannelId', 'قناة التنبيهات')}
          ${sw('aiInvestigator.includeMessages', 'تحليل الرسائل')}
          <div class="grid-3">
            ${num('aiInvestigator.messageLookbackHours', 'مدى الرجوع (ساعات)')}
            ${num('aiInvestigator.maxMessagesPerChannel', 'أقصى رسائل/قناة')}
            ${num('aiInvestigator.maxFindings', 'أقصى نتائج')}
          </div>`, '🕵️')}
      </div>
      <div class="banner${info.dashboard?.passwordLogin ? '' : ' info'}">${info.dashboard?.passwordLogin ? '🔐 الدخول بكلمة المرور مفعّل.' : 'ℹ️ لتفعيل الدخول بكلمة مرور أضف <code>DASHBOARD_PASSWORD</code> في متغيرات البيئة.'}</div>`;
  },

  // ---------------- Tickets ----------------
  async tickets() {
    const data = await api.get(`/api/guilds/${S.guildId}/tickets`).catch(() => []);
    const list = Array.isArray(data) ? data : data.tickets || [];
    S.tickets = list;
    const rows = list
      .slice(0, 100)
      .map((t) => {
        const status = t.status === 'closed' ? '🔴 مغلقة' : t.status === 'claimed' ? '🟡 مستلمة' : '🟢 مفتوحة';
        return `<tr>
          <td>${esc(t.type || 'عام')}</td>
          <td><code>${esc(String(t.channelId || t._id || '').slice(0, 22))}</code></td>
          <td>${status}</td>
          <td>${esc(t.claimedBy || '—')}</td>
          <td>${fmtDate(t.createdAt)}</td>
          <td class="actions">
            <button class="btn sm" data-act="ticket-reply" data-id="${esc(t._id || t.channelId)}">رد</button>
            ${t.status !== 'closed' ? `<button class="btn sm success" data-act="ticket-claim" data-id="${esc(t._id || t.channelId)}">استلام</button><button class="btn sm danger" data-act="ticket-close" data-id="${esc(t._id || t.channelId)}">إغلاق</button>` : `<button class="btn sm danger" data-act="ticket-delete" data-id="${esc(t._id || t.channelId)}">حذف</button>`}
          </td>
        </tr>`;
      })
      .join('');
    return `
      ${card('إعدادات التذاكر', `
        ${sw('tickets.welcomeEnabled', 'رسالة ترحيب داخل التذكرة')}
        ${sw('tickets.autoMessageEnabled', 'رسالة تلقائية عند الفتح')}
        ${area('tickets.autoMessage', 'نص الرسالة التلقائية')}
        <div class="grid-3">
          ${num('tickets.autoCloseHours', 'إغلاق تلقائي بعد (ساعات)')}
          ${num('tickets.maxPerUser', 'أقصى تذاكر للعضو')}
          ${sw('tickets.surveyEnabled', 'استبيان رضا بعد الإغلاق')}
        </div>
        ${sw('tickets.lockUntilClaim', 'قفل التذكرة حتى يستلمها إداري')}
        ${arr('tickets.supportRoleIds', 'رولات الدعم (IDs)')}
        ${arr('tickets.adminRoleIds', 'رولات الإدارة العليا (IDs)')}`, '⚙️')}
      ${card('أحدث التذاكر', rows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>النوع</th><th>المعرف</th><th>الحالة</th><th>المستلم</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">لا توجد تذاكر بعد</div>', '🎫')}`;
  },

  // ---------------- Members ----------------
  async members() {
    const data = await api.get(`/api/guilds/${S.guildId}/members`).catch((e) => ({ list: [], error: e.message }));
    const list = Array.isArray(data) ? data : data.list || [];
    S.members = list;
    return `
      <div class="card"><div class="card-head"><h3>👥 الأعضاء (${fmtNum(data.total ?? list.length)})</h3>
        <input class="inp" id="member-search" style="max-width:220px" placeholder="🔍 بحث بالاسم أو ID">
      </div>
      <div class="card-body">
        <div class="tbl-wrap"><table class="tbl" id="members-table">
          <thead><tr><th>العضو</th><th>المعرف</th><th>الحالة</th><th>انضم</th><th>إجراءات</th></tr></thead>
          <tbody>
            ${list.slice(0, 300).map((m) => `<tr data-name="${esc(((m.username || '') + ' ' + (m.nickname || '') + ' ' + m.id).toLowerCase())}">
              <td>${esc(m.nickname || m.username || m.id)}${m.bot ? ' 🤖' : ''}</td>
              <td><code>${esc(m.id)}</code></td>
              <td>${m.presence === 'online' ? '🟢' : m.presence === 'idle' ? '🟡' : m.presence === 'dnd' ? '🔴' : '⚪'}</td>
              <td>${fmtDate(m.joinedAt)}</td>
              <td class="actions">
                <button class="btn sm" data-act="m-warn" data-id="${m.id}">تحذير</button>
                <button class="btn sm" data-act="m-timeout" data-id="${m.id}">توقيت</button>
                <button class="btn sm danger" data-act="m-kick" data-id="${m.id}">طرد</button>
                <button class="btn sm danger" data-act="m-ban" data-id="${m.id}">حظر</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        ${!list.length ? '<div class="empty">لا توجد بيانات — البوت قد لا يزال يجمع الأعضاء. حدّث الصفحة.</div>' : ''}
      </div></div>`;
  },

  // ---------------- Economy ----------------
  async economy() {
    const list = await api.get(`/api/guilds/${S.guildId}/economy`).catch(() => []);
    S.economy = Array.isArray(list) ? list : [];
    const items = (val('shop.items') || []);
    return `
      <div class="grid-2">
        ${card('إعداد الاقتصاد', `
          ${sw('economy.enabled', 'تفعيل الاقتصاد')}
          <div class="grid-2">${txt('economy.currency', 'اسم العملة')}${txt('economy.currencySymbol', 'الرمز')}</div>
          <div class="grid-3">
            ${num('economy.dailyAmount', 'المكافأة اليومية')}
            ${num('economy.weeklyAmount', 'الأسبوعية')}
            ${num('economy.monthlyAmount', 'الشهرية')}
          </div>
          ${sw('economy.bankEnabled', 'نظام البنك')}
          <div class="grid-2">${num('economy.bankInterestRate', 'فائدة يومية %', { step: 0.1 })}${num('economy.bankMaxDeposit', 'أقصى إيداع')}</div>
          ${sw('economy.robEnabled', 'السرقة')}
          <div class="grid-2">${num('economy.robCooldown', 'كولداون السرقة (مللي)')}${num('economy.transferTax', 'ضريبة التحويل %')}</div>
          ${sw('economy.leaderboardEnabled', 'لوحة المتصدرين')}
          ${sw('economy.shopEnabled', 'تفعيل المتجر')}`, '💰')}
        ${card('المتجر', `
          <div id="shop-list">${items.length ? items.map((it, i) => `<div class="sec-title" style="justify-content:space-between;display:flex"><span>${esc(it.name || 'عنصر')} — ${fmtNum(it.price)}</span><button class="btn sm danger" data-act="shop-del" data-idx="${i}">حذف</button></div>`).join('') : '<div class="empty">لا عناصر</div>'}</div>
          <button class="btn primary mt" data-act="shop-add">➕ إضافة عنصر</button>`, '🛒')}
      </div>
      ${card('أعلى الأرصدة', `
        <div class="grid-3 mb">
          <input class="inp" id="give-user" placeholder="ID العضو">
          <input class="inp" id="give-amount" type="number" placeholder="المبلغ (+/-)">
          <button class="btn success" data-act="econ-give">منح</button>
        </div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>العضو</th><th>الرصيد</th><th>البنك</th><th>المستوى</th></tr></thead><tbody>
          ${S.economy.slice(0, 50).map((u) => `<tr><td><code>${esc(u.userId || u.id || '')}</code></td><td>${fmtNum(u.balance)}</td><td>${fmtNum(u.bank)}</td><td>${fmtNum(u.level)}</td></tr>`).join('')}
        </tbody></table></div>
        <button class="btn danger mt" data-act="econ-reset">⚠️ تصفير اقتصاد السيرفر</button>`, '🏆')}`;
  },

  // ---------------- Welcome ----------------
  async welcome() {
    const w = val('welcome') || {};
    const l = val('leave') || {};
    return `
      <div class="grid-2">
        ${card('رسالة الترحيب', `
          ${sw('welcome.enabled', 'تفعيل الترحيب')}
          ${area('welcome.message', 'نص الترحيب', '{user} {server} {count}')}
          ${txt('welcome.embedTitle', 'عنوان البطاقة')}
          ${txt('welcome.embedColor', 'لون البطاقة (#hex)')}
          ${sw('welcome.dmEnabled', 'ترحيب بالخاص')}
          ${area('welcome.dmMessage', 'نص رسالة الخاص')}
          <div class="sec-title">الحالة: ${w.enabled ? '🟢 مفعّل' : '🔴 معطّل'}</div>`, '👋')}
        ${card('رسالة الوداع', `
          ${sw('leave.enabled', 'تفعيل الوداع')}
          ${area('leave.message', 'نص الوداع', '{user} {server} {count}')}
          ${txt('leave.embedColor', 'لون البطاقة (#hex)')}
          <div class="sec-title">الحالة: ${l.enabled ? '🟢 مفعّل' : '🔴 معطّل'}</div>`, '😢')}
      </div>`;
  },

  // ---------------- Levels ----------------
  async levels() {
    return `
      <div class="grid-2">
        ${card('نظام المستويات', `
          ${sw('leveling.enabled', 'تفعيل المستويات')}
          <div class="grid-3">
            ${num('leveling.xpPerMessage', 'XP لكل رسالة')}
            ${num('leveling.xpCooldown', 'كولداون (مللي)')}
            ${num('leveling.xpGainMultiplier', 'مضاعف الخبرة', { step: 0.1 })}
          </div>
          ${num('leveling.voiceXpPerMinute', 'XP للصوت/دقيقة')}
          ${arr('leveling.ignoredChannels', 'قنوات مستثناة (IDs)')}
          ${arr('leveling.ignoredRoles', 'رولات مستثناة (IDs)')}`, '📈')}
        ${card('رسالة الترقية', `
          ${sel('leveling.levelUpStyle', 'النمط', [['embed', 'بطاقة Embed'], ['text', 'نص عادي']])}
          ${txt('leveling.levelUpTitle', 'العنوان')}
          ${area('leveling.levelUpMessage', 'النص', '{user} {level}')}
          ${txt('leveling.levelUpColor', 'اللون (#hex)')}`, '🎉')}
      </div>`;
  },

  // ---------------- Logs ----------------
  async logs() {
    const TYPES = [['messages', 'الرسائل'], ['members', 'الأعضاء'], ['roles', 'الرولات'], ['channels', 'القنوات'], ['voice', 'الصوتي'], ['moderation', 'الإشراف'], ['tickets', 'التذاكر'], ['economy', 'الاقتصاد'], ['server', 'السيرفر'], ['ai', 'AI']];
    const data = await api.get(`/api/guilds/${S.guildId}/logs?limit=50`).catch(() => ({ logs: [] }));
    const rows = (data.logs || [])
      .map((c) => `<tr><td>${esc(c.caseId ?? '—')}</td><td>${esc(c.type || '')}</td><td><code>${esc(c.targetId || '')}</code></td><td>${esc(c.reason || '').slice(0, 60)}</td><td>${fmtDate(c.createdAt)}</td></tr>`)
      .join('');
    return `
      <div class="grid-2">
        ${card('إعداد السجلات', `
          ${sw('logging.enabled', 'تفعيل السجلات')}
          ${chSel('logging.channelId', 'القناة الرئيسية')}
          <div class="sec-title">تقسيم القنوات حسب النوع</div>
          <div class="grid-3">${TYPES.map(([k, ar]) => chSel('logging.channels.' + k, ar)).join('')}</div>
          ${arr('logging.ignoredChannels', 'قنوات مستثناة (IDs)')}
          ${arr('logging.ignoredRoles', 'رولات مستثناة (IDs)')}`, '📜')}
        ${card('آخر العقوبات والإجراءات', rows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>النوع</th><th>العضو</th><th>السبب</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">لا سجلات إشراف بعد</div>', '⚖️')}
      </div>`;
  },

  // ---------------- Knowledge ----------------
  async knowledge() {
    const data = await api.get(`/api/guilds/${S.guildId}/knowledge`);
    const entries = data.entries || [];
    return `
      ${card('إضافة معلومة', `
        <div class="grid-3">
          <input class="inp" id="k-title" placeholder="العنوان">
          <input class="inp" id="k-cat" placeholder="التصنيف (عام)">
          <input class="inp" id="k-tags" placeholder="وسوم مفصولة بفواصل">
        </div>
        <textarea class="inp mt" id="k-content" placeholder="المحتوى — يستخدمه AI للإجابة على الأعضاء والتذاكر" style="min-height:110px"></textarea>
        <button class="btn primary mt" data-act="k-add">➕ إضافة</button>`, '📚')}
      ${card(`المعلومات (${fmtNum(entries.length)})`, entries.length ? entries.map((en) => `
        <div class="sec-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>📄 ${esc(en.title)} <span class="dim">(${esc(en.category || 'عام')}${en.tags?.length ? ' · ' + esc(en.tags.join(', ')) : ''})</span></span>
          <button class="btn sm danger" data-act="k-del" data-id="${esc(en._id)}">حذف</button>
        </div>
        <div class="dim" style="white-space:pre-wrap;margin-bottom:8px">${esc(String(en.content || '').slice(0, 240))}${String(en.content || '').length > 240 ? '…' : ''}</div>
      `).join('') : '<div class="empty">لا توجد معلومات بعد</div>', '🗂️')}`;
  },

  // ---------------- General ----------------
  async general() {
    return `
      <div class="grid-2">
        ${card('الهوية', `
          ${txt('prefix', 'بادئة الأوامر النصية')}
          ${sel('language', 'لغة البوت', [['ar', 'العربية'], ['en', 'English']])}
          ${sel('timezone', 'المنطقة الزمنية', [['Asia/Riyadh', 'الرياض'], ['Africa/Cairo', 'القاهرة'], ['Asia/Dubai', 'دبي'], ['Asia/Baghdad', 'بغداد'], ['UTC', 'UTC']])}
          ${txt('settingsPassword', 'كلمة مرور لوحة الإعدادات في Discord')}`, '⚙️')}
        ${card('الموسيقى والسنايب', `
          ${sw('music.enabled', 'تفعيل الموسيقى')}
          ${sw('music.allowDJ', 'رول DJ فقط يتحكم')}
          <div class="grid-2">${num('music.defaultVolume', 'مستوى الصوت %', { min: 1, max: 100 })}${num('music.maxQueueSize', 'أقصى قائمة انتظار')}</div>
          ${sw('music.autoplay', 'تشغيل تلقائي بعد القائمة')}
          <div class="sec-title">سنايب</div>
          ${sw('snipe.enabled', 'استرجاع الرسائل المحذوفة /snipe')}`, '🎵')}
      </div>`;
  },
};

// ============================================
// Page wiring (actions)
// ============================================
function memberById(id) { return (S.members || []).find((m) => m.id === id); }

async function runCommand(command, payload = {}) {
  const r = await api.post(`/api/guilds/${S.guildId}/command`, { command, payload });
  if (r && r.success === false) throw new Error(r.error || 'فشل');
  return r ? r.result : null;
}

// مستمع موحّد لكل صفحات اللوحة (يمنع تكرار المستمعات عند التنقل)
document.addEventListener('click', onViewClick);
document.addEventListener('input', (e) => {
  if (e.target.id === 'member-search') {
    const q = e.target.value.trim().toLowerCase();
    $$('#members-table tbody tr').forEach((tr) => {
      tr.style.display = !q || (tr.dataset.name || '').includes(q) ? '' : 'none';
    });
  }
});

function onViewClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const id = btn.dataset.id;
  if (act && act.startsWith('m-')) return onMemberAction(btn, id);
  if (act && act.startsWith('ticket-')) return onTicketAction(btn, id);
  if (act === 'k-add' || act === 'k-del') return onKnowledgeAction(btn);
  if (act === 'econ-give' || act === 'econ-reset' || act === 'shop-del' || act === 'shop-add') return onEconomyAction(btn);
}

function onMemberAction(btn, id) {
  const m = memberById(id) || {};
  const name = m.nickname || m.username || id;
  const map = {
    'm-warn': {
      title: `تحذير ${name}`, ok: 'إرسال التحذير',
      body: '<input class="inp" data-modal-input placeholder="سبب التحذير">',
      run: (reason) => runCommand('member_warn', { userId: id, reason }),
    },
    'm-timeout': {
      title: `توقيت ${name}`, ok: 'تطبيق التوقيت',
      body: '<input class="inp" type="number" data-modal-input placeholder="المدة بالدقائق (0 لإلغاء)" value="10">',
      run: (min) => runCommand('member_timeout', { userId: id, duration: Math.max(0, Number(min || 0)) * 60000 }),
    },
    'm-kick': {
      title: `طرد ${name}`, ok: 'طرد', danger: true,
      body: '<input class="inp" data-modal-input placeholder="سبب الطرد">',
      run: (reason) => runCommand('member_kick', { userId: id, reason }),
    },
    'm-ban': {
      title: `حظر ${name}`, ok: 'حظر', danger: true,
      body: '<input class="inp" data-modal-input placeholder="سبب الحظر">',
      run: (reason) => runCommand('member_ban', { userId: id, reason }),
    },
  };
  const cfg = map[btn.dataset.act];
  if (!cfg) return;
  openModal({
    title: cfg.title, body: cfg.body, okText: cfg.ok, danger: !!cfg.danger,
    onOk: async () => {
      const v = modalInput();
      await cfg.run(v);
      toast('تم التنفيذ ✓', 'ok');
    },
  });
}

function onTicketAction(btn, id) {
  const actions = {
    'ticket-reply': {
      title: 'رد على التذكرة', ok: 'إرسال',
      body: '<textarea class="inp" data-modal-input placeholder="نص الرد"></textarea>',
      cmd: (v) => ['ticket_reply', { ticketId: v.id, content: v.value, actor: 'لوحة التحكم' }],
    },
    'ticket-claim': { title: 'استلام التذكرة', ok: 'استلام', cmd: (v) => ['ticket_claim', { ticketId: v.id }] },
    'ticket-close': { title: 'إغلاق التذكرة', ok: 'إغلاق', cmd: (v) => ['ticket_close', { ticketId: v.id, reason: 'إغلاق من لوحة التحكم' }] },
    'ticket-delete': { title: 'حذف التذكرة', ok: 'حذف', cmd: (v) => ['ticket_delete', { ticketId: v.id }] },
  };
  const cfg = actions[btn.dataset.act];
  if (!cfg) return;
  openModal({
    title: cfg.title, body: cfg.body || '', okText: cfg.ok,
    danger: btn.dataset.act.includes('delete') || btn.dataset.act.includes('close'),
    onOk: async () => {
      const v = modalInput();
      const [command, payload] = cfg.cmd({ id, value: v });
      await runCommand(command, payload);
      toast('تم ✓', 'ok');
      render('tickets');
    },
  });
}

async function onKnowledgeAction(btn) {
  if (btn.dataset.act === 'k-add') {
    const title = $('#k-title').value.trim();
    const content = $('#k-content').value.trim();
    if (!title || !content) return toast('العنوان والمحتوى مطلوبان', 'err');
    await api.post(`/api/guilds/${S.guildId}/knowledge`, {
      title, content, category: $('#k-cat').value.trim(), tags: $('#k-tags').value,
    });
    toast('تمت الإضافة ✓', 'ok');
    render('knowledge');
  }
  if (btn.dataset.act === 'k-del') {
    if (!(await confirmModal('حذف المعلومة', 'هل أنت متأكد؟'))) return;
    await api.del(`/api/guilds/${S.guildId}/knowledge/${btn.dataset.id}`);
    toast('تم الحذف', 'ok');
    render('knowledge');
  }
}

async function onEconomyAction(btn) {
  const act = btn.dataset.act;
  if (act === 'econ-give') {
    const userId = $('#give-user').value.trim();
    const amount = Number($('#give-amount').value);
    if (!userId || !amount) return toast('أدخل ID والمبلغ', 'err');
    await api.post(`/api/guilds/${S.guildId}/economy/give`, { userId, amount });
    toast('تم المنح ✓', 'ok');
    render('economy');
  }
  if (act === 'econ-reset') {
    if (!(await confirmModal('تصفير الاقتصاد', 'سيتم حذف كل الأرصدة نهائياً — متأكد؟'))) return;
    await api.post(`/api/guilds/${S.guildId}/economy/reset`, {});
    toast('تم التصفير', 'ok');
    render('economy');
  }
  if (act === 'shop-del') {
    const items = [...(val('shop.items') || [])];
    items.splice(Number(btn.dataset.idx), 1);
    await save('shop.items', items);
    render('economy');
  }
  if (act === 'shop-add') {
    openModal({
      title: 'إضافة عنصر للمتجر', okText: 'إضافة',
      body: `<input class="inp" data-modal-input id="shop-name" placeholder="اسم العنصر">
             <input class="inp mt-sm" data-modal-input id="shop-price" type="number" placeholder="السعر">`,
      onOk: async () => {
        const name = $('#shop-name').value.trim();
        const price = Number($('#shop-price').value);
        if (!name || !price) return false;
        const items = [...(val('shop.items') || [])];
        items.push({ id: 'item_' + Date.now().toString(36), name, price });
        await save('shop.items', items);
        toast('تمت الإضافة ✓', 'ok');
        render('economy');
      },
    });
  }
}

// ===== Login wiring =====
function loginError(msg) {
  const el = $('#login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

$('#btn-request-code').onclick = async () => {
  try {
    await api.post('/dashboard/auth/code', {});
    $('#code-step').classList.remove('hidden');
    $('#btn-request-code').textContent = '🔁 إعادة إرسال الكود';
    toast('تم إرسال الكود على الخاص ✓', 'ok');
  } catch (e) {
    loginError(e.message);
  }
};

$('#btn-verify-code').onclick = async () => {
  try {
    await api.post('/dashboard/auth/code/verify', { code: $('#code-input').value.trim() });
    await startApp();
  } catch (e) {
    loginError(e.message);
  }
};

$('#btn-login-pass').onclick = async () => {
  try {
    await api.post('/dashboard/auth/password', { password: $('#pass-input').value });
    await startApp();
  } catch (e) {
    loginError(e.message);
  }
};

$('#btn-logout').onclick = async () => {
  try { await api.post('/dashboard/auth/logout', {}); } catch { /* تجاهل */ }
  location.reload();
};

$('#btn-refresh').onclick = async () => {
  await selectGuild(S.guildId, S.page);
};

// ===== Boot =====
(async function boot() {
  try {
    const st = await api.get('/dashboard/auth/status');
    if (st.authenticated) await startApp();
    else showLogin(st.login);
  } catch (e) {
    showLogin({ password: false, code: false });
  }
})();
