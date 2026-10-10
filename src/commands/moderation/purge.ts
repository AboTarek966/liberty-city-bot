// ============================================
// Liberty City Bot - Purge Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('مسح رسائل من القناة')
    .addIntegerOption(option =>
      option
        .setName('amount')
        .setDescription('عدد الرسائل (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('مسح رسائل عضو معين فقط')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    // Fetch messages
    const messages = await interaction.channel!.messages.fetch({ limit: 100 });

    // Filter messages
    let messagesToDelete = Array.from(messages.values());

    if (targetUser) {
      messagesToDelete = messagesToDelete.filter(m => m.author.id === targetUser.id);
    }

    // Filter out old messages (older than 14 days)
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    messagesToDelete = messagesToDelete.filter(m => m.createdTimestamp > twoWeeksAgo);

    // Limit to amount
    messagesToDelete = messagesToDelete.slice(0, amount);

    if (messagesToDelete.length === 0) {
      await interaction.editReply({
        content: '❌ لا توجد رسائل للمسح',
      });
      return;
    }

    // Delete messages
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased() || !('bulkDelete' in channel)) {
      await interaction.editReply({
        content: '❌ لا يمكن مسح الرسائل في هذه القناة',
      });
      return;
    }
    const deleted = await channel.bulkDelete(messagesToDelete, true);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ تم مسح الرسائل')
      .setColor(Colors.success)
      .setDescription(
        `تم مسح **${deleted.size}** رسالة` +
        (targetUser ? ` من ${targetUser}` : '')
      )
      .setFooter({ text: 'Liberty City Bot' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;