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
    .setDescription(
      `مرحباً **${interaction.user.username}**! 👋\n\n` +
      `أنا بوت **Liberty City** الشامل، إليك قائمة الأوامر المتاحة:\n\n` +
      `> استخدم \`/help <أمر>\` للحصول على معلومات تفصيلية عن أمر معين\n` +
      `> جميع الأوامر هي Slash Commands (تبدأ بـ \`/\`)`
    )
    .setColor(Colors.primary)
    .setThumbnail(interaction.client.user?.displayAvatarURL() || '')
    .setFooter({ text: 'Liberty City Bot | جميع الحقوق محفوظة' })
    .setTimestamp();

  // Add category fields
  for (const category of categories) {
    const info = categoryInfo[category] || { name: category, emoji: '📂' };
    const catCommands = client.commandHandler.getCommandsByCategory(category);

    if (catCommands.length > 0) {
      embed.addFields({
        name: `${info.emoji} ${info.name} [${catCommands.length}]`,
        value: catCommands
          .slice(0, 15)
          .map(cmd => `\`/${cmd.data.name}\``)
          .join('، ') + (catCommands.length > 15 ? `... و ${catCommands.length - 15} أمر آخر` : ''),
        inline: false,
      });
    }
  }

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

  const embed = new EmbedBuilder()
    .setTitle(`📋 معلومات الأمر: /${data.name}`)
    .setDescription(data.description)
    .setColor(Colors.primary)
    .addFields(
      { name: '📂 التصنيف', value: command.category || 'غير مصنف', inline: true },
      { name: '⏱️ الكولداون', value: command.cooldown ? `${command.cooldown} ثانية` : 'بدون', inline: true },
      {
        name: '🔐 الصلاحيات المطلوبة',
        value: command.permissions && command.permissions.length > 0
          ? command.permissions.map(p => `\`${p}\``).join(', ')
          : 'لا توجد صلاحيات مطلوبة',
        inline: false,
      },
    )
    .setFooter({ text: 'Liberty City Bot' })
    .setTimestamp();

  // Add options info
  if (options.length > 0) {
    const optionsList = options
      .map((opt: any) => {
        const required = opt.required ? '(مطلوب)' : '(اختياري)';
        return `\`/${data.name} ${opt.name}\` - ${opt.description} ${required}`;
      })
      .join('\n');

    embed.addFields({ name: '📝 الوسائط', value: optionsList, inline: false });
  }

  // Add usage example
  embed.addFields({
    name: '💡 مثال على الاستخدام',
    value: `\`/${data.name}${options.length > 0 ? ' ' + options.map((o: any) => `<${o.name}>`).join(' ') : ''}\``,
    inline: false,
  });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}

export default command;