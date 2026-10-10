// نقل سجلات التذاكر من قناة اللوحة إلى قناة اللوجات الرسمية
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const r = await mongoose.connection.db.collection('guildsettings').updateOne(
    { guildId: '1481739211143909499' },
    { $set: { 'tickets.logChannelId': '1482716586140762132' } } // [꧁System꧂] 📜｜LOGS
  );
  console.log('تم نقل سجلات التذاكر إلى قناة 📜 LOGS، المعاد:', r.modifiedCount);
  await mongoose.disconnect();
})();
