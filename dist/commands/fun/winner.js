"use strict";
// ============================================
// Omni Bot - Winner Command (الفائز)
// الإدارة تعلن الفائز يدوياً بدل السحب العشوائي
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const models_1 = require("../../models");
const giveaway_1 = require("../../utils/giveaway");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('winner')
        .setDescription('🏆 إعلان الفائز في السحب يدوياً (بدلاً من السحب العشوائي)')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o
        .setName('users')
        .setDescription('منشن الفائز/الفائزين (مثال: @opencode)')
        .setRequired(true))
        .addStringOption(o => o
        .setName('id')
        .setDescription('معرّف السحب (اختياري — افتراضي: آخر سحب منتهٍ بدون فائز)')
        .setAutocomplete(true)),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageGuild],
    async autocomplete(interaction) {
        if (!interaction.guildId) {
            await interaction.respond([]);
            return;
        }
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'id') {
            await interaction.respond([]);
            return;
        }
        const giveaways = await models_1.Giveaway.find({ guildId: interaction.guildId })
            .sort({ createdAt: -1 })
            .limit(25)
            .catch(() => []);
        const needle = String(focused.value || '').toLowerCase();
        const choices = giveaways
            .filter(g => {
            if (!needle)
                return true;
            return (String(g.shortId).toLowerCase().includes(needle) ||
                String(g.prize).toLowerCase().includes(needle));
        })
            .map(g => ({
            name: `#${g.shortId} — ${String(g.prize).slice(0, 80)} (${g.ended ? 'منتهٍ' : 'شغال'} • ${new Set((g.entries || []).map(String)).size} مشارك)`,
            value: g.shortId,
        }));
        await interaction.respond(choices.slice(0, 25));
    },
    async execute(interaction) {
        const client = interaction.client;
        await interaction.deferReply({ ephemeral: true });
        const usersRaw = interaction.options.getString('users', true);
        const ids = (0, giveaway_1.parseUserMentions)(usersRaw);
        if (!ids.length) {
            await interaction.editReply({ content: '❌ منشن عضو واحد على الأقل — مثال: `الفائز @opencode`' });
            return;
        }
        const ref = interaction.options.getString('id') || undefined;
        const result = await (0, giveaway_1.addGiveawayWinners)(client, interaction.guildId, ref, ids);
        if (!result.ok) {
            await interaction.editReply({ content: result.reason || '❌ تعذّر إعلان الفائز' });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🏆 تم إعلان الفائز')
            .setColor(embeds_1.Colors.success)
            .setDescription(`**السحب:** \`${result.giveaway?.shortId}\` — ${result.giveaway?.prize}\n` +
            `**الفائزون:** ${result.winners.map(id => `<@${id}>`).join('، ')}` +
            (result.finishedNow ? '\n\n> ✅ أُنهي السحب الآن (كان منتهياً أو أُنهي يدوياً)' : ''))
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=winner.js.map