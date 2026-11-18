"use strict";
// ============================================
// Omni Bot - 🤖 تنفيذ طلبات المتجر (تأكيد الدفع + التسليم)
// منطق مشترك بين أمر البائع (زر «تم التسليم والاستلام») ووكيل الاكتشاف
// التلقائي للتحويل (#credit <payeeId> <amount>).
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.fulfillStoreOrder = fulfillStoreOrder;
const discord_js_1 = require("discord.js");
const helpers_1 = require("./helpers");
const models_1 = require("../models");
const store_1 = require("./store");
const logger = (0, helpers_1.createLogger)('StoreFulfill');
/**
 * يمسك الطلب ذرياً (status: pending → paid) ثم ينفّذ التسليم:
 *   زيادة مبيعات العنصر + خصم الكمية + منح رول التسليم + إيصال خاص للمشتري.
 * @returns تفاصيل ما تم (أو claimed=false لو سبق إنهاء الطلب)
 */
async function fulfillStoreOrder(client, input) {
    const { mode, orderId, notifyLog = false } = input;
    // 🔒 حجز ذرّي — يمنع تنفيذ نفس الطلب مرتين (زر + وكيل تلقائي بنفس اللحظة)
    const order = await models_1.StoreOrder.findOneAndUpdate({ orderId, status: 'pending' }, {
        $set: {
            status: 'paid',
            paidBy: input.actorLabel || (mode === 'auto' ? 'auto' : 'manual'),
            paidAt: new Date(),
        },
    }, { new: true });
    if (!order)
        return { claimed: false, alreadyDone: true };
    const store = await (0, store_1.getStore)(false).catch(() => null);
    const project = store && (0, store_1.findProject)(store, order.projectId);
    let projectIncluded = !!project;
    let stockLine = null;
    let totalSales;
    // 📊 زيادة عداد المبيعات + حسم الكمية من المخزون
    if (project) {
        project.sales = (project.sales || 0) + 1;
        totalSales = project.sales;
        if (project.stock !== undefined && project.stock !== null && project.stock > 0) {
            project.stock = Math.max(0, project.stock - 1);
            stockLine =
                project.stock === 0
                    ? '📦 الكمية: **نفدت بالكامل** بعد هذا الطلب'
                    : `📦 الكمية المتبقية: **${project.stock}**`;
        }
        await store.save().catch((err) => logger.warn(`store save failed: ${err?.message}`));
    }
    const meta = (0, store_1.storeTypeMeta)(order.itemType ?? project?.type);
    const emoji = order.itemEmoji || (project ? (0, store_1.storeItemEmoji)(project) : meta.emoji);
    // 🏷️ منح رول المشتري (إن وُجد مربوط بالعنصر ومكّنتنا الصلاحيات)
    let roleLine = null;
    const deliveryRoleId = project?.deliveryRoleId;
    if (deliveryRoleId) {
        const guild = input.guild ??
            (order.guildId && client ? client.guilds.cache.get(order.guildId) : null) ??
            null;
        if (!guild) {
            roleLine = '⚠️ تعذر منح رول المشتري — لم يُحدَّد السيرفر.';
        }
        else {
            const member = await guild.members.fetch(order.buyerId).catch(() => null);
            if (!member) {
                roleLine = '⚠️ تعذر جلب عضوية المشتري من السيرفر لمنحه الرول.';
            }
            else if (member.roles.cache.has(deliveryRoleId)) {
                roleLine = `🏷️ رول المشتري: <@&${deliveryRoleId}> — يملكه بالفعل ✅`;
            }
            else {
                try {
                    await member.roles.add(deliveryRoleId, `Omni Store — تسليم طلب #${order.orderId}`);
                    roleLine = `🏷️ رول المشتري: <@&${deliveryRoleId}> ✅ تم منحه`;
                }
                catch {
                    roleLine = `⚠️ رول المشتري: <@&${deliveryRoleId}> — تعذر منحه (رتبة البوت/الصلاحيات أو الرول غير موجود)`;
                }
            }
        }
    }
    // 📲 إيصال الدفع للمشتري في الخاص
    try {
        if (client) {
            const buyer = await client.users.fetch(order.buyerId).catch(() => null);
            if (buyer) {
                const receipt = new discord_js_1.EmbedBuilder()
                    .setColor(0x57f287)
                    .setTitle(mode === 'auto' ? '🎉 وصل دفعك وتم التسليم تلقائياً — شكراً لك!' : '🎉 وصل دفعك وتم التسليم — شكراً لك!')
                    .setDescription([
                    `${emoji} **العنصر:** ${order.projectName}`,
                    `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
                    `🧾 **طلب:** #${order.orderId}`,
                    `💰 **المبلغ:** ${(0, store_1.formatCredits)(order.amount)} كريديت (صافي ${(0, store_1.formatCredits)(order.price)})`,
                    project?.deliveryNote?.trim()
                        ? `\n📬 **تعليمات التسليم:**\n> ${project.deliveryNote.trim().slice(0, 500)}`
                        : (order.itemDeliveryNote || '').trim()
                            ? `\n📬 **تعليمات التسليم:**\n> ${(order.itemDeliveryNote || '').trim().slice(0, 500)}`
                            : null,
                    '',
                    'لو عندك أي استفسار عن العنصر بعد التسليم، تواصل مع البائع مباشرة.',
                ]
                    .filter(Boolean)
                    .join('\n'))
                    .setTimestamp()
                    .setFooter({ text: 'Omni Store • شكراً لثقتك' });
                if (project?.imageUrl)
                    receipt.setThumbnail(project.imageUrl);
                await buyer.send({ embeds: [receipt] }).catch(() => { });
            }
        }
    }
    catch {
        /* تجاهل */
    }
    // 🔔 بطاقة إشعار للبائع/قناة السجل — خاصة بمسار الاكتشاف التلقائي
    if (notifyLog && client) {
        const payeeId = order.payeeId || store?.payeeId;
        const logChannelId = store?.logChannelId;
        const confirmedEmbed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('🤖 تم التسليم تلقائياً — اكتُشف أمر الدفع')
            .setDescription([
            `${emoji} **العنصر:** ${order.projectName}`,
            `🏷️ **النوع:** ${meta.emoji} ${meta.label}`,
            `🧾 **الطلب:** #${order.orderId}`,
            `💰 **الصافي:** ${(0, store_1.formatCredits)(order.price)} كريديت`,
            `👤 **الدفع تم من المشتري:** <@${order.buyerId}> (\`${order.buyerId}\`)`,
            `💳 **أمر الدفع المتطابقة:** \`${(0, store_1.buildTransferCommand)(payeeId || '', order.amount)}\``,
            '',
            project ? `📊 إجمالي مبيعات هذا العنصر: **${project.sales}**` : null,
            stockLine,
            roleLine,
            '',
            '> 🤖 البوت رصد تحويل كريديت مطابق تماماً للمبلغ وأمر الدفع الخاص بالطلب — سُجّل الدفع فوراً وتم التسليم.',
        ]
            .filter(Boolean)
            .join('\n'))
            .setTimestamp()
            .setFooter({ text: 'Omni Store • تأكيد تلقائي' });
        try {
            let delivered = false;
            if (logChannelId) {
                const channel = input.guild?.channels.cache.get(logChannelId) ??
                    (await client.channels.fetch(logChannelId).catch(() => null));
                if (channel?.isTextBased?.()) {
                    await channel.send({ embeds: [confirmedEmbed] });
                    delivered = true;
                }
            }
            if (!delivered && payeeId) {
                const payee = await client.users.fetch(payeeId).catch(() => null);
                if (payee)
                    await payee.send({ embeds: [confirmedEmbed] }).catch(() => { });
            }
        }
        catch {
            /* تجاهل */
        }
    }
    if (mode === 'auto') {
        logger.info(`🤖 Auto-fulfilled order #${order.orderId} (${order.projectName}) | buyer=${order.buyerId} | amount=${order.amount} | sales=${totalSales ?? 'n/a'}`);
    }
    return { claimed: true, totalSales, stockLine, roleLine, projectIncluded };
}
//# sourceMappingURL=storeFulfill.js.map