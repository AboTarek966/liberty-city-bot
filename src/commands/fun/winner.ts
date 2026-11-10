// ============================================
// Omni Bot - Winner Command (الفائز)
// الإدارة تعلن الفائز يدوياً بدل السحب العشوائي
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  AutocompleteInteraction,
  ApplicationCommandOptionChoiceData,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { OmniClient } from '../../OmniClient';
import { Colors } from '../../utils/embeds';
import { Giveaway } from '../../models';
import { addGiveawayWinners, findDefaultGiveawayForWinner, parseUserMentions } from '../../utils/giveaway';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('winner')
    .setDescription('🏆 إعلان الفائز في السحب يدوياً (بدلاً من السحب العشوائي)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o =>
      o
        .setName('users')
        .setDescription('منشن الفائز/الفائزين (مثال: @opencode)')
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName('id')
        .setDescription('معرّف السحب (اختياري — افتراضي: آخر سحب منتهٍ بدون فائز)')
        .setAutocomplete(true)
    ),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageGuild],

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) {
      await interaction.respond([]);
      return;
    }
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'id') {
      await interaction.respond([]);
      return;
    }

    const giveaways = await Giveaway.find({ guildId: interaction.guildId })
      .sort({ createdAt: -1 })
      .limit(25)
      .catch(() => [] as any[]);

    const needle = String(focused.value || '').toLowerCase();
    const choices: ApplicationCommandOptionChoiceData[] = (giveaways as any[])
      .filter(g => {
        if (!needle) return true;
        return (
          String(g.shortId).toLowerCase().includes(needle) ||
          String(g.prize).toLowerCase().includes(needle)
        );
      })
      .map(g => ({
        name: `#${g.shortId} — ${String(g.prize).slice(0, 80)} (${g.ended ? 'منتهٍ' : 'شغال'} • ${new Set((g.entries || []).map(String)).size} مشارك)`,
        value: g.shortId,
      }));

    await interaction.respond(choices.slice(0, 25));
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as OmniClient;
    await interaction.deferReply({ ephemeral: true });

    const usersRaw = interaction.options.getString('users', true);
    const ids = parseUserMentions(usersRaw);
    if (!ids.length) {
      await interaction.editReply({ content: '❌ منشن عضو واحد على الأقل — مثال: `الفائز @opencode`' });
      return;
    }

    const ref = interaction.options.getString('id') || undefined;
    const result = await addGiveawayWinners(client, interaction.guildId!, ref, ids);
    if (!result.ok) {
      await interaction.editReply({ content: result.reason || '❌ تعذّر إعلان الفائز' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 تم إعلان الفائز')
      .setColor(Colors.success)
      .setDescription(
        `**السحب:** \`${result.giveaway?.shortId}\` — ${result.giveaway?.prize}\n` +
          `**الفائزون:** ${result.winners!.map(id => `<@${id}>`).join('، ')}` +
          (result.finishedNow ? '\n\n> ✅ أُنهي السحب الآن (كان منتهياً أو أُنهي يدوياً)' : '')
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
