"use strict";
// ============================================
// Omni Bot - متجر البروجيكتات (زر تأكيد الشراء)
// ينشئ الطلب ويعرض أمر الدفع بالكريديت
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const models_1 = require("../../models");
const handler = {
    id: 'store:confirm',
    async execute(interaction) {
        const projectId = interaction.customId.split(':')[2];
        if (!projectId)
            return;
        const store = await (0, store_1.getStore)();
        const project = store && (0, store_1.findProject)(store, projectId);
        if (!store || !project || !project.enabled) {
            await interaction.reply({
                content: '❌ هذا البروجيكت غير متاح حالياً.',
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
        const amount = (0, store_1.computeTransferAmount)(project.price, tax);
        // ♻︎ منع تكرار طلبات مفتوحة لنفس المشروع ونفس المشتري خلال 15 دقيقة
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
                price: project.price,
                amount,
                taxPercent: tax,
                payeeId: store.payeeId,
                probotPrefix: store.probotPrefix || '!',
                buyerId: interaction.user.id,
                guildId: interaction.guildId ?? undefined,
            }));
        const transferCommand = (0, store_1.buildTransferCommand)(store.payeeId, amount);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('💳 أمر الدفع جاهز — انسخه ونفذه في الشات')
            .setDescription([
            `📦 **البروجيكت:** ${project.name}`,
            `🧾 **الطلب:** #${order.orderId}`,
            '',
            `💰 **السعر الصافي (يوصلك البائع):** ${(0, store_1.priceLine)(project.price)} كريديت`,
            `🧾 **خصم ProBot:** ${tax}% من كل تحويل`,
            `💳 **المطلوب تحويله:** ${(0, store_1.formatCredits)(amount)} كريديت`,
            '',
            '**📋 أمر التحويل (انسخه حرفيًا):**',
            `\`\`\`${transferCommand}\`\`\``,
            '',
            `> ⬆️ انسخ الأمر وأرسله في أي روم يقرأ البوت — الصيغة: \`credit ${store.payeeId} ${amount}#\``,
            '> 💡 المبلغ مظبوط يصلك **صافي** على سعر البروجيكت بعد خصم ProBot.',
        ].join('\n'))
            .setFooter({ text: 'Omni Store • انتظر تأكيد البائع من بلوك الإيصال' })
            .setTimestamp();
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
            .setLabel('رجوع')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('↩️'));
        await interaction.update({ embeds: [embed], components: [row] });
    },
};
exports.default = handler;
//# sourceMappingURL=storeConfirm.js.map