// ============================================
// Liberty City Bot - Leaderboard Buttons
// customId format: lb|<type>|<period>|<limit>
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import {
  buildLeaderboardEmbed,
  buildLeaderboardButtons,
  LBType,
  LBPeriod,
  LBLimit,
} from '../../commands/utility/leaderboard';

const VALID_TYPES = ['all', 'messages', 'voiceMinutes'];
const VALID_PERIODS = ['day', 'week', 'month', 'total'];
const VALID_LIMITS = ['10', '25', 'all'];

const handler: ButtonHandler = {
  id: 'lb',
  async execute(interaction: ButtonInteraction) {
    // ✅ الرد السريع فوراً لمنع انتهاء صلاحية التفاعل (خطأ 10062)
    await interaction.deferUpdate();

    const parts = interaction.customId.split('|');
    const type = (VALID_TYPES.includes(parts[1]) ? parts[1] : 'all') as LBType;
    const period = (VALID_PERIODS.includes(parts[2]) ? parts[2] : 'week') as LBPeriod;
    const limit = (VALID_LIMITS.includes(parts[3]) ? parts[3] : '10') as LBLimit;

    const client = interaction.client as LibertyClient;

    const embed = await buildLeaderboardEmbed(
      client,
      interaction.guildId!,
      type,
      period,
      limit
    );
    const components = buildLeaderboardButtons(type, period, limit);

    await interaction.editReply({ embeds: [embed], components });
  },
};

export default handler;
