'use strict';
/* ============================================
   Omni Dashboard — Frontend v2 "Pro Max"
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
  logsPage: 1,
  logsType: '',
};
const cache = { members: null, roles: null };

// ===== API =====
const api = {
  async req(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      ...opts,
      headers: { 'Content-Type': 'application/json', 'x-omni-csrf': '1', ...(opts.headers || {}) },
    });
    if (res.status === 401) {
      showLogin({ password: true, code: true });
      throw new Error('انتهت الجلسة — سجّل الدخول من جديد');
    }
    let data = null;
    try { data = await res.json(); } catch { data = {}; }
    if (res.status === 403 && data?.error === 'oauth_required') {
      showOAuthGuard();
    }
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
  el.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

let modalOk = null;
let pendingConfirmResolve = null;
function openModal({ title, body, okText = 'تأكيد', danger = false, wide = false, onOk }) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = body;
  const box = $('#modal .modal');
  box.classList.toggle('wide', !!wide);
  const ok = $('#modal-ok');
  ok.textContent = okText;
  ok.className = 'btn ' + (danger ? 'danger' : 'primary');
  modalOk = onOk || null;
  $('#modal').classList.add('open');
}
function closeModal() {
  $('#modal').classList.remove('open');
  modalOk = null;
  if (pendingConfirmResolve) { const r = pendingConfirmResolve; pendingConfirmResolve = null; r(false); }
}
function confirmModal(title, text, okText = 'تأكيد') {
  return new Promise((resolve) => {
    let settled = false;
    pendingConfirmResolve = (v) => { if (!settled) { settled = true; resolve(v); } };
    openModal({
      title, body: `<p class="confirm-text">${esc(text)}</p>`, okText, danger: true,
      onOk: () => { if (pendingConfirmResolve) { const r = pendingConfirmResolve; pendingConfirmResolve = null; settled = true; r(true); } return true; },
    });
  });
}
function modalInput() { const el = $('#modal-body').querySelector('[data-modal-input]'); return el ? el.value : null; }

// ===== Settings access =====
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

// ===== Caches =====
async function ensureMembers(force = false) {
  if (!force && cache.members) return cache.members;
  const data = await api.get(`/api/guilds/${S.guildId}/members`).catch(() => []);
  cache.members = Array.isArray(data) ? data : data.list || [];
  return cache.members;
}
async function ensureRoles(force = false) {
  if (!force && cache.roles) return cache.roles;
  cache.roles = await api.get(`/api/guilds/${S.guildId}/roles`).catch(() => []);
  return cache.roles;
}
function resolveName(id, kind) {
  if (!id) return '—';
  if (kind === 'role') return (cache.roles || []).find((r) => r.id === id)?.name || `رول ${String(id).slice(-5)}`;
  if (kind === 'member' || kind === 'bot') {
    const m = (cache.members || []).find((x) => x.id === id);
    return m ? `${m.nickname || m.username || id}${m.bot ? ' 🤖' : ''}` : `عضو ${String(id).slice(-5)}`;
  }
  if (kind === 'channel') {
    const c = S.channels.find((x) => x.id === id);
    return c ? `#${c.name}` : `قناة ${String(id).slice(-5)}`;
  }
  return String(id);
}

// ===== Field builders =====
function sw(path, label, desc = '') {
  return `<label class="sw"><input type="checkbox" data-set="${path}" data-kind="bool" ${val(path) ? 'checked' : ''}><span class="track"></span><span class="lbl">${esc(label)}${desc ? `<em>${esc(desc)}</em>` : ''}</span></label>`;
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
function roleSel(path, label) {
  const cur = String(val(path) ?? '');
  const opts = [['', '— بدون —'], ...(cache.roles || []).map((r) => [r.id, r.name])];
  return `<div class="field"><label>${esc(label)}</label><select class="inp" data-set="${path}" data-kind="text">${opts
    .map(([v, l]) => `<option value="${esc(v)}" ${String(v) === cur ? 'selected' : ''}>${esc(l)}</option>`)
    .join('')}</select></div>`;
}
function arrLines(path, label, ph = 'سطر لكل عنصر') {
  const v = val(path);
  const text = Array.isArray(v) ? v.join('\n') : v || '';
  return `<div class="field"><label>${esc(label)}</label><textarea class="inp" data-set="${path}" data-kind="lines" placeholder="${esc(ph)}">${esc(text)}</textarea></div>`;
}
function chipList(path, label, kind, hint = '') {
  const list = Array.isArray(val(path)) ? val(path) : [];
  const chips = list
    .map((id) => `<span class="chip-item" title="${esc(id)}"><span>${esc(resolveName(id, kind))}</span><button type="button" class="chip-x" data-chip-remove="${path}" data-chip-id="${esc(id)}">✕</button></span>`)
    .join('');
  return `<div class="field"><label>${esc(label)} ${hint ? `<em>${esc(hint)}</em>` : ''}</label>
    <div class="chip-box">${chips || '<span class="chip-empty">لا يوجد عناصر</span>'}
    <button type="button" class="btn sm" data-chip-add="${path}" data-chip-kind="${kind}">➕ إضافة</button></div></div>`;
}
function card(title, body, icon = '', extra = '') {
  return `<div class="card"><div class="card-head"><h3>${icon ? esc(icon) + ' ' : ''}${esc(title)}</h3><div class="head-side">${extra}</div></div><div class="card-body">${body}</div></div>`;
}
const FIELD = { title: 'الفصل', body: '', icon: '' };

// ===== Screen switching =====
function showLogin(login = {}) {
  $('#app').classList.add('hidden');
  $('#oauth-guard').classList.add('hidden');
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

function showOAuthGuard() {
  $('#login').classList.add('hidden');
  $('#app').classList.add('hidden');
  $('#oauth-guard').classList.remove('hidden');
  $('#oauth-guard').classList.add('open');
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
  cache.members = null;
  cache.roles = null;
  S.logsPage = 1;
  S.logsType = '';
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

const NAV = [
  { title: 'الرئيسية', items: [['overview', '🏠', 'نظرة عامة']] },
  { title: 'الأمان', items: [['protection', '🛡️', 'الحماية'], ['investigator', '🕵️', 'المحقق الأمني'], ['verification', '✅', 'التحقق'], ['honeypot', '🍯', 'المصيدة']] },
  { title: 'المجتمع', items: [['members', '👥', 'الأعضاء'], ['levels', '📈', 'المستويات'], ['economy', '💰', 'الاقتصاد'], ['welcome', '👋', 'الترحيب والوداع'], ['giveaways', '🎁', 'السحوبات']] },
  { title: 'الإدارة', items: [['tickets', '🎫', 'التذاكر'], ['announcements', '📢', 'الإعلانات'], ['commands', '🧩', 'أوامر ووسوم'], ['aliases', '⌨️', 'الأسماء المستعارة'], ['logs', '📜', 'السجلات'], ['knowledge', '📚', 'المعرفة']] },
  { title: 'النظام', items: [['ai', '🤖', 'الذكاء الاصطناعي'], ['general', '⚙️', 'إعدادات عامة'], ['sessions', '🔒', 'الجلسات والأجهزة'], ['help', '❓', 'مساعدة']] },
];
const ALL_PAGES = NAV.flatMap((g) => g.items.map((i) => i[0]));

function renderNav() {
  $('#nav').innerHTML = NAV.map(
    (group) => `<div class="nav-group"><div class="nav-title">${group.title}</div>${group.items
      .map(([id, icon, label]) => `<button type="button" data-page="${id}"><span class="nav-ic">${icon}</span><span>${label}</span></button>`)
      .join('')}</div>`
  ).join('');
  $$('#nav button').forEach((b) => { b.onclick = () => navigate(b.dataset.page); });
}

function navigate(page) {
  S.page = ALL_PAGES.includes(page) ? page : 'overview';
  location.hash = '#/' + page;
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === S.page));
  render(S.page);
}

// ===== Router =====
async function render(page) {
  if (!S.ready) return;
  const view = $('#view');
  view.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div><span>جارٍ التحميل…</span></div>';
  try {
    const html = await (PAGES[page] || PAGES.overview)();
    view.innerHTML = `<div class="page-anim">${html}</div>`;
  } catch (e) {
    view.innerHTML = `<div class="empty">⚠️ ${esc(e.message)}</div>`;
  }
}

// ===== Delegated events =====
document.addEventListener('change', async (e) => {
  // عناصر خاصة
  if (e.target.name === 'ann-type') {
    const isChannel = e.target.value === 'channel';
    const holder = $('#ann-channel-holder');
    if (holder) holder.classList.toggle('hidden', !isChannel);
    return;
  }
  if (e.target.id === 'logs-type') {
    S.logsType = e.target.value;
    S.logsPage = 1;
    return render('logs');
  }
  const el = e.target.closest('[data-set]');
  if (!el) return;
  const kind = el.dataset.kind;
  let v;
  if (kind === 'bool') v = el.checked;
  else if (kind === 'num') v = el.value === '' ? 0 : Number(el.value);
  else if (kind === 'lines') v = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
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

document.addEventListener('click', onViewClick);

async function onViewClick(e) {
  const chipAdd = e.target.closest('[data-chip-add]');
  if (chipAdd) return openPicker(chipAdd.dataset.chipAdd, chipAdd.dataset.chipKind);
  const chipRm = e.target.closest('[data-chip-remove]');
  if (chipRm) {
    const path = chipRm.dataset.chipRemove;
    const id = chipRm.dataset.chipId;
    const list = (Array.isArray(val(path)) ? val(path) : []).filter((x) => x !== id);
    await save(path, list);
    return render(S.page);
  }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const id = btn.dataset.id;
  if (act.startsWith('m-')) return memberAction(btn, id);
  if (act.startsWith('ticket-')) return ticketAction(btn, id);
  if (act.startsWith('k-')) return knowledgeAction(btn);
  if (act.startsWith('econ-') || act === 'shop-add' || act === 'shop-del') return economyAction(btn);
  if (act.startsWith('ann-')) return announcementsAction(btn);
  if (act.startsWith('inv-')) return investigatorAction(btn);
  if (act.startsWith('cc-')) return commandsAction(btn);
  if (act.startsWith('tag-')) return commandsAction(btn);
  if (act.startsWith('alias-')) return aliasesAction(btn);
  if (act.startsWith('sess-')) return sessionsAction(btn);
  if (act.startsWith('lr-')) return levelRewardAction(btn);
  if (act.startsWith('welcome-')) return welcomeAction(btn);
  if (act === 'logs-prev') { S.logsPage = Math.max(1, S.logsPage - 1); return render('logs'); }
  if (act === 'logs-next') { S.logsPage += 1; return render('logs'); }
  if (act === 'logs-refresh') return render('logs');
  if (act === 'rerender') return render(S.page);
}

async function runCommand(command, payload = {}) {
  const r = await api.post(`/api/guilds/${S.guildId}/command`, { command, payload });
  if (r && r.success === false) throw new Error(r.error || 'فشل');
  return r ? r.result : null;
}

// ===== Picker =====
async function openPicker(path, kind) {
  let options = [];
  if (kind === 'bot') options = (await ensureMembers()).filter((m) => m.bot).map((m) => ({ id: m.id, label: `${m.username || m.id} 🤖`, sub: m.id }));
  else if (kind === 'member') options = (await ensureMembers()).map((m) => ({ id: m.id, label: `${m.nickname || m.username || m.id}${m.bot ? ' 🤖' : ''}`, sub: m.id }));
  else if (kind === 'role') options = (await ensureRoles()).map((r) => ({ id: r.id, label: r.name, sub: r.id }));
  else if (kind === 'channel') options = S.channels.filter((c) => c.type === 0 || c.type === 5).map((c) => ({ id: c.id, label: '#' + c.name, sub: c.id }));
  const current = new Set(Array.isArray(val(path)) ? val(path) : []);
  const rows = options
    .filter((o) => !current.has(o.id))
    .map((o) => `<label class="pick-row" data-search="${esc((o.label + ' ' + o.sub).toLowerCase())}"><input type="checkbox" value="${esc(o.id)}"><span class="pick-name">${esc(o.label)}</span><code>${esc(o.sub)}</code></label>`)
    .join('');
  const titles = { bot: 'إضافة بوتات', member: 'إضافة أعضاء', role: 'إضافة رولات', channel: 'إضافة قنوات' };
  openModal({
    title: titles[kind] || 'إضافة عناصر',
    okText: 'إضافة المحدد',
    wide: true,
    body: `<input class="inp mb-sm" id="picker-search" placeholder="🔍 بحث بالاسم أو ID">
      <div class="picker-list">${rows || '<div class="chip-empty">لا توجد عناصر متاحة للإضافة</div>'}</div>
      <div class="manual-row mt-sm"><input class="inp" id="picker-manual" placeholder="أو الصق ID يدوي (مفصول بفواصل)"><button type="button" class="btn" id="picker-manual-add">إضافة</button></div>`,
    onOk: async () => {
      const checked = [...document.querySelectorAll('.picker-list input:checked')].map((i) => i.value);
      const manual = ($('#picker-manual').value || '').split(',').map((s) => s.trim()).filter((s) => /^\d{5,25}$/.test(s));
      const add = [...new Set([...checked, ...manual])].filter((x) => !current.has(x));
      if (!add.length) { toast('اختر عنصراً واحداً على الأقل', 'err'); return false; }
      await save(path, [...current, ...add]);
      toast(`تمت إضافة ${add.length} عنصر ✓`, 'ok');
      render(S.page);
    },
  });
  const s = $('#picker-search');
  if (s) s.addEventListener('input', () => {
    const q = s.value.trim().toLowerCase();
    $$('.picker-list .pick-row').forEach((row) => {
      row.style.display = !q || row.dataset.search.includes(q) ? '' : 'none';
    });
  });
  const mBtn = $('#picker-manual-add');
  if (mBtn) mBtn.addEventListener('click', async () => {
    const t = ($('#picker-manual').value || '').split(',').map((x) => x.trim()).filter((x) => /^\d{5,25}$/.test(x));
    if (!t.length) return toast('ID غير صالح', 'err');
    const add = [...new Set([...current, ...t])].filter((x) => !current.has(x));
    await save(path, [...current, ...add]);
    toast('تمت الإضافة ✓', 'ok');
    closeModal();
    render(S.page);
  });
}

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
    const on = (p) => (val(p) ? '<span class="dot green"></span>' : '<span class="dot red"></span>');
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
        </div>`, '🏰')}
      </div>
      ${card('ملخص الأنظمة', `
        <div class="status-grid">
          <div class="status-item">${on('protection.antiRaid.enabled')} مكافحة الرايد</div>
          <div class="status-item">${on('protection.antiSpam.enabled')} مكافحة السبام</div>
          <div class="status-item">${on('protection.antiNuke.enabled')} مكافحة التخريب</div>
          <div class="status-item">${on('protection.scamFilter.enabled')} فلتر الاحتيال</div>
          <div class="status-item">${on('protection.aiAutoMod.enabled')} رقيب المحتوى AI</div>
          <div class="status-item">${on('protection.aiTranslator.enabled')} المترجم الفوري</div>
          <div class="status-item">${on('aiInvestigator.enabled')} المحقق الأمني</div>
          <div class="status-item">${on('ai.enabled')} الردود الذكية</div>
          <div class="status-item">${on('aiInsights.moodEnabled')} تحليل المزاج</div>
          <div class="status-item">${on('aiInsights.summarizeEnabled')} تلخيص الروابط</div>
          <div class="status-item">${on('welcome.enabled')} الترحيب</div>
          <div class="status-item">${on('logging.enabled')} السجلات</div>
          <div class="status-item">${on('leveling.enabled')} المستويات</div>
          <div class="status-item">${on('economy.enabled')} الاقتصاد</div>
          <div class="status-item">${on('verification.enabled')} التحقق</div>
          <div class="status-item">${on('honeypot.enabled')} المصيدة</div>
        </div>`, '⚡')}
    `;
  },

  // ---------------- Protection ----------------
  async protection() {
    await ensureRoles().catch(() => {});
    const actions = [['delete', 'حذف'], ['warn', 'تحذير'], ['mute', 'كتم'], ['kick', 'طرد'], ['ban', 'حظر'], ['quarantine', 'حجر']];
    const msHint = (v) => (v ? `= ${Math.round(v / 1000)} ث` : '');
    return `
      <div class="banner info">🛡️ كل تعديل هنا يُطبَّق على البوت مباشرة (مزامنة خلال ثوانٍ).</div>
      ${card('قنوات السجلات', `
        ${chSel('protection.logChannel', 'قناة التنبيهات العامة للحماية (افتراضي)')}
        <div class="dim">عند تحديد قناة هنا، ستُرسل معظم تنبيهات الحماية إليها ما لم تحدد قناة أدق لكل وحدة.</div>`, '📜')}
      <div class="grid-2">
        ${card('الرايد والانضمام', `
          ${sw('protection.antiRaid.enabled', 'مكافحة الرايد')}
          <div class="grid-3">
            ${num('protection.antiRaid.threshold', 'عدد الداخلين')}
            ${num('protection.antiRaid.timeWindow', 'النافذة (مللي ثانية)')}
            ${sel('protection.antiRaid.action', 'الإجراء', actions)}
          </div>
          <div class="sec-title">👹 الوضع الوحشي</div>
          ${sw('protection.antiRaid.beastMode.enabled', 'تشديد تلقائي أثناء الهجوم')}
          <div class="grid-3">
            ${num('protection.antiRaid.beastMode.minAccountAgeDays', 'أقل عمر حساب (أيام)')}
            ${sw('protection.antiRaid.beastMode.requireAvatar', 'اشتراط صورة شخصية')}
            ${sel('protection.antiRaid.beastMode.suspiciousJoinAction', 'إجراء الحساب المشبوه', [['kick', 'طرد'], ['ban', 'حظر'], ['none', 'بدون']])}
          </div>
          ${sw('protection.antiRaid.beastMode.escalateVerification', 'رفع مستوى التحقق تلقائياً')}
          ${num('protection.antiRaid.beastMode.autoRecoverMinutes', 'مدة التعافي (دقائق)')}
          ${chSel('protection.antiRaid.logChannel', 'قناة سجل الرايد')}
          <div class="sec-title">🚫 السبام</div>
          ${sw('protection.antiSpam.enabled', 'مكافحة السبام')}
          <div class="grid-3">
            ${num('protection.antiSpam.maxMessages', 'أقصى رسائل')}
            ${num('protection.antiSpam.timeWindow', 'النافذة (مللي)')}
            ${sel('protection.antiSpam.action', 'الإجراء', actions)}
          </div>
          <div class="grid-2">${num('protection.antiSpam.muteDuration', 'مدة الكتم (مللي)')} ${chSel('protection.antiSpam.logChannel', 'قناة سجل السبام')}</div> ${msHint(val('protection.antiSpam.muteDuration'))}`, '🚪')}
        ${card('الروابط والدعوات', `
          ${sw('protection.antiLink.enabled', 'حظر الروابط')}
          ${sel('protection.antiLink.action', 'الإجراء', actions)}
          ${arrLines('protection.antiLink.whitelist', 'روابط مسموحة (سطر لكل رابط)')}
          ${chipList('protection.antiLink.ignoreRoles', 'رولات مستثناة', 'role')}
          ${chSel('protection.antiLink.logChannel', 'قناة سجل الروابط')}
          <div class="sec-title">📨 دعوات السيرفرات</div>
          ${sw('protection.antiInvite.enabled', 'حظر الدعوات')}
          ${chipList('protection.antiInvite.ignoreRoles', 'رولات مستثناة', 'role')}
          ${chSel('protection.antiInvite.logChannel', 'قناة سجل الدعوات')}`, '🔗')}
        ${card('المنشن والتنسيق', `
          ${sw('protection.antiMention.enabled', 'حظر المنشن الجماعي')}
          <div class="grid-2">${num('protection.antiMention.max', 'أقصى عدد منشن')}${sel('protection.antiMention.action', 'الإجراء', actions)}</div>
          ${chSel('protection.antiMention.logChannel', 'قناة سجل المنشن')}
          <div class="sec-title">🔠 الحروف الكبيرة</div>
          ${sw('protection.antiCaps.enabled', 'حظر الرسائل CAPS')}
          <div class="grid-3">${num('protection.antiCaps.percentage', 'النسبة %')}${num('protection.antiCaps.minLength', 'أقل طول')}${sel('protection.antiCaps.action', 'الإجراء', actions)}</div>
          ${chSel('protection.antiCaps.logChannel', 'قناة سجل CAPS')}
          <div class="sec-title">😄 الإيموجي</div>
          ${sw('protection.antiEmoji.enabled', 'حظر الإفراط')}
          <div class="grid-2">${num('protection.antiEmoji.max', 'الحد الأقصى')}${sel('protection.antiEmoji.action', 'الإجراء', actions)}</div>
          ${chSel('protection.antiEmoji.logChannel', 'قناة سجل الإيموجي')}`, '📣')}
        ${card('مكافحة التخريب (Anti-Nuke)', `
          ${sw('protection.antiNuke.enabled', 'حماية anti-nuke')}
          <div class="grid-3">
            ${sel('protection.antiNuke.mode', 'النمط', [['prevent', 'منع فوري'], ['react', 'ردّ فعل']])}
            ${sel('protection.antiNuke.action', 'الإجراء', actions)}
            ${num('protection.antiNuke.threshold', 'حد العمليات')}
          </div>
          <div class="grid-2">${num('protection.antiNuke.timeWindow', 'النافذة الزمنية')}${chSel('protection.antiNuke.logChannel', 'قناة سجل التخريب')}</div>
          ${sw('protection.antiNuke.slowNukeGuard', 'الرصد البطيء')}
          <div class="grid-2">${num('protection.antiNuke.slowNukeMax', 'أقصى عمليات بطيئة')}${num('protection.antiNuke.slowNukeWindowMinutes', 'النافذة (دقائق)')}</div>
          ${sw('protection.antiNuke.autoRestore', 'استعادة القنوات والرولات')}
          ${sw('protection.antiNuke.autoDmRecovery', 'تنبيه المالك بالخاص')}
          ${chipList('protection.antiNuke.whitelistedChannels', 'قنوات مستثناة', 'channel')}
          ${chipList('protection.antiNuke.whitelistedRoles', 'رولات مستثناة', 'role')}`, '💣')}
        ${card('الحسابات والبوتات', `
          ${sw('protection.antiAlt.enabled', 'كشف الحسابات الوهمية')}
          <div class="grid-3">${num('protection.antiAlt.checkCreationDays', 'أقل عمر (أيام)')}${num('protection.antiAlt.maxAccountsPerIP', 'أقصى حسابات/IP')}${sel('protection.antiAlt.action', 'الإجراء', actions)}</div>
          <div class="grid-2">${roleSel('protection.antiAlt.quarantineRoleId', 'رول الحجر')}${chSel('protection.antiAlt.logChannel', 'قناة سجل الحسابات المشبوهة')}</div>
          <div class="sec-title">🤖 البوتات — القائمة البيضاء</div>
          ${sw('protection.antiBot.enabled', 'منع دخول البوتات غير المصرح لها')}
          ${chipList('protection.antiBot.whitelist', 'بوتات مسموحة', 'bot', 'استخدم زر الإضافة لاختيار أكثر من بوت دفعة واحدة')}
          ${chSel('protection.antiBot.logChannel', 'قناة سجل البوتات')}
          <div class="sec-title">👑 الصلاحيات الخطيرة</div>
          ${sw('protection.antiAdmin.enabled', 'رصد منح Administrator')}
          ${sel('protection.antiAdmin.action', 'الإجراء', actions)}
          ${chSel('protection.antiAdmin.logChannel', 'قناة سجل الصلاحيات')}
          <div class="sec-title">🤖 مكافحة الإساءة للبوت</div>
          ${sw('protection.antiBotAbuse.enabled', 'تحذير ثم سحب الرولات القابلة للإزالة ثم الحظر')}`, '🤖')}
        ${card('الفلاتر والصيانة', `
          ${sw('protection.scamFilter.enabled', 'فلتر الاحتيال والنصب')}
          ${sw('protection.messageScanner.enabled', 'ماسح المرفقات والروابط')}
          ${sel('protection.messageScanner.action', 'إجراء الماسح', [['delete', 'حذف'], ['warn', 'تحذير'], ['mute', 'كتم'], ['ban', 'حظر']])}
          ${sw('protection.messageScanner.scanLinks', 'فحص الروابط')}
          ${sw('protection.messageScanner.scanAttachments', 'فحص المرفقات')}
          ${arrLines('protection.messageScanner.whitelistDomains', 'نطاقات مسموحة')}
          ${txt('protection.messageScanner.virusTotalApiKey', 'مفتاح VirusTotal (اختياري)')}
          ${chSel('protection.messageScanner.logChannel', 'قناة سجل الماسح')}
          ${sw('protection.punishmentTracker.enabled', 'تتبع العقوبات المتكررة')}
          <div class="sec-title">💾 النسخ الاحتياطي والفحص</div>
          ${sw('protection.autoBackup.enabled', 'نسخ احتياطي تلقائي')}
          <div class="grid-2">${num('protection.autoBackup.interval', 'كل كم ساعة')}${num('protection.autoBackup.keep', 'عدد النسخ')}</div>
          ${sw('protection.autoScan.enabled', 'فحص أمني دوري')}
          ${num('protection.autoScan.interval', 'كل كم ساعة')}`, '🧹')}
        ${card('الدعوات والقوائم', `
          ${sw('protection.inviteTracker.enabled', 'متتبع الدعوات')}
          <div class="grid-3">${num('protection.inviteTracker.rewardInvites', 'مكافأة الدعوات')}${num('protection.inviteTracker.minInviteAgeHours', 'أقل عمر (ساعات)')}${num('protection.inviteTracker.maxUsesPerInvite', 'أقصى استخدامات')}</div>
          <div class="grid-2">${sw('protection.inviteTracker.trackJoins', 'تتبع الدخول')}${sw('protection.inviteTracker.trackLeaves', 'تتبع الخروج')}</div>
          ${sel('protection.inviteTracker.suspiciousInviteAction', 'إجراء الدعوة المشبوهة', [['warn', 'تحذير'], ['kick', 'طرد'], ['ban', 'حظر'], ['none', 'بدون']])}
          ${chSel('protection.inviteTracker.logChannel', 'قناة سجل الدعوات والدعوات المشبوهة')}
          ${roleSel('protection.inviteTracker.rewardRoleId', 'رول مكافأة الدعوات')}
          <div class="sec-title">⚪ القائمة البيضاء العامة</div>
          ${sw('protection.whitelist.enabled', 'تفعيل القائمة البيضاء')}
          ${chipList('protection.whitelist.userIds', 'أعضاء/بوتات مستثنون', 'member')}
          ${chSel('protection.whitelist.logChannel', 'قناة سجل القائمة البيضاء')}
          <div class="sec-title">👑 موافقة المالك</div>
          ${sw('protection.ownerApproval', 'طلب موافقة المالك قبل إطفاء أي حماية', 'عند التعطيل يطلب البوت تأكيداً إضافياً')}
          <div class="status-item">${val('protection.lockdown') ? '🔴 وضع الطوارئ مفعّل حالياً' : '🟢 لا يوجد وضع طوارئ'} <em class="dim">(يُدار من زر الطوارئ في ديسكورد)</em></div>`, '🎟️')}
        ${card('إشراف تلقائي — كلمات وحروف زالغو', `
          ${sw('automod.enabled', 'تفعيل الإشراف التقليدي')}
          ${arrLines('automod.badWords', 'كلمات ممنوعة (سطر لكل كلمة)')}
          <div class="grid-2">${sel('automod.badWordsAction', 'إجراء الكلمات المحظورة', [['delete', 'حذف'], ['warn', 'تحذير'], ['mute', 'كتم'], ['kick', 'طرد'], ['ban', 'حظر']])}${num('automod.badWordsDuration', 'مدة الكتم (مللي)')}</div>
          <div class="sec-title">ᐤ نصوص زالغو</div>
          ${sw('automod.zalgoEnabled', 'حظر نصوص زالغو')}
          ${sel('automod.zalgoAction', 'إجراء زالغو', [['delete', 'حذف'], ['warn', 'تحذير'], ['mute', 'كتم']])}
          ${chipList('automod.ignoredRoles', 'رولات مستثناة', 'role')}
          ${chipList('automod.ignoredChannels', 'قنوات مستثناة', 'channel')}`, '✍️')}
      </div>`;
  },

  // ---------------- AI ----------------
  async ai() {
    await ensureRoles().catch(() => {});
    const catAr = { spam: 'سبام', toxicity: 'إساءة', nsfw: 'إباحي', scam: 'احتيال', threat: 'تهديد', pii: 'بيانات شخصية', raid: 'رايد لغوي', selfharm: 'إيذاء ذات' };
    const acts = [['delete', 'حذف'], ['warn', 'تحذير'], ['mute', 'كتم'], ['ban', 'حظر'], ['resources', 'موارد']];
    return `
      <div class="grid-2">
        ${card('الردود الذكية', `
          ${sw('ai.enabled', 'تفعيل الردود')}
          <div class="grid-2">
            ${sel('ai.provider', 'المزوّد', [['openai', 'OpenAI'], ['anthropic', 'Anthropic'], ['both', 'الاثنان'], ['auto', 'تلقائي']])}
            ${sel('ai.responseLanguage', 'لغة الرد', [['ar', 'العربية'], ['en', 'English'], ['auto', 'تلقائي']])}
          </div>
          <div class="grid-3">
            ${txt('ai.model', 'الموديل')}
            ${num('ai.temperature', 'الإبداع (0-2)', { step: 0.1 })}
            ${num('ai.maxTokens', 'أقصى توكنز')}
            ${num('ai.cooldown', 'الانتظار (ثواني)')}
          </div>
          ${area('ai.systemPrompt', 'الشخصية العامة (System Prompt)')}
          ${chipList('ai.allowedChannels', 'قنوات مسموحة', 'channel')}
          ${chipList('ai.ignoredChannels', 'قنوات مستثناة', 'channel')}
          ${chipList('ai.allowedRoles', 'رولات مسموحة', 'role')}
          ${chipList('ai.ignoredRoles', 'رولات مستثناة', 'role')}`, '💬')}
        ${card('أدوات ذكية إضافية', `
          <div class="banner info">تعمل عبر أوامر ديسكورد: <code>/mood</code> و <code>/summarize</code>.</div>
          ${sw('aiInsights.moodEnabled', '📊 تحليل مزاج القنوات', 'تحليل آخر 20-100 رسالة + AI')}
          ${sw('aiInsights.summarizeEnabled', '🔗 تلخيص الروابط والفيديو', 'قراءة الصفحات وتلخيص يوتيوب')}`, '✨')}
        ${card('المترجم الفوري', `
          ${sw('protection.aiTranslator.enabled', 'تفعيل الترجمة التلقائية')}
          <div class="grid-2">
            ${sel('protection.aiTranslator.defaultTargetLang', 'اللغة الافتراضية', [['ar', 'العربية'], ['en', 'الإنجليزية'], ['fr', 'الفرنسية'], ['es', 'الإسبانية'], ['de', 'الألمانية'], ['tr', 'التركية']])}
            ${num('protection.aiTranslator.maxLength', 'أقصى طول نص')}
          </div>
          ${sw('protection.aiTranslator.showOriginal', 'إظهار النص الأصلي')}
          ${chipList('protection.aiTranslator.autoTranslateChannels', 'قنوات ترجمة تلقائية', 'channel')}
          ${chipList('protection.aiTranslator.ignoredChannels', 'قنوات مستثناة', 'channel')}
          ${chipList('protection.aiTranslator.ignoredRoles', 'رولات مستثناة', 'role')}
          ${chSel('protection.aiTranslator.logChannel', 'قناة سجل الترجمة')}`, '🌐')}
        ${card('رقيب المحتوى AI', `
          ${sw('protection.aiAutoMod.enabled', 'تفعيل الرقيب')}
          <div class="grid-2">
            ${num('protection.aiAutoMod.sensitivity', 'الحساسية (1-10)', { min: 1, max: 10 })}
            ${num('protection.aiAutoMod.muteDuration', 'مدة الكتم (دقائق)')}
          </div>
          ${sw('protection.aiAutoMod.escalation', 'تصعيد المخالفات المتكررة')}
          ${num('protection.aiAutoMod.maxWarningsBeforeEscalation', 'عدد التحذيرات قبل التصعيد')}
          ${chipList('protection.aiAutoMod.ignoredChannels', 'قنوات مستثناة', 'channel')}
          ${chipList('protection.aiAutoMod.ignoredRoles', 'رولات مستثناة', 'role')}
          ${chSel('protection.aiAutoMod.logChannel', 'قناة سجل الرقيب')}
          <div class="sec-title">التصنيفات والإجراءات</div>
          ${Object.entries(catAr).map(([c, ar]) => `
            <div class="cat-row">
              <div class="cat-toggle">${sw('protection.aiAutoMod.categories.' + c, ar)}</div>
              <div class="cat-action">${sel('protection.aiAutoMod.actions.' + c, 'الإجراء', acts)}</div>
            </div>`).join('')}`, '🧠')}
        ${card('مساعد التذاكر AI', `
          ${sw('protection.aiTicketAssistant.enabled', 'تفعيل المساعد')}
          ${sw('protection.aiTicketAssistant.autoClaim', 'استلام تلقائي')}
          ${sw('protection.aiTicketAssistant.replyToMessages', 'الرد على الرسائل')}
          ${sw('protection.aiTicketAssistant.analyzeOnCreate', 'تحليل عند الإنشاء')}
          ${sw('protection.aiTicketAssistant.learnFromTickets', 'التعلم من التذاكر')}
          ${num('protection.aiTicketAssistant.confidenceThreshold', 'حد الثقة %')}
          ${num('protection.aiTicketAssistant.maxAutoActionsPerTicket', 'أقصى إجراءات تلقائية/تذكرة')}
          ${sw('protection.aiTicketAssistant.requireAdminApprovalForBans', 'موافقة قبل الحظر')}
          ${sw('protection.aiTicketAssistant.requireAdminApprovalForRoles', 'موافقة قبل الرولات')}
          ${sw('protection.aiTicketAssistant.requireAdminApprovalForPermissions', 'موافقة قبل الصلاحيات')}
          ${sw('protection.aiTicketAssistant.notifyAdminsOnFailure', 'تنبيه الإدارة عند الفشل')}
          ${area('protection.aiTicketAssistant.customPersonality', 'شخصية خاصة بالتذاكر')}`, '🎫')}
      </div>`;
  },

  // ---------------- Investigator ----------------
  async investigator() {
    const data = await api.get(`/api/guilds/${S.guildId}/investigator`).catch(() => ({ run: null, findings: [] }));
    const run = data.run;
    const findings = data.findings || [];
    const sevMeta = { critical: ['🚨', 'critical'], high: ['🔴', 'high'], medium: ['🟠', 'medium'], low: ['🟡', 'low'], info: ['🔵', 'info'] };
    const runCard = run
      ? `<div class="kv mb">
          <b>آخر فحص</b><span>${fmtDate(run.startedAt)} (${esc(run.trigger || '')})</span>
          <b>الخطورة</b><span class="sev sev-${esc(run.riskLevel)}">${esc(run.riskLevel)} — ${fmtNum(run.riskScore)}/100</span>
          <b>النتائج</b><span>${fmtNum(run.findingsCount)} (حرج: ${fmtNum(run.criticalCount)} • عالي: ${fmtNum(run.highCount)})</span>
          <b>الموديل</b><span>${esc(run.aiModel || 'محلي')} ${run.aiUsed ? '· AI ✔' : ''}</span>
        </div>
        <p class="dim">${esc(run.summary || '')}</p>`
      : '<div class="chip-empty">لا يوجد فحص سابق</div>';
    const findingRows = findings
      .map((f) => {
        const [icon, cls] = sevMeta[f.severity] || ['🔵', 'info'];
        return `<div class="finding">
          <div class="finding-head"><span class="sev sev-${cls}">${icon} ${esc(f.severity)}</span><b>${esc(f.title)}</b>
            <span class="chip ${f.status === 'open' ? 'red' : ''}">${esc(f.status)}</span></div>
          <div class="dim">${esc((f.description || '').slice(0, 300))}</div>
          <div class="finding-foot">
            ${f.subjectName ? `<span>👤 ${esc(f.subjectName)}</span>` : ''}
            <span>📦 ${fmtNum(f.occurrences)} مرة</span>
            <span>🕒 ${fmtDate(f.lastSeenAt)}</span>
            ${f.recommendation ? `<span title="${esc(f.recommendation)}">💡 ${esc(f.recommendation.slice(0, 90))}</span>` : ''}
          </div></div>`;
      })
      .join('');
    return `
      <div class="grid-2">
        ${card('حالة المحقق', `${runCard}
          <div class="btn-row">
            <button class="btn primary" data-act="inv-run">🔍 فحص شامل الآن</button>
            <button class="btn" data-act="inv-run-deep">🧠 فحص عميق بالذكاء الاصطناعي</button>
          </div>`, '🕵️')}
        ${card('إعدادات المحقق', `
          ${sw('aiInvestigator.enabled', 'تفعيل المحقق')}
          ${sw('aiInvestigator.automatic', 'فحص تلقائي دوري')}
          ${sw('aiInvestigator.scanOnStartup', 'فحص عند بدء التشغيل')}
          <div class="grid-2">
            ${num('aiInvestigator.intervalHours', 'كل كم ساعة (1-168)', { min: 1, max: 168 })}
            ${sel('aiInvestigator.minSeverityToAlert', 'أدنى خطورة للتنبيه', [['info', 'معلوماتي'], ['low', 'منخفض'], ['medium', 'متوسط'], ['high', 'عالي'], ['critical', 'حرج']])}
          </div>
          ${chSel('aiInvestigator.alertChannelId', 'قناة التنبيهات')}
          ${sw('aiInvestigator.includeMessages', 'تحليل الرسائل')}
          <div class="grid-3">
            ${num('aiInvestigator.messageLookbackHours', 'مدى الرجوع (ساعات)')}
            ${num('aiInvestigator.maxMessagesPerChannel', 'أقصى رسائل/قناة')}
            ${num('aiInvestigator.maxFindings', 'أقصى نتائج')}
          </div>
          ${num('aiInvestigator.autoResolveDays', 'حل تلقائي بعد (أيام)')}
          ${chipList('aiInvestigator.ignoredChannelIds', 'قنوات مستثناة', 'channel')}`, '⚙️')}
      </div>
      ${card(`أحدث النتائج (${fmtNum(findings.length)})`, findingRows || '<div class="empty">لا توجد نتائج — السيرفر نظيف 🎉</div>', '📋')}`;
  },

  // ---------------- Verification ----------------
  async verification() {
    await ensureRoles().catch(() => {});
    return `
      <div class="grid-2">
        ${card('نظام التحقق', `
          ${sw('verification.enabled', 'تفعيل التحقق')}
          ${chSel('verification.channelId', 'قناة التوثيق')}
          ${roleSel('verification.roleId', 'رول العضو الموثق')}
          ${txt('verification.title', 'العنوان')}
          ${area('verification.description', 'الوصف')}
          <div class="grid-2">
            ${txt('verification.buttonLabel', 'نص الزر')}
            ${txt('verification.buttonEmoji', 'إيموجي الزر')}
          </div>
          ${sw('verification.captchaEnabled', 'كابتشا إضافية')}
          ${num('verification.minAccountAgeDays', 'أقل عمر حساب (أيام)')}
          ${sw('verification.kickOnFail', 'طرد عند الفشل المتكرر')}
          ${roleSel('verification.quarantineRoleId', 'رول الحجر')}
          ${chSel('verification.logChannelId', 'قناة سجل التوثيق')}`, '✅')}
        ${card('الحجر التلقائي للحسابات الجديدة', `
          ${sw('verification.autoQuarantine', 'تفعيل الحجر التلقائي')}
          ${sw('verification.autoQuarantineNewAccounts', 'حجر كل الحسابات الجديدة تلقائياً')}
          ${num('verification.autoQuarantineMaxAccountAgeDays', 'أقصى عمر حساب للحجر (أيام)')}
          <div class="banner info">الحسابات المحجورة تُمنع من الكتابة حتى تُوثّق نفسها بالزر.</div>`, '🧊')}
      </div>`;
  },

  // ---------------- Honeypot ----------------
  async honeypot() {
    await ensureRoles().catch(() => {});
    return `
      <div class="grid-2">
        ${card('المصيدة (Honeypot)', `
          ${sw('honeypot.enabled', 'تفعيل المصيدة')}
          ${chSel('honeypot.channelId', 'قناة المصيدة')}
          ${sel('honeypot.action', 'الإجراء عند دخول المصيدة', [['ban', 'حظر'], ['kick', 'طرد'], ['mute', 'كتم'], ['timeout', 'توقيت'], ['warn', 'تحذير']])}
          ${num('honeypot.timeoutMinutes', 'مدة التوقيت (دقائق)')}
          ${sw('honeypot.deleteMessage', 'حذف الرسالة فوراً')}
          ${sw('honeypot.ignoreAdmins', 'تجاهل الإداريين')}
          ${chSel('honeypot.logChannelId', 'قناة سجل المصيدة')}`, '🍯')}
        ${card('التنبيهات', `
          ${chipList('honeypot.alertRoleIds', 'رولات يتم تنبيهها', 'role')}
          <div class="banner info">💡 المصيدة قناة فخ — أي عضو يكتب فيها يُعتبر مخترقاً ويُنفَّذ الإجراء فوراً.</div>`, '🔔')}
      </div>`;
  },

  // ---------------- Tickets ----------------
  async tickets() {
    await ensureRoles().catch(() => {});
    const data = await api.get(`/api/guilds/${S.guildId}/tickets`).catch(() => []);
    const list = Array.isArray(data) ? data : data.tickets || [];
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
        ${chipList('tickets.supportRoleIds', 'رولات الدعم', 'role')}
        ${chipList('tickets.adminRoleIds', 'رولات الإدارة العليا', 'role')}`, '⚙️')}
      ${card('أحدث التذاكر', rows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>النوع</th><th>المعرف</th><th>الحالة</th><th>المستلم</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">لا توجد تذاكر بعد</div>', '🎫')}`;
  },

  // ---------------- Members ----------------
  async members() {
    const data = await api.get(`/api/guilds/${S.guildId}/members`).catch((e) => ({ list: [], error: e.message }));
    const list = Array.isArray(data) ? data : data.list || [];
    cache.members = list;
    await ensureRoles().catch(() => {});
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
                <button class="btn sm" data-act="m-role-add" data-id="${m.id}">＋رول</button>
                ${(m.roles || []).length ? `<button class="btn sm" data-act="m-role-del" data-id="${m.id}">－رول</button>` : ''}
                <button class="btn sm" data-act="m-history" data-id="${m.id}">سجل</button>
                <button class="btn sm danger" data-act="m-kick" data-id="${m.id}">طرد</button>
                <button class="btn sm danger" data-act="m-ban" data-id="${m.id}">حظر</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div>
        ${!list.length ? '<div class="empty">لا توجد بيانات — حدّث الصفحة.</div>' : ''}
      </div></div>`;
  },

  // ---------------- Economy ----------------
  async economy() {
    await ensureRoles().catch(() => {});
    const list = await api.get(`/api/guilds/${S.guildId}/economy`).catch(() => []);
    S.economy = Array.isArray(list) ? list : [];
    const items = val('shop.items') || [];
    const shopRows = items
      .map((it, i) => `<div class="list-row"><span class="grow">🛒 ${esc(it.name || 'عنصر')} <span class="dim">— ${fmtNum(it.price)} ${esc(val('economy.currencySymbol') || '💰')}${it.roleId ? ' · رول: ' + esc(resolveName(it.roleId, 'role')) : ''}</span></span><button class="btn sm danger" data-act="shop-del" data-idx="${i}">حذف</button></div>`)
      .join('');
    return `
      <div class="grid-2">
        ${card('إعداد الاقتصاد', `
          ${sw('economy.enabled', 'تفعيل الاقتصاد')}
          <div class="grid-2">${txt('economy.currency', 'اسم العملة')}${txt('economy.currencySymbol', 'الرمز')}</div>
          <div class="grid-3">${num('economy.dailyAmount', 'اليومية')}${num('economy.weeklyAmount', 'الأسبوعية')}${num('economy.monthlyAmount', 'الشهرية')}</div>
          <div class="sec-title">💼 الدخل</div>
          <div class="grid-2">${num('economy.workAmount.min', 'أقل راتب work')}${num('economy.workAmount.max', 'أعلى راتب work')}</div>
          <div class="grid-2">${num('economy.begAmount.min', 'أقل تسول')}${num('economy.begAmount.max', 'أعلى تسول')}</div>
          <div class="sec-title">🏦 البنك والتحويل</div>
          ${sw('economy.bankEnabled', 'نظام البنك')}
          <div class="grid-2">${num('economy.bankInterestRate', 'فائدة يومية %', { step: 0.1 })}${num('economy.bankMaxDeposit', 'أقصى إيداع')}</div>
          ${sw('economy.transferEnabled', 'التحويل بين الأعضاء')}
          <div class="grid-2">${num('economy.transferTax', 'ضريبة التحويل %')}${num('economy.transferCooldown', 'كولداون التحويل (مللي)')}</div>
          <div class="sec-title">🎰 الألعاب والسرقة</div>
          ${sw('economy.robEnabled', 'السرقة')}
          ${num('economy.robCooldown', 'كولداون السرقة (مللي)')}
          <div class="grid-2">${sw('economy.coinflipEnabled', 'قلب العملة')}${sw('economy.diceEnabled', 'النرد')}${sw('economy.blackjackEnabled', 'بلاك جاك')}${sw('economy.slotsEnabled', 'سلوتس')}</div>
          <div class="sec-title">🎙️ مكافآت الصوت والمتفرقات</div>
          ${sw('economy.voiceRewardsEnabled', 'مكافآت التواجد الصوتي')}
          <div class="grid-2">${num('economy.voiceRewardPerMinute', 'مكافأة/دقيقة')}${num('economy.voiceRewardInterval', 'الفاصل (مللي)')}</div>
          ${sw('economy.leaderboardEnabled', 'لوحة المتصدرين')}
          ${sw('economy.inventoryEnabled', 'الحقيبة')}`, '💰')}
        ${card('المتجر', `
          ${sw('shop.enabled', 'تفعيل المتجر')}
          <div class="stack">${shopRows || '<div class="chip-empty">لا عناصر بعد</div>'}</div>
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
    return `
      <div class="grid-2">
        ${card('رسالة الترحيب', `
          ${sw('welcome.enabled', 'تفعيل الترحيب')}
          ${area('welcome.message', 'نص الترحيب', '{user} {server} {count}')}
          ${txt('welcome.embedTitle', 'عنوان البطاقة')}
          ${txt('welcome.embedColor', 'لون البطاقة (#hex)')}
          ${sw('welcome.imageEnabled', 'بطاقة الصورة الديناميكية')}
          ${sw('welcome.dmEnabled', 'ترحيب بالخاص')}
          ${area('welcome.dmMessage', 'نص رسالة الخاص')}
          <div class="btn-row mt">
            <select class="inp" id="welcome-test-channel" style="max-width:240px">${S.channels.filter((c) => c.type === 0).map((c) => `<option value="${c.id}">#${esc(c.name)}</option>`).join('')}</select>
            <button class="btn" data-act="welcome-test">🧪 إرسال تجربة</button>
          </div>`, '👋')}
        ${card('بطاقة الترحيب (الإحداثيات والألوان)', `
          ${sw('welcome.card.enabled', 'تفعيل البطاقة')}
          <div class="grid-3">
            ${num('welcome.card.avatarX', 'الأفتار X')}${num('welcome.card.avatarY', 'الأفتار Y')}${num('welcome.card.avatarSize', 'حجم الأفتار')}
          </div>
          <div class="grid-3">
            ${num('welcome.card.nameX', 'الاسم X')}${num('welcome.card.nameY', 'الاسم Y')}${num('welcome.card.nameSize', 'حجم الاسم')}
            ${txt('welcome.card.nameColor', 'لون الاسم')}
          </div>
          <div class="grid-3">
            ${num('welcome.card.countX', 'العدد X')}${num('welcome.card.countY', 'العدد Y')}${num('welcome.card.countSize', 'حجم العدد')}
            ${txt('welcome.card.countColor', 'لون العدد')}
          </div>`, '🎨')}
        ${card('رسالة الوداع', `
          ${sw('leave.enabled', 'تفعيل الوداع')}
          ${area('leave.message', 'نص الوداع', '{user} {server} {count}')}
          ${txt('leave.embedColor', 'لون البطاقة (#hex)')}`, '😢')}
      </div>`;
  },

  // ---------------- Levels ----------------
  async levels() {
    await ensureRoles().catch(() => {});
    const rewards = val('leveling.levelRewards') || [];
    const rows = rewards
      .map((r, i) => `<div class="list-row"><span class="badge">LV ${esc(r.level)}</span><span class="grow">${esc(resolveName(r.roleId, 'role'))}</span><button class="btn sm danger" data-act="lr-del" data-idx="${i}">حذف</button></div>`)
      .join('');
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
          ${chipList('leveling.ignoredChannels', 'قنوات مستثناة', 'channel')}
          ${chipList('leveling.ignoredRoles', 'رولات مستثناة', 'role')}`, '📈')}
        ${card('رسالة الترقية', `
          ${sel('leveling.levelUpStyle', 'النمط', [['embed', 'بطاقة Embed'], ['text', 'نص عادي']])}
          ${txt('leveling.levelUpTitle', 'العنوان')}
          ${area('leveling.levelUpMessage', 'النص', '{user} {level}')}
          ${txt('leveling.levelUpColor', 'اللون (#hex)')}`, '🎉')}
        ${card('مكافآت المستويات', `
          <div class="stack">${rows || '<div class="chip-empty">لا مكافآت بعد</div>'}</div>
          <button class="btn primary mt" data-act="lr-add">➕ إضافة مكافأة</button>
          <div class="banner info mt">عند وصول العضو للمستوى المحدد يُعطى الرول تلقائياً.</div>`, '🎁')}
      </div>`;
  },

  // ---------------- Giveaways ----------------
  async giveaways() {
    await ensureRoles().catch(() => {});
    const data = await api.get(`/api/guilds/${S.guildId}/giveaways`).catch(() => ({ active: [], recent: [] }));
    const activeRows = (data.active || [])
      .map((g) => `<tr><td>🎁 ${esc(g.prize)}</td><td><code>${esc(g.shortId || '')}</code></td><td>${fmtDate(g.endsAt)}</td><td>${fmtNum((g.entries || []).length)}</td><td>${fmtNum(g.winnersCount)}</td></tr>`)
      .join('');
    const recentRows = (data.recent || [])
      .map((g) => `<tr><td>${esc(g.prize)}</td><td>${fmtDate(g.endedAt)}</td><td>${(g.winnerIds || []).map((w) => `<@${esc(w)}>`).join(', ') || '—'}</td></tr>`)
      .join('');
    return `
      <div class="grid-2">
        ${card('الإعدادات الافتراضية', `
          ${sw('giveaways.enabled', 'تفعيل السحوبات')}
          <div class="grid-3">
            ${num('giveaways.defaultDurationMinutes', 'المدة (دقائق)')}
            ${num('giveaways.defaultWinners', 'عدد الفائزين')}
            ${num('giveaways.defaultMinLevel', 'أقل مستوى')}
          </div>
          <div class="grid-2">${num('giveaways.defaultMinAccountAgeDays', 'أقل عمر حساب (أيام)')}${num('giveaways.defaultMinInvites', 'أقل دعوات')}</div>
          ${chipList('giveaways.defaultRoleIds', 'رولات مطلوبة للمشاركة', 'role')}
          <div class="grid-2">${sw('giveaways.dmWinners', 'إبلاغ الفائزين بالخاص')}${sw('giveaways.pingWinners', 'منشن الفائزين')}</div>`, '⚙️')}
        ${card('سحوبات نشطة', activeRows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الجائزة</th><th>المعرف</th><th>ينتهي</th><th>مشاركات</th><th>فائزون</th></tr></thead><tbody>${activeRows}</tbody></table></div>` : '<div class="empty">لا سحوبات نشطة — أنشئ سحباً بأمر /giveaway</div>', '🎁')}
      </div>
      ${card('سحوبات منتهية حديثاً', recentRows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>الجائزة</th><th>انتهى</th><th>الفائزون</th></tr></thead><tbody>${recentRows}</tbody></table></div>` : '<div class="empty">لا يوجد</div>', '📜')}`;
  },

  // ---------------- Announcements ----------------
  async announcements() {
    const history = (val('protection.announcements.history') || []).slice(-20).reverse();
    const histRows = history
      .map((h) => `<tr><td>${h.type === 'dm' ? '✉️ خاص' : '📢 قنوات'}</td><td>${esc((h.content || '').slice(0, 80))}</td><td>${esc(h.sentBy || '')}</td><td>${fmtDate(h.at)}</td></tr>`)
      .join('');
    return `
      <div class="grid-2">
        ${card('إرسال إعلان', `
          <div class="radio-row">
            <label class="radio"><input type="radio" name="ann-type" value="channel" checked><span>📢 قناة</span></label>
            <label class="radio"><input type="radio" name="ann-type" value="dm"><span>✉️ خاص للجميع</span></label>
          </div>
          <div id="ann-channel-holder">
            <div class="field"><label>القناة (اتركها بدون لبث في كل القنوات العامة)</label>
              <select class="inp" id="ann-channel">
                <option value="">— كل القنوات العامة —</option>
                ${S.channels.filter((c) => c.type === 0 || c.type === 5).map((c) => `<option value="${c.id}">#${esc(c.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <textarea class="inp" id="ann-content" placeholder="نص الإعلان…" style="min-height:120px"></textarea>
          <button class="btn primary mt" data-act="ann-send">🚀 إرسال الآن</button>
          <div class="banner info mt">✉️ الإرسال للخاص يرسل لكل الأعضاء — استخدمه بحكمة.</div>`, '📢')}
        ${card('آخر الإعلانات', histRows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>النوع</th><th>النص</th><th>بواسطة</th><th>التاريخ</th></tr></thead><tbody>${histRows}</tbody></table></div>` : '<div class="empty">لا إعلانات سابقة</div>', '🕘')}
      </div>`;
  },

  // ---------------- Custom commands & tags ----------------
  async commands() {
    const ccs = val('customCommands') || [];
    const tags = val('tags') || [];
    const ccRows = ccs
      .map((c, i) => `<div class="list-row"><span class="grow"><code>${esc(c.name)}</code> ${c.embed ? '<span class="chip cyan">embed</span>' : ''} ${c.scope === 'admin' ? '<span class="chip red">إدارة</span>' : '<span class="chip green">عام</span>'} <span class="dim">${esc((c.content || '').slice(0, 60))}</span></span><button class="btn sm danger" data-act="cc-del" data-idx="${i}">حذف</button></div>`)
      .join('');
    const tagRows = tags
      .map((t, i) => `<div class="list-row"><span class="grow"><code>${esc(t.name)}</code> <span class="dim">${esc((t.content || '').slice(0, 70))}</span></span><button class="btn sm danger" data-act="tag-del" data-idx="${i}">حذف</button></div>`)
      .join('');
    return `
      <div class="grid-2">
        ${card('الأوامر المخصصة', `
          <div class="stack">${ccRows || '<div class="chip-empty">لا أوامر مخصصة</div>'}</div>
          <button class="btn primary mt" data-act="cc-add">➕ إضافة أمر</button>`, '🧩')}
        ${card('الوسوم (Tags)', `
          <div class="stack">${tagRows || '<div class="chip-empty">لا وسوم</div>'}</div>
          <button class="btn primary mt" data-act="tag-add">➕ إضافة وسم</button>`, '🏷️')}
      </div>`;
  },

  // ---------------- Command aliases ----------------
  async aliases() {
    const [aliasesData, commandsData] = await Promise.all([
      api.get(`/api/guilds/${S.guildId}/aliases`).catch(() => ({ aliases: [] })),
      api.get('/api/commands').catch(() => ({ commands: [] })),
    ]);
    const aliases = aliasesData.aliases || [];
    const commands = commandsData.commands || [];
    const grouped = new Map();
    for (const a of aliases) {
      if (!grouped.has(a.alias)) grouped.set(a.alias, []);
      const target = `/${String(a.command || '').replace(':', ' ')}`;
      if (!grouped.get(a.alias).includes(target)) grouped.get(a.alias).push(target);
    }
    const groupedRows = [...grouped.entries()].map(([alias, rows]) => {
      return `<div class="sec-title"><code>${esc(alias)}</code></div>` + rows
        .map((a) => `<div class="list-row"><span class="grow">← <code>${esc('/' + String(a.command || '').replace(':', ' '))}</code>${a.options && Object.keys(a.options).length ? ' <span class="dim">· خيارات افتراضية</span>' : ''}</span><button class="btn sm danger" data-act="alias-del" data-id="${esc(a._id)}" data-alias="${esc(alias)}">حذف هذا الارتباط</button></div>`)
        .join('');
    }).join('');

    return `
      <div class="grid-2">
        ${card('إضافة اختصار', `
          <div class="banner info">اختصر أي أمر موجود بسلسلة قصيرة. مثال: <code>اختار</code> ← <code>/choose</code></div>
          <div class="field"><label>الاسم المستعار</label><input class="inp" id="al-shortcut" maxlength="30" placeholder="مثال: اختار"></div>
          <div class="field"><label>الأمر المستهدف</label><select class="inp" id="al-command">
            <option value="">— اختر أمراً —</option>
            ${commands.map((c) => `<option value="${esc(c.name)}">${esc(c.name)} — ${esc(c.description || '')}</option>`).join('')}
          </select></div>
          <div class="field"><label>خيارات افتراضية (JSON — اختياري)</label><textarea class="inp" id="al-options" placeholder='{"key":"value"}'></textarea></div>
          <button class="btn primary" data-act="alias-add">⌨️ إضافة الاختصار</button>
          ${commands.length ? '' : '<div class="banner info mt">لم تُحمَّل قائمة الأوامر — تأكد أن البوت متصل ثم حدّث الصفحة.</div>'}`, '⌨️')}
        ${card(`الاختصارات الحالية (${fmtNum(aliases.length)})`, `
          <div class="stack">${groupedRows || '<div class="empty">لا اختصارات بعد</div>'}</div>
          ${aliases.length ? `<button class="btn danger mt" data-act="alias-clear">🗑️ حذف كل الاختصارات</button>` : ''}`, '📋')}
      </div>`;
  },

  // ---------------- Logs ----------------
  async logs() {
    const TYPES = [['messages', 'الرسائل'], ['members', 'الأعضاء'], ['roles', 'الرولات'], ['channels', 'القنوات'], ['voice', 'الصوتي'], ['moderation', 'الإشراف'], ['tickets', 'التذاكر'], ['economy', 'الاقتصاد'], ['server', 'السيرفر'], ['ai', 'AI']];
    const typeFilter = S.logsType ? `&type=${encodeURIComponent(S.logsType)}` : '';
    const data = await api.get(`/api/guilds/${S.guildId}/logs?limit=25&page=${S.logsPage}${typeFilter}`).catch(() => ({ logs: [], pages: 1, total: 0 }));
    const logs = data.logs || [];
    const rows = logs
      .map((c) => `<tr><td>${esc(c.caseId ?? '—')}</td><td>${esc(c.type || '')}</td><td><code>${esc(c.targetId || '')}</code></td><td>${esc((c.reason || '').slice(0, 60))}</td><td>${fmtDate(c.createdAt)}</td></tr>`)
      .join('');
    return `
      <div class="grid-2">
        ${card('إعداد السجلات', `
          ${sw('logging.enabled', 'تفعيل السجلات')}
          ${chSel('logging.channelId', 'القناة الرئيسية')}
          <div class="sec-title">تقسيم القنوات حسب النوع</div>
          <div class="grid-3">${TYPES.map(([k, ar]) => chSel('logging.channels.' + k, ar)).join('')}</div>
          ${chipList('logging.ignoredChannels', 'قنوات مستثناة', 'channel')}
          ${chipList('logging.ignoredRoles', 'رولات مستثناة', 'role')}`, '📜')}
        ${card('سجل الإشراف', `
          <div class="btn-row mb">
            <select class="inp" id="logs-type" style="max-width:170px">
              <option value="">كل الأنواع</option>
              ${['warn', 'mute', 'kick', 'ban', 'delete', 'other'].map((t) => `<option value="${t}" ${S.logsType === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <span class="chip">الإجمالي: ${fmtNum(data.total || 0)}</span>
            <span class="chip">صفحة ${fmtNum(S.logsPage)} / ${fmtNum(Math.max(1, data.pages || 1))}</span>
          </div>
          ${rows ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>النوع</th><th>العضو</th><th>السبب</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">لا سجلات</div>'}
          <div class="btn-row mt">
            <button class="btn sm" data-act="logs-prev">⬅️ السابق</button>
            <button class="btn sm" data-act="logs-next">التالي ➡️</button>
          </div>`, '⚖️')}
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
        <div class="sec-title row-between">
          <span>📄 ${esc(en.title)} <span class="dim">(${esc(en.category || 'عام')}${en.tags?.length ? ' · ' + esc(en.tags.join(', ')) : ''})</span></span>
          <button class="btn sm danger" data-act="k-del" data-id="${esc(en._id)}">حذف</button>
        </div>
        <div class="dim pre-wrap mb-sm">${esc(String(en.content || '').slice(0, 240))}${String(en.content || '').length > 240 ? '…' : ''}</div>
      `).join('') : '<div class="empty">لا توجد معلومات بعد</div>', '🗂️')}`;
  },

  // ---------------- General ----------------
  async general() {
    await ensureRoles().catch(() => {});
    await ensureMembers().catch(() => {});
    return `
      <div class="grid-2">
        ${card('الهوية', `
          ${txt('prefix', 'بادئة الأوامر النصية')}
          ${sel('language', 'لغة البوت', [['ar', 'العربية'], ['en', 'English']])}
          ${sel('timezone', 'المنطقة الزمنية', [['Asia/Riyadh', 'الرياض'], ['Africa/Cairo', 'القاهرة'], ['Asia/Dubai', 'دبي'], ['Asia/Baghdad', 'بغداد'], ['UTC', 'UTC']])}
          ${txt('settingsPassword', 'كلمة مرور لوحة الإعدادات في Discord')}`, '⚙️')}
        ${card('الرول التلقائي والسجن', `
          <div class="sec-title">👋 الرول التلقائي</div>
          ${sw('autorole.enabled', 'تفعيل الرول التلقائي')}
          ${roleSel('autorole.roleId', 'الرول الممنوح عند الانضمام')}
          <div class="sec-title">🚔 السجن (Jail)</div>
          ${sw('jail.enabled', 'تفعيل السجن')}
          ${chSel('jail.channelId', 'قناة السجن')}
          ${roleSel('jail.jailRoleId', 'رول السجن')}`, '🎭')}
        ${card('الموسيقى', `
          ${sw('music.enabled', 'تفعيل الموسيقى')}
          ${sw('music.allowDJ', 'رول DJ فقط يتحكم')}
          <div class="grid-2">${num('music.defaultVolume', 'مستوى الصوت %', { min: 1, max: 100 })}${num('music.maxQueueSize', 'أقصى قائمة انتظار')}</div>
          ${sw('music.autoplay', 'تشغيل تلقائي بعد القائمة')}
          ${chipList('music.restrictToChannels', 'حصر الموسيقى في قنوات', 'channel')}`, '🎵')}
        ${card('التحذيرات وسنايب', `
          <div class="sec-title">⚖️ نظام Warn-Roles</div>
          ${chipList('warnRoles.memberIds', 'أعضاء فريق التحذيرات', 'member')}
          ${chipList('warnRoles.adminIds', 'إداريو التحذيرات', 'member')}
          <div class="grid-3">
            ${roleSel('warnRoles.adminSequential.role1Id', 'رول تحذير 1')}
            ${roleSel('warnRoles.adminSequential.role2Id', 'رول تحذير 2')}
            ${roleSel('warnRoles.adminSequential.role3Id', 'رول تحذير 3')}
          </div>
          <div class="sec-title">🔍 سنايب</div>
          ${sw('snipe.enabled', 'استرجاع الرسائل المحذوفة /snipe')}`, '🚨')}
      </div>`;
  },

  // ---------------- Sessions ----------------
  async sessions() {
    const data = await api.get('/dashboard/api/sessions').catch(() => ({ sessions: [], currentSessionId: null }));
    const sessions = data.sessions || [];
    const currentId = data.currentSessionId;
    const rows = sessions.map((s) => {
      const status = s.status === 'active' ? '<span class="chip green">نشطة</span>' : s.status === 'revoked' ? '<span class="chip red">ملغاة</span>' : '<span class="chip">منتهية</span>';
      const method = s.authMethod || '—';
      const device = `${esc(s.deviceName || 'جهاز')} · ${esc(s.browserName || 'المتصفح')} · ${esc(s.osName || 'نظام غير معروف')}`;
      const location = `${esc(s.countryName || 'غير محدد')}${s.ip ? `<br><code>${esc(s.ip)}</code>` : ''}`;
      return `<tr data-name="${esc(((s.username || '') + ' ' + (s.userId || '') + ' ' + (s.deviceName || '') + ' ' + (s.ip || '')).toLowerCase())}">
        <td>${esc(s.username || 'المالك')}<br><code>${esc(s.userId || s.sessionId || '')}</code></td>
        <td>${status}<br><span class="dim">${esc(method)}</span></td>
        <td>${device}<br><span class="dim">${esc(s.deviceType || '')}</span></td>
        <td>${location}</td>
        <td>${fmtDate(s.lastSeenAt)}<br><span class="dim">طلبات: ${esc(s.requestCount ?? 0)}</span></td>
        <td>${esc(s.lastPath || '—')}</td>
        <td class="actions">
          ${s.status === 'active' ? `<button class="btn sm danger" data-act="sess-revoke" data-id="${esc(s.sessionId || '')}">${s.isCurrent ? 'تسجيل خروج هذه الجلسة' : 'تسجيل خروج'}</button>` : '<span class="dim">—</span>'}
        </td>
      </tr>`;
    }).join('');
    return `
      ${card('الجلسات والأجهزة', `
        <div class="btn-row mb">
          <span class="chip cyan">النشطة الآن: ${fmtNum(sessions.filter((s) => s.status === 'active').length)}</span>
          <span class="chip">الأرشيف: ${fmtNum(sessions.filter((s) => s.status !== 'active').length)}</span>
          <button class="btn danger" data-act="sess-logout-all">🚪 خروج من كل الأجهزة</button>
        </div>
        <div class="tbl-wrap"><table class="tbl" id="sessions-table">
          <thead><tr><th>المستخدم</th><th>الحالة وطريقة الدخول</th><th>الجهاز والمتصفح</th><th>الموقع والعنوان</th><th>آخر نشاط</th><th>آخر صفحة</th><th>إجراء</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="7"><div class="empty">لا توجد جلسات بعد</div></td></tr>'}</tbody>
        </table></div>
      `, '🔒')}
      ${card('تفاصيل الأمان', `
        <p class="help-how">وثّق الجلسة بـ Discord OAuth (طبقة تحقق إضافية مع كلمة المرور).</p>
        <div class="btn-row mb">
          <a class="btn primary" href="/dashboard/auth/oauth/start">✅ وثّق بـ Discord OAuth</a>
          <span class="dim">يعتمد على DISCORD_CLIENT_SECRET وإعداد Redirect URI في Discord</span>
        </div>
        <p>الجلسات النشطة تُحفظ في ذاكرة البوت وتُسجّل للتحقيق في قاعدة البيانات بدون حفظ التوكن.</p>
        <p>إذا لاحظت جلسة غريبة، اضغط «تسجيل خروج» عليها فوراً، ثم «خروج من كل الأجهزة» للحصول على جلسة نظيفة.</p>
      `, '🛡️')}`;
  },

  // ---------------- Help ----------------
  async help() {
    const topic = (icon, page, what, how) => `
      <div class="help-item">
        <div class="help-head"><span class="help-icon">${icon}</span><b>${page}</b></div>
        <p>${what}</p>
        <p class="help-how">الاستخدام: ${how}</p>
      </div>`;
    return `
      <div class="banner info">تشرح هذه الصفحة كل أبواب لوحة التحكم. كل تعديل يُحفظ تلقائياً في قاعدة بيانات البوت ويُطبّق خلال ثوانٍ من غير إعادة تشغيل.</div>
      ${card('البداية والحفظ', `
        ${topic('🏠', 'نظرة عامة', 'عدد الأعضاء وسرعة البوت ومدة التشغيل وملخص حالة أهم الأنظمة لكل سيرفر.', 'راجع النقاط الخضراء والحمراء لمعرفة المفعّل والمعطّل.')}
        ${topic('🎛️', 'حفظ التغييرات', 'المفاتيح والحقول تحفظ عند تغييرها وتظهر رسالة نجاح. القوائم تُضاف فورياً عند الضغط على إضافة.', 'بعد تغيير إعداد مهم حدّث الصفحة للتأكد من ثباته.')}
      `, '🚀')}
      ${card('الأمان والحماية', `
        ${topic('🛡️', 'الحماية', 'الرايد، السبام، الروابط، الدعوات، المنشن، المخالفين، والتخريب، مع الإجراءات والحدود وقنوات السجلات والقوائم الاستثنائية.', 'فعّل الوحدة، اختر الإجراء، ثم حدّد قناة السجل وأي رولات أو قنوات مستثناة.')}
        ${topic('🕵️', 'المحقق الأمني', 'تحليل داخلي للمخاطر والنوايا والهجمات مع تقرير ونتائج مصنّفة بالخطورة.', 'شغّل الفحص اليدوي أو فعّل الفحص الدوري وحدّد قناة التنبيهات.')}
        ${topic('✅', 'التحقق', 'زر توثيق وحجر تلقائي للحسابات الجديدة ورول العضو الموثق وحد أدنى لعمر الحساب.', 'حدّد قناة التوثيق والرول والسلوك عند فشل الشرط.')}
        ${topic('🍯', 'المصيدة', 'قناة فخ؛ أي رسالة فيها تؤدي لإجراء الحماية المحدد مع إشعار رولات معينة.', 'استخدم قناة مخفية لا يراها الأعضاء وفعّلها بحذر.')}
      `, '🛡️')}
      ${card('الأعضاء والمجتمع', `
        ${topic('👥', 'الأعضاء', 'بحث، سجل إجراءات، تحذير، توقيت، تحكم بالرولات، طرد وحظر.', 'استخدم البحث للتصفية واضغط السجل لعرض التحذيرات.')}
        ${topic('📈', 'المستويات', 'خبرة بالرسائل والصوت، رسائل ترقية، ومكافآت رولات عند مستويات.', 'فعّل المستويات واضبط XP ثم أضف مكافأة الرول عند المستوى المطلوب.')}
        ${topic('💰', 'الاقتصاد', 'عملة، أجر عمل، تسول، بنك، تحويلات، متجر، حقيبة ولوحة متصدرين.', 'فعّل الاقتصاد ثم اضبط المبالغ والمعدلات ومحتويات المتجر.')}
        ${topic('👋', 'الترحيب والوداع', 'رسائل انضمام ومغادرة، ألوان وبطاقة صورة ورسالة خاصة.', 'فعّل الرسائل واختر قناة الإعلانات وقناة الوداع وتجربة رسالة الترحيب.')}
        ${topic('🎁', 'السحوبات', 'إعدادات افتراضية ونتائج للسحوبات النشطة والمنتهية.', 'حدّد المدة والفائزين والشروط ثم أنشئ السحب من Discord.')}
      `, '👥')}
      ${card('الإدارة والأتمتة', `
        ${topic('🎫', 'التذاكر', 'إعدادات عامة وإدارة مباشرة للتذاكر: رد، استلام، إغلاق، حذف.', 'اضبط الرولات والحد الأقصى والإغلاق التلقائي والترحيب ثم راقب الجدول.')}
        ${topic('📢', 'الإعلانات', 'إرسال لقناة محددة أو لكل القنوات العامة أو رسائل خاصة، مع سجل الإعلانات.', 'اختر الهدف واكتب النص وراجع التأكيد قبل الإرسال.')}
        ${topic('🧩', 'أوامر ووسوم', 'أوامر نصية مخصصة ووسوم بنصوص حرة، مع نطاق عام/إداري.', 'اكتب الاسم والمحتوى واختر النوع والصلاحية.')}
        ${topic('⌨️', 'الأسماء المستعارة', 'اختصار سهل لأي أمر موجود، ويمكن ربطه بخيارات افتراضية.', 'اختر الأمر من القائمة واكتب الاختصار، ويمكنك إضافة اسم واحد لأكثر من أمر.')}
        ${topic('📜', 'السجلات', 'تسجيل أحداث وأقسام مخصصة لكل نوع، مع فلتر وترقيم صفحات لعمليات الإشراف.', 'فعّل التسجيل واختر قناة رئيسية وقنوات لكل نوع مستقل.')}
        ${topic('📚', 'المعرفة', 'قاعدة معرفة تستخدمها إجابات AI وخدمة التذاكر.', 'أضف عنواناً ومحتوى وتصنيفاً ووسوماً، ويمكنك حذف أي سجل.')}
      `, '📋')}
      ${card('الذكاء الاصطناعي والإعدادات العامة', `
        ${topic('🤖', 'الذكاء الاصطناعي', 'ردود ذكية، ترجمة فورية، رقيب AI، مساعد تذاكر، تحليل المزاج، وتلخيص الروابط والفيديو.', 'فعّل الميزة المطلوبة بين مفاتيحها ثم اضبط النموذج والقنوات والرولات والإجراءات.')}
        ${topic('⚙️', 'إعدادات عامة', 'الهوية والبادئة واللغة والمنطقة الزمنية والرول التلقائي والسجن والموسيقى وتحذيرات الرول.', 'عدّل كل بند ثم حدّث الصفحة للتأكد من الحفظ.')}
      `, '🤖')}
      ${card('استكشاف الأخطاء', `
        <p>إذا لا تُحفظ التغييرات، حدّث الصفحة وأعد المحاولة. إذا لا تظهر قنوات أو رولات، حدّث عاماً أولاً. إذا فشل الإجراء، تحقق من صلاحيات البوت في ديسكورد. بعد إعادة تشغيل البوت قد تحتاج تسجيل دخول جديد للوحة.</p>
      `, '🧭')}`;
  },
};

// ============================================
// Page actions
// ============================================
function memberById(id) { return (cache.members || []).find((m) => m.id === id); }

function memberAction(btn, id) {
  const m = memberById(id) || {};
  const name = m.nickname || m.username || id;
  const map = {
    'm-warn': { title: `تحذير ${name}`, ok: 'إرسال التحذير', body: '<input class="inp" data-modal-input placeholder="سبب التحذير">', run: (reason) => runCommand('member_warn', { userId: id, reason }) },
    'm-timeout': { title: `توقيت ${name}`, ok: 'تطبيق التوقيت', body: '<input class="inp" type="number" data-modal-input placeholder="المدة بالدقائق (0 لإلغاء)" value="10">', run: (min) => runCommand('member_timeout', { userId: id, duration: Math.max(0, Number(min || 0)) * 60000 }) },
    'm-kick': { title: `طرد ${name}`, ok: 'طرد', danger: true, body: '<input class="inp" data-modal-input placeholder="سبب الطرد">', run: (reason) => runCommand('member_kick', { userId: id, reason }) },
    'm-ban': { title: `حظر ${name}`, ok: 'حظر', danger: true, body: '<input class="inp" data-modal-input placeholder="سبب الحظر">', run: (reason) => runCommand('member_ban', { userId: id, reason }) },
  };
  if (btn.dataset.act === 'm-role-add' || btn.dataset.act === 'm-role-del') return openRoleAssign(id, btn.dataset.act === 'm-role-add' ? 'add' : 'remove');
  if (btn.dataset.act === 'm-history') {
    openModal({
      title: `سجل ${name}`, okText: 'إغلاق',
      body: '<div class="empty">…جارٍ التحميل</div>',
      onOk: () => true,
    });
    runCommand('member_get', { userId: id })
      .then((res) => {
        const warnings = (res && res.warnings) || [];
        $('#modal-body').innerHTML = warnings.length
          ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>النوع</th><th>السبب</th><th>بواسطة</th><th>التاريخ</th></tr></thead><tbody>${warnings.map((w) => `<tr><td>${esc(w.type)}</td><td>${esc(w.reason || '')}</td><td><code>${esc(w.moderatorId || '')}</code></td><td>${fmtDate(w.createdAt)}</td></tr>`).join('')}</tbody></table></div>`
          : '<div class="empty">لا سجل إشراف لهذا العضو 👌</div>';
      })
      .catch((e) => { $('#modal-body').innerHTML = `<div class="empty">⚠️ ${esc(e.message)}</div>`; });
    return;
  }
  const cfg = map[btn.dataset.act];
  if (!cfg) return;
  openModal({
    title: cfg.title, body: cfg.body, okText: cfg.ok, danger: !!cfg.danger,
    onOk: async () => { await cfg.run(modalInput()); toast('تم التنفيذ ✓', 'ok'); },
  });
}

async function openRoleAssign(userId, mode) {
  await ensureRoles();
  const m = memberById(userId) || {};
  const current = new Set((m.roles || []).map((r) => r.id));
  const rows = (cache.roles || [])
    .filter((r) => (mode === 'add' ? !current.has(r.id) : current.has(r.id)))
    .map((r) => `<label class="pick-row" data-search="${esc((r.name + ' ' + r.id).toLowerCase())}"><input type="checkbox" value="${esc(r.id)}"><span class="pick-name">${esc(r.name)}</span><code>${esc(r.id)}</code></label>`)
    .join('');
  openModal({
    title: `${mode === 'add' ? 'إضافة' : 'إزالة'} رولات — ${esc(m.nickname || m.username || userId)}`,
    okText: 'تنفيذ', wide: true,
    body: `<input class="inp mb-sm" id="picker-search" placeholder="🔍 بحث"><div class="picker-list">${rows || '<div class="chip-empty">لا شيء متاح</div>'}</div>`,
    onOk: async () => {
      const ids = [...document.querySelectorAll('.picker-list input:checked')].map((i) => i.value);
      if (!ids.length) { toast('اختر رولاً واحداً على الأقل', 'err'); return false; }
      for (const roleId of ids) {
        await runCommand(mode === 'add' ? 'member_addrole' : 'member_removerole', { userId, roleId });
      }
      toast(`تم ${mode === 'add' ? 'إضافة' : 'إزالة'} ${ids.length} رول ✓`, 'ok');
      cache.members = null;
    },
  });
  const s = $('#picker-search');
  if (s) s.addEventListener('input', () => {
    const q = s.value.trim().toLowerCase();
    $$('.picker-list .pick-row').forEach((row) => { row.style.display = !q || row.dataset.search.includes(q) ? '' : 'none'; });
  });
}

function ticketAction(btn, id) {
  const actions = {
    'ticket-reply': { title: 'رد على التذكرة', ok: 'إرسال', body: '<textarea class="inp" data-modal-input placeholder="نص الرد"></textarea>', cmd: (v) => ['ticket_reply', { ticketId: v.id, content: v.value, actor: 'لوحة التحكم' }] },
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

async function knowledgeAction(btn) {
  if (btn.dataset.act === 'k-add') {
    const title = $('#k-title').value.trim();
    const content = $('#k-content').value.trim();
    if (!title || !content) return toast('العنوان والمحتوى مطلوبان', 'err');
    await api.post(`/api/guilds/${S.guildId}/knowledge`, { title, content, category: $('#k-cat').value.trim(), tags: $('#k-tags').value });
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

async function sessionsAction(btn) {
  if (btn.dataset.act === 'sess-revoke') {
    if (!(await confirmModal('تسجيل خروج من جلسة', 'سيتم تسجيل الخروج من هذه الجلسة فوراً. متأكد؟'))) return;
    const res = await api.del(`/api/dashboard/sessions/${encodeURIComponent(btn.dataset.id)}`);
    if (res.currentRevoked) {
      location.href = '/dashboard/auth/logout';
      return;
    }
    toast('تم تسجيل الخروج من الجلسة ✓', 'ok');
    render('sessions');
  }
  if (btn.dataset.act === 'sess-logout-all') {
    if (!(await confirmModal('خروج من كل الأجهزة', 'سيتم إنهاء كل الجلسات النشطة، بما فيها جلستك هذه. متأكد؟'))) return;
    await api.delete('/api/dashboard/sessions/logout-all', {});
    location.href = '/dashboard/auth/logout';
  }
}

async function economyAction(btn) {
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
    await ensureRoles();
    const roleOpts = [['', '— بدون رول —'], ...(cache.roles || []).map((r) => [r.id, r.name])];
    openModal({
      title: 'إضافة عنصر للمتجر', okText: 'إضافة',
      body: `<input class="inp" id="shop-name" placeholder="اسم العنصر">
             <input class="inp mt-sm" id="shop-price" type="number" placeholder="السعر">
             <textarea class="inp mt-sm" id="shop-desc" placeholder="وصف قصير (اختياري)"></textarea>
             <div class="field mt-sm"><label>مكافأة رول (اختياري)</label><select class="inp" id="shop-role">${roleOpts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></div>`,
      onOk: async () => {
        const name = $('#shop-name').value.trim();
        const price = Number($('#shop-price').value);
        if (!name || !price) { toast('الاسم والسعر مطلوبان', 'err'); return false; }
        const items = [...(val('shop.items') || [])];
        const item = { id: 'item_' + Date.now().toString(36), name, price };
        const desc = $('#shop-desc').value.trim();
        const roleId = $('#shop-role').value;
        if (desc) item.description = desc;
        if (roleId) item.roleId = roleId;
        items.push(item);
        await save('shop.items', items);
        toast('تمت الإضافة ✓', 'ok');
        render('economy');
      },
    });
  }
}

async function announcementsAction(btn) {
  if (btn.dataset.act !== 'ann-send') return;
  const type = document.querySelector('input[name="ann-type"]:checked')?.value || 'channel';
  const content = $('#ann-content').value.trim();
  const channelId = $('#ann-channel') ? $('#ann-channel').value : '';
  if (!content) return toast('اكتب نص الإعلان', 'err');
  const ok = await confirmModal('تأكيد الإرسال', type === 'dm' ? 'سيتم إرسال رسالة خاصة لجميع الأعضاء — متأكد؟' : channelId ? 'سيتم الإرسال للقناة المحددة — متأكد؟' : 'سيتم الإرسال لكل القنوات العامة — متأكد؟');
  if (!ok) return;
  toast('جارٍ الإرسال…');
  const res = await runCommand('broadcast', { type: type === 'dm' ? 'dm' : 'channel', content, channelId: channelId || undefined });
  toast(`تم الإرسال ✓ (نجح: ${fmtNum(res?.sent ?? '?')}${res?.failed ? ' • فشل: ' + fmtNum(res.failed) : ''})`, 'ok');
  render('announcements');
}

async function investigatorAction(btn) {
  const deep = btn.dataset.act === 'inv-run-deep';
  toast(deep ? '🧠 جارٍ فحص عميق بالذكاء الاصطناعي… قد يأخذ دقيقة' : '🔍 جارٍ الفحص…');
  try {
    const res = await runCommand('investigator_run', { deep });
    toast(`تم الفحص ✓ — الخطورة: ${res?.riskLevel || '?'} • النتائج: ${fmtNum(res?.findings ?? 0)}`, 'ok');
  } catch (e) {
    toast(e.message, 'err');
  }
  render('investigator');
}

async function commandsAction(btn) {
  const act = btn.dataset.act;
  if (act === 'cc-add') {
    openModal({
      title: 'إضافة أمر مخصص', okText: 'إضافة',
      body: `<input class="inp" id="cc-name" placeholder="اسم الأمر (بدون /)">
             <textarea class="inp mt-sm" id="cc-content" placeholder="محتوى الرد"></textarea>
             <div class="grid-2 mt-sm">
               <div class="field"><label>النوع</label><select class="inp" id="cc-embed"><option value="text">نص عادي</option><option value="embed">بطاقة Embed</option></select></div>
               <div class="field"><label>الصلاحية</label><select class="inp" id="cc-scope"><option value="public">للجميع</option><option value="admin">للإدارة فقط</option></select></div>
             </div>`,
      onOk: async () => {
        const name = $('#cc-name').value.trim().replace(/^\//, '');
        const content = $('#cc-content').value.trim();
        if (!name || !content) { toast('الاسم والمحتوى مطلوبان', 'err'); return false; }
        const list = [...(val('customCommands') || [])];
        if (list.some((c) => c.name.toLowerCase() === name.toLowerCase())) { toast('الاسم مستخدم بالفعل', 'err'); return false; }
        list.push({ name, content, embed: $('#cc-embed').value === 'embed', scope: $('#cc-scope').value, createdBy: 'لوحة التحكم', createdAt: new Date().toISOString(), uses: 0 });
        await save('customCommands', list);
        toast('تمت الإضافة ✓', 'ok');
        render('commands');
      },
    });
  }
  if (act === 'cc-del') {
    if (!(await confirmModal('حذف الأمر', 'متأكد؟'))) return;
    const list = [...(val('customCommands') || [])];
    list.splice(Number(btn.dataset.idx), 1);
    await save('customCommands', list);
    render('commands');
  }
  if (act === 'tag-add') {
    openModal({
      title: 'إضافة وسم', okText: 'إضافة',
      body: `<input class="inp" id="tag-name" placeholder="اسم الوسم">
             <textarea class="inp mt-sm" id="tag-content" placeholder="محتوى الوسم"></textarea>`,
      onOk: async () => {
        const name = $('#tag-name').value.trim();
        const content = $('#tag-content').value.trim();
        if (!name || !content) { toast('الاسم والمحتوى مطلوبان', 'err'); return false; }
        const list = [...(val('tags') || [])];
        list.push({ name, content });
        await save('tags', list);
        toast('تمت الإضافة ✓', 'ok');
        render('commands');
      },
    });
  }
  if (act === 'tag-del') {
    if (!(await confirmModal('حذف الوسم', 'متأكد؟'))) return;
    const list = [...(val('tags') || [])];
    list.splice(Number(btn.dataset.idx), 1);
    await save('tags', list);
    render('commands');
  }
}

async function aliasesAction(btn) {
  const act = btn.dataset.act;
  if (act === 'alias-add') {
    const alias = $('#al-shortcut').value.trim();
    const command = $('#al-command').value.trim();
    const options = $('#al-options').value.trim();
    if (!alias || !command) { toast('اكتب الاسم المستعار واختر الأمر المستهدف', 'err'); return; }
    try {
      if (options) JSON.parse(options);
    } catch {
      toast('الخيارات ليست JSON صالحاً', 'err');
      return;
    }
    await api.post(`/api/guilds/${S.guildId}/aliases`, { alias, command, options });
    toast('تمت إضافة الاختصار ✓', 'ok');
    render('aliases');
  }
  if (act === 'alias-del') {
    if (!(await confirmModal('حذف الارتباط', `سيتم حذف الاختصار ${btn.dataset.alias} من هذا الأمر فقط. متأكد؟`))) return;
    await api.del(`/api/guilds/${S.guildId}/aliases/${btn.dataset.id}`);
    toast('تم الحذف ✓', 'ok');
    render('aliases');
  }
  if (act === 'alias-clear') {
    if (!(await confirmModal('حذف كل الاختصارات', 'سيتم حذف جميع الاختصارات من هذا السيرفر نهائياً. متأكد؟'))) return;
    const res = await api.del(`/api/guilds/${S.guildId}/aliases`);
    toast(`تم حذف ${res.deleted ?? 0} ارتباط ✓`, 'ok');
    render('aliases');
  }
}

async function levelRewardAction(btn) {
  if (btn.dataset.act === 'lr-del') {
    const list = [...(val('leveling.levelRewards') || [])];
    list.splice(Number(btn.dataset.idx), 1);
    await save('leveling.levelRewards', list);
    render('levels');
  }
  if (btn.dataset.act === 'lr-add') {
    await ensureRoles();
    openModal({
      title: 'إضافة مكافأة مستوى', okText: 'إضافة',
      body: `<div class="field"><label>المستوى</label><input class="inp" type="number" id="lr-level" min="1" placeholder="5"></div>
             <div class="field"><label>الرول</label><select class="inp" id="lr-role">${(cache.roles || []).map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></div>`,
      onOk: async () => {
        const level = Number($('#lr-level').value);
        const roleId = $('#lr-role').value;
        if (!level || !roleId) { toast('أدخل المستوى واختر الرول', 'err'); return false; }
        const list = [...(val('leveling.levelRewards') || [])];
        list.push({ level, roleId });
        list.sort((a, b) => a.level - b.level);
        await save('leveling.levelRewards', list);
        toast('تمت الإضافة ✓', 'ok');
        render('levels');
      },
    });
  }
}

async function welcomeAction(btn) {
  if (btn.dataset.act !== 'welcome-test') return;
  const channelId = $('#welcome-test-channel') ? $('#welcome-test-channel').value : '';
  if (!channelId) return toast('لا توجد قناة نصية', 'err');
  await runCommand('welcome_test', { channelId });
  toast('تم إرسال رسالة تجريبية ✓', 'ok');
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
  } catch (e) { loginError(e.message); }
};
async function enterAfterLogin() {
  const st = await api.get('/dashboard/auth/status');
  if (st.oauthRequired && st.user && !st.user.oauthVerified) {
    showOAuthGuard();
    return;
  }
  await startApp();
}

$('#btn-verify-code').onclick = async () => {
  try {
    await api.post('/dashboard/auth/code/verify', { code: $('#code-input').value.trim() });
    await enterAfterLogin();
  } catch (e) { loginError(e.message); }
};
$('#btn-login-pass').onclick = async () => {
  try {
    await api.post('/dashboard/auth/password', { password: $('#pass-input').value });
    await enterAfterLogin();
  } catch (e) { loginError(e.message); }
};
$('#btn-logout').onclick = async () => {
  try { await api.post('/dashboard/auth/logout', {}); } catch { /* تجاهل */ }
  location.reload();
};
$('#btn-refresh').onclick = async () => { await selectGuild(S.guildId, S.page); };
$('#btn-oauth-logout')?.addEventListener('click', async () => {
  try { await api.post('/dashboard/auth/logout', {}); } catch { /* تجاهل */ }
  location.href = '/dashboard';
});

// modal wiring
$('#modal-x').onclick = closeModal;
$('#modal-cancel').onclick = () => closeModal();
$('#modal-ok').onclick = async () => {
  if (!modalOk) return closeModal();
  try {
    const ok = await modalOk();
    if (ok !== false) closeModal();
  } catch (e) { toast(e.message, 'err'); }
};
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });

// ===== Boot =====
(async function boot() {
  try {
    const st = await api.get('/dashboard/auth/status');
    if (st.oauthRequired && st.user && !st.user.oauthVerified) showOAuthGuard();
    else if (st.authenticated) await startApp();
    else showLogin(st.login);
  } catch (e) {
    showLogin({ password: false, code: false });
  }
})();
