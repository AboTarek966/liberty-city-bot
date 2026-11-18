"use strict";
// ============================================
// Omni Bot - 📢 متجر Omni (زر إعلان — كتابة/اعتماد/رفض)
// المشتري: اكتب إعلانك بعد الدفع تلقائياً  • البائع: اعتمد ✅ أو ارفض ❌
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const store_1 = require("../../utils/store");
const models_1 = require("../../models");
const handler = {
    id: 'store:ad',
    async execute(interaction) {
        const parts = interaction.customId.split(':');
        const action = parts[2];
        const orderId = parts[3];
        const order = await models_1.StoreOrder.findOne({ orderId });
        if (!order) {
            await interaction.reply({ content: '❌ لم يتم العثور على هذا الطلب', ephemeral: true });
            return;
        }
        // ---------- 📢 اكتب إعلانك — للمشتري فقط ----------
        if (action === 'compose') {
            if (order.buyerId !== interaction.user.id) {
                await interaction.reply({ content: '⛔ هذا الزر لصاحب الطلب فقط.', ephemeral: true });
                return;
            }
            if (order.status !== 'paid') {
                await interaction.reply({ content: 'ℹ️ لم يتأكد دفعك بعد — ينفتح نموذج الإعلان بعد تأكيد الدفع.', ephemeral: true });
                return;
            }
            if (order.adStatus === 'approved') {
                await interaction.reply({ content: '✅ إعلانك معتمد — لا يحتاج إعادة كتابة. شكراً لك!', ephemeral: true });
                return;
            }
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`store:ad:compose:${order.orderId}`)
                .setTitle('📢 اكتب إعلانك')
                .addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
                .setCustomId('ad_text')
                .setLabel('نص الإعلان')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder('اكتب إعلانك بالتفصيل... ماتقدمه، مميزاته، كيف يتواصل معك، أي عرض خاص')
                .setMaxLength(4000)
                .setRequired(true)), new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
                .setCustomId('ad_link')
                .setLabel('رابط دعوة سيرفرك')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('https://discord.gg/xxxxxxxxx')
                .setMaxLength(200)
                .setRequired(true)));
            await interaction.showModal(modal);
            return;
        }
        // ---------- ✅/❌ — للبائع أو من يدير المتجر فقط ----------
        const isPayee = !!order.payeeId && order.payeeId === interaction.user.id;
        const isStaff = await (0, store_1.canManageStore)(interaction.client, interaction.user.id);
        if (!isPayee && !isStaff) {
            await interaction.reply({ content: '⛔ هذا الزر لبائع الطلب أو من يدير المتجر فقط.', ephemeral: true });
            return;
        }
        if (order.adStatus !== 'submitted') {
            await interaction.reply({ content: 'ℹ️ ما فيه إعلان بانتظار اعتمادك — المشتري لسه ما كتب إعلانه.', ephemeral: true });
            return;
        }
        // ---------- ✅ اعتماد الإعلان ----------
        if (action === 'approve') {
            order.adStatus = 'approved';
            await order.save();
            const meta = (0, store_1.storeTypeMeta)(order.itemType ?? 'ad');
            const copyEmbed = new discord_js_1.EmbedBuilder()
                .setColor(0x57f287)
                .setTitle('✅ تم اعتماد إعلانك — تفضل نص جاهز تنشره')
                .setDescription(order.adText?.slice(0, 4000) || '—')
                .addFields({
                name: '🔗 الدعوة',
                value: order.adLink
                    ? `[${order.adLink}](${order.adLink})`
                    : 'غير محدد',
            })
                .setTimestamp()
                .setFooter({ text: `Omni Store • إعلان معتمد — طلب #${order.orderId}` });
            await interaction
                .update({
                content: `📢 **عتم ${interaction.user} الإعلان** — طلب #${order.orderId}\n> تفضل الإعلان جاهز للنشر في أي مكان (روم إعلانات، بوستات، مواقع...)\n> نص الإعلان أدناه — انسخه أو انشره.`,
                embeds: [copyEmbed],
                components: [],
            })
                .catch(() => { });
            // إشعار المشتري بالخاص
            try {
                const buyer = await interaction.client.users.fetch(order.buyerId).catch(() => null);
                if (buyer) {
                    await buyer
                        .send({
                        embeds: [
                            new discord_js_1.EmbedBuilder()
                                .setColor(0x57f287)
                                .setTitle('🎉 تم اعتماد إعلانك ونشره!')
                                .setDescription(`${meta.emoji} **الطلب:** #${order.orderId}\n\nنص إعلانك المعتمد:\n\n${order.adText?.slice(0, 3500) || ''}\n\n🔗 ${order.adLink || ''}`)
                                .setTimestamp(),
                        ],
                    })
                        .catch(() => { });
                }
            }
            catch {
                /* تجاهل */
            }
            return;
        }
        // ---------- ❌ رفض الإعلان ----------
        if (action === 'reject') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`store:ad:reject:${order.orderId}`)
                .setTitle('❌ سبب الرفض (اختياري)')
                .addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
                .setCustomId('reason')
                .setLabel('السبب — يصل للمشتري (اختياري)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('مثال: محتوى/رابط غير مناسب — أو بدون سبب')
                .setMaxLength(200)
                .setRequired(false)));
            await interaction.showModal(modal);
            return;
        }
    },
};
exports.default = handler;
//# sourceMappingURL=storeAd.js.map