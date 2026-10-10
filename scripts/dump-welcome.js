// عرض إعدادات الترحيب الحالية (للتشخيص)
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const docs = await mongoose.connection.db
      .collection('guildsettings')
      .find({})
      .project({ guildId: 1, welcome: 1, autorole: 1 })
      .toArray();
    for (const d of docs) {
      console.log('Guild:', d.guildId);
      console.log('welcome:', JSON.stringify(d.welcome, null, 2));
      console.log('autorole:', JSON.stringify(d.autorole, null, 2));
    }
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await mongoose.disconnect();
  }
})();
