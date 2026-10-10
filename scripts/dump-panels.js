// عرض سريع للوحات التذاكر المحفوظة (للتشخيص)
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    const col = db.collection('guildsettings');
    const docs = await col.find({}).project({ guildId: 1, 'tickets.panels': 1 }).toArray();
    for (const d of docs) {
      console.log('Guild:', d.guildId);
      const panels = (d.tickets && d.tickets.panels) || [];
      console.log('Panels count:', panels.length);
      panels.forEach((p, i) => {
        console.log(`  [${i}] id=${p.id} name=${JSON.stringify(p.name)} channel=${p.channelId} msg=${p.messageId} type=${p.type} options=${(p.options || []).length} fields=${(p.fields || []).length}`);
      });
    }
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await mongoose.disconnect();
  }
})();
