"use strict";
// ============================================
// Liberty City Bot - Ticket Add Member Modal
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const handler = {
    id: 'ticket_add_member_modal',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true }); // ✅ منع انتهاء الصلاحية
        const raw = interaction.fields.getTextInputValue('member_id').trim();
        // Extract ID from mention or raw ID
        const idMatch = raw.match(/^<@!?(\d+)>$/) || raw.match(/^(\d+)$/);
        if (!idMatch) {
            await interaction.editReply({
                content: '❌ معرّف غير صالح. استخدم رقم المعرّف أو المنشن',
            });
            return;
        }
        const userId = idMatch[1];
        try {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (!member) {
                await interaction.editReply({ content: '❌ العضو غير موجود في السيرفر' });
                return;
            }
            if (member.user.bot) {
                await interaction.editReply({ content: '❌ لا يمكن إضافة بوت' });
                return;
            }
            const byMember = await interaction.guild.members.fetch(interaction.user.id);
            if (!byMember.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
                await interaction.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات' });
                return;
            }
            if (!interaction.channelId) {
                await interaction.editReply({ content: '❌ هذه التذكرة غير صالحة' });
                return;
            }
            await client.ticketHandler.addMemberToTicket(interaction.channelId, member, byMember);
            await interaction.editReply({
                content: `✅ تمت إضافة ${member} للتذكرة`,
            });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketAddMember.js.map