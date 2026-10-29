"use strict";
// ============================================
// Liberty City Bot - Purge Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('purge')
        .setDescription('مسح رسائل من القناة')
        .addIntegerOption(option => option
        .setName('amount')
        .setDescription('عدد الرسائل (1-100)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100))
        .addBooleanOption(option => option
        .setName('all')
        .setDescription('حذف كل رسائل القناة بالكامل')
        .setRequired(false))
        .addUserOption(option => option
        .setName('user')
        .setDescription('مسح رسائل عضو معين فقط')
        .setRequired(false))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageMessages],
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const purgeAll = interaction.options.getBoolean('all');
        const targetUser = interaction.options.getUser('user');
        await interaction.deferReply({ ephemeral: true });
        const channel = interaction.channel;
        if (!channel || !channel.isTextBased() || !('bulkDelete' in channel)) {
            await interaction.editReply({
                content: '❌ لا يمكن مسح الرسائل في هذه القناة',
            });
            return;
        }
        // 🧹 حذف كل الرسائل
        if (purgeAll) {
            let total = 0;
            for (let i = 0; i < 30; i++) {
                const fetched = await channel.messages.fetch({ limit: 100 });
                if (fetched.size === 0)
                    break;
                const deleted = await channel.bulkDelete(fetched, true);
                total += deleted.size;
                if (deleted.size < fetched.size)
                    break;
                await new Promise(r => setTimeout(r, 1200));
            }
            await interaction.editReply({ content: `🧹 **تم حذف كل الرسائل — الإجمالي: ${total} رسالة**` });
            return;
        }
        if (!amount) {
            await interaction.editReply({ content: '❌ حدد عدد الرسائل أو فعّل خيار `all`' });
            return;
        }
        // Fetch messages
        const messages = await channel.messages.fetch({ limit: 100 });
        // Filter messages
        let messagesToDelete = Array.from(messages.values());
        if (targetUser) {
            messagesToDelete = messagesToDelete.filter(m => m.author.id === targetUser.id);
        }
        // Filter out old messages (older than 14 days)
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        messagesToDelete = messagesToDelete.filter(m => m.createdTimestamp > twoWeeksAgo);
        // Limit to amount
        messagesToDelete = messagesToDelete.slice(0, amount);
        if (messagesToDelete.length === 0) {
            await interaction.editReply({
                content: '❌ لا توجد رسائل للمسح',
            });
            return;
        }
        // Delete messages
        const deleted = await channel.bulkDelete(messagesToDelete, true);
        await interaction.editReply({ content: `🗑️ تم مسح **${deleted.size}** رسالة` + (targetUser ? ` من ${targetUser}` : '') });
    },
};
exports.default = command;
//# sourceMappingURL=purge.js.map