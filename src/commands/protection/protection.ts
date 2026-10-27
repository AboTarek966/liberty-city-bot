// ============================================
// Liberty City Bot - Protection Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';
import { getGuildSettings, invalidateGuildSettings } from '../../models';
import { gateProtectionOff } from '../../utils/ownerApproval';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('protection')
    .setDescription('إعدادات الحماية المتقدمة')
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('عرض حالة الحماية')
    )
    .addSubcommand(sub =>
      sub
        .setName('antiraid')
        .setDescription('إعدادات مضاد الغارات')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('تفعيل أو تعطيل')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('threshold')
            .setDescription('عدد الانضمامات المسموح بها (1-50)')
            .setMinValue(1)
            .setMaxValue(50)
        )
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('الإجراء عند رصد هجوم')
            .addChoices(
              { name: 'طرد', value: 'kick' },
              { name: 'حظر', value: 'ban' },
              { name: 'إغلاق القنوات', value: 'lockdown' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('antispam')
        .setDescription('إعدادات مضاد السبام')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('تفعيل أو تعطيل')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('max_messages')
            .setDescription('الحد الأقصى للرسائل (2-20)')
            .setMinValue(2)
            .setMaxValue(20)
        )
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('الإجراء المتخذ')
            .addChoices(
              { name: 'تحذير', value: 'warn' },
              { name: 'كتم', value: 'mute' },
              { name: 'طرد', value: 'kick' },
              { name: 'حظر', value: 'ban' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('antilink')
        .setDescription('إعدادات مضاد الروابط')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('تفعيل أو تعطيل')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('whitelist')
            .setDescription('روابط مسموح بها مفصولة بفواصل')
        )
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('الإجراء المتخذ')
            .addChoices(
              { name: 'حذف', value: 'delete' },
              { name: 'تحذير', value: 'warn' },
              { name: 'كتم', value: 'mute' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('antiinvite')
        .setDescription('إعدادات مضاد الدعوات')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('تفعيل أو تعطيل')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('الإجراء المتخذ')
            .addChoices(
              { name: 'حذف', value: 'delete' },
              { name: 'تحذير', value: 'warn' },
              { name: 'كتم', value: 'mute' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('antinuke')
        .setDescription('مضاد النيوك — كشف الحذف الجماعي وعقوبة المخالف')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('threshold')
            .setDescription('عدد العناصر المحذوفة قبل التصعيد (2-20)')
            .setMinValue(2)
            .setMaxValue(20)
        )
        .addIntegerOption(opt =>
          opt
            .setName('window')
            .setDescription('النافذة الزمنية بالثواني (3-60)')
            .setMinValue(3)
            .setMaxValue(60)
        )
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('عقوبة المخالف')
            .addChoices(
              { name: 'تنبيه فقط', value: 'alert' },
              { name: 'طرد', value: 'kick' },
              { name: 'حظر', value: 'ban' },
              { name: '🗡️ سلب كل الرولات (يبقى في السيرفر معطّلاً)', value: 'strip' }
            )
        )
        .addBooleanOption(opt =>
          opt
            .setName('autorestore')
            .setDescription('♻️ إعادة بنية السيرفر تلقائياً بعد هجوم الحذف (الافتراضي: مفعّل)')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('hierarchy')
        .setDescription('🛡️ فحص التسلّم — هل البوت أعلى رتبة؟ أهم فحص أمني')
    )
    .addSubcommand(sub =>
      sub
        .setName('antibot')
        .setDescription('مضاد البوتات — حظر البوتات غير المصرح بها، والقائمة البيضاء استثناء وقائي فقط')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)
        )
        .addUserOption(opt =>
          opt.setName('add').setDescription('إضافة بوت للقائمة البيضاء (استثناء وقائي — الهجوم السريع يُعاقب)')
        )
        .addUserOption(opt =>
          opt.setName('remove').setDescription('إزالة بوت من القائمة البيضاء')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('antiadmin')
        .setDescription('مراقبة منح صلاحية Administrator (تنبيه فقط)')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('autobackup')
        .setDescription('النسخ الاحتياطي التلقائي لبنية السيرفر')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('interval')
            .setDescription('الفاصل بالساعات (1-72)')
            .setMinValue(1)
            .setMaxValue(72)
        )
        .addBooleanOption(opt =>
          opt.setName('create_now').setDescription('إنشاء نسخة احتياطية فورية الآن')
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const settings = await getGuildSettings(interaction.guildId!);

    await interaction.deferReply({ ephemeral: true });

    // 👑 بوابة موافقة المالك — "enabled:false" = إطفاء حماية → يحتاج نقرة مالك السيرفر (التاج)
    const SUB_TO_FIELD: Record<string, string> = {
      antiraid: 'antiRaid',
      antispam: 'antiSpam',
      antilink: 'antiLink',
      antiinvite: 'antiInvite',
      antinuke: 'antiNuke',
      antibot: 'antiBot',
      antiadmin: 'antiAdmin',
      autobackup: 'autoBackup',
    };
    const gateField = SUB_TO_FIELD[subcommand];
    if (gateField && interaction.options.getBoolean('enabled') === false) {
      const gateMsg = await gateProtectionOff({
        settings,
        guild: interaction.guild!,
        user: interaction.user,
        channel: interaction.channel,
        field: gateField,
      });
      if (gateMsg) {
        await interaction.editReply({ content: gateMsg });
        return; // ⛔ لم يُطبَّق شيء
      }
    }

    switch (subcommand) {
      case 'status':
        return showStatus(interaction, settings);
      case 'antiraid':
        return configureAntiRaid(interaction, settings);
      case 'antispam':
        return configureAntiSpam(interaction, settings);
      case 'antilink':
        return configureAntiLink(interaction, settings);
      case 'antiinvite':
        return configureAntiInvite(interaction, settings);
      case 'antinuke':
        return configureAntiNuke(interaction, settings);
      case 'hierarchy':
        return configureHierarchy(interaction);
      case 'antibot':
        return configureAntiBot(interaction, settings);
      case 'antiadmin':
        return configureAntiAdmin(interaction, settings);
      case 'autobackup':
        return configureAutoBackup(interaction, settings);
    }
  },
};

// --------------------------------------------
// Show Status
// --------------------------------------------
async function showStatus(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const p = settings.protection;

  const embed = new EmbedBuilder()
    .setTitle('🛡️ حالة الحماية')
    .setDescription('حالة جميع أنظمة الحماية في السيرفر')
    .setColor(Colors.primary)
    .addFields(
      {
        name: '🚨 مضاد الغارات',
        value: p.antiRaid.enabled ? '✅ مفعل' : '❌ معطل',
        inline: true,
      },
      {
        name: '💬 مضاد السبام',
        value: p.antiSpam.enabled ? '✅ مفعل' : '❌ معطل',
        inline: true,
      },
      {
        name: '🔗 مضاد الروابط',
        value: p.antiLink.enabled ? '✅ مفعل' : '❌ معطل',
        inline: true,
      },
      {
        name: '📨 مضاد الدعوات',
        value: p.antiInvite.enabled ? '✅ مفعل' : '❌ معطل',
        inline: true,
      },
      {
        name: '@ مضاد المنشنز',
        value: p.antiMention.enabled ? '✅ مفعل' : '❌ معطل',
        inline: true,
      },
      {
        name: '🔠 مضاد الكابس',
        value: p.antiCaps.enabled ? '✅ مفعل' : '❌ معطل',
        inline: true,
      },
      {
        name: '😀 مضاد الإيموجي',
        value: p.antiEmoji.enabled ? '✅ مفعل' : '❌ معطل',
        inline: true,
      },
      {
        name: '🤖 أوتومود',
        value: settings.automod?.enabled ? '✅ مفعل' : '❌ معطل',
        inline: true,
      },
      {
        name: '💣 مضاد النيوك',
        value: p.antiNuke?.enabled
          ? '✅ مفعل — استجابة فورية من أول عملية'
          : '❌ معطل',
        inline: true,
      },
      {
        name: '🤖 مضاد البوتات',
        value: p.antiBot?.enabled
          ? `✅ مفعل (${p.antiBot?.whitelist?.length || 0} في القائمة البيضاء الوقائية)`
          : '❌ معطل',
        inline: true,
      },
      {
        name: '⚠️ مراقبة الأدمن',
        value: p.antiAdmin?.enabled ? '✅ مفعل (📢 تنبيه فقط)' : '❌ معطل',
        inline: true,
      },
      {
        name: '💾 نسخ تلقائي',
        value: p.autoBackup?.enabled
          ? `✅ مفعل (كل ${p.autoBackup?.interval ?? 6} ساعة)`
          : '❌ معطل',
        inline: true,
      },
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure Anti-Raid
// --------------------------------------------
async function configureAntiRaid(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);
  const threshold = interaction.options.getInteger('threshold');
  const action = interaction.options.getString('action');

  settings.protection.antiRaid.enabled = enabled;
  if (threshold) settings.protection.antiRaid.threshold = threshold;
  if (action) settings.protection.antiRaid.action = action;

  await settings.save();
  invalidateGuildSettings(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle('🚨 مضاد الغارات')
    .setColor(enabled ? Colors.success : Colors.error)
    .addFields(
      { name: 'الحالة', value: enabled ? '✅ مفعل' : '❌ معطل', inline: true },
      { name: 'الحد', value: `${settings.protection.antiRaid.threshold} عضو/دقيقة`, inline: true },
      { name: 'الإجراء', value: getActionName(settings.protection.antiRaid.action), inline: true },
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure Anti-Spam
// --------------------------------------------
async function configureAntiSpam(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);
  const maxMessages = interaction.options.getInteger('max_messages');
  const action = interaction.options.getString('action');

  settings.protection.antiSpam.enabled = enabled;
  if (maxMessages) settings.protection.antiSpam.maxMessages = maxMessages;
  if (action) settings.protection.antiSpam.action = action;

  await settings.save();
  invalidateGuildSettings(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle('💬 مضاد السبام')
    .setColor(enabled ? Colors.success : Colors.error)
    .addFields(
      { name: 'الحالة', value: enabled ? '✅ مفعل' : '❌ معطل', inline: true },
      { name: 'الحد الأقصى', value: `${settings.protection.antiSpam.maxMessages} رسائل/5 ثوانٍ`, inline: true },
      { name: 'الإجراء', value: getActionName(settings.protection.antiSpam.action), inline: true },
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure Anti-Link
// --------------------------------------------
async function configureAntiLink(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);
  const whitelist = interaction.options.getString('whitelist');
  const action = interaction.options.getString('action');

  settings.protection.antiLink.enabled = enabled;
  if (whitelist) settings.protection.antiLink.whitelist = whitelist.split(',').map(s => s.trim());
  if (action) settings.protection.antiLink.action = action;

  await settings.save();
  invalidateGuildSettings(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle('🔗 مضاد الروابط')
    .setColor(enabled ? Colors.success : Colors.error)
    .addFields(
      { name: 'الحالة', value: enabled ? '✅ مفعل' : '❌ معطل', inline: true },
      { name: 'الإجراء', value: getActionName(settings.protection.antiLink.action), inline: true },
      {
        name: 'قائمة بيضاء',
        value: settings.protection.antiLink.whitelist.length > 0
          ? settings.protection.antiLink.whitelist.join(', ')
          : 'لا يوجد',
        inline: false,
      },
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure Anti-Invite
// --------------------------------------------
async function configureAntiInvite(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);
  const action = interaction.options.getString('action');

  settings.protection.antiInvite.enabled = enabled;
  if (action) settings.protection.antiInvite.action = action;

  await settings.save();
  invalidateGuildSettings(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle('📨 مضاد الدعوات')
    .setColor(enabled ? Colors.success : Colors.error)
    .addFields(
      { name: 'الحالة', value: enabled ? '✅ مفعل' : '❌ معطل', inline: true },
      { name: 'الإجراء', value: getActionName(settings.protection.antiInvite.action), inline: true },
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure Anti-Nuke
// --------------------------------------------
async function configureAntiNuke(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);
  const threshold = interaction.options.getInteger('threshold');
  const windowSec = interaction.options.getInteger('window');
  const action = interaction.options.getString('action');
  const autoRestore = interaction.options.getBoolean('autorestore');

  if (!settings.protection.antiNuke) settings.protection.antiNuke = {};
  settings.protection.antiNuke.enabled = enabled;
  if (threshold) settings.protection.antiNuke.threshold = threshold;
  if (windowSec) settings.protection.antiNuke.timeWindow = windowSec * 1000;
  if (action) settings.protection.antiNuke.action = action;
  if (autoRestore !== null && autoRestore !== undefined) {
    settings.protection.antiNuke.autoRestore = autoRestore;
  } else if (settings.protection.antiNuke.autoRestore === undefined) {
    settings.protection.antiNuke.autoRestore = true; // الافتراضي: مفعّل
  }

  await settings.save();
  invalidateGuildSettings(interaction.guildId!);

  const n = settings.protection.antiNuke;

  // 🛡️ قراءة تسلّم البوت — أهم مؤشر يحدّد إن كانت العقوبة ستنجح أصلاً
  const hierarchy = interaction.guild
    ? (interaction.client as LibertyClient).securityHandler.checkHierarchy(interaction.guild)
    : null;

  const hierarchyLine = !hierarchy
    ? '—'
    : hierarchy.ok
      ? `✅ البوت أعلى رتبة (\`${hierarchy.botPosition}\`) — **العقوبات تنفّذ فعلاً**`
      : `⛔ **البوت ليس أعلى رتبة** — ${hierarchy.offenderCount} رول فوقه، العقوبات **ستفشل**. ارفع رول البوت!`;

  const embed = new EmbedBuilder()
    .setTitle('💣 مضاد النيوك')
    .setColor(enabled ? Colors.success : Colors.error)
    .addFields(
      { name: 'الحالة', value: enabled ? '✅ مفعل' : '❌ معطل', inline: true },
      { name: 'العتاد', value: `${n.threshold ?? 3} عناصر / ${Math.round((n.timeWindow ?? 10000) / 1000)} ثانية`, inline: true },
      { name: 'عقوبة المخالف', value: getActionName(n.action || 'kick'), inline: true },
      {
        name: '♻️ الاستعادة التلقائية',
        value: n.autoRestore !== false ? '✅ مفعّلة — يُعاد بناء السيرفر من آخر نسخة' : '❌ مطفأة',
        inline: true,
      },
      { name: '🛡️ تسلّم البوت', value: hierarchyLine, inline: false },
      {
        name: 'كيف يعمل؟',
        value:
          'يرصد الحذف المكثف للقنوات/الرولات/الحظر، يحدّد المنفّذ من سجلات التدقيق، ' +
          'ينفّذ العقوبة **بعد التأكد من التسلّم**، ثم **يعيد البناء تلقائياً** من آخر نسخة احتياطية.',
        inline: false,
      },
      ...(hierarchy && !hierarchy.ok
        ? [{
            name: '⚠️ افعل هذا الآن',
            value:
              `Server Settings ← Roles ← اسحب رول البوت (‎${hierarchy.botRoleName}‎) لأعلى القائمة\n` +
              '_أو شغّل `/protection hierarchy` بعد التصحيح للتأكد._',
            inline: false,
          }]
        : [])
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure / Show Hierarchy — فحص التسلّم
// --------------------------------------------
async function configureHierarchy(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: '❌ هذا الأمر داخل السيرفر فقط' });
    return;
  }

  const client = interaction.client as LibertyClient;
  const s = client.securityHandler.checkHierarchy(guild);

  const embed = new EmbedBuilder()
    .setTitle(s.ok ? '🛡️ فحص التسلّم — الحالة ممتازة' : '🚨 فحص التسلّم — ثغرة خطيرة!')
    .setDescription(
      s.ok
        ? '**البوت يملك أعلى رتبة في السيرفر** — يقدر يطرد ويحظر ويسلب الرولات من أي أحد ' +
          'بما فيهم الأشمنستريتر، والاستعادة التلقائية تعمل.'
        : '**البوت ليس أعلى رتبة.** أي رول فوقه يعني أن صاحبه **لا يُمسّ**: مضاد النيوك سيفشل ' +
          'بصمت عند الهجوم، والاستعادة قد تتعطّل. لازم تصلحها الحين.'
    )
    .setColor(s.ok ? Colors.success : Colors.error)
    .addFields(
      { name: '📌 أعلى رتبة للبوت', value: `${s.botRoleName} — الموقع \`#${s.botPosition}\``, inline: true },
      { name: '👥 إجمالي الرولات', value: `${guild.roles.cache.size}`, inline: true },
      {
        name: s.ok ? '✅ فوق البوت' : `⛔ فوق البوت (${s.offenderCount})`,
        value: s.ok ? 'لا يوجد — البوت في القمة' : s.offenders.join('\n') || '—',
        inline: false,
      },
      ...(s.ok
        ? [{
            name: '✅ ماذا يعني هذا؟',
            value:
              '- مضاد النيوك يطرد/يحظر/يسلب الرولات ✅\n' +
              '- الاستعادة التلقائية بعد الهجوم ✅\n' +
              '- منع منح الأدمنستريتر ✅',
            inline: false,
          }]
        : [{
            name: '✅ كيف تصلحها (خطوتين)',
            value:
              '**1.** Server Settings ← Roles\n' +
              `**2.** اسحب رول البوت (‎${s.botRoleName}‎) **لأعلى القائمة** — يبقى الأول تحت @everyone مباشرة\n\n` +
              '_بعد التصحيح شغّل الأمر مرة ثانية للتأكد._',
            inline: false,
          }])
    )
    .setFooter({ text: 'Liberty City — Hierarchy Guard' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure Anti-Bot
// --------------------------------------------
async function configureAntiBot(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);
  const add = interaction.options.getUser('add');
  const remove = interaction.options.getUser('remove');

  if (!settings.protection.antiBot) settings.protection.antiBot = { whitelist: [] };
  if (!settings.protection.antiBot.whitelist) settings.protection.antiBot.whitelist = [];
  settings.protection.antiBot.enabled = enabled;

  const wl: string[] = settings.protection.antiBot.whitelist;
  let note = '';

  if (add) {
    if (!add.bot) {
      note = `ℹ️ \`${add.tag}\` ليس بوتاً — للبوتات استخدم /whitelist، وهذا الاستثناء الوقائي يشمل الأعضاء أيضاً`;
    }
    if (!wl.includes(add.id)) wl.push(add.id);
  }
  if (remove) {
    const idx = wl.indexOf(remove.id);
    if (idx >= 0) wl.splice(idx, 1);
  }

  await settings.save();
  invalidateGuildSettings(interaction.guildId!);

  const whitelistText =
    wl.length > 0
      ? wl.map(id => `• <@${id}> (\`${id}\`)`).join('\n')
      : 'لا يوجد — كل بوت غير البوت الرسمي سيُحظر عند التفعيل';

  const embed = new EmbedBuilder()
    .setTitle('🤖 مضاد البوتات')
    .setColor(enabled ? Colors.success : Colors.error)
    .addFields(
      { name: 'الحالة', value: enabled ? '✅ مفعل' : '❌ معطل', inline: true },
      {
        name: 'ملاحظة',
        value:
          note ||
          'يحظر أي بوت غير مصرح به فوراً — والقائمة البيضاء تستثنيه من الحظر الوقائي فقط',
        inline: false,
      },
      { name: 'القائمة البيضاء الوقائية', value: whitelistText, inline: false },
      {
        name: '⚠️ تنبيه',
        value:
          'الاستثناء يشمل الدخول والفحص التلقائي فقط.\n' +
          '🚨 أي هجوم سريع (حذف/إنشاء/تعديل جماعي أو سبام) يُعاقب فوراً حتى لو كان البوت في القائمة.',
        inline: false,
      }
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure Anti-Admin
// --------------------------------------------
async function configureAntiAdmin(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);

  if (!settings.protection.antiAdmin) settings.protection.antiAdmin = {};
  settings.protection.antiAdmin.enabled = enabled;

  await settings.save();
  invalidateGuildSettings(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle('⚠️ مراقبة منح صلاحية Administrator')
    .setColor(enabled ? Colors.success : Colors.error)
    .addFields(
      { name: 'الحالة', value: enabled ? '✅ مفعل' : '❌ معطل', inline: true },
      {
        name: 'الإجراء',
        value: '📢 تنبيه فقط (لا يعاقب المنفّذ أبداً)',
        inline: true,
      },
      {
        name: 'كيف يعمل؟',
        value: 'يراقب أي رول (بما فيه @everyone) يحصل على Administrator — يحدّد المنفّذ من سجلات التدقيق وينبّهك فوراً. لا يعاقب المنفّذ أبداً حتى لو كان admin streiter.',
        inline: false,
      }
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Configure Auto-Backup
// --------------------------------------------
async function configureAutoBackup(interaction: ChatInputCommandInteraction, settings: any): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);
  const interval = interaction.options.getInteger('interval');
  const createNow = interaction.options.getBoolean('create_now');

  if (!settings.protection.autoBackup)
    settings.protection.autoBackup = { enabled: false, interval: 6, keep: 5 };
  settings.protection.autoBackup.enabled = enabled;
  if (interval) settings.protection.autoBackup.interval = interval;
  if (!settings.protection.autoBackup.keep) settings.protection.autoBackup.keep = 5;

  await settings.save();
  invalidateGuildSettings(interaction.guildId!);

  const lc = interaction.client as LibertyClient;
  await lc.securityHandler.syncAutoBackup(interaction.guild!, false);

  let backupLine = '—';
  if (createNow && enabled) {
    try {
      const r = await lc.securityHandler.createBackup(interaction.guild!);
      backupLine = `✅ أُنشئت نسخة فورية: ${r.channels} قناة + ${r.roles} رول (${(r.size / 1024).toFixed(1)} KB)`;
    } catch (err: any) {
      backupLine = `⚠️ فشل: ${err.message}`;
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('💾 النسخ الاحتياطي التلقائي')
    .setColor(enabled ? Colors.success : Colors.error)
    .addFields(
      { name: 'الحالة', value: enabled ? '✅ مفعل' : '❌ معطل', inline: true },
      {
        name: 'الفاصل',
        value: `كل ${settings.protection.autoBackup.interval ?? 6} ساعة (يحتفظ بآخر 5 نسخ)`,
        inline: true,
      },
      { name: 'النسخة الفورية', value: backupLine, inline: false },
      {
        name: 'الأوامر',
        value: '`/backup list` عرض النسخ • `/backup restore` الاستعادة بعد أي هجوم',
        inline: false,
      }
    )
    .setFooter({ text: 'Liberty City Protection' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Helper
// --------------------------------------------
function getActionName(action: string): string {
  const actions: Record<string, string> = {
    kick: '👢 طرد',
    ban: '🔨 حظر',
    lockdown: '🔒 إغلاق القنوات',
    warn: '⚠️ تحذير',
    mute: '🔇 كتم',
    delete: '🗑️ حذف',
    alert: '📢 تنبيه فقط',
    strip: '🗡️ سلب الرولات',
  };
  return actions[action] || action;
}

export default command;