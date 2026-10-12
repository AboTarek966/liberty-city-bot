"use strict";
// ============================================
// Liberty City Bot - شراء عنصر من المتجر (shop_buy)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const handler = {
    id: 'shop_buy',
    async execute(interactionRaw) {
        const interaction = interactionRaw;
        await interaction.deferUpdate(); // ✅ فوراً قبل أي عملية أخرى
        const itemId = interaction.values[0];
        const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
        const shop = settings.shop;
        const item = (shop?.items || []).find((it) => it.id === itemId);
        if (!shop?.enabled) {
            await interaction.editReply({ content: '🔒 تم إغلاق المتجر — لم يتم الشراء', components: [], embeds: [] });
            return;
        }
        if (!item) {
            await interaction.editReply({ content: '❌ هذا العنصر لم يعد موجوداً في المتجر', components: [], embeds: [] });
            return;
        }
        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(item.roleId);
        if (!role) {
            await interaction.editReply({ content: '❌ رول هذا العنصر لم يعد موجوداً — تواصل مع الإدارة', components: [], embeds: [] });
            return;
        }
        if (member.roles.cache.has(item.roleId)) {
            await interaction.editReply({ content: `❌ أنت تملك ${role} بالفعل — لا داعي للشراء`, components: [], embeds: [] });
            return;
        }
        const profile = await models_1.UserProfile.findOne({
            userId: interaction.user.id,
            guildId: interaction.guildId,
        }).catch(() => null);
        if (!profile || profile.balance < item.price) {
            await interaction.editReply({
                content: `❌ رصيدك غير كافٍ — تحتاج **${(0, helpers_1.formatNumber)(item.price)}** ولديك **${(0, helpers_1.formatNumber)(profile?.balance || 0)}**`,
                components: [],
                embeds: [],
            });
            return;
        }
        // فحص أولوية الرول قبل الإضافة
        const me = interaction.guild.members.me;
        if (!me || role.position >= me.roles.highest.position) {
            await interaction.editReply({
                content: `❌ لا أستطيع إعطاء ${role} — تأكد أن رتبتي أعلى منه`,
                components: [],
                embeds: [],
            });
            return;
        }
        profile.balance -= item.price;
        await profile.save();
        const added = await member.roles.add(role, 'Liberty City - Shop purchase').catch(() => null);
        if (!added) {
            // إرجاع المبلغ إذا فشلت إضافة الرول
            profile.balance += item.price;
            await profile.save();
            await interaction.editReply({
                content: '❌ فشلت إضافة الرول (قد تكون رتبتي نازلة) — لم يتم خصم أي مبلغ',
                components: [],
                embeds: [],
            });
            return;
        }
        await interaction.editReply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embeds_1.Colors.success)
                    .setTitle('🛍️ تم الشراء بنجاح!')
                    .setDescription(`اشتريت **${item.name}** بسعر **${(0, helpers_1.formatNumber)(item.price)}** 💰\n` +
                    `أُضيفت إليك ${role}\n` +
                    `رصيدك الآن: **${(0, helpers_1.formatNumber)(profile.balance)}**`)
                    .setTimestamp(),
            ],
            components: [],
        });
    },
};
exports.default = handler;
//# sourceMappingURL=shopBuy.js.map