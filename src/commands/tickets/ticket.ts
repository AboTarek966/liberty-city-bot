// ============================================
// Liberty City Bot - Ticket Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';
import { getGuildSettings, Ticket } from '../../models';
import { buildTicketTopPage, sanitizeTicketTopPeriod } from '../../utils/ticketTop';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('نظام التذاكر الشامل')
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('إعداد نظام التذاكر')
        .addChannelOption(opt =>
          opt
            .setName('category')
            .setDescription('فئة التذاكر')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addChannelOption(opt =>
          opt
            .setName('log_channel')
            .setDescription('قناة سجل التذاكر')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(opt =>
          opt
            .setName('support_role')
            .setDescription('رول الدعم الفني')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('إنشاء لوحة التذاكر')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('قناة اللوحة')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('title')
            .setDescription('عنوان اللوحة')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('description')
            .setDescription('وصف اللوحة')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('emoji')
            .setDescription('إيموجي اللوحة')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('close')
        .setDescription('إغلاق التذكرة الحالية')
        .addStringOption(opt =>
          opt
            .setName('reason')
            .setDescription('سبب الإغلاق')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('claim')
        .setDescription('استلام التذكرة')
    )
    .addSubcommand(sub =>
      sub
        .setName('stats')
        .setDescription('عرض إحصائيات التذاكر')
    )
    .addSubcommand(sub =>
      sub
        .setName('mystats')
        .setDescription('📊 عرض عدد التذاكر التي استلمتها')
    )
    .addSubcommand(sub =>
      sub
        .setName('top')
        .setDescription('🏆 أعلى إداريين في استلام التذاكر — يومي/أسبوعي/شهري')
        .addStringOption(opt =>
          opt
            .setName('period')
            .setDescription('الفترة الزمنية')
            .setRequired(false)
            .addChoices(
              { name: '📅 يومي', value: 'day' },
              { name: '📆 أسبوعي', value: 'week' },
              { name: '🗓️ شهري', value: 'month' },
              { name: '📈 إجمالي', value: 'total' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('إضافة عضو للتذكرة')
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('العضو')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('إزالة عضو من التذكرة')
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('العضو')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('addrole')
        .setDescription('إضافة رول يمكنه استلام التذاكر')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('الرول المضاف')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('removerole')
        .setDescription('إزالة رول من فريق التذاكر')
        .addRoleOption(opt =>
          opt
            .setName('role')
            .setDescription('الرول المُزال')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('roles')
        .setDescription('عرض رولات فريق التذاكر')
    )
    .addSubcommand(sub =>
      sub
        .setName('idle')
        .setDescription('⏳ الإغلاق التلقائي للتذاكر الخاملة (ساعة بدون نشاط)')
        .addIntegerOption(opt =>
          opt
            .setName('hours')
            .setDescription('عدد الساعات — 0 = إيقاف الإغلاق التلقائي')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(720)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('image')
        .setDescription('🖼️ ضبط صورة/بانر لوحة التذاكر (اختياري)')
        .addAttachmentOption(opt =>
          opt
            .setName('file')
            .setDescription('ارفع الصورة — اتركها فارغة لحذف الصورة الحالية')
            .setRequired(false)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'setup':
        return handleSetup(interaction, client);
      case 'panel':
        return handlePanel(interaction, client);
      case 'close':
        return handleClose(interaction, client);
      case 'claim':
        return handleClaim(interaction, client);
      case 'stats':
        return handleStats(interaction, client);
      case 'mystats':
        return handleMyStats(interaction);
      case 'top':
        return handleTop(interaction);
      case 'add':
        return handleAdd(interaction);
      case 'remove':
        return handleRemove(interaction);
      case 'addrole':
        return handleAddRole(interaction);
      case 'removerole':
        return handleRemoveRole(interaction);
      case 'roles':
        return handleListRoles(interaction);
      case 'idle':
        return handleIdle(interaction);
      case 'image':
        return handleImage(interaction, client);
    }
  },
};

// --------------------------------------------
// Panel Image (صورة/بانر اللوحة — اختياري)
// --------------------------------------------
async function handleImage(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  const file = interaction.options.getAttachment('file');
  const settings = await getGuildSettings(interaction.guildId!);
  const panels = settings.tickets.panels;
  const panel = panels[panels.length - 1];

  if (!panel) {
    await interaction.reply({ content: '⚠️ لا توجد لوحة تذاكر بعد — أنشئها أولاً بـ `/ticket panel`', ephemeral: true });
    return;
  }

  if (file) {
    if (!/\.(png|jpe?g|gif|webp)$/i.test(file.name || file.url)) {
      await interaction.reply({ content: '❌ الملف ليس صورة مدعومة (png/jpg/gif/webp)', ephemeral: true });
      return;
    }
    panel.image = file.url;
  } else {
    panel.image = undefined as any;
  }

  await settings.save();
  await client.ticketHandler.updatePanelMessage(interaction.guild!, panel).catch(() => {});

  await interaction.reply({
    content: file
      ? '✅ تم ضبط الصورة كبانر للوحة وتحديث رسالة اللوحة فوراً'
      : '🗑️ تم حذف صورة اللوحة وتحديث الرسالة',
    ephemeral: true,
  });
}

// --------------------------------------------
// Idle Auto-Close (الإغلاق التلقائي عند الخمول)
// --------------------------------------------
async function handleIdle(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
    return;
  }
  const hours = interaction.options.getInteger('hours', true);
  const settings = await getGuildSettings(interaction.guildId!);
  settings.tickets.autoCloseHours = hours;
  await settings.save();

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(hours > 0 ? Colors.success : Colors.warning)
        .setTitle('⏳ الإغلاق التلقائي')
        .setDescription(
          hours > 0
            ? `سيتم تحذير التذاكر الخاملة ثم إغلاقها بعد **${hours} ساعة** بدون نشاط\nيُفحص كل 15 دقيقة — وأي رسالة في التذكرة تُعيد عدّاد النشاط`
            : `تم **إيقاف** الإغلاق التلقائي — لن تُغلق أي تذكرة بسبب الخمول`
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}

// --------------------------------------------
// Add Support Role
// --------------------------------------------
async function handleAddRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const role = interaction.options.getRole('role', true);

  await interaction.deferReply({ ephemeral: true });

  const settings = await getGuildSettings(interaction.guildId!);

  if (settings.tickets.supportRoleIds.includes(role.id)) {
    await interaction.editReply({ content: '⚠️ هذا الرول موجود بالفعل في فريق التذاكر' });
    return;
  }

  settings.tickets.supportRoleIds.push(role.id);
  await settings.save();

  const embed = new EmbedBuilder()
    .setTitle('✅ تم إضافة الرول')
    .setColor(Colors.success)
    .setDescription(
      `${role} أصبح الآن من فريق الدعم ويستطيع:\n` +
      `🤝 استلام التذاكر واستلام إشعاراتها\n` +
      `📂 رؤية جميع قنوات التذاكر\n` +
      `🔒 إغلاق وحذف التذاكر`
    )
    .setFooter({ text: 'Liberty City Tickets' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Remove Support Role
// --------------------------------------------
async function handleRemoveRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const role = interaction.options.getRole('role', true);

  await interaction.deferReply({ ephemeral: true });

  const settings = await getGuildSettings(interaction.guildId!);
  const index = settings.tickets.supportRoleIds.indexOf(role.id);

  if (index === -1) {
    await interaction.editReply({ content: '⚠️ هذا الرول ليس في فريق التذاكر' });
    return;
  }

  settings.tickets.supportRoleIds.splice(index, 1);
  await settings.save();

  await interaction.editReply({
    content: `✅ تم إزالة ${role} من فريق التذاكر`,
  });
}

// --------------------------------------------
// List Support Roles
// --------------------------------------------
async function handleListRoles(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const settings = await getGuildSettings(interaction.guildId!);
  const roleIds = settings.tickets.supportRoleIds;

  const embed = new EmbedBuilder()
    .setTitle('🛡️ رولات فريق التذاكر')
    .setColor(Colors.primary)
    .setDescription(
      roleIds.length > 0
        ? roleIds.map((id: string) => `• <@&${id}>`).join('\n')
        : 'لا توجد رولات مُضافة بعد.\nاستخدم `/ticket addrole role:@الرول` لإضافة رول.'
    )
    .addFields(
      { name: '📁 فئة التذاكر', value: settings.tickets.categoryId ? `<#${settings.tickets.categoryId}>` : 'غير محددة', inline: true },
      { name: '📋 قناة السجلات', value: settings.tickets.logChannelId ? `<#${settings.tickets.logChannelId}>` : 'غير محددة', inline: true },
      { name: '🔢 الحد الأقصى/عضو', value: `${settings.tickets.maxPerUser}`, inline: true },
    )
    .setFooter({ text: 'Liberty City Tickets' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Setup
// --------------------------------------------
async function handleSetup(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  const category = interaction.options.getChannel('category', true) as any;
  const logChannel = interaction.options.getChannel('log_channel') as TextChannel | null;
  const supportRole = interaction.options.getRole('support_role');

  await interaction.deferReply({ ephemeral: true });

  const settings = await getGuildSettings(interaction.guildId!);

  settings.tickets.categoryId = category.id;
  if (logChannel) settings.tickets.logChannelId = logChannel.id;
  if (supportRole) {
    if (!settings.tickets.supportRoleIds.includes(supportRole.id)) {
      settings.tickets.supportRoleIds.push(supportRole.id);
    }
  }

  await settings.save();

  const embed = new EmbedBuilder()
    .setTitle('✅ تم إعداد نظام التذاكر')
    .setColor(Colors.success)
    .addFields(
      { name: '📁 الفئة', value: `${category}`, inline: true },
      { name: '📋 قناة السجلات', value: logChannel ? `${logChannel}` : 'غير محددة', inline: true },
      { name: '🛡️ رول الدعم', value: supportRole ? `${supportRole}` : 'غير محدد', inline: true },
      { name: '📊 الحد الأقصى للمستخدم', value: `${settings.tickets.maxPerUser}`, inline: true },
    )
    .setFooter({ text: 'Liberty City Tickets' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Panel
// --------------------------------------------
async function handlePanel(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  const title = interaction.options.getString('title', true);
  const description = interaction.options.getString('description', true);
  const emoji = interaction.options.getString('emoji') || '🎫';

  await interaction.deferReply({ ephemeral: true });

  const result = await client.ticketHandler.createPanel(
    interaction.guild!,
    channel,
    {
      id: '',
      name: title,
      description,
      emoji,
      type: 'select',
      fields: [],
      supportRoleIds: [],
    }
  );

  const embed = new EmbedBuilder()
    .setTitle('✅ تم إنشاء لوحة التذاكر')
    .setColor(Colors.success)
    .addFields(
      { name: '📍 القناة', value: `${channel}`, inline: true },
      { name: '🆔 معرف اللوحة', value: `\`${result.panel.id}\``, inline: true },
      {
        name: 'ℹ️ ملاحظات',
        value:
          '> • تم **استبدال** اللوحة القديمة تلقائياً (لوحة واحدة فقط)\n' +
          '> • الأنواع المكتوبة في اللوحة القديمة **تُرث تلقائياً**\n' +
          '> • عدّل النصوص والأنواع من `/settings` → 🎫 التذاكر',
        inline: false,
      }
    )
    .setFooter({ text: 'Liberty City Tickets' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Close
// --------------------------------------------
async function handleClose(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  const reason = interaction.options.getString('reason');

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.guild!.members.cache.get(interaction.user.id)!;

  // Check if this is a ticket channel
  const ticket = await Ticket.findOne({ channelId: interaction.channelId });
  if (!ticket) {
    await interaction.editReply({
      content: '❌ هذه ليست قناة تذكرة',
    });
    return;
  }

  // Check permissions (ticket creator or support role)
  const settings = await getGuildSettings(interaction.guildId!);
  const isSupport = settings.tickets.supportRoleIds.some((r: string) => member.roles.cache.has(r));
  const isCreator = ticket.userId === interaction.user.id;

  if (!isSupport && !isCreator && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply({
      content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة',
    });
    return;
  }

  try {
    const result = await client.ticketHandler.closeTicket(
      interaction.channelId,
      member,
      reason || undefined
    );

    // The channel will be deleted automatically
    await interaction.editReply({
      content: '✅ جارٍ إغلاق التذكرة...',
    });
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ حدث خطأ: ${error.message}`,
    });
  }
}

// --------------------------------------------
// Claim
// --------------------------------------------
async function handleClaim(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const member = interaction.guild!.members.cache.get(interaction.user.id)!;

  // Check permissions
  const settings = await getGuildSettings(interaction.guildId!);
  const isSupport = settings.tickets.supportRoleIds.some((r: string) => member.roles.cache.has(r));

  if (!isSupport && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply({
      content: '❌ يجب أن تكون من فريق الدعم لاستلام التذاكر',
    });
    return;
  }

  try {
    const ticket = await client.ticketHandler.claimTicket(interaction.channelId, member);

    await interaction.editReply({
      content: `✅ تم استلام التذكرة بواسطة ${member}`,
    });
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ حدث خطأ: ${error.message}`,
    });
  }
}

// --------------------------------------------
// Stats
// --------------------------------------------
async function handleStats(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const stats = await client.ticketHandler.getTicketStats(interaction.guildId!);

  const embed = new EmbedBuilder()
    .setTitle('📊 إحصائيات التذاكر')
    .setColor(Colors.primary)
    .addFields(
      { name: '📦 إجمالي التذاكر', value: `${stats.total}`, inline: true },
      { name: '🟢 مفتوحة', value: `${stats.open}`, inline: true },
      { name: '🔵 مستلمة', value: `${stats.claimed}`, inline: true },
      { name: '🟡 بالانتظار', value: `${stats.waiting}`, inline: true },
      { name: '🔴 مغلقة', value: `${stats.closed}`, inline: true },
    )
    .setFooter({ text: 'Liberty City Tickets' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// My Stats (عدد التذاكر المستلمة لهذا الإداري)
// --------------------------------------------
async function handleMyStats(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const settings = await getGuildSettings(interaction.guildId!);
  const count = settings.tickets.claimStats?.get(interaction.user.id) || 0;

  const embed = new EmbedBuilder()
    .setTitle('📊 إحصائياتك في التذاكر')
    .setColor(Colors.primary)
    .setDescription(
      `👤 ${interaction.user}\n\n` +
      `🤝 **التذاكر التي استلمتها:** \`${count}\`\n\n` +
      `📌 هذا العداد يشمل فقط التذاكر التي قمت باستلامها (وليس فتحها).`
    )
    .setFooter({ text: 'Liberty City Tickets' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Top (أعلى 10 إداريين في استلام التذاكر)
// --------------------------------------------
async function handleTop(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const period = sanitizeTicketTopPeriod(interaction.options.getString('period'));
  const result = await buildTicketTopPage(interaction.guild!, period, 1);
  await interaction.editReply({ embeds: [result.embed], components: result.components });
}

// --------------------------------------------
// Add
// --------------------------------------------
async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser('user', true);

  await interaction.deferReply({ ephemeral: true });

  const ticket = await Ticket.findOne({ channelId: interaction.channelId });
  if (!ticket) {
    await interaction.editReply({
      content: '❌ هذه ليست قناة تذكرة',
    });
    return;
  }

  const channel = interaction.channel as TextChannel;

  await channel.permissionOverwrites.edit(target.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
  });

  await interaction.editReply({
    content: `✅ تم إضافة ${target} إلى التذكرة`,
  });
}

// --------------------------------------------
// Remove
// --------------------------------------------
async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser('user', true);

  await interaction.deferReply({ ephemeral: true });

  const ticket = await Ticket.findOne({ channelId: interaction.channelId });
  if (!ticket) {
    await interaction.editReply({
      content: '❌ هذه ليست قناة تذكرة',
    });
    return;
  }

  const channel = interaction.channel as TextChannel;

  await channel.permissionOverwrites.delete(target.id);

  await interaction.editReply({
    content: `✅ تم إزالة ${target} من التذكرة`,
  });
}

export default command;