"use strict";
// ============================================
// Liberty City Bot - Shop Command (متجر السيرفر)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('shop')
        .setDescription('🛍️ متجر السيرفر — اشترِ رولات باستخدام رصيدك')
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        await interaction.deferReply();
        const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
        const shop = settings.shop;
        const items = shop?.items || [];
        if (!shop?.enabled) {
            await interaction.editReply({ content: '🔒 المتجر مغلق حالياً — تواصل مع الإدارة' });
            return;
        }
        if (items.length === 0) {
            await interaction.editReply({ content: '🛍️ المتجر فارغ حالياً — تواصل مع الإدارة' });
            return;
        }
        const profile = await models_1.UserProfile.findOne({
            userId: interaction.user.id,
            guildId: interaction.guildId,
        }).catch(() => null);
        const balance = profile?.balance || 0;
        const list = items
            .map((it) => `**${it.name}** — 💰 \`${(0, helpers_1.formatNumber)(it.price)}\` → <@&${it.roleId}>`)
            .join(' • ');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embeds_1.Colors.primary)
            .setTitle('🛍️ متجر السيرفر')
            .setDescription(`**رصيدك الحالي:** 💰 \`${(0, helpers_1.formatNumber)(balance)}\` • ` +
            `اختر عنصراً من القائمة بالأسفل للشراء — سيُخصم المبلغ ويصلك الرول فوراً\n\n` +
            `${list}`);
        const select = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId('shop_buy')
            .setPlaceholder('🛍️ اختر العنصر الذي تريد شراؤه')
            .addOptions(items.slice(0, 25).map((it) => ({
            label: `${it.name} — ${it.price}`,
            description: `سعر: ${it.price} عملة`,
            value: it.id,
        })));
        await interaction.editReply({
            embeds: [embed],
            components: [new discord_js_1.ActionRowBuilder().addComponents(select)],
        });
    },
};
exports.default = command;
//# sourceMappingURL=shop.js.map