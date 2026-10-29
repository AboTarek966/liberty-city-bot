"use strict";
// ============================================
// Liberty City Bot - Rank Command (بطاقة المستوى التفاعلية)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTopEmbed = buildTopEmbed;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
function topButton(userId) {
    return new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`rank:top`)
        .setLabel('🏆 التوب')
        .setStyle(discord_js_1.ButtonStyle.Primary)
        .setEmoji('🏆'), new discord_js_1.ButtonBuilder()
        .setCustomId(`rank:refresh:${userId}`)
        .setLabel('🔄 تحديث')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🔄'));
}
async function buildTopEmbed(client, guildId) {
    const top = await client.levelingHandler.getTopMembers(guildId, 10);
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const lines = top.length
        ? top.map((p, i) => {
            const medal = medals[i] || `**${i + 1}.**`;
            return `${medal} <@${p.userId}> — المستوى \`${p.level}\` • \`${p.xp}\` XP`;
        })
        : ['📭 لا توجد بيانات بعد'];
    return new discord_js_1.EmbedBuilder()
        .setColor(embeds_1.Colors.warning)
        .setTitle('🏆 لوحة المتصدرين — المستويات')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'استخدم /rank لعرض بطاقتك' })
        .setTimestamp();
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('rank')
        .setDescription('📈 عرض بطاقة المستوى والخبرة — لك أو لأي عضو')
        .addUserOption(option => option.setName('user').setDescription('العضو المراد عرض بطاقته (اختياري)').setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        const client = interaction.client;
        const target = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild?.members.cache.get(target.id) ||
            (await interaction.guild?.members.fetch(target.id).catch(() => null));
        if (!member) {
            await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
            return;
        }
        const card = await client.levelingHandler.buildRankCard(member);
        await interaction.reply({
            embeds: [card],
            components: [topButton(target.id)],
        });
    },
};
exports.default = command;
//# sourceMappingURL=rank.js.map