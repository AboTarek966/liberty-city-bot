// ============================================
// Liberty City Bot - Honeypot Command
// ============================================
// /honeypot setup | disable | status
// قناة طعم: أي رسالة فيها تُحذف ويُعاقب صاحبها فوراً.

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  TextChannel,
  GuildMember,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getGuildSettings, invalidateGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';
import { honeypotActionLabel, HoneypotAction } from '../../utils/honeypot';

const ACTIONS: HoneypotAction[] = ['delete', 'timeout', 'kick', 'ban'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('🍯 قناة الطعم — اصطياد المخترقين والسبام فوراً')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('إعداد قناة الطعم والعقوبة')
        .addChannelOption(o =>
          o
            .setName('channel')
            .setDescription('القناة التي يُمنع الكتابة فيها (قناة الطعم)')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(o =>
          o
            .setName('action')
            .setDescription('العقوبة عند الكتابة في القناة')
            .addChoices(
              { name: '🗑️ حذف الرسالة فقط', value: 'delete' },
              { name: '🔇 كتم مؤقت', value: 'timeout' },
              { name: '👢 طرد', value: 'kick' },
              { name: '🔨 حظر', value: 'ban' }
            )
        )
        .addIntegerOption(o =>
          o
            .setName('timeout_minutes')
            .setDescription('مدة الكتم بالدقائق (عند اختيار كتم)')
            .setMinValue(1)
            .setMaxValue(40320)
        )
        .addChannelOption(o =>
          o
            .setName('log_channel')
            .setDescription('قناة سجل الاصطياد')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption(o =>
          o
            .setName('alert_roles')
            .setDescription('رولات يتم منشنها عند الاصطياد (آيديات/منشن مفصولة بمسافة)')
            .setMaxLength(500)
        )
        .addBooleanOption(o =>
          o.setName('delete_message').setDescription('حذف رسالة المخالف (افتراضي: نعم)')
        )
        .addBooleanOption(o =>
          o.setName('ignore_admins').setDescription('استثناء الإداريين من العقوبة (افتراضي: نعم)')
        )
    )
    .addSubcommand(sub => sub.setName('disable').setDescription('إيقاف قناة الطعم'))
    .addSubcommand(sub => sub.setName('status').setDescription('عرض إعدادات قناة الطعم')),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const settings = await getGuildSettings(guild.id);

    if (sub === 'setup') {
      await interaction.deferReply({ ephemeral: true });

      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const action = (interaction.options.getString('action') || 'ban') as HoneypotAction;

      if (!ACTIONS.includes(action)) {
        await interaction.editReply({ content: '❌ عقوبة غير معروفة' });
        return;
      }

      if (action !== 'delete' && action !== 'timeout' && action !== 'kick' && action !== 'ban') {
        await interaction.editReply({ content: '❌ عقوبة غير صالحة' });
        return;
      }

      const me = guild.members.me;
      const missing: string[] = [];
      if (me) {
        if (action === 'delete' && !me.permissions.has(PermissionFlagsBits.ManageMessages)) {
          missing.push('إدارة الرسائل');
        }
        if (action === 'timeout' && !me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          missing.push('كتم الأعضاء');
        }
        if (action === 'kick' && !me.permissions.has(PermissionFlagsBits.KickMembers)) {
          missing.push('طرد الأعضاء');
        }
        if (action === 'ban' && !me.permissions.has(PermissionFlagsBits.BanMembers)) {
          missing.push('حظر الأعضاء');
        }
      }
      if (missing.length) {
        await interaction.editReply({
          content: `❌ **صلاحيات ناقصة للبوت:** ${missing.join('، ')}\n> امنح البوت الصلاحيات ثم أعد المحاولة.`,
        });
        return;
      }

      // استخراج آيديات الرولات من النص (منشن أو رقم)
      const alertRaw = interaction.options.getString('alert_roles') || '';
      const alertRoleIds = Array.from(
        new Set(
          (alertRaw.match(/\d{17,20}/g) || []).filter(id => guild.roles.cache.has(id))
        )
      );

      settings.honeypot = {
        enabled: true,
        channelId: channel.id,
        action,
        timeoutMinutes: interaction.options.getInteger('timeout_minutes') || 10,
        logChannelId: interaction.options.getChannel('log_channel')?.id || settings.honeypot?.logChannelId,
        alertRoleIds,
        deleteMessage: interaction.options.getBoolean('delete_message') ?? true,
        ignoreAdmins: interaction.options.getBoolean('ignore_admins') ?? true,
      };

      await settings.save();
      invalidateGuildSettings(guild.id);

      await interaction.editReply({
        content:
          `✅ **تم تفعيل قناة الطعم**\n` +
          `> 📢 القناة: ${channel}\n` +
          `> ⚙️ العقوبة: **${honeypotActionLabel(action)}**${
            action === 'timeout' ? ` (${settings.honeypot.timeoutMinutes} دقيقة)` : ''
          }\n` +
          `> 🗑️ حذف الرسالة: ${settings.honeypot.deleteMessage ? '✅' : '❌'}\n` +
          `> 🛡️ استثناء الإداريين: ${settings.honeypot.ignoreAdmins ? '✅' : '❌'}\n` +
          `> 📋 السجل: ${
            settings.honeypot.logChannelId ? `<#${settings.honeypot.logChannelId}>` : '—'
          }\n` +
          `> 🔔 منشن: ${
            alertRoleIds.length ? alertRoleIds.map(id => `<@&${id}>`).join('، ') : '—'
          }\n\n` +
          `> ⚠️ **لا تكتب في القناة أبداً** — أي رسالة فيها تُعتبر مخالفة.`,
      });
      return;
    }

    if (sub === 'disable') {
      if (!settings.honeypot) {
        await interaction.reply({ content: '⚠️ قناة الطعم غير مُعدّة أصلاً', ephemeral: true });
        return;
      }
      settings.honeypot.enabled = false;
      await settings.save();
      invalidateGuildSettings(guild.id);
      await interaction.reply({ content: '🔴 **تم إيقاف قناة الطعم**', ephemeral: true });
      return;
    }

    // status
    const hp = settings.honeypot;
    if (!hp) {
      await interaction.reply({
        content: '📭 قناة الطعم غير مُعدّة — استخدم `/honeypot setup`',
        ephemeral: true,
      });
      return;
    }

    const channel = hp.channelId ? guild.channels.cache.get(hp.channelId) : null;
    const log = hp.logChannelId ? guild.channels.cache.get(hp.logChannelId) : null;
    const me = guild.members.me;
    const canPunish =
      !me ||
      (hp.action === 'delete' && me.permissions.has(PermissionFlagsBits.ManageMessages)) ||
      (hp.action === 'timeout' && me.permissions.has(PermissionFlagsBits.ModerateMembers)) ||
      (hp.action === 'kick' && me.permissions.has(PermissionFlagsBits.KickMembers)) ||
      (hp.action === 'ban' && me.permissions.has(PermissionFlagsBits.BanMembers));

    const embed = new EmbedBuilder()
      .setTitle('🍯 إعدادات قناة الطعم')
      .setColor(hp.enabled ? Colors.success : Colors.error)
      .addFields(
        { name: '⚡ الحالة', value: hp.enabled ? '🟢 مفعّلة' : '🔴 معطّلة', inline: true },
        { name: '📢 القناة', value: channel ? `${channel}` : '❌ غير محددة', inline: true },
        { name: '⚙️ العقوبة', value: honeypotActionLabel(hp.action), inline: true },
        {
          name: '⏱️ مدة الكتم',
          value: hp.action === 'timeout' ? `${hp.timeoutMinutes} دقيقة` : '—',
          inline: true,
        },
        { name: '🗑️ حذف الرسالة', value: hp.deleteMessage ? '✅' : '❌', inline: true },
        { name: '🛡️ استثناء الإداريين', value: hp.ignoreAdmins ? '✅' : '❌', inline: true },
        { name: '📋 السجل', value: log ? `${log}` : '—', inline: true },
        {
          name: '🔔 منشن',
          value: hp.alertRoleIds?.length
            ? hp.alertRoleIds.map((id: string) => `<@&${id}>`).join('، ')
            : '—',
          inline: false,
        },
        {
          name: '✅ جاهزية البوت',
          value: canPunish ? '🟢 يملك الصلاحيات المطلوبة' : '🔴 صلاحيات ناقصة — راجع إعدادات الرول',
          inline: false,
        }
      )
      .setFooter({ text: `${guild.name} • Liberty City Honeypot` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
