// ============================================
// Liberty City Bot - Games Menu Handler
// اختيار لعبة من القائمة → إرسال طريقة اللعب
// ============================================

import { StringSelectMenuInteraction, EmbedBuilder } from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { Colors } from '../../utils/embeds';
import { GAMES_LIST } from '../../commands/fun/games';

const handler: SelectMenuHandler = {
  id: 'games_menu',
  async execute(interactionRaw) {
    const interaction = interactionRaw as StringSelectMenuInteraction;
    await interaction.deferUpdate(); // ✅ فوراً

    const game = GAMES_LIST.find(g => g.value === interaction.values[0]);
    if (!game) {
      await interaction.followUp({ content: '❌ لعبة غير معروفة', ephemeral: true });
      return;
    }

    await interaction.followUp({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.primary)
          .setTitle(`${game.label} — طريقة اللعب`)
          .setDescription(`\`\`\`\n${game.usage}\n\`\`\``)
          .setFooter({ text: 'اكتب الأمر كما هو — وجرّب حظك!' }),
      ],
      ephemeral: true,
    });
  },
};

export default handler;
