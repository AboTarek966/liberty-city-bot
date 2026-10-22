// ============================================
// Liberty City Bot - Alias Command
// Custom shortcuts for commands (e.g., "b" -> /ban)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';
import { CommandAlias } from '../../models';
import { invalidateAliasCache } from '../../utils/aliasCache';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('alias')
    .setDescription('إدارة اختصارات الأوامر')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('إضافة اختصار لأمر')
        .addStringOption(o =>
          o
            .setName('shortcut')
            .setDescription('الاختصار الذي سكتبه في الشات (مثال: تايم)')
            .setRequired(true)
            .setMaxLength(15)
        )
        .addStringOption(o =>
          o
            .setName('command')
            .setDescription('🎯 أوامر الإدارة والعقوبات')
            .setRequired(false)
            .addChoices(
              { name: '🔨 حظر', value: 'ban' },
              { name: '👢 طرد', value: 'kick' },
              { name: '⏱️ تايم أوت', value: 'timeout' },
              { name: '⚠️ تحذير', value: 'warn' },
              { name: '🔇 كتم', value: 'mute' },
              { name: '🔊 فك كتم', value: 'unmute' },
              { name: '🗣️ السماح بالكلام', value: 'speak' },
              { name: '🗑️ مسح', value: 'purge' },
              { name: '🚫 إلغاء حظر', value: 'unban' },
              { name: '🗑️ إلغاء تايم', value: 'untimeout' },
              { name: '✅ إزالة تحذير', value: 'unwarn' },
              { name: '🔒 سجن', value: 'jail' },
              { name: '🔓 إفراج', value: 'unjail' },
              { name: '⬆️ ترقية', value: 'promote' },
              { name: '🚨 لوكداون', value: 'lockdown' },
              { name: '🔒 قفل/فتح الروم', value: 'lock' },
              { name: '🔕 كتم مؤقت', value: 'timeout' },
              { name: '🏓 بينج', value: 'ping' },
              { name: '💬 say', value: 'say' },
              { name: '🖼️ أفاتار', value: 'avatar' },
              { name: '📝 إمبد', value: 'embed' },
              { name: '🏆 توب', value: 'top' },
              { name: '👤 يوزر إنفو', value: 'userinfo' },
            )
        )
        .addStringOption(o =>
          o
            .setName('extra')
            .setDescription('🎮 ألعاب (25 لعبة)')
            .setRequired(false)
            .addChoices(
              { name: '🎱 8ball', value: '8ball' },
              { name: '🔀 اختر', value: 'choose' },
              { name: '🎲 نرد', value: 'dice' },
              { name: '🪙 عملة', value: 'flip' },
              { name: '😂 نكتة', value: 'joke' },
              { name: '📊 تصويت', value: 'poll' },
              { name: '💯 تقييم', value: 'rate' },
              { name: '🎰 سلوتس', value: 'slots' },
              { name: '🃏 بلاك جاك', value: 'blackjack' },
              { name: '💣 قنبلة', value: 'bomb' },
              { name: '🎳 بولينغ', value: 'bowling' },
              { name: '🐉 تنين', value: 'dragon' },
              { name: '⚔️ مبارزة', value: 'duel' },
              { name: '🎣 صيد', value: 'fish' },
              { name: '🎯 سهام', value: 'darts' },
              { name: '🔼 أعلى/أقل', value: 'highlow' },
              { name: '🏁 سباق', value: 'race' },
              { name: '🎯 روليت', value: 'roulette' },
              { name: '✂️ RPS', value: 'rps' },
              { name: '💪 قوة', value: 'power' },
              { name: '🧩 لغز', value: 'riddle' },
              { name: '💰 كنز', value: 'treasure' },
              { name: '🧱 شد حبل', value: 'tug' },
              { name: '🎡 عجلة', value: 'wheel' },
              { name: '❌⭕ XO', value: 'xo' },
            )
        )
        .addStringOption(o =>
          o
            .setName('extra2')
            .setDescription('🎵 موسيقى + حماية + معلومات')
            .setRequired(false)
            .addChoices(
              // 🎵 قيم فريدة لكل إجراء (music:<فعل>) — كانت كلها 'music' ولا تفرّق بينها
              { name: '🎵 تشغيل أغنية', value: 'music:play' },
              { name: '⏭️ تخطي', value: 'music:skip' },
              { name: '⏹️ إيقاف الموسيقى', value: 'music:stop' },
              { name: '⏸️ إيقاف مؤقت', value: 'music:pause' },
              { name: '▶️ استئناف', value: 'music:resume' },
              { name: '📋 قائمة الانتظار', value: 'music:queue' },
              { name: '🎵 الأغنية الحالية', value: 'music:nowplaying' },
              { name: '🔊 الصوت', value: 'music:volume' },
              { name: '🔁 التكرار', value: 'music:loop' },
              { name: '⏩ تقديم 10 ثوانٍ', value: 'music:forward' },
              { name: '⏪ إرجاع 10 ثوانٍ', value: 'music:back' },
              { name: '🚪 مغادرة الصوتية', value: 'music:leave' },
              { name: '🔀 خلط القائمة', value: 'music:shuffle' },
              { name: '🗑️ إزالة أغنية', value: 'music:remove' },
              { name: '🛡️ حماية', value: 'protection' },
              { name: '🛑 لوكداون', value: 'lockdown' },
              { name: '🔒 قفل/فتح الروم', value: 'lock' },
              { name: '🔒 سجن', value: 'jail' },
              { name: '🔓 إفراج', value: 'unjail' },
              { name: '🏰 سيرفر إنفو', value: 'serverinfo' },
              { name: '👤 يوزر إنفو', value: 'userinfo' },
              { name: '🏆 توب', value: 'top' },
              { name: '📈 نشاط', value: 'activity' },
            )
        )
        .addStringOption(o =>
          o
            .setName('extra2b')
            .setDescription('🛠️ أدوات + تذاكر + AI')
            .setRequired(false)
            .addChoices(
              { name: '🏓 بينج', value: 'ping' },
              { name: '💬 say', value: 'say' },
              { name: '🖼️ أفاتار', value: 'avatar' },
              { name: '📝 إمبد', value: 'embed' },
              { name: '🕵️ سنايب', value: 'snipe' },
              { name: '💾 باك أب', value: 'backup' },
              { name: '🎫 تذاكر', value: 'ticket' },
              { name: '🤖 AI', value: 'ai' },
              { name: '🎮 ألعاب', value: 'games' },
              { name: '🎮 لعبة', value: 'game' },
              { name: '🗣️ السماح بالكلام', value: 'speak' },
            )
        )
        .addStringOption(o =>
          o
            .setName('extra3')
            .setDescription('📦 أوامر إدارية + رولات + حماية متقدمة')
            .setRequired(false)
            .addChoices(
              { name: '⚙️ إعدادات', value: 'settings' },
              { name: '🛡️ حماية', value: 'protection' },
              { name: '🕵️ سنايب', value: 'snipe' },
              { name: '💾 باك أب', value: 'backup' },
              { name: '⌨️ علياس', value: 'alias' },
              { name: '🎭 رول منيو', value: 'rolemenu' },
              { name: '➕ أوتو رول', value: 'autorole' },
              { name: '➕ رول أدد', value: 'roleadd' },
              { name: '➖ رول ريموف', value: 'roleremove' },
              { name: '🔓 إلغاء تايم', value: 'untimeout' },
              { name: '🔓 إلغاء حظر', value: 'unban' },
              { name: '✅ إزالة تحذير', value: 'unwarn' },
              { name: '⬆️ ترقية', value: 'promote' },
              { name: '🚨 لوكداون', value: 'lockdown' },
              { name: '🔒 سجن', value: 'jail' },
              { name: '🔓 إفراج', value: 'unjail' },
              { name: '📊 توب تذاكر', value: 'ticket_top' },
              { name: '📊 تذكرة ستات', value: 'ticket_mystats' },
              { name: '💤 AFK', value: 'afk' },
              { name: '🎫 تذاكر', value: 'ticket' },
              { name: '🤖 AI', value: 'ai' },
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('حذف اختصار')
        .addStringOption(o => o.setName('shortcut').setDescription('الاختصار').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('عرض جميع الاختصارات')
    ),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      await handleAdd(interaction, client);
    } else if (sub === 'remove') {
      await handleRemove(interaction);
    } else if (sub === 'list') {
      await handleList(interaction);
    }
  },
};

// --------------------------------------------
// Add Alias
// --------------------------------------------
async function handleAdd(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  let shortcut = interaction.options.getString('shortcut', true).toLowerCase().trim();
  const choice = interaction.options.getString('command');
  const extra = interaction.options.getString('extra');
  const extra2 = interaction.options.getString('extra2');
  const extra3 = interaction.options.getString('extra3');

  // 🎯 اختر من إحدى القوائم (جميع أوامر البوت متاحة)
  if (!choice && !extra && !extra2 && !interaction.options.getString('extra3')) {
    await interaction.reply({
      content: '❌ **اختر الأمر من القائمة** — جميع أوامر البوت متاحة في القوائم',
      ephemeral: true,
    });
    return;
  }

  const commandName = (choice || extra || interaction.options.getString('extra2') || interaction.options.getString('extra3') || '').toLowerCase().trim();

  // Remove prefix if user typed it (e.g., "/ban" -> "ban")
  const cleanCommand = commandName.replace(/^\//, '');

  // 🎵 أوامر بفرعي مثل `music:play` → الأمر الأساسي للتحقق هو `music`
  const baseCommand = cleanCommand.includes(':') ? cleanCommand.split(':')[0] : cleanCommand;

  // Validate shortcut: no spaces, reasonable length, not a reserved word
  if (shortcut.includes(' ') || shortcut.length > 15) {
    await interaction.reply({
      content: '❌ الاختصار لا يمكن أن يحتوي على مسافات وألا يزيد عن 15 حرف',
      ephemeral: true,
    });
    return;
  }

  // Check if it starts with "/" (would conflict with slash commands)
  if (shortcut.startsWith('/')) shortcut = shortcut.slice(1);

  // Check if command exists
  const targetCommand = client.commandHandler.getCommand(baseCommand);
  if (!targetCommand) {
    await interaction.reply({
      content: `❌ الأمر \`${baseCommand}\` غير موجود. استخدم \`/help\` لعرض الأوامر`,
      ephemeral: true,
    });
    return;
  }

  // ⚡ السماح بنفس الاختصار لأكثر من أمر (نظام التبديل/Toggle)
  // مثال: `ت` → تحذير و `ت` → إزالة تحذير — البوت يحدد أيهما ينفّذ حسب الحالة
  const existingSame = await CommandAlias.findOne({
    guildId: interaction.guildId!,
    alias: shortcut,
    command: cleanCommand,
  });

  if (existingSame) {
    await interaction.reply({
      content: `❌ الاختصار \`${shortcut}\` مرتبط بالفعل بالأمر \`/${cleanCommand}\``,
      ephemeral: true,
    });
    return;
  }

  const existingOther = await CommandAlias.findOne({
    guildId: interaction.guildId!,
    alias: shortcut,
    command: { $ne: cleanCommand },
  });

  // ⚡ السماح باختصار يطابق اسم أمر مدمج (مثل `afk` أو `ping`):
  // لا يوجد تعارض تقني — الأوامر المدمجة تعمل عبر الشرائح فقط،
  // والشات لا ينفذ إلا الاختصارات. (كان يُرفض سابقاً بدون سبب حقيقي)
  const isBuiltinName = !!client.commandHandler.getCommand(shortcut);

  await CommandAlias.create({
    guildId: interaction.guildId!,
    alias: shortcut,
    command: cleanCommand,
    createdBy: interaction.user.id,
    isBuiltinOverride: isBuiltinName,
  }).catch(err => {
    if (err.code === 11000) {
      throw new Error('هذا الاختصار مستخدم بالفعل لأمر آخر');
    }
    throw err;
  });

  invalidateAliasCache(interaction.guildId!);

  await interaction.reply({
    content: `✅ تم إضافة الاختصار \`${shortcut}\` للأمر \`/${cleanCommand}\``,
    ephemeral: true,
  });
}

// --------------------------------------------
// Remove Alias
// --------------------------------------------
async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const shortcut = interaction.options.getString('shortcut', true).toLowerCase().trim();

  const deleted = await CommandAlias.findOneAndDelete({
    guildId: interaction.guildId!,
    alias: shortcut,
  });

  if (!deleted) {
    await interaction.reply({ content: `❌ الاختصار \`${shortcut}\` غير موجود`, ephemeral: true });
    return;
  }

  invalidateAliasCache(interaction.guildId!);
  await interaction.reply({ content: `✅ تم حذف الاختصار \`${shortcut}\``, ephemeral: true });
}

// --------------------------------------------
// List Aliases
// --------------------------------------------
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  const aliases = await CommandAlias.find({ guildId: interaction.guildId! }).lean();

  if (!aliases.length) {
    await interaction.reply({ content: '📭 لا توجد اختصارات مضافة بعد', ephemeral: true });
    return;
  }

  const lines = aliases
    .map((a, i) => `${i + 1}. \`${a.alias}\` → \`/${String(a.command).replace(':', ' ')}\``)
    .join('\n');

  const embed = new EmbedBuilder()
    .setTitle('📋 قائمة الاختصارات')
    .setDescription(lines)
    .setColor(Colors.primary)
    .setFooter({ text: `${aliases.length} اختصار` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

export default command;