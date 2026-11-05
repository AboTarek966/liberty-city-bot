"use strict";
// ============================================
// Omni Bot - Ticket Reset (إعادة تعيين الاختيار)
// يعيد ضبط اختيار نوع التذكرة في اللوحة فقط —
// لا يحذف التذكرة المفتوحة ولا يغلقها.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const handler = {
    id: 'ticket_reset',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        const client = interaction.client;
        try {
            // 🔎 استخراج معرّف اللوحة من قائمة الاختيار داخل الرسالة
            let selectCustomId;
            for (const row of interaction.message.components) {
                for (const comp of row.components || []) {
                    // يدعم الصيغة الجديدة ticket_select_<panelId> والقديمة ticket_select
                    if (typeof comp.customId === 'string' && comp.customId.startsWith('ticket_select')) {
                        selectCustomId = comp.customId;
                        break;
                    }
                }
                if (selectCustomId)
                    break;
            }
            if (!selectCustomId) {
                await interaction.reply({
                    content: '❌ لم أجد قائمة أنواع التذاكر في هذه اللوحة.',
                    ephemeral: true,
                });
                return;
            }
            const panelId = selectCustomId.startsWith('ticket_select_')
                ? selectCustomId.slice('ticket_select_'.length)
                : '';
            const settings = await (0, models_1.getGuildSettings)(interaction.guild.id).catch(() => null);
            const panel = panelId
                ? (settings?.tickets?.panels || []).find((p) => p.id === panelId)
                : null;
            let components;
            if (panel) {
                // ✅ إعادة بناء اللوحة من الإعدادات = قائمة اختيار جديدة بلا تحديد
                components = client.ticketHandler.buildPanelComponents(panel);
            }
            else {
                // 🔁 احتياطي: إعادة بناء قائمة الاختيار من نفس الرسالة
                components = interaction.message.components.map((row) => {
                    const comp = (row.components || []).find((c) => typeof c.customId === 'string' && c.customId.startsWith('ticket_select_'));
                    if (!comp)
                        return row;
                    const menu = new discord_js_1.StringSelectMenuBuilder()
                        .setCustomId(comp.customId)
                        .setPlaceholder(comp.placeholder || '🎫 اختر نوع التذكرة');
                    const options = (comp.options || [])
                        .slice(0, 25)
                        .map((o) => ({
                        label: o.label,
                        value: o.value,
                        description: o.description || undefined,
                        emoji: o.emoji?.id ? o.emoji : undefined,
                    }))
                        .filter((o) => o.label && o.value);
                    if (options.length > 0)
                        menu.addOptions(options);
                    return new discord_js_1.ActionRowBuilder().addComponents(menu);
                });
            }
            // 🖥️ تحديث نفس رسالة اللوحة — يمسح التحديد من القائمة
            await interaction.update({ components });
            await interaction
                .followUp({
                content: '🔄 تم إلغاء الاختيار — اختر نوع التذكرة من جديد.\n(تذكرتك المفتوحة لم تُحذف ولم تُغلق)',
                ephemeral: true,
            })
                .catch(() => { });
        }
        catch (error) {
            await interaction
                .followUp({ content: `❌ حدث خطأ: ${error.message || 'غير معروف'}`, ephemeral: true })
                .catch(() => { });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketReset.js.map