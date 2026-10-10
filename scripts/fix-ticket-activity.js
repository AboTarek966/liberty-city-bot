// تهيئة lastActivityAt للتذاكر المفتوحة القديمة (حتى لا تُغلق فوراً كأنها خاملة)
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const r = await mongoose.connection.db.collection('tickets').updateMany(
    { status: { $in: ['open', 'claimed', 'waiting'] }, lastActivityAt: { $exists: false } },
    { $set: { lastActivityAt: new Date(), idleWarned: false } }
  );
  console.log(`تم تهيئة lastActivityAt لـ ${r.modifiedCount} تذكرة مفتوحة قديمة`);
  await mongoose.disconnect();
})();
