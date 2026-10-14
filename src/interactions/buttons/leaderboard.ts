// ============================================
// Liberty City Bot - Leaderboard Buttons
// customId: lb|<type>|<period>|<limit>|<page>[|<mark>]
//   mark: prev / next / r (تحديث) / p (فترة) / t (نوع)
// التنسيق القديم (بدون صفحة) يُعامَل كصفحة 1
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import {
  buildLeaderboardPage,
  sanitizeType,
  sanitizePeriod,
  sanitizeLimit,
} from '../../commands/utility/leaderboard';

const handler: ButtonHandler = {
  id: 'lb',
  async execute(interaction: ButtonInteraction) {
    // ✅ الرد السريع فوراً لمنع انتهاء صلاحية التفاعل (خطأ 10062)
    await interaction.deferUpdate();

    const parts = interaction.customId.split('|');
    const type = sanitizeType(parts[1]);
    const period = sanitizePeriod(parts[2]);
    const limit = sanitizeLimit(parts[3]);

    // التنسيق القديم = صفحة 1
    const rawPage = parseInt(parts[4], 10);
    let page = Number.isFinite(rawPage) ? rawPage : 1;

    const mark = parts[5] || '';
    if (mark === 'prev') page -= 1;
    else if (mark === 'next') page += 1;

    const client = interaction.client as LibertyClient;

    // (تجميع الصفوف ثم تقسيمها إلى صفحات يتم داخل الباني،
    //  ورقم الصفحة يُصحَّح تلقائياً إذا تجاوز الإجمالي)
    const result = await buildLeaderboardPage(
      client,
      interaction.guild!,
      type,
      period,
      limit,
      page
    );

    await interaction.editReply({
      embeds: [result.embed],
      components: result.components,
    });
  },
};

export default handler;
