// ============================================
// Omni Bot - Help Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { OmniClient } from '../../OmniClient';
import { Colors } from '../../utils/embeds';

/**
 * 📂 أسماء وأيقونات تصنيفات /help
 * emoji = اسم إيموجي السيرفر، fallback = إيموجي يونيكود لو مش موجود
 */
const CATEGORY_INFO: Record<string, { name: string; emoji: string; fallback: string }> = {
  moderation: { name: 'أوامر الادارة', emoji: 'staff~2', fallback: '🛡️' },
  protection: { name: 'أوامر الحماية', emoji: 'consideration', fallback: '🔒' },
  tickets: { name: 'أوامر التذاكر', emoji: 'ticket~2', fallback: '🎫' },
  settings: { name: 'أوامر الاعدادات', emoji: 'correct', fallback: '⚙️' },
  ai: { name: 'الذكاء الاصطناعي', emoji: 'chat~1', fallback: '🤖' },
  roles: { name: 'أوامر الرتب', emoji: 'notebook~1', fallback: '📛' },
  fun: { name: 'أوامر الترفيه والألعاب', emoji: '🎮', fallback: '🎮' },
  utility: { name: 'أوامر الأدوات', emoji: '🔧', fallback: '🔧' },
  info: { name: 'أوامر المعلومات', emoji: 'ℹ️', fallback: 'ℹ️' },
};

/**
 * 🔎 إيجاد إيموجي السيرفر بالاسم.
 * يدعم الأسماء المكررة بصيغة `name~2` (ثاني إيموجي بنفس الاسم).
 */
function findGuildEmoji(guild: Guild | null, name: string) {
  if (!guild) return null;
  const all = [...guild.emojis.cache.values()];
  if (!all.length) return null;

  const lower = name.toLowerCase();
  let found = all.find(e => e.name?.toLowerCase() === lower);

  if (!found) {
    const m = /^(.+?)~(\d+)$/.exec(name);
    if (m) {
      const base = m[1].toLowerCase();
      const index = Math.max(1, parseInt(m[2], 10)) - 1;
      found = all.filter(e => e.name?.toLowerCase() === base)[index];
    }
  }

  return found || null;
}

/** 🎨 إيموجي جاهز لأزرار ديسكورد (كائن)، أو الاحتياطي */
function guildEmoji(guild: Guild | null, name: string, fallback: string): any {
  const found = findGuildEmoji(guild, name);
  if (!found) return fallback;
  return { id: found.id, name: found.name, animated: found.animated };
}

/** 🎨 إيموجي جاهز للنصوص/الإمبد `<:name:id>`، أو الاحتياطي */
function guildEmojiText(guild: Guild | null, name: string, fallback: string): string {
  const found = findGuildEmoji(guild, name);
  if (!found) return fallback;
  return `<${found.animated ? 'a' : ''}:${found.name}:${found.id}>`;
}

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
    const client = interaction.client as OmniClient;
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
async function showHelpMenu(interaction: ChatInputCommandInteraction, client: OmniClient): Promise<void> {
  const categories = client.commandHandler.getCategories();

  const embed = new EmbedBuilder()
    .setTitle(`📚 أوامر ${interaction.guild!.name}`)
    .setColor(Colors.primary)
    .setThumbnail(interaction.client.user?.displayAvatarURL() || '');

  // قائمة مختصرة بالتصنيفات والأوامر
  const lines: string[] = [];
  for (const category of categories) {
    const info = CATEGORY_INFO[category] || { name: category, emoji: '📂', fallback: '📂' };
    const catCommands = client.commandHandler.getCommandsByCategory(category);

    if (catCommands.length > 0) {
      const names =
        catCommands
          .slice(0, 12)
          .map(cmd => `\`/${cmd.data.name}\``)
          .join('، ') + (catCommands.length > 12 ? ` … +${catCommands.length - 12}` : '');
      lines.push(
        `${guildEmojiText(interaction.guild, info.emoji, info.fallback)} **${info.name}** [${catCommands.length}]: ${names}`
      );
    }
  }

  embed.setDescription(
    (
      `**${interaction.user.username}** 👋 — استخدم \`/help <أمر>\` للتفاصيل عن أمر معين\n\n` +
      lines.join('\n')
    ).substring(0, 4000)
  );

  // Create buttons for navigation
  const emojiOf = (key: string) => {
    const info = CATEGORY_INFO[key];
    return info ? guildEmoji(interaction.guild, info.emoji, info.fallback) : '📂';
  };

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('help_moderation')
      .setLabel(CATEGORY_INFO.moderation.name)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(emojiOf('moderation')),
    new ButtonBuilder()
      .setCustomId('help_protection')
      .setLabel(CATEGORY_INFO.protection.name)
      .setStyle(ButtonStyle.Success)
      .setEmoji(emojiOf('protection')),
    new ButtonBuilder()
      .setCustomId('help_tickets')
      .setLabel(CATEGORY_INFO.tickets.name)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojiOf('tickets')),
    new ButtonBuilder()
      .setCustomId('help_ai')
      .setLabel(CATEGORY_INFO.ai.name)
      .setStyle(ButtonStyle.Danger)
      .setEmoji(emojiOf('ai')),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('help_fun')
      .setLabel('الترفيه')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎮'),
    new ButtonBuilder()
      .setCustomId('help_roles')
      .setLabel(CATEGORY_INFO.roles.name)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emojiOf('roles')),
    new ButtonBuilder()
      .setCustomId('help_settings')
      .setLabel(CATEGORY_INFO.settings.name)
      .setStyle(ButtonStyle.Success)
      .setEmoji(emojiOf('settings')),
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
  client: OmniClient,
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