"use strict";
// ============================================
// Liberty City Bot - Ticket Type Select Menu
// القيمة المختارة = اسم النوع، ويصبح اسم قناة التذكرة بذلك الاسم
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const models_1 = require("../../models");
// محاولة مساعدة للألواح القديمة (قيم كانت معرفات حقول)
const legacyNames = {
    support: 'دعم فني',
    inquiry: 'استفسار',
    report: 'إبلاغ',
};
const handler = {
    id: 'ticket_select',
    async execute(interaction) {
        const selectInteraction = interaction;
        const client = selectInteraction.client;
        if (!selectInteraction.guild)
            return;
        await selectInteraction.deferReply({ ephemeral: true });
        try {
            const member = await selectInteraction.guild.members.fetch(selectInteraction.user.id);
            const panelId = selectInteraction.customId.replace('ticket_select_', '');
            const value = selectInteraction.values[0];
            // حل القيمة → اسم النوع (من خيارات اللوحة أو القيم القديمة أو النص الخام)
            let type = value;
            const settings = await (0, models_1.getGuildSettings)(selectInteraction.guild.id).catch(() => null);
            const panel = settings?.tickets?.panels?.find((p) => p.id === panelId);
            if (panel) {
                const opt = (panel.options || []).find((o) => o.label === value);
                if (opt) {
                    type = opt.label;
                }
                else {
                    const field = (panel.fields || []).find((f) => f.id === value || f.label === value);
                    if (field)
                        type = field.label;
                }
            }
            if (legacyNames[type])
                type = legacyNames[type];
            const ticket = await client.ticketHandler.createTicket({
                guild: selectInteraction.guild,
                user: member,
                type,
                panelId,
            });
            await selectInteraction.editReply({
                content: `✅ تم إنشاء تذكرتك (${type}) بنجاح: <#${ticket.channelId}>`,
            });
        }
        catch (error) {
            await selectInteraction.editReply({
                content: `❌ ${error.message || 'حدث خطأ أثناء إنشاء التذكرة'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketSelect.js.map