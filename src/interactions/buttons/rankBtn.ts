// ============================================
// Liberty City Bot - Rank Buttons (تفاعل بطاقة المستوى)
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { buildTopEmbed } from '../../commands/info/rank';

const handler: ButtonHandler = {
  id: 'rank',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    await interaction.deferUpdate();

    const parts = interaction.customId.split(':'); // rank:action:userId?
    const action = parts[1];
    const userId = parts[2] || interaction.user.id;

    if (action === 'top') {
      const embed = await buildTopEmbed(client, interaction.guild.id);
      await interaction.editReply({ embeds: [embed], components: interaction.message.components as any });
      return;
    }

    if (action === 'refresh') {
      const member =
        interaction.guild.members.cache.get(userId) ||
        (await interaction.guild.members.fetch(userId).catch(() => null));
      if (!member) {
        await interaction.editReply({ content: '❌ لم يتم العثور على العضو' });
        return;
      }
      const card = await client.levelingHandler.buildRankCard(member);
      // نُبقي الأزرار كما كانت (زر التوب + تحديث)
      await interaction.editReply({ embeds: [card], components: interaction.message.components as any });
      return;
    }

    await interaction.editReply({ content: '❌ إجراء غير معروف' });
  },
};

export default handler;
