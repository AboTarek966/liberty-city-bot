// ============================================
// Liberty City Bot - Bomb (اقطع السلك)
// قنبلة بسلك صحيح واحد — تحديد الرياضيات ينقذك
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

const WIRES = ['🔴', '🔵', '🟢', '🟡'];

function makeSum(want: number): string {
  const a = 1 + Math.floor(Math.random() * Math.max(2, want - 1));
  return `${a} + ${Math.max(1, want - a)}`;
}

function makeWrong(want: number): string {
  for (let i = 0; i < 50; i++) {
    const a = 1 + Math.floor(Math.random() * 15);
    const b = 1 + Math.floor(Math.random() * 15);
    if (a + b !== want) return `${a} + ${b}`;
  }
  return '9 + 9';
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('bomb')
    .setDescription('💣 اقطع السلك — أربعة أسلاك وسلك واحد فقط ينقذك!')
    .setDMPermission(false),

  cooldown: 7,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const target = 6 + Math.floor(Math.random() * 18); // 6 .. 23
    const labels = [makeSum(target), makeWrong(target), makeWrong(target), makeWrong(target)];

    // خلط فيشر-يتس ثم تحديد موضع السلك الصحيح من القيم النهائية
    for (let i = labels.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [labels[i], labels[j]] = [labels[j], labels[i]];
    }
    const correct = labels.findIndex(l => {
      const [a, b] = l.split(' + ').map(Number);
      return a + b === target;
    });

    const id = newGameId();
    setFunState(id, 'bomb', { correct, target, labels, done: false });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      labels.map((l, i) =>
        new ButtonBuilder()
          .setCustomId(`fun:bomb:${id}:${i}`)
          .setLabel(`${WIRES[i]} ${l}`)
          .setStyle(ButtonStyle.Danger)
      )
    );

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.error)
          .setTitle('💣 قنبلة مسلّحة!')
          .setDescription(
            `⏱️ الإشارة الأخيرة قبل الانفجار:\n\n` +
            `> اقطع السلك الذي مجموعه **= ${target}**\n\n` +
            `${WIRES.map((w, i) => `${w} \`${labels[i]}\``).join('  •  ')}`
          )
          .setFooter({ text: 'اختر بسرعة — أحد الأربعة خطأ وينفجر!' }),
      ],
      components: [row],
    });
  },
};

export default command;
