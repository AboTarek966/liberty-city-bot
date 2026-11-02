// language: JavaScript, file: register-nuke.js
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// بيقرأ التوكن من إعدادات الاستضافة بدون ما يتحط في الكود
const token = process.env.TOKEN || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
const clientId = '1557735350464417822'; 
const guildId = '1566450270093836428'; 

if (!token) {
    console.error("❌ التوكن مش موجود في الاستضافة! روح للوحة التحكم وحطه في الـ Environment Variables.");
    process.exit(1);
}

const commands = [
    new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('تخريب شامل بأقصى سرعة')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log('⏳ جاري تسجيل أمر /nuke...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
        console.log('✅ تم تسجيل أمر /nuke بنجاح في السيرفر!');
    } catch (error) {
        console.error('❌ حصل خطأ:', error);
    }
})();