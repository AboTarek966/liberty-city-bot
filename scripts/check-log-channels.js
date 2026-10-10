// فحص إعدادات سجلات التذاكر + قائمة قنوات السيرفر
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const doc = await db.collection('guildsettings').findOne({ guildId: '1481739211143909499' });

  console.log('tickets.logChannelId =', doc?.tickets?.logChannelId);
  console.log('tickets.transcriptChannelId =', doc?.tickets?.transcriptChannelId);
  console.log('logging.channelId =', doc?.logging?.channelId);
  console.log('panels channels =', (doc?.tickets?.panels || []).map(p => p.channelId));

  const token = process.env.DISCORD_TOKEN;
  const res = await fetch('https://discord.com/api/v10/guilds/1481739211143909499/channels', {
    headers: { Authorization: `Bot ${token}` },
  });
  const channels = await res.json();
  const cats = {};
  for (const c of channels) cats[c.id] = c;
  for (const c of channels.sort((a, b) => (a.position || 0) - (b.position || 0))) {
    if (c.type !== 0 && c.type !== 2 && c.type !== 4) continue;
    const parent = c.parent_id && cats[c.parent_id] ? `[${cats[c.parent_id].name}] ` : '';
    const flag =
      c.id === doc?.tickets?.logChannelId ? ' <== tickets.logChannelId' :
      c.id === doc?.logging?.channelId ? ' <== logging.channelId' :
      c.id === doc?.tickets?.transcriptChannelId ? ' <== transcripts' : '';
    console.log(`${c.id} | type=${c.type} | ${parent}${c.name}${flag}`);
  }
  await mongoose.disconnect();
})();
