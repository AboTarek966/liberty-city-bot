// مقارنة رسائل اللوحة الفعلية في ديسكورد مع حالة قاعدة البيانات
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const CHANNEL = '1481752205429178448';
const API = 'https://discord.com/api/v10';

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bot ${token}` } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

(async () => {
  // 1) الرسائل الفعلية في قناة اللوحات
  const msgs = await get(`/channels/${CHANNEL}/messages?limit=15`);
  console.log('=== Discord messages in panel channel ===');
  if (msgs.status === 200) {
    for (const m of msgs.body) {
      const title = m.embeds?.[0]?.title || '(no embed)';
      const desc = (m.embeds?.[0]?.description || '').slice(0, 120).replace(/\n/g, ' | ');
      const comps = (m.components || [])
        .flatMap(r => r.components || [])
        .map(c => `${c.type}:${c.custom_id || c.label || ''}`)
        .join(', ');
      console.log(`  id=${m.id} at=${m.timestamp}`);
      console.log(`    title: ${title}`);
      console.log(`    desc:  ${desc}`);
      console.log(`    comps: ${comps}`);
    }
  } else {
    console.log('  ERROR', msgs.status, JSON.stringify(msgs.body));
  }

  // 2) حالة قاعدة البيانات
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI);
  const doc = await mongoose.connection.db.collection('guildsettings').findOne({ guildId: '1481739211143909499' });
  console.log('\n=== DB panels (last = active) ===');
  const panels = doc?.tickets?.panels || [];
  panels.forEach((p, i) => {
    console.log(`  [${i}] id=${p.id} name="${p.name}" msg=${p.messageId} ch=${p.channelId} options=${(p.options || []).length}`);
    console.log(`       desc="${(p.description || '').slice(0, 100)}"`);
    (p.options || []).forEach(o => console.log(`       opt: ${o.emoji || ''} ${o.label} | ${o.description || ''}`));
  });
  await mongoose.disconnect();
})();
