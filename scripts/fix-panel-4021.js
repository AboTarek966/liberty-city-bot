// إعادة محاولة إزالة الأزرار من اللوحة 4021 (كانت429 — rate limit)
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const API = 'https://discord.com/api/v10';
const CH = '1481752205429178448';
const MSG = '1558427349354020936';

(async () => {
  const r = await fetch(`${API}/channels/${CH}/messages/${MSG}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  const m = await r.json();
  if (r.status !== 200) { console.log('GET failed:', r.status, JSON.stringify(m)); return; }

  const comps = (m.components || []).filter(row =>
    (row.components || []).some(c => c.type === 3)
  );

  const p = await fetch(`${API}/channels/${CH}/messages/${MSG}`, {
    method: 'PATCH',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ components: comps }),
  });
  console.log('PATCH:', p.status, await p.text());
})();
