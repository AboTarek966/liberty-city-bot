// تشخيص: هل يستطيع البوت الوصول لقناة الترحيب؟
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const WELCOME_CHANNEL = '1481741895141949693';
const GUILD = '1481739211143909499';
const API = 'https://discord.com/api/v10';

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bot ${token}` } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

(async () => {
  const me = await get('/users/@me');
  console.log('BOT:', me.status, me.body?.username || me.body);

  const ch = await get(`/channels/${WELCOME_CHANNEL}`);
  console.log(`\nGET /channels/${WELCOME_CHANNEL} → ${ch.status}`);
  if (ch.status === 200) {
    console.log('  name:', ch.body.name, '| type:', ch.body.type, '| parent:', ch.body.parent_id);
  } else {
    console.log('  error:', JSON.stringify(ch.body));
  }

  const gchs = await get(`/guilds/${GUILD}/channels`);
  console.log(`\nGET /guilds/${GUILD}/channels → ${gchs.status}`);
  if (gchs.status === 200) {
    console.log('  visible channels:', gchs.body.length);
    const hit = gchs.body.find((c) => c.id === WELCOME_CHANNEL);
    console.log('  welcome channel visible?', hit ? `YES (${hit.name}, type ${hit.type})` : 'NO — bot cannot see it');
    console.log('  --- text channels bot can see ---');
    gchs.body
      .filter((c) => c.type === 0)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .forEach((c) => console.log(`  #${c.name}  ${c.id}${c.id === WELCOME_CHANNEL ? '  ← WELCOME' : ''}`));
  } else {
    console.log('  error:', JSON.stringify(gchs.body));
  }

  // صلاحيات البوت في السيرفر
  const member = await get(`/guilds/${GUILD}/members/@me`);
  console.log(`\nGET bot member → ${member.status}`);
  if (member.status === 200) {
    console.log('  roles:', JSON.stringify(member.body.roles));
  }
})();
