"use strict";
// ============================================
// Liberty City Bot - Giveaway Entry Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const giveaway_1 = require("../../utils/giveaway");
const handler = {
    id: 'giveaway:entry',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        const shortId = interaction.customId.split(':')[2];
        if (!shortId) {
            await interaction.reply({ content: '❌ زر سحب غير صالح', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const member = interaction.guild.members.cache.get(interaction.user.id) ||
            (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
        if (!member) {
            await interaction.editReply({ content: '❌ لم يتم العثور على عضويتك' });
            return;
        }
        const result = await (0, giveaway_1.toggleGiveawayEntry)(interaction.client, interaction.guild.id, shortId, member);
        if (!result.ok) {
            await interaction.editReply({ content: `❌ ${result.reason}` });
            return;
        }
        if (result.left) {
            await interaction.editReply({
                content: `🚪 **تم انسحابك من السحب** — يمكنك المشاركة مجدداً في أي وقت قبل انتهائه.`,
            });
            return;
        }
        await interaction.editReply({
            content: `🎉 **تم تسجيل مشاركتك!**\n` +
                `> 🎁 الجائزة: **${result.giveaway?.prize}**\n` +
                `> 👥 عدد المشاركين الآن: \`${result.giveaway?.entries.length ?? 0}\`\n\n` +
                `حظاً موفقاً! 🍀`,
        });
    },
};
exports.default = handler;
//# sourceMappingURL=giveawayEntry.js.map