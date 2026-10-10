// ============================================
// Liberty City Bot - Help Category Buttons
// ============================================

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

const categoryInfo: Record<string, { name: string; emoji: string }> = {
  moderation: { name: '🛡️ الموديريشن', emoji: '🛡️' },
  protection: { name: '🔒 الحماية', emoji: '🔒' },
  tickets: { name: '🎫 التذاكر', emoji: '🎫' },
  settings: { name: '⚙️ الإعدادات', emoji: '⚙️' },
  ai: { name: '🤖 الذكاء الاصطناعي', emoji: '🤖' },
  utility: { name: '🔧 الأدوات', emoji: '🔧' },
  info: { name: 'ℹ️ المعلومات', emoji: 'ℹ️' },
};

const handler: ButtonHandler = {
  id: 'help',
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate(); // ✅ منع انتهاء الصلاحية

    const client = interaction.client as LibertyClient;
    const category = interaction.customId.replace('help_', '');
    const info = categoryInfo[category] || { name: category, emoji: '📂' };
    const commands = client.commandHandler.getCommandsByCategory(category);

    const embed = new EmbedBuilder()
      .setTitle(`${info.emoji} أوامر ${info.name}`)
      .setDescription(
        commands.length > 0
          ? commands
              .map(cmd => `> \`/${cmd.data.name}\` — ${cmd.data.description}`)
              .join('\n')
          : 'لا توجد أوامر في هذا التصنيف'
      )
      .setColor(Colors.primary)
      .setFooter({ text: 'Liberty City Bot' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default handler;
