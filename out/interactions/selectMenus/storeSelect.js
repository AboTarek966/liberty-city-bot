"use strict";
// ============================================
// Omni Bot - متجر البروجيكتات (القائمة المنسدلة)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const handler = {
    id: 'store:select',
    async execute(interaction) {
        const select = interaction;
        if (!select.guild)
            return;
        await select.deferReply({ ephemeral: false });
        const projectId = select.values?.[0];
        const store = await (0, store_1.getStore)();
        const project = store && projectId ? (0, store_1.findProject)(store, projectId) : undefined;
        if (!store || !project || !project.enabled) {
            await select.editReply({
                content: '❌ هذا البروجيكت غير متاح حالياً — ربما أُزيل من المتجر أو أُوقف مؤقتاً.',
            });
            return;
        }
        const tax = Number(store.taxPercent ?? 5);
        const amount = (0, store_1.computeTransferAmount)(project.price, tax);
        const payee = store.payeeId;
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle('🛒 تأكيد طلب الشراء')
            .setDescription([
            `📦 **البروجيكت:** ${project.name}`,
            project.description?.trim() ? `📝 ${project.description.trim()}` : null,
            '',
            `💰 **السعر الصافي:** ${(0, store_1.priceLine)(project.price)} كريديت`,
            `🧾 **خصم ProBot:** ${tax}% على التحويلات`,
            `💳 **المطلوب تحويله:** ${(0, store_1.priceLine)(amount)} كريديت`,
            payee ? `👤 **المستلم:** <@${payee}>` : '👤 **المستلم:** غير مهيأ بعد — أبلغ البائع',
            '',
            '> بعد التأكيد بنعرض للكل ملخص الطلب — وأمر الدفع يفضل ظاهر بس للمشتري عبر الزر 📋.',
        ]
            .filter(Boolean)
            .join('\n'))
            .setFooter({ text: 'Omni Store • التأكيد قبل الدفع' })
            .setTimestamp();
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`store:confirm:${project.id}:${select.user.id}`)
            .setLabel('تأكيد الشراء')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('✅'), new discord_js_1.ButtonBuilder()
            .setCustomId('store:back')
            .setLabel('رجوع')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('↩️'));
        await select.editReply({ embeds: [embed], components: [row] });
    },
};
exports.default = handler;
//# sourceMappingURL=storeSelect.js.map