"use strict";
// ============================================
// Poll - Vote Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../../models");
const poll_1 = require("../../commands/fun/poll");
const handler = {
    id: 'poll',
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true }); // ✅ منع انتهاء الصلاحية
        const idx = parseInt(interaction.customId.split('|')[1], 10);
        const poll = await models_1.Poll.findOne({ messageId: interaction.message.id });
        if (!poll) {
            await interaction.editReply({ content: '❌ هذا الاستطلاع لم يعد موجوداً' });
            return;
        }
        if (!poll.active) {
            await interaction.editReply({ content: '🔒 انتهى هذا الاستطلاع' });
            return;
        }
        if (isNaN(idx) || idx < 0 || idx >= poll.options.length) {
            await interaction.editReply({ content: '❌ خيار غير صالح' });
            return;
        }
        const userId = interaction.user.id;
        const votedIndex = poll.options.findIndex(o => o.votes.includes(userId));
        let message;
        if (votedIndex === idx) {
            // إلغاء الصوت
            poll.options[idx].votes = poll.options[idx].votes.filter((id) => id !== userId);
            message = '🗳️ تم إلغاء صوتك';
        }
        else {
            // إزالة الصوت القديم إن وجد ثم تصويت جديد
            if (votedIndex !== -1) {
                poll.options[votedIndex].votes = poll.options[votedIndex].votes.filter((id) => id !== userId);
            }
            poll.options[idx].votes.push(userId);
            message = `✅ تم تسجيل صوتك على: **${poll.options[idx].text}**`;
        }
        await poll.save();
        // تحديث رسالة الاستطلاع
        try {
            const { embed, components } = (0, poll_1.buildPollEmbed)(poll);
            await interaction.message.edit({ embeds: [embed], components });
        }
        catch {
            /* تجاهل */
        }
        await interaction.editReply({ content: message });
    },
};
exports.default = handler;
//# sourceMappingURL=pollVote.js.map