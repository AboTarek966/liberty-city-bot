// ============================================
// فحص حدود مكونات Discord لكل لوحات الإعدادات
// يشغَّل بعد npx tsc — يكتشف أخطاء COMPONENT_LAYOUT_WIDTH_EXCEEDED
// ============================================
require('dotenv').config();
const mongoose = require('mongoose');

const GUILD_ID = '1481739211143909499';

// حدود Discord
const ROW_MAX_WIDTH = 5;          // عرض الصف الأقصى
const BUTTON_WIDTH = 1;           // الزر = 1
const SELECT_WIDTH = 5;           // القائمة المنسدلة = 5
const MAX_ROWS = 5;               // أقصى صفوف في الرسالة
const EMBED_DESC_MAX = 4096;
const EMBED_TITLE_MAX = 256;
const EMBED_FIELD_VALUE_MAX = 1024;
const EMBED_FIELDS_MAX = 25;

function widthOf(comp) {
  // type: 2 = button, 3/5/6/7/8 = selects, 4 = text input
  if (comp.type === 2) return BUTTON_WIDTH;
  if ([3, 5, 6, 7, 8].includes(comp.type)) return SELECT_WIDTH;
  return 0;
}

function validatePanel(name, panel) {
  const errors = [];
  const rows = panel.components || [];

  if (rows.length > MAX_ROWS) {
    errors.push(`عدد الصفوف ${rows.length} > ${MAX_ROWS}`);
  }

  rows.forEach((row, ri) => {
    const comps = row.toJSON ? row.toJSON().components : row.components;
    const total = comps.reduce((s, c) => s + widthOf(c), 0);
    if (total > ROW_MAX_WIDTH) {
      errors.push(
        `الصف ${ri + 1}: عرض ${total} > ${ROW_MAX_WIDTH} (أنواع: ${comps
          .map(c => (c.type === 2 ? 'زر' : 'منسدلة'))
          .join('، ')})`
      );
    }
    const selects = comps.filter(c => [3, 5, 6, 7, 8].includes(c.type)).length;
    if (selects > 1) {
      errors.push(`الصف ${ri + 1}: ${selects} قوائم منسدلة في صف واحد (الحد 1)`);
    }
    if (comps.length > 5) {
      errors.push(`الصف ${ri + 1}: ${comps.length} مكونات (الحد 5)`);
    }
  });

  for (const emb of panel.embeds || []) {
    const e = emb.toJSON ? emb.toJSON() : emb;
    if (e.description && e.description.length > EMBED_DESC_MAX) {
      errors.push(`إمبد: الوصف ${e.description.length} > ${EMBED_DESC_MAX}`);
    }
    if (e.title && e.title.length > EMBED_TITLE_MAX) {
      errors.push(`إمبد: العنوان ${e.title.length} > ${EMBED_TITLE_MAX}`);
    }
    if (e.fields && e.fields.length > EMBED_FIELDS_MAX) {
      errors.push(`إمبد: حقول ${e.fields.length} > ${EMBED_FIELDS_MAX}`);
    }
    (e.fields || []).forEach((f, i) => {
      if (f.value && f.value.length > EMBED_FIELD_VALUE_MAX) {
        errors.push(`إمبد: حقل ${i + 1} (${f.name}) ${f.value.length} > ${EMBED_FIELD_VALUE_MAX}`);
      }
    });
  }

  if (errors.length) {
    console.log(`❌ ${name}`);
    errors.forEach(e => console.log(`   - ${e}`));
  } else {
    console.log(`✅ ${name} (${rows.length} صف)`);
  }
  return errors.length === 0;
}

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const { buildPanel, buildLevelIgnorePanel, buildLevelRewardsPanel, buildTicketMovePanel } =
      require('../dist/utils/settingsPanel');

    const guild = {
      id: GUILD_ID,
      name: 'Fuse',
      memberCount: 49,
      iconURL: () => null,
      roles: { cache: new Map() },
      channels: { cache: new Map() },
      members: { cache: new Map() },
    };

    const categories = [
      'home', 'general', 'protection', 'tickets', 'ai',
      'welcome', 'leave', 'logging', 'levels', 'automod',
    ];

    let ok = true;
    for (const cat of categories) {
      const panel = await buildPanel(cat, guild, 'validator');
      if (!validatePanel(cat, panel)) ok = false;
    }

    // اللوحات الفرعية
    const settings = await (require('../dist/models').getGuildSettings(GUILD_ID));
    if (!validatePanel('levels:ignore (فرعية)', buildLevelIgnorePanel(guild, settings))) ok = false;
    if (!validatePanel('levels:rewards (فرعية)', buildLevelRewardsPanel(guild, settings))) ok = false;
    if (!validatePanel('tickets:move (فرعية)', buildTicketMovePanel(guild, settings))) ok = false;

    console.log(ok ? '\n🎉 كل اللوائح متوافقة مع حدود Discord' : '\n⚠️ يوجد أخطاء يجب إصلاحها');
    process.exitCode = ok ? 0 : 1;
  } catch (e) {
    console.error('ERR', e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
