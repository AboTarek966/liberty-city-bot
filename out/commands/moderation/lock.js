"use strict";
// ============================================
// Liberty City Bot - Lock Command (قفل الروم)
// يقفل الروم الحالي فقط — لا يفتحه.
// لفتح الروم استخدم /unlock أو اختصاره المستقل.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('lock')
        .setDescription('قفل الروم الحالي — منع الكتابة للجميع ما عدا الإدارة')
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
        if (isLocked) {
            await interaction.reply({
                content: `🔒 ${channel} مقفول بالفعل — استخدم \`/unlock\` لفتحه`,
                ephemeral: true,
            });
            return;
        }
        try {
            // 🔒 قفل — منع @everyone من الكتابة (من معه أدنمنستريتر يتجاوز القفل تلقائياً)
            await channel.permissionOverwrites.edit(everyone, { SendMessages: false, SendMessagesInThreads: false, AddReactions: false }, { reason: `قفل الروم بواسطة ${interaction.user.tag}` });
            await interaction.reply(`🔒 تم قفل ${channel} — الكتابة ممنوعة للجميع **ما عدا الإدارة (أدنمنستريتر)**\nلفتحه استخدم \`/unlock\``);
        }
        catch (error) {
            await interaction.reply({
                content: `❌ فشل قفل الروم: ${error.message}`,
                ephemeral: true,
            });
        }
    },
};
exports.default = command;
//# sourceMappingURL=lock.js.map