// ============================================
// Omni Bot - Help Category Buttons
// ============================================

import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { OmniClient } from '../../OmniClient';
import { Colors } from '../../utils/embeds';

const categoryInfo: Record<string, { name: string; emoji: string }> = {
  moderation: { name: 'أوامر الادارة', emoji: '🛡️' },
  protection: { name: 'أوامر الحماية', emoji: '🔒' },
  tickets: { name: 'أوامر التذاكر', emoji: '🎫' },
  settings: { name: 'أوامر الاعدادات', emoji: '⚙️' },
  ai: { name: 'الذكاء الاصطناعي', emoji: '🤖' },
  roles: { name: 'أوامر الرتب', emoji: '📛' },
  fun: { name: 'أوامر الترفيه والألعاب', emoji: '🎮' },
  utility: { name: 'أوامر الأدوات', emoji: '🔧' },
  info: { name: 'أوامر المعلومات', emoji: 'ℹ️' },
};

const handler: ButtonHandler = {
  id: 'help',
  async execute(interaction: ButtonInteraction) {
    await interaction.deferUpdate(); // ✅ منع انتهاء الصلاحية

    const client = interaction.client as OmniClient;
    const category = interaction.customId.replace('help_', '');
    const info = categoryInfo[category] || { name: category, emoji: '📂' };
    const commands = client.commandHandler.getCommandsByCategory(category);

    const embed = new EmbedBuilder()
      .setTitle(`${info.emoji} ${info.name}`)
      .setDescription(
        commands.length > 0
          ? commands
              .map(cmd => `> \`/${cmd.data.name}\` — ${cmd.data.description}`)
              .join('\n')
          : 'لا توجد أوامر في هذا التصنيف'
      )
      .setColor(Colors.primary)
      .setFooter({ text: interaction.guild?.name || 'Omni' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default handler;
