// ============================================
// Omni Bot - Auto Reply Command (رد تلقائي)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getGuildSettings, invalidateGuildSettings } from '../../models';

const DEFAULTS = {
  enabled: false,
  channelIds: [] as string[],
  text: '',
  imageUrl: undefined as string | undefined,
  deleteTrigger: false,
  replyToMessage: true,
  ignoreStaff: true,
  cooldownSeconds: 30,
};

async function ensureConfig(settings: any): Promise<any> {
  if (!settings.autoReply) settings.autoReply = { ...DEFAULTS, channelIds: [] };
  if (!Array.isArray(settings.autoReply.channelIds)) settings.autoReply.channelIds = [];
  return settings.autoReply;
}

function isManager(interaction: ChatInputCommandInteraction): boolean {
  const member = interaction.member as any;
  const perms = member?.permissions;
  if (!perms) return false;
  return (
    perms.has(PermissionFlagsBits.ManageGuild) ||
    perms.has(PermissionFlagsBits.Administrator) ||
    interaction.user.id === interaction.guild?.ownerId
  );
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('autoreply')
    .setDescription('💬 الرد التلقائي — كلمة و/أو صورة في قنوات محددة')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('إعداد الرد التلقائي وقناته')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('القناة التي يعمل فيها الرد التلقائي')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('text').setDescription('الكلمة أو النص الذي يرسله البوت').setMaxLength(2000).setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName('image').setDescription('رابط صورة يرسلها البوت (اختياري)').setMaxLength(500).setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('cooldown')
            .setDescription('الفاصل الزمني بالثواني لكل عضو (0 = بدون)')
            .setMinValue(0)
            .setMaxValue(3600)
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName('delete').setDescription('حذف رسالة العضو بعد الرد؟').setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName('reply').setDescription('الرد كـ Reply على رسالة العضو؟').setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName('ignore_staff').setDescription('تجاهل رسائل الإداريين؟').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('إضافة قناة أخرى للرد التلقائي')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('القناة المراد إضافتها')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('إزالة قناة من الرد التلقائي')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('القناة المراد إزالتها')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('on').setDescription('تشغيل الرد التلقائي'))
    .addSubcommand((sub) => sub.setName('off').setDescription('إيقاف الرد التلقائي'))
    .addSubcommand((sub) => sub.setName('status').setDescription('عرض إعدادات الرد التلقائي الحالية'))
    .addSubcommand((sub) => sub.setName('clear').setDescription('مسح الرد التلقائي بالكامل (نص/صورة/قنوات)')),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    if (!isManager(interaction)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const settings = (await getGuildSettings(interaction.guild.id)) as any;
    const cfg = await ensureConfig(settings);

    const save = async () => {
      await settings.save();
      invalidateGuildSettings(interaction.guild!.id);
    };

    const channelsText = () =>
      cfg.channelIds.length
        ? cfg.channelIds.map((id: string) => `<#${id}>`).join('، ')
        : '— لا توجد قنوات —';

    switch (sub) {
      case 'setup': {
        const channel = interaction.options.getChannel('channel', true);
        const text = interaction.options.getString('text');
        const image = interaction.options.getString('image');
        const cooldown = interaction.options.getInteger('cooldown');
        const del = interaction.options.getBoolean('delete');
        const reply = interaction.options.getBoolean('reply');
        const ignoreStaff = interaction.options.getBoolean('ignore_staff');

        if (image && !/^https?:\/\/\S+$/i.test(image)) {
          await interaction.reply({
            content: '❌ رابط الصورة يجب أن يبدأ بـ http:// أو https://',
            ephemeral: true,
          });
          return;
        }

        cfg.channelIds = [channel!.id];
        if (text !== null && text !== undefined) cfg.text = text.trim();
        if (image !== null && image !== undefined) cfg.imageUrl = image.trim();
        if (cooldown !== null && cooldown !== undefined) cfg.cooldownSeconds = cooldown;
        if (del !== null && del !== undefined) cfg.deleteTrigger = del;
        if (reply !== null && reply !== undefined) cfg.replyToMessage = reply;
        if (ignoreStaff !== null && ignoreStaff !== undefined) cfg.ignoreStaff = ignoreStaff;
        cfg.enabled = true;

        if (!String(cfg.text || '').trim() && !String(cfg.imageUrl || '').trim()) {
          await interaction.reply({
            content: '⚠️ تم تحديد القناة، لكن لا يوجد نص ولا صورة بعد — أضف `text` أو `image`',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content:
              `✅ **تم تفعيل الرد التلقائي** في ${channelsText()}\n` +
              `> 💬 النص: ${cfg.text ? cfg.text.slice(0, 200) : '—'}\n` +
              `> 🖼️ الصورة: ${cfg.imageUrl ? '✅ موجودة' : '—'}\n` +
              `> ⏱️ الفاصل: ${cfg.cooldownSeconds} ثانية`,
            ephemeral: true,
          });
        }
        await save();
        return;
      }
      case 'add': {
        const channel = interaction.options.getChannel('channel', true);
        if (cfg.channelIds.includes(channel!.id)) {
          await interaction.reply({ content: '⚠️ القناة مضافة بالفعل', ephemeral: true });
          return;
        }
        if (cfg.channelIds.length >= 10) {
          await interaction.reply({ content: '❌ الحد الأقصى 10 قنوات', ephemeral: true });
          return;
        }
        cfg.channelIds.push(channel!.id);
        await save();
        await interaction.reply({
          content: `✅ تمت إضافة <#${channel!.id}> — القنوات الحالية: ${channelsText()}`,
          ephemeral: true,
        });
        return;
      }
      case 'remove': {
        const channel = interaction.options.getChannel('channel', true);
        if (!cfg.channelIds.includes(channel!.id)) {
          await interaction.reply({ content: '⚠️ القناة غير مضافة', ephemeral: true });
          return;
        }
        cfg.channelIds = cfg.channelIds.filter((id: string) => id !== channel!.id);
        await save();
        await interaction.reply({
          content: `🗑️ تمت إزالة <#${channel!.id}> — القنوات الحالية: ${channelsText()}`,
          ephemeral: true,
        });
        return;
      }
      case 'on': {
        if (!cfg.channelIds.length) {
          await interaction.reply({
            content: '⚠️ حدد قناة أولاً: `/autoreply setup channel:#قناة text:...`',
            ephemeral: true,
          });
          return;
        }
        cfg.enabled = true;
        await save();
        await interaction.reply({ content: `✅ تم تشغيل الرد التلقائي في ${channelsText()}`, ephemeral: true });
        return;
      }
      case 'off': {
        cfg.enabled = false;
        await save();
        await interaction.reply({ content: '⏸️ تم إيقاف الرد التلقائي (الإعدادات محفوظة)', ephemeral: true });
        return;
      }
      case 'status': {
        const embed = new EmbedBuilder()
          .setTitle('💬 الرد التلقائي')
          .setColor(cfg.enabled ? 0x1abc9c : 0xe74c3c)
          .setDescription(
            `> ⚡ **الحالة:** ${cfg.enabled ? '🟢 مفعّل' : '🔴 معطّل'}\n` +
              `> 📍 **القنوات:** ${channelsText()}\n` +
              `> 💬 **النص:** ${cfg.text ? cfg.text.slice(0, 500) : '— لا يوجد —'}\n` +
              `> 🖼️ **الصورة:** ${cfg.imageUrl ? `[عرض](${cfg.imageUrl})` : '— لا توجد —'}\n` +
              `> 🗑️ **حذف رسالة العضو:** ${cfg.deleteTrigger ? 'نعم' : 'لا'}\n` +
              `> ↩️ **الرد كـ Reply:** ${cfg.replyToMessage !== false ? 'نعم' : 'لا'}\n` +
              `> 🛡️ **تجاهل الإداريين:** ${cfg.ignoreStaff !== false ? 'نعم' : 'لا'}\n` +
              `> ⏱️ **الفاصل:** ${cfg.cooldownSeconds} ثانية`
          )
          .setFooter({ text: interaction.guild.name });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      case 'clear': {
        (settings as any).autoReply = { ...DEFAULTS, channelIds: [] };
        await save();
        await interaction.reply({ content: '🧹 تم مسح الرد التلقائي بالكامل وتوقفه', ephemeral: true });
        return;
      }
      default:
        await interaction.reply({ content: '❌ أمر فرعي غير معروف', ephemeral: true });
    }
  },
};

export default command;
