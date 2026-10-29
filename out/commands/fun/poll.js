"use strict";
// ============================================
// Liberty City Bot - Poll Command (الاستطلاعات)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPollEmbed = buildPollEmbed;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const models_1 = require("../../models");
const MAX_OPTIONS = 6;
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('poll')
        .setDescription('📊 استطلاع رأي — تصويت مباشر بالأزرار')
        .addStringOption(opt => opt.setName('question').setDescription('السؤال').setRequired(true).setMaxLength(300))
        .addStringOption(opt => opt.setName('option1').setDescription('الخيار 1').setRequired(true).setMaxLength(100))
        .addStringOption(opt => opt.setName('option2').setDescription('الخيار 2').setRequired(true).setMaxLength(100))
        .addStringOption(opt => opt.setName('option3').setDescription('الخيار 3').setMaxLength(100))
        .addStringOption(opt => opt.setName('option4').setDescription('الخيار 4').setMaxLength(100))
        .addStringOption(opt => opt.setName('option5').setDescription('الخيار 5').setMaxLength(100))
        .addStringOption(opt => opt.setName('option6').setDescription('الخيار 6').setMaxLength(100)),
    cooldown: 10,
    async execute(interaction) {
        const client = interaction.client;
        const question = interaction.options.getString('question', true);
        const optionTexts = [];
        for (let i = 1; i <= MAX_OPTIONS; i++) {
            const v = interaction.options.getString(`option${i}`);
            if (v)
                optionTexts.push(v.trim());
        }
        if (optionTexts.length < 2) {
            await interaction.reply({ content: '❌ تحتاج خيارين على الأقل', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        // Build a temporary in-memory poll so we can render the embed first,
        // then send the message, then persist with the real messageId (schema requires it).
        const tempPoll = {
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            ownerId: interaction.user.id,
            question,
            options: optionTexts.map(text => ({ text, votes: [] })),
        };
        const { embed, components } = buildPollEmbed(tempPoll, interaction.user.username);
        const channel = interaction.channel;
        const message = await channel.send({ embeds: [embed], components });
        // Persist only after we have the messageId (required by schema)
        await models_1.Poll.create({ ...tempPoll, messageId: message.id });
        await interaction.editReply({
            content: `✅ تم إنشاء الاستطلاع — [عرض التصويت](${message.url})`,
        });
    },
};
// --------------------------------------------
// Shared builder
// --------------------------------------------
function buildPollEmbed(poll, authorName) {
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
    const tally = poll.options
        .map((o, i) => {
        const count = o.votes.length;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        return `${i + 1}️⃣ ${o.text} — **${pct}%** (${count} صوت)`;
    })
        .join('\n') || 'لا أصوات بعد';
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`📊 ${poll.question}`.substring(0, 256))
        .setColor(embeds_1.Colors.primary)
        .setDescription(tally);
    const rows = [];
    let current = new discord_js_1.ActionRowBuilder();
    poll.options.forEach((o, i) => {
        if (current.components.length >= 5) {
            rows.push(current);
            current = new discord_js_1.ActionRowBuilder();
        }
        current.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`poll|${i}`)
            .setLabel(`${i + 1}. ${o.text}`.substring(0, 80))
            .setStyle(discord_js_1.ButtonStyle.Secondary));
    });
    if (current.components.length > 0)
        rows.push(current);
    return { embed, components: rows };
}
exports.default = command;
//# sourceMappingURL=poll.js.map