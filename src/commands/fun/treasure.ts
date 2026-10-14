// ============================================
// Liberty City Bot - Treasure Chests (صناديق الكنز)
// ثلاثة صناديق — واحد فقط فيه الكنز
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';
import { newGameId, setFunState } from '../../utils/funGameState';

const CHESTS = ['📦', '🎁', '🗃️'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('treasure')
    .setDescription('💰 صناديق الكنز — ثلاثة صناديق، كنز واحد، اختر بحكمة!')
    .setDMPermission(false),

  cooldown: 6,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const prizeIdx = Math.floor(Math.random() * CHESTS.length);
    const id = newGameId();
    setFunState(id, 'treasure', { prizeIdx, taken: false });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      CHESTS.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`fun:treasure:${id}:${i}`)
          .setLabel(`الصندوق ${i + 1}`)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.primary)
          .setTitle('💰 صناديق الكنز')
          .setDescription('اختر صندوقاً واحداً فقط — **كنز واحد** من الثلاثة!')
          .setFooter({ text: 'مرة واحدة لكل شخص — الحظ يحسم' }),
      ],
      components: [row],
    });
  },
};

export default command;
