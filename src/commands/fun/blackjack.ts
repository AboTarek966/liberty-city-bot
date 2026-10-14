// ============================================
// Liberty City Bot - Blackjack (بلك جاك)
// ضد الموزع — اسحب أو قف، 21 هو الرقم السحري
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
import { newDeck, handValue, renderHand, type Card } from '../../utils/blackjack';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('🃏 بلك جاك — اسحب أو قف، اقترب من 21 دون أن تتجاوز!')
    .setDMPermission(false),

  cooldown: 8,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const deck = newDeck();
    const player: Card[] = [deck.pop()!, deck.pop()!];
    const dealer: Card[] = [deck.pop()!, deck.pop()!];

    const id = newGameId();
    setFunState(id, 'bj', { deck, player, dealer, done: false }, 3 * 60 * 1000);

    // بلك جاك فوري؟
    if (handValue(player) === 21) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.success)
            .setTitle('🃏 بلك جاك!')
            .setDescription(
              `✋ يدك: **${renderHand(player)} = 21**\n` +
              `🎩 يد الموزع: **${renderHand(dealer)} = ${handValue(dealer)}**\n\n` +
              `🏆 **بلك جاك!** فزت فوراً — ${interaction.user.toString()}!`
            ),
        ],
        components: [],
      });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`fun:bj:${id}:hit`).setLabel('🎲 سحب بطاقة').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`fun:bj:${id}:stand`).setLabel('✋ قف').setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.primary)
          .setTitle('🃏 بلك جاك — دورك')
          .setDescription(
            `✋ يدك: **${renderHand(player)} = ${handValue(player)}**\n` +
            `🎩 يد الموزع: **${renderHand(dealer, true)} = ?**\n\n` +
            `اجمع **21** أو اقترب منها — تجاوزها وخسرت.`
          ),
      ],
      components: [row],
    });
  },
};

export default command;
