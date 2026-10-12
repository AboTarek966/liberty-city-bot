"use strict";
// ============================================
// Liberty City Bot - استبيان رضا التذاكر (⭐ 1-5)
// يصل للعضو في رسالة خاصة بعد إغلاق تذكرته
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('TicketSurvey');
const handler = {
    id: 'ticket_survey',
    async execute(interaction) {
        const parts = interaction.customId.split(':');
        const ticketDbId = parts[1];
        const stars = Number.parseInt(parts[2], 10);
        if (!ticketDbId || !Number.isInteger(stars) || stars < 1 || stars > 5) {
            await interaction.reply({ content: '❌ تقييم غير صالح', ephemeral: true });
            return;
        }
        await interaction.deferUpdate(); // ✅ فوراً قبل أي عملية أخرى
        const ticket = await models_1.Ticket.findById(ticketDbId).catch(() => null);
        if (!ticket) {
            await interaction.editReply({ content: '❌ لم يتم العثور على التذكرة' });
            return;
        }
        if (ticket.userId !== interaction.user.id) {
            await interaction.reply({ content: '❌ هذا التقييم ليس لك', ephemeral: true });
            return;
        }
        // تسجيل التقييم في قناة سجلات التذاكر
        try {
            const guild = interaction.client.guilds.cache.get(ticket.guildId);
            if (guild) {
                const settings = await (0, models_1.getGuildSettings)(guild.id);
                const logId = settings.tickets.logChannelId || settings.logging.channelId;
                const logChannel = logId ? guild.channels.cache.get(logId) : null;
                if (logChannel && 'send' in logChannel) {
                    await logChannel.send({
                        embeds: [
                            (0, embeds_1.createEmbed)({
                                title: `⭐ تقييم عضو جديد — ${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)} (${stars}/5)`,
                                description: `> 👤 العضو: <@${ticket.userId}>\n` +
                                    `> 📂 نوع التذكرة: ${ticket.type}\n` +
                                    `> 📅 أُغلقت: ${ticket.closedAt ? `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:R>` : 'غير معروف'}`,
                                color: stars >= 4 ? embeds_1.Colors.success : stars === 3 ? embeds_1.Colors.warning : embeds_1.Colors.error,
                                footer: { text: 'Liberty City Ticket Surveys' },
                            }),
                        ],
                    });
                }
            }
        }
        catch (error) {
            logger.error('Failed to log survey rating:', error);
        }
        await interaction.editReply({
            embeds: [
                (0, embeds_1.createEmbed)({
                    title: 'شكراً لك! 💙',
                    description: `قيّمت تجربتك بـ **${'⭐'.repeat(stars)}** (${stars}/5)\nرأيك يساعدنا على تحسين خدمة الدعم`,
                    color: embeds_1.Colors.success,
                }),
            ],
            components: [],
        });
    },
};
exports.default = handler;
//# sourceMappingURL=ticketSurvey.js.map