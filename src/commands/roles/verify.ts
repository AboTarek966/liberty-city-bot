// ============================================
// Omni Bot - Verify Setup Command
// ============================================
// /verify setup | send | disable | status
// بوابة تحقق كاملة: رول + قناة + عمر الحساب + كابتشا + رول حجر + سجل

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getGuildSettings, invalidateGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';
import { getAccountAgeDays } from '../../utils/verification';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('✅ بوابة التحقق — إعداد رسالة التوثيق وشروطها')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('setup')
        .setDescription('إعداد بوابة التحقق')
        .addRoleOption(o =>
          o.setName('role').setDescription('الرول الذي يُعطى بعد التوثيق').setRequired(true)
        )
        .addChannelOption(o =>
          o
            .setName('channel')
            .setDescription('قناة رسالة التوثيق (افتراضي: الحالية)')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addIntegerOption(o =>
          o
            .setName('min_account_age_days')
            .setDescription('أقل عمر للحساب بالأيام (0 = بدون حد)')
            .setMinValue(0)
            .setMaxValue(365)
        )
        .addBooleanOption(o =>
          o.setName('captcha').setDescription('تفعيل كابتشا رياضية قبل منح الرول')
        )
        .addRoleOption(o =>
          o.setName('quarantine_role').setDescription('رول الحجر — يُزال عند التوثيق الناجح')
        )
        .addChannelOption(o =>
          o
            .setName('log_channel')
            .setDescription('قناة سجل التوثيق')
            .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption(o =>
          o.setName('kick_on_fail').setDescription('طرد الحساب الذي لا يستوفي شرط العمر')
        )
        .addStringOption(o =>
          o.setName('title').setDescription('عنوان رسالة التوثيق').setMaxLength(256)
        )
        .addStringOption(o =>
          o.setName('description').setDescription('وصف رسالة التوثيق').setMaxLength(1000)
        )
        .addStringOption(o =>
          o.setName('button_label').setDescription('نص زر التوثيق').setMaxLength(80)
        )
    )
    .addSubcommand(sub => sub.setName('send').setDescription('إرسال/تحديث رسالة التوثيق في القناة'))
    .addSubcommand(sub => sub.setName('disable').setDescription('إيقاف بوابة التحقق'))
    .addSubcommand(sub => sub.setName('status').setDescription('عرض حالة بوابة التحقق')),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;
    const settings = await getGuildSettings(guild.id);
    const v = settings.verification;

    if (sub === 'setup') {
      await interaction.deferReply({ ephemeral: true });

      const role = interaction.options.getRole('role', true);
      const channel =
        (interaction.options.getChannel('channel') as TextChannel | null) ||
        (interaction.channel as TextChannel | null);

      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.editReply({ content: '❌ اختر قناة نصية صالحة' });
        return;
      }

      const me = guild.members.me;
      if (me && me.roles.highest.position <= role.position) {
        await interaction.editReply({
          content:
            `❌ **لا أستطيع إعطاء ${role}** — رتبة البوت يجب أن تكون أعلى من رول التوثيق.\n` +
            `> ارفع رتبة البوت من إعدادات السيرفر ثم أعد المحاولة.`,
        });
        return;
      }

      v.enabled = true;
      v.roleId = role.id;
      v.channelId = channel.id;
      v.minAccountAgeDays = interaction.options.getInteger('min_account_age_days') ?? v.minAccountAgeDays ?? 0;
      v.captchaEnabled = interaction.options.getBoolean('captcha') ?? v.captchaEnabled ?? false;
      v.quarantineRoleId = interaction.options.getRole('quarantine_role')?.id || v.quarantineRoleId;
      v.logChannelId = interaction.options.getChannel('log_channel')?.id || v.logChannelId;
      v.kickOnFail = interaction.options.getBoolean('kick_on_fail') ?? v.kickOnFail ?? false;
      if (interaction.options.getString('title')) v.title = interaction.options.getString('title')!;
      if (interaction.options.getString('description')) {
        v.description = interaction.options.getString('description')!;
      }
      if (interaction.options.getString('button_label')) {
        v.buttonLabel = interaction.options.getString('button_label')!;
      }

      await settings.save();
      invalidateGuildSettings(guild.id);

      const sent = await sendVerificationPanel(guild, settings);
      await interaction.editReply({
        content:
          `✅ **تم إعداد بوابة التحقق**\n` +
          `> 🛡️ الرول: ${role}\n` +
          `> 📢 القناة: ${channel}\n` +
          `> 🕰️ أقل عمر: \`${v.minAccountAgeDays || 0}\` يوم\n` +
          `> 🧮 كابتشا: ${v.captchaEnabled ? '✅ مفعّلة' : '❌ معطّلة'}\n` +
          `> 🚧 رول الحجر: ${v.quarantineRoleId ? `<@&${v.quarantineRoleId}>` : '—'}\n` +
          `> 👢 طرد عند الفشل: ${v.kickOnFail ? '✅' : '❌'}\n\n` +
          (sent.ok ? `📤 تم إرسال رسالة التوثيق في ${channel}` : `⚠️ ${sent.message}`),
      });
      return;
    }

    if (sub === 'send') {
      await interaction.deferReply({ ephemeral: true });
      const result = await sendVerificationPanel(guild, settings);
      await interaction.editReply({ content: result.message });
      return;
    }

    if (sub === 'disable') {
      v.enabled = false;
      await settings.save();
      invalidateGuildSettings(guild.id);
      await interaction.reply({ content: '🔴 **تم إيقاف بوابة التحقق** — لن يعمل زر التوثيق.', ephemeral: true });
      return;
    }

    // status
    const role = v.roleId ? guild.roles.cache.get(v.roleId) : null;
    const channel = v.channelId ? guild.channels.cache.get(v.channelId) : null;
    const quarantine = v.quarantineRoleId ? guild.roles.cache.get(v.quarantineRoleId) : null;
    const log = v.logChannelId ? guild.channels.cache.get(v.logChannelId) : null;

    const embed = new EmbedBuilder()
      .setTitle('✅ حالة بوابة التحقق')
      .setColor(v.enabled ? Colors.success : Colors.error)
      .addFields(
        { name: '⚡ الحالة', value: v.enabled ? '🟢 مفعّلة' : '🔴 معطّلة', inline: true },
        { name: '🛡️ الرول', value: role ? `${role}` : '❌ غير محدد', inline: true },
        { name: '📢 القناة', value: channel ? `${channel}` : '❌ غير محددة', inline: true },
        {
          name: '🕰️ عمر الحساب',
          value: v.minAccountAgeDays ? `\`${v.minAccountAgeDays}\` يوم` : 'بدون حد',
          inline: true,
        },
        { name: '🧮 كابتشا', value: v.captchaEnabled ? '🟢 مفعّلة' : '🔴 معطّلة', inline: true },
        { name: '🚧 رول الحجر', value: quarantine ? `${quarantine}` : '—', inline: true },
        {
          name: '🚧 حجر تلقائي',
          value: v.autoQuarantine !== false ? '🟢 نعم' : '🔴 لا',
          inline: true,
        },
        { name: '👢 طرد عند الفشل', value: v.kickOnFail ? '🟢 نعم' : '🔴 لا', inline: true },
        { name: '📋 السجل', value: log ? `${log}` : '—', inline: true },
        {
          name: '👥 عمر حسابك',
          value: `${getAccountAgeDays(interaction.user)} يوم`,
          inline: true,
        }
      )
      .setFooter({ text: `${guild.name} • Verification` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

// --------------------------------------------
// Send / refresh the verification message
// --------------------------------------------
export async function sendVerificationPanel(
  guild: any,
  settings: any
): Promise<{ ok: boolean; message: string }> {
  const v = settings.verification;
  if (!v?.roleId || !v?.channelId) {
    return { ok: false, message: '⚠️ حدد رول التوثيق والقناة أولاً باستخدام `/verify setup`' };
  }

  const channel = guild.channels.cache.get(v.channelId) as TextChannel | undefined;
  if (!channel || !channel.isTextBased()) {
    return { ok: false, message: '❌ قناة التوثيق غير موجودة أو ليست نصية' };
  }

  const role = guild.roles.cache.get(v.roleId);
  if (!role) return { ok: false, message: '❌ رول التوثيق لم يعد موجوداً' };

  const me = guild.members.me;
  if (me && me.roles.highest.position <= role.position) {
    return {
      ok: false,
      message: '⚠️ **ارفع رتبة البوت أعلى من رول التوثيق** حتى يتمكن من إعطائه',
    };
  }

  const embed = new EmbedBuilder()
    .setTitle(v.title || '✅ توثيق العضوية')
    .setDescription(v.description || 'اضغط الزر بالأسفل للحصول على رتبة العضو')
    .setColor(Colors.success)
    .setFooter({ text: `${guild.name} • Verification` })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('verify')
    .setLabel(v.buttonLabel || 'توثيق')
    .setStyle(ButtonStyle.Success);

  if (v.buttonEmoji) {
    try {
      button.setEmoji(v.buttonEmoji);
    } catch {
      /* إيموجي غير صالح — نتجاهله */
    }
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  // حذف الرسالة القديمة إن وُجدت
  if (v.messageId) {
    const old = await channel.messages.fetch(v.messageId).catch(() => null);
    if (old) await old.delete().catch(() => {});
  }

  try {
    const message = await channel.send({ embeds: [embed], components: [row] });
    v.messageId = message.id;
    await settings.save();
    return { ok: true, message: `📤 تم إرسال رسالة التوثيق في ${channel}` };
  } catch (error: any) {
    return { ok: false, message: `❌ فشل إرسال رسالة التوثيق: \`${error.message}\`` };
  }
}

export default command;
