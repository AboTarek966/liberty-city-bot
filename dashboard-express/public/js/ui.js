/* ═══ Liberty UI Kit — tabs, modal, dropdown, toasts, live selectors ═══ */
window.LC = (() => {
  // ---------- helpers ----------
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('en-US');

  async function api(url, opts = {}) {
    const r = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }

  // ---------- toasts ----------
  function toast(msg, type = 'success', ms = 3600) {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill', warn: 'bi-exclamation-triangle-fill' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><div>${esc(msg)}</div>`;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, ms);
  }

  // ---------- modal ----------
  let scrimEl = null;
  function modal({ title, body, actions = [], wide = false }) {
    ensureScrim();
    const m = document.createElement('div');
    m.className = 'modal';
    if (wide) m.style.maxWidth = '780px';
    m.innerHTML = `
      <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close style="width:32px;height:32px;">✕</button></div>
      <div class="modal-body">${body}</div>
      <div class="modal-foot"></div>`;
    const foot = $('.modal-foot', m);
    actions.forEach(a => {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || '');
      b.innerHTML = `${a.icon ? `<i class="bi bi-${a.icon}"></i>` : ''} ${esc(a.label)}`;
      b.onclick = () => Promise.resolve(a.onclick?.(m, b)).finally(() => { if (!a.keepOpen) close(); });
      foot.appendChild(b);
    });
    if (!actions.length) foot.remove();
    scrimEl.appendChild(m);
    openScrim();
    $$('[data-close]', m).forEach(b => b.onclick = close);
    return m;
  }
  function ensureScrim() {
    if (scrimEl) return;
    scrimEl = document.createElement('div');
    scrimEl.className = 'scrim';
    scrimEl.onclick = (e) => { if (e.target === scrimEl) close(); };
    document.body.appendChild(scrimEl);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }
  function openScrim() { ensureScrim(); scrimEl.classList.add('show'); }
  function close() { scrimEl?.classList.remove('show'); if (scrimEl) scrimEl.innerHTML = ''; }

  function confirmBox(title, text, { danger = true, okLabel = 'تأكيد' } = {}) {
    return new Promise((resolve) => {
      let settled = false;
      const m = modal({
        title,
        body: `<p style="color:var(--text-2);font-size:13.5px;">${esc(text)}</p>`,
        actions: [
          { label: okLabel, cls: danger ? 'danger' : 'primary', icon: danger ? 'exclamation-octagon' : 'check2', onclick: () => { settled = true; resolve(true); } },
          { label: 'إلغاء', cls: 'ghost', onclick: () => { settled = true; resolve(false); } },
        ],
      });
      $$('[data-close]', m).forEach(b => b.addEventListener('click', () => { if (!settled) resolve(false); }));
    });
  }

  // ---------- tabs ----------
  function initTabs(root = document) {
    $$('.tabs', root).forEach(tabs => {
      const panes = $$('.tabpane', tabs.nextElementSibling ? tabs.parentElement : document);
      $$('.tab', tabs).forEach((t, i) => {
        if (t.dataset.bound) return;
        t.dataset.bound = '1';
        t.addEventListener('click', () => {
          $$('.tab', tabs).forEach(x => x.classList.remove('active'));
          t.classList.add('active');
          const group = t.closest('.tabs').dataset.group || 'default';
          const target = t.dataset.target;
          $$(`.tabpane[data-group="${group}"]`).forEach(p => p.classList.remove('active'));
          const pane = target ? document.getElementById(target) : panes[i];
          pane?.classList.add('active');
        });
      });
    });
  }

  // ---------- dropdown ----------
  function initDropdowns() {
    document.addEventListener('click', (e) => {
      const dd = e.target.closest('[data-dd]');
      if (dd) {
        const menu = dd.nextElementSibling;
        menu?.classList.toggle('show');
        return;
      }
      $$('.dd-menu.show').forEach(m => m.classList.remove('show'));
    });
  }

  // ---------- live channel/role selects ----------
  function fillSelect(sel, items, selectedValue) {
    if (!sel) return;
    const cur = selectedValue ?? sel.dataset.value ?? sel.value ?? '';
    sel.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = sel.dataset.placeholder || '— اختر —';
    sel.appendChild(ph);
    groups(items).forEach(g => {
      const og = document.createElement('optgroup');
      og.label = g.label;
      g.items.forEach(it => {
        const o = document.createElement('option');
        o.value = it.id;
        o.textContent = it.label;
        og.appendChild(o);
      });
      sel.appendChild(og);
    });
    const flat = items.map(x => (x.options ? x.options : [x])).flat();
    const match = flat.find(x => String(x.id) === String(cur));
    sel.value = match ? String(match.id) : '';
    if (!match && cur) {
      const o = document.createElement('option');
      o.value = cur;
      o.textContent = `ID: ${cur}`;
      sel.appendChild(o);
      sel.value = String(cur);
    }
  }
  function groups(items) {
    // items: [{id,label,type}] → groups: categories with children
    const cats = items.filter(i => i.type === 4);
    const out = [{ label: 'بدون تصنيف', items: items.filter(i => i.type !== 4 && !i.parentId).map(i => ({ id: i.id, label: prettify(i) })) }];
    cats.forEach(c => {
      const children = items.filter(i => i.parentId === c.id);
      if (children.length) out.push({ label: c.label, items: children.map(i => ({ id: i.id, label: prettify(i) })) });
    });
    const orphan = items.filter(i => i.type !== 4 && i.parentId && !cats.some(c => c.id === i.parentId));
    if (orphan.length) out.push({ label: 'قنوات أخرى', items: orphan.map(i => ({ id: i.id, label: prettify(i) })) });
    return out;
  }
  function prettify(ch) {
    const icons = { 0: '#', 2: '🔊', 5: '📣', 13: '🎤', 15: '📋', 4: '' };
    return `${icons[ch.type] || ''} ${ch.label ?? ch.name}`;
  }

  async function loadChannels(guildId, selects, { keepInputs = true } = {}) {
    try {
      const channels = await api(`/api/guilds/${guildId}/channels`);
      (Array.isArray(selects) ? selects : [selects]).forEach(sel => {
        if (typeof sel === 'string') sel = document.getElementById(sel);
        if (!sel || sel.tagName !== 'SELECT') return;
        const types = (sel.dataset.types || '0,2,4,5,13,15').split(',').map(Number);
        const items = channels.filter(c => types.includes(c.type)).map(c => ({ ...c, label: c.name }));
        fillSelect(sel, items);
      });
      return true;
    } catch { return false; }
  }

  async function loadRoles(guildId, selects) {
    try {
      const roles = await api(`/api/guilds/${guildId}/roles`);
      (Array.isArray(selects) ? selects : [selects]).forEach(sel => {
        if (typeof sel === 'string') sel = document.getElementById(sel);
        if (!sel) return;
        fillSelect(sel, roles.map(r => ({ id: r.id, label: r.name, color: r.color })));
      });
      return true;
    } catch { return false; }
  }

  // channel multi-list (chips editor): container + hidden input id, comma separated
  // opts: { inputId, listEl, guildId, kind='channels'|'roles'|'text', placeholder, path (dotted save path), onSaved }
  function multiEditor(cfg) {
    const { inputId, listEl, guildId, kind = 'channels', path } = cfg;
    const input = document.getElementById(inputId);
    const list = document.getElementById(listEl);
    if (!input || !list) return;
    const ids = () => input.value.split(',').map(s => s.trim()).filter(Boolean);
    const render = (names) => {
      list.innerHTML = '';
      if (!ids().length) { list.innerHTML = `<span class="text-dim" style="font-size:12px;font-weight:600;">${esc(cfg.placeholder || 'لا عناصر — اضغط ＋')}</span>`; return; }
      ids().forEach(id => {
        const chip = document.createElement('span');
        chip.className = 'chip purple';
        chip.style.margin = '2px';
        const name = names?.[id];
        chip.innerHTML = `${esc(name || '#' + id)} <i class="bi bi-x" style="cursor:pointer"></i>`;
        chip.querySelector('i').onclick = () => {
          input.value = ids().filter(x => x !== id).join(',');
          render(names);
          persist();
        };
        list.appendChild(chip);
      });
    };
    const persist = async () => {
      if (!path) return;
      const keys = path.split('.');
      const payload = {};
      let node = payload;
      keys.slice(0, -1).forEach(k => { node[k] = node[k] || {}; node = node[k]; });
      node[keys[keys.length - 1]] = ids();
      const ok = await saveSetting(guildId, payload, null);
      if (ok && cfg.onSaved) cfg.onSaved(ids());
    };
    const fetchNames = async () => {
      try {
        const data = kind === 'roles' ? await api(`/api/guilds/${guildId}/roles`) : await api(`/api/guilds/${guildId}/channels`);
        const map = {};
        data.forEach(x => map[x.id] = kind === 'roles' ? `@${x.name}` : `#${x.name}`);
        render(map);
      } catch { render(null); }
    };
    window['add_' + inputId] = async () => {
      const data = kind === 'roles' ? await api(`/api/guilds/${guildId}/roles`) : await api(`/api/guilds/${guildId}/channels`);
      const opts = data.filter(x => kind !== 'channels' || x.type !== 4);
      modal({
        title: kind === 'roles' ? 'اختر رولات' : 'اختر قنوات',
        body: `<div style="max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:5px;">${
          opts.map(o => `<label class="field-check"><input type="checkbox" value="${o.id}" ${ids().includes(o.id) ? 'checked' : ''}><span>${esc(kind === 'roles' ? '@' + o.name : '#' + o.name)}</span></label>`).join('')
        }</div>`,
        actions: [
          { label: 'حفظ', cls: 'primary', icon: 'plus', onclick: (m) => {
            const picked = $$('input[type=checkbox]:checked', m).map(i => i.value);
            const set = new Set([...ids(), ...picked]);
            input.value = [...set].join(',');
            fetchNames();
            persist();
          }},
          { label: 'إلغاء', cls: 'ghost' },
        ],
      });
    };
    fetchNames();
    const btn = document.querySelector(`[data-addfor="${inputId}"]`);
    if (btn) btn.onclick = () => window['add_' + inputId]();
  }

  // ---------- setting saver (works with switches & forms) ----------
  async function saveSetting(guildId, payload, btn) {
    const busy = btn;
    if (busy) { busy.dataset.old = busy.innerHTML; busy.disabled = true; busy.innerHTML = '<span class="spinner"></span>'; }
    try {
      await api(`/api/guilds/${guildId}/settings`, { method: 'PATCH', body: payload });
      toast('تم الحفظ ✅');
      return true;
    } catch (e) {
      toast('فشل الحفظ: ' + e.message, 'error');
      return false;
    } finally {
      if (busy) { busy.disabled = false; busy.innerHTML = busy.dataset.old; }
    }
  }
  // Auto-wire switches: [data-toggle="path.key"] → PATCH {protection:{...}} style payload via dotted path
  function wireSwitches(guildId) {
    $$('[data-toggle]').forEach(sw => {
      if (sw.dataset.wired) return;
      sw.dataset.wired = '1';
      sw.addEventListener('change', async () => {
        const path = sw.dataset.toggle; // e.g. "protection.antiRaid.enabled"
        const keys = path.split('.');
        const value = sw.checked;
        // build nested payload from dotted path
        const payload = {};
        let node = payload;
        keys.slice(0, -1).forEach(k => { node[k] = node[k] || {}; node = node[k]; });
        node[keys[keys.length - 1]] = value;
        const ok = await saveSetting(guildId, payload, null);
        if (!ok) sw.checked = !sw.checked;
      });
    });
    $$('[data-num]').forEach(el => {
      if (el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('change', async () => {
        const path = el.dataset.num;
        const keys = path.split('.');
        const value = Number(el.value || 0);
        const payload = {};
        let node = payload;
        keys.slice(0, -1).forEach(k => { node[k] = node[k] || {}; node = node[k]; });
        node[keys[keys.length - 1]] = value;
        await saveSetting(guildId, payload, null);
      });
    });
    $$('[data-text]').forEach(el => {
      if (el.dataset.wired) return;
      el.dataset.wired = '1';
      const commit = async () => {
        const path = el.dataset.text;
        const keys = path.split('.');
        const payload = {};
        let node = payload;
        keys.slice(0, -1).forEach(k => { node[k] = node[k] || {}; node = node[k]; });
        node[keys[keys.length - 1]] = el.tagName === 'SELECT' ? el.value : el.value.trim();
        await saveSetting(guildId, payload, null);
      };
      if (el.tagName === 'SELECT') el.addEventListener('change', commit);
      else el.addEventListener('change', commit);
    });
  }

  // ---------- auto-init ----------
  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initDropdowns();
  });

  return { $, $$, esc, fmt, api, toast, modal, close, confirmBox, initTabs, loadChannels, loadRoles, multiEditor, saveSetting, wireSwitches };
})();
