// language: JavaScript, file: register-nuke.js
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// البيانات التي أرسلتها
const token = 'MTU1NzczNTM1MDQ2NDQxNzgyMg.GJ8EGW.I52itfL8fCf7KAE6RAg148iJQrKHnEbQPIRT2A';
const clientId = '1557735350464417822';
const guildId = '1566450270093836428'; // الأيدي بتاع السيرفر

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