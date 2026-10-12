// ============================================
// Liberty City Bot - Help Command
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
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('عرض جميع الأوامر المتاحة')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('اسم الأمر للحصول على معلومات تفصيلية')
        .setRequired(false)
    ),
  
  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const commandName = interaction.options.getString('command');

    // Show specific command info
    if (commandName) {
      return showCommandInfo(interaction, client, commandName);
    }

    // Show help menu
    return showHelpMenu(interaction, client);
  },
};

// --------------------------------------------
// Show Help Menu
// --------------------------------------------
async function showHelpMenu(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  const commands = client.commandHandler.getCommands();
  const categories = client.commandHandler.getCategories();

  const categoryInfo: Record<string, { name: string; emoji: string }> = {
    moderation: { name: '🛡️ الموديريشن', emoji: '🛡️' },
    protection: { name: '🔒 الحماية', emoji: '🔒' },
    tickets: { name: '🎫 التذاكر', emoji: '🎫' },
    settings: { name: '⚙️ الإعدادات', emoji: '⚙️' },
    ai: { name: '🤖 الذكاء الاصطناعي', emoji: '🤖' },
    utility: { name: '🔧 الأدوات', emoji: '🔧' },
    info: { name: 'ℹ️ المعلومات', emoji: 'ℹ️' },
    fun: { name: '🎮 الترفيه والألعاب', emoji: '🎮' },
    roles: { name: '📛 الرتب', emoji: '📛' },
  };

  const embed = new EmbedBuilder()
    .setTitle('📚 أوامر Liberty City')
    .setColor(Colors.primary)
    .setThumbnail(interaction.client.user?.displayAvatarURL() || '');

  // قائمة مختصرة بالتصنيفات والأوامر
  const lines: string[] = [];
  for (const category of categories) {
    const info = categoryInfo[category] || { name: category, emoji: '📂' };
    const catCommands = client.commandHandler.getCommandsByCategory(category);

    if (catCommands.length > 0) {
      const names =
        catCommands
          .slice(0, 12)
          .map(cmd => `\`/${cmd.data.name}\``)
          .join('، ') + (catCommands.length > 12 ? ` … +${catCommands.length - 12}` : '');
      lines.push(`${info.emoji} **${info.name}** [${catCommands.length}]: ${names}`);
    }
  }

  embed.setDescription(
    (
      `**${interaction.user.username}** 👋 — استخدم \`/help <أمر>\` للتفاصيل عن أمر معين\n\n` +
      lines.join('\n')
    ).substring(0, 4000)
  );

  // Create buttons for navigation
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('help_moderation')
      .setLabel('الموديريشن')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🛡️'),
    new ButtonBuilder()
      .setCustomId('help_protection')
      .setLabel('الحماية')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🔒'),
    new ButtonBuilder()
      .setCustomId('help_tickets')
      .setLabel('التذاكر')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎫'),
    new ButtonBuilder()
      .setCustomId('help_ai')
      .setLabel('AI')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🤖'),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('help_fun')
      .setLabel('الترفيه')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎮'),
    new ButtonBuilder()
      .setCustomId('help_roles')
      .setLabel('الرتب')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📛'),
    new ButtonBuilder()
      .setCustomId('help_settings')
      .setLabel('الإعدادات')
      .setStyle(ButtonStyle.Success)
      .setEmoji('⚙️'),
    new ButtonBuilder()
      .setCustomId('help_utility')
      .setLabel('الأدوات')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔧'),
    new ButtonBuilder()
      .setCustomId('help_info')
      .setLabel('معلومات')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('ℹ️'),
  );

  await interaction.reply({
    embeds: [embed],
    components: [row, row2],
  });
}

// --------------------------------------------
// Show Command Info
// --------------------------------------------
async function showCommandInfo(
  interaction: ChatInputCommandInteraction,
  client: LibertyClient,
  commandName: string
): Promise<void> {
  const command = client.commandHandler.getCommand(commandName);

  if (!command) {
    await interaction.reply({
      content: `❌ الأمر \`${commandName}\` غير موجود. استخدم \`/help\` لعرض جميع الأوامر`,
      ephemeral: true,
    });
    return;
  }

  const data = command.data;
  const options = data.options || [];

  const parts = [
    `📋 **/${data.name}** — ${data.description}`,
    `📂 ${command.category || 'غير مصنف'} • ⏱️ ${command.cooldown ? `${command.cooldown} ثانية` : 'بدون كولداون'}`,
    `🔐 ${command.permissions && command.permissions.length > 0
      ? command.permissions.map(p => `\`${p}\``).join(', ')
      : 'لا توجد صلاحيات مطلوبة'}`,
  ];

  // معلومات الوسائط
  if (options.length > 0) {
    parts.push(
      `📝 ${options
        .map((opt: any) => `\`/${data.name} ${opt.name}\` ${opt.required ? '(مطلوب)' : '(اختياري)'}`)
        .join('، ')}`
    );
  }

  // مثال على الاستخدام
  parts.push(
    `💡 \`/${data.name}${options.length > 0 ? ' ' + options.map((o: any) => `<${o.name}>`).join(' ') : ''}\``
  );

  await interaction.reply({
    content: parts.join(' • '),
    ephemeral: true,
  });
}

export default command;