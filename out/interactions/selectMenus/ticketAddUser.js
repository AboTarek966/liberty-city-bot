"use strict";
// ============================================
// Liberty City Bot - Ticket Add User (UserSelectMenu)
// اختيار أعضاء من قائمة لإضافتهم للتذكرة (بديل حديث عن المودال)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const handler = {
    id: 'ticket_add_user',
    async execute(interaction) {
        const userSelect = interaction;
        const client = userSelect.client;
        if (!userSelect.guild || !userSelect.channelId)
            return;
        await userSelect.deferReply({ ephemeral: true });
        try {
            const byMember = await userSelect.guild.members.fetch(userSelect.user.id);
            if (!byMember.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels)) {
                await userSelect.editReply({ content: '❌ تحتاج صلاحية إدارة القنوات لإضافة أعضاء' });
                return;
            }
            const added = [];
            const skipped = [];
            for (const userId of userSelect.values.slice(0, 5)) {
                if (userId === userSelect.user.id) {
                    skipped.push('نفسك');
                    continue;
                }
                const member = await userSelect.guild.members.fetch(userId).catch(() => null);
                if (!member) {
                    skipped.push(`<@${userId}>`);
                    continue;
                }
                if (member.user.bot) {
                    skipped.push(`${member} (بوت)`);
                    continue;
                }
                await client.ticketHandler.addMemberToTicket(userSelect.channelId, member, byMember);
                added.push(member.toString());
            }
            const parts = [];
            if (added.length > 0)
                parts.push(`✅ تمت إضافة: ${added.join(' ')}`);
            if (skipped.length > 0)
                parts.push(`⚠️ تم تجاهل: ${skipped.join(' ')}`);
            await userSelect.editReply({ content: parts.join('\n') || '❌ لم تتم إضافة أحد' });
        }
        catch (error) {
            await userSelect.editReply({ content: `❌ ${error.message || 'حدث خطأ'}` });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketAddUser.js.map