"use strict";
// ============================================
// Omni Bot - 🛍️ متجر Omni (القائمة المنسدلة)
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
        // 🧪 لو القائمة جاية من معاينة خاصة (ephemeral) نخلي تفاصيل الطلب خاصة برضه
        const fromEphemeral = Boolean(select.message?.flags?.has(discord_js_1.MessageFlags.Ephemeral));
        await select.deferReply({ ephemeral: fromEphemeral });
        const projectId = select.values?.[0];
        const store = await (0, store_1.getStore)();
        const project = store && projectId ? (0, store_1.findProject)(store, projectId) : undefined;
        if (!store || !project || !project.enabled) {
            await select.editReply({
                content: '❌ هذا العنصر غير متاح حالياً — ربما أُزيل من المتجر أو أُوقف مؤقتاً.',
            });
            return;
        }
        if (!(0, store_1.isItemInStock)(project)) {
            await select.editReply({
                content: `⛔ **${project.name}** نفدت كميته حالياً — جرّب عنصراً آخر أو تواصل مع البائع.`,
            });
            return;
        }
        const meta = (0, store_1.storeTypeMeta)(project.type);
        const emoji = (0, store_1.storeItemEmoji)(project);
        const tax = Number(store.taxPercent ?? 5);
        const discount = (0, store_1.normalizeDiscountPercent)(project.discountPercent);
        const effectivePrice = (0, store_1.getEffectivePrice)(project);
        const amount = (0, store_1.computeTransferAmount)(effectivePrice, tax);
        const payee = store.payeeId;
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(meta.color)
            .setTitle('🛒 تأكيد طلب الشراء')
            .setDescription([
            `${emoji} **العنصر:** ${project.name}`,
            `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
            project.description?.trim() ? `📝 ${project.description.trim()}` : null,
            project.stock !== undefined ? `📦 **المتاح:** ${project.stock}` : null,
            '',
            discount
                ? `💰 **السعر الأساسي:** ~~${(0, store_1.priceLine)(project.price)}~~ كريديت`
                : `💰 **السعر الصافي:** ${(0, store_1.priceLine)(effectivePrice)} كريديت`,
            discount ? `🏷️ **خصم ${discount}%** — السعر بعد الخصم: ${(0, store_1.priceLine)(effectivePrice)} كريديت` : null,
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
        if (project.imageUrl)
            embed.setImage(project.imageUrl);
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`store:confirm:${project.id}:${select.user.id}`)
            .setLabel('تأكيد الشراء')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('✅'), new discord_js_1.ButtonBuilder()
            .setCustomId('store:back')
            .setLabel('رجوع للمتجر')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('↩️'));
        await select.editReply({ embeds: [embed], components: [row] });
    },
};
exports.default = handler;
//# sourceMappingURL=storeSelect.js.map