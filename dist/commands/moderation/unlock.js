"use strict";
// ============================================
// Liberty City Bot - Unlock Command (فتح الروم)
// يفتح الروم الحالي فقط — لا يقفله.
// للقفل استخدم /lock أو اختصاره المستقل.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('unlock')
        .setDescription('فتح الروم الحالي — إعادة الكتابة للجميع')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageChannels)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.ManageChannels],
    async execute(interaction) {
        const channel = interaction.channel;
        if (!channel ||
            !('permissionOverwrites' in channel) ||
            ![discord_js_1.ChannelType.GuildText, discord_js_1.ChannelType.GuildAnnouncement, discord_js_1.ChannelType.GuildForum].includes(channel.type)) {
            await interaction.reply({
                content: '❌ هذا الأمر يعمل فقط في قنوات نصية/إعلان/منتدى',
                ephemeral: true,
            });
            return;
        }
        const everyone = interaction.guild.roles.everyone;
        const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
        const isLocked = overwrite ? overwrite.deny.has(discord_js_1.PermissionFlagsBits.SendMessages) : false;
        if (!isLocked) {
            await interaction.reply({
                content: `🔓 ${channel} مفتوح بالفعل — استخدم \`/lock\` لقفله`,
                ephemeral: true,
            });
            return;
        }
        try {
            // 🔓 فتح — إزالة منع الكتابة (يستعيد الإعداد الطبيعي للروم)
            await channel.permissionOverwrites.edit(everyone, { SendMessages: null, SendMessagesInThreads: null, AddReactions: null }, { reason: `فتح الروم بواسطة ${interaction.user.tag}` });
            await interaction.reply(`🔓 تم فتح ${channel} — الكتابة متاحة للجميع مرة ثانية`);
        }
        catch (error) {
            await interaction.reply({
                content: `❌ فشل فتح الروم: ${error.message}`,
                ephemeral: true,
            });
        }
    },
};
exports.default = command;
//# sourceMappingURL=unlock.js.map