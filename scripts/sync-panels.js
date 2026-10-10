// مزامنة رسائل اللوحة: إزالة زر "تذكرة عامة" من كل اللوحات + حذف اللوحات القديمة (نوع زر فقط)
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const API = 'https://discord.com/api/v10';

async function req(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

(async () => {
  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGODB_URI);
  const doc = await mongoose.connection.db
    .collection('guildsettings')
    .findOne({ guildId: '1481739211143909499' });
  const panels = doc?.tickets?.panels || [];
  const toRemoveIds = [];

  for (const p of panels) {
    if (!p.channelId || !p.messageId) continue;

    const msg = await req('GET', `/channels/${p.channelId}/messages/${p.messageId}`);
    if (msg.status !== 200) {
      console.log(`[${p.id}] رسالة غير موجودة (${msg.status}) — تخطي`);
      toRemoveIds.push(p.id);
      continue;
    }

    const hasSelect = (msg.data.components || []).some(r =>
      (r.components || []).some(c => c.type === 3)
    );

    if (!hasSelect) {
      // لوحات قديمة بزر فقط — حذف الرسالة وقاعدة البيانات
      const del = await req('DELETE', `/channels/${p.channelId}/messages/${p.messageId}`);
      console.log(`[${p.id}] لوحات قديمة (زر فقط) — حذف الرسالة: ${del.status}`);
      toRemoveIds.push(p.id);
    } else {
      // إزالة صفوف الأزرار — الإبقاء على قائمة الأنواع فقط
      const newComponents = (msg.data.components || []).filter(r =>
        (r.components || []).some(c => c.type === 3)
      );
      const patch = await req('PATCH', `/channels/${p.channelId}/messages/${p.messageId}`, {
        components: newComponents,
      });
      console.log(`[${p.id}] إزالة الأزرار من اللوحة: ${patch.status}`);
    }
  }

  if (toRemoveIds.length > 0) {
    await mongoose.connection.db.collection('guildsettings').updateOne(
      { guildId: '1481739211143909499' },
      { $pull: { 'tickets.panels': { id: { $in: toRemoveIds } } } }
    );
    console.log(`تم حذف ${toRemoveIds.length} لوحة قديمة من قاعدة البيانات`);
  }

  // تحديث العداد ليطابق عدد التذاكر السابقة
  const tickets = await mongoose.connection.db
    .collection('tickets')
    .countDocuments({ guildId: '1481739211143909499' });
  await mongoose.connection.db.collection('guildsettings').updateOne(
    { guildId: '1481739211143909499' },
    { $set: { 'tickets.counter': tickets } }
  );
  console.log(`عداد التذاكر مضبوط على ${tickets} (التذكرة القادمة = رقم ${tickets + 1})`);

  await mongoose.disconnect();
})();
