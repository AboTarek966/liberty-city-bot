// ============================================
// Liberty City Bot - Ping Command
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('عرض سرعة استجابة البوت'),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.deferReply({ fetchReply: true });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const websocket = interaction.client.ws.ping;

    await interaction.editReply({
      content: `🏓 Pong! — الاستجابة \`${roundtrip}ms\` • الـ WebSocket \`${websocket}ms\` • ${getRating(roundtrip)}`,
    });
  },
};

function getRating(ms: number): string {
  if (ms < 100) return '⚡ ممتاز جداً';
  if (ms < 200) return '✅ ممتاز';
  if (ms < 300) return '👍 جيد جداً';
  if (ms < 500) return '👌 جيد';
  if (ms < 1000) return '⚠️ متوسط';
  return '❌ بطيء';
}

export default command;