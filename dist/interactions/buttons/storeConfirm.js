"use strict";
// ============================================
// Omni Bot - 🛍️ متجر Omni (زر تأكيد الشراء)
// ينشئ الطلب ويعرض أمر الدفع بالكريديت
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const models_1 = require("../../models");
const handler = {
    id: 'store:confirm',
    async execute(interaction) {
        const parts = interaction.customId.split(':');
        const projectId = parts[2];
        const ownerId = parts[3];
        if (!projectId)
            return;
        if (ownerId && ownerId !== interaction.user.id) {
            await interaction.reply({
                content: '⛔ هذا الاختيار لصاحب الطلب فقط — اكتب `/store` واختر عنصرك الخاص.',
                ephemeral: true,
            });
            return;
        }
        const store = await (0, store_1.getStore)();
        const project = store && (0, store_1.findProject)(store, projectId);
        if (!store || !project || !project.enabled) {
            await interaction.reply({
                content: '❌ هذا العنصر غير متاح حالياً.',
                ephemeral: true,
            });
            return;
        }
        if (!(0, store_1.isItemInStock)(project)) {
            await interaction.reply({
                content: `⛔ **${project.name}** نفدت كميته حالياً — جرّب عنصراً آخر.`,
                ephemeral: true,
            });
            return;
        }
        if (!store.payeeId) {
            await interaction.reply({
                content: '❌ المتجر غير مهيأ بعد — أبلغ البائع يضبط المستلم عبر `/project config`.',
                ephemeral: true,
            });
            return;
        }
        const tax = Number(store.taxPercent ?? 5);
        const discount = (0, store_1.normalizeDiscountPercent)(project.discountPercent);
        const basePrice = Math.max(1, Math.floor(Number(project.price) || 0));
        const netPrice = (0, store_1.getEffectivePrice)(project);
        const amount = (0, store_1.computeTransferAmount)(netPrice, tax);
        const meta = (0, store_1.storeTypeMeta)(project.type);
        const emoji = (0, store_1.storeItemEmoji)(project);
        // ♻︎ منع تكرار طلبات مفتوحة لنفس العنصر ونفس المشتري خلال 15 دقيقة
        const since = new Date(Date.now() - 15 * 60_000);
        const existing = await models_1.StoreOrder.findOne({
            buyerId: interaction.user.id,
            projectId: project.id,
            status: 'pending',
            createdAt: { $gte: since },
        });
        const order = existing ??
            (await models_1.StoreOrder.create({
                orderId: (0, store_1.shortId)(6),
                projectId: project.id,
                projectName: project.name,
                itemType: project.type,
                itemEmoji: project.emoji,
                itemDeliveryNote: project.deliveryNote,
                price: netPrice,
                amount,
                taxPercent: tax,
                payeeId: store.payeeId,
                probotPrefix: store.probotPrefix || '!',
                buyerId: interaction.user.id,
                guildId: interaction.guildId ?? undefined,
            }));
        const transferCommand = (0, store_1.buildTransferCommand)(store.payeeId, amount);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(meta.color)
            .setTitle('💳 تفاصيل طلب الشراء — ظاهرة للكل')
            .setDescription([
            `${emoji} **العنصر:** ${project.name}`,
            `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
            `🧾 **الطلب:** #${order.orderId}`,
            '',
            discount
                ? `💰 **السعر الأساسي:** ~~${(0, store_1.priceLine)(basePrice)}~~ كريديت`
                : `💰 **السعر الصافي (يوصلك البائع):** ${(0, store_1.priceLine)(netPrice)} كريديت`,
            discount ? `🏷️ **خصم:** ${discount}% — **السعر بعد الخصم:** ${(0, store_1.priceLine)(netPrice)} كريديت` : null,
            `🧾 **خصم ProBot:** ${tax}% من كل تحويل`,
            `💳 **المطلوب تحويله:** ${(0, store_1.formatCredits)(amount)} كريديت`,
            project.deliveryNote?.trim() ? `📬 **التسليم:** ${project.deliveryNote.trim().slice(0, 180)}` : null,
            '',
            '**📋 أمر التحويل (للكل يشوفه):**',
            `\`\`\`${transferCommand}\`\`\``,
            '',
            '> ⬆️ المشتري يدوس **دفعت — طلب التسليم** بعد ما يدفع.',
        ]
            .filter(Boolean)
            .join('\n'))
            .setFooter({ text: 'Omni Store • انتظر تأكيد البائع من بلوك الإيصال' })
            .setTimestamp();
        if (project.imageUrl)
            embed.setThumbnail(project.imageUrl);
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`store:copy:${order.orderId}`)
            .setLabel('نسخ أمر الدفع')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('📋'), new discord_js_1.ButtonBuilder()
            .setCustomId(`store:paid:${order.orderId}`)
            .setLabel('دفعت — طلب التسليم')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('✅'), new discord_js_1.ButtonBuilder()
            .setCustomId('store:back')
            .setLabel('رجوع للمتجر')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('↩️'));
        await interaction.update({ embeds: [embed], components: [row] });
    },
};
exports.default = handler;
//# sourceMappingURL=storeConfirm.js.map