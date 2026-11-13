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
import {
  downloadAutoReplyAttachment,
  prepareAutoReplyImage,
  PreparedAutoReplyImage,
} from '../../utils/autoReplyImage';

const DEFAULTS = {
  enabled: false,
  channelIds: [] as string[],
  text: '',
  imageUrl: undefined as string | undefined,
  imageData: undefined as string | undefined,
  imageMimeType: undefined as string | undefined,
  imageName: undefined as string | undefined,
  deleteTrigger: false,
  replyToMessage: true,
  ignoreStaff: true,
  cooldownSeconds: 30,
};

async function prepareAttachmentImage(attachment: any): Promise<PreparedAutoReplyImage> {
  const buffer = await downloadAutoReplyAttachment(attachment.url);
  return prepareAutoReplyImage(buffer, attachment.contentType || '', attachment.name || '');
}

function applyDeviceImage(cfg: any, prepared: PreparedAutoReplyImage): void {
  cfg.imageData = prepared.base64;
  cfg.imageMimeType = prepared.mimeType;
  cfg.imageName = prepared.name;
  // الصورة من الجهاز لها أولوية — لا نُبقي رابطاً قديماً يربك المستخدم
  cfg.imageUrl = '';
}

function clearDeviceImage(cfg: any): void {
  cfg.imageData = '';
  cfg.imageMimeType = '';
  cfg.imageName = '';
}

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
          opt
            .setName('image')
            .setDescription('رابط صورة خارجي (اختياري — أو استخدم image_file من جهازك)')
            .setMaxLength(500)
            .setRequired(false)
        )
        .addAttachmentOption((opt) =>
          opt
            .setName('image_file')
            .setDescription('🖼️ اختر صورة من جهازك بدلاً من الرابط (اختياري)')
            .setRequired(false)
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
    .addSubcommand((sub) =>
      sub
        .setName('image')
        .setDescription('🖼️ اختر صورة من جهازك للرد التلقائي')
        .addAttachmentOption((opt) =>
          opt
            .setName('file')
            .setDescription('الصورة من جهازك (JPG/PNG/WebP/GIF)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('remove_image').setDescription('🗑️ حذف صورة الرد التلقائي (الجهاز والرابط)')
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
        const imageFile = interaction.options.getAttachment('image_file');
        const cooldown = interaction.options.getInteger('cooldown');
        const del = interaction.options.getBoolean('delete');
        const reply = interaction.options.getBoolean('reply');
        const ignoreStaff = interaction.options.getBoolean('ignore_staff');

        // تحميل/ضغط صورة الجهاز قد يتجاوز مهلة 3 ثوانٍ
        if (imageFile) await interaction.deferReply({ ephemeral: true });
        const respond = async (payload: any) =>
          imageFile ? interaction.editReply(payload) : interaction.reply(payload);

        if (image && !imageFile && !/^https?:\/\/\S+$/i.test(image)) {
          await respond({
            content: '❌ رابط الصورة يجب أن يبدأ بـ http:// أو https://',
          });
          return;
        }

        let prepared: PreparedAutoReplyImage | null = null;
        if (imageFile) {
          try {
            prepared = await prepareAttachmentImage(imageFile);
          } catch (err: any) {
            await interaction.editReply({ content: `❌ ${err?.message || 'تعذّر تجهيز الصورة'}` });
            return;
          }
        }

        cfg.channelIds = [channel!.id];
        if (text !== null && text !== undefined) cfg.text = text.trim();
        if (prepared) {
          applyDeviceImage(cfg, prepared);
        } else if (image !== null && image !== undefined) {
          cfg.imageUrl = image.trim();
          clearDeviceImage(cfg);
        }
        if (cooldown !== null && cooldown !== undefined) cfg.cooldownSeconds = cooldown;
        if (del !== null && del !== undefined) cfg.deleteTrigger = del;
        if (reply !== null && reply !== undefined) cfg.replyToMessage = reply;
        if (ignoreStaff !== null && ignoreStaff !== undefined) cfg.ignoreStaff = ignoreStaff;
        cfg.enabled = true;

        const hasImage = Boolean(String(cfg.imageData || '').trim() || String(cfg.imageUrl || '').trim());
        if (!String(cfg.text || '').trim() && !hasImage) {
          await respond({
            content:
              '⚠️ تم تحديد القناة، لكن لا يوجد نص ولا صورة بعد — أضف `text` أو `image` (رابط) أو `image_file` (من جهازك)',
          });
        } else {
          await respond({
            content:
              `✅ **تم تفعيل الرد التلقائي** في ${channelsText()}\n` +
              `> 💬 النص: ${cfg.text ? cfg.text.slice(0, 200) : '—'}\n` +
              `> 🖼️ الصورة: ${
                String(cfg.imageData || '').trim()
                  ? '✅ من الجهاز'
                  : cfg.imageUrl
                    ? '✅ رابط خارجي'
                    : '—'
              }\n` +
              `> ⏱️ الفاصل: ${cfg.cooldownSeconds} ثانية`,
          });
        }
        await save();
        return;
      }
      case 'image': {
        const file = interaction.options.getAttachment('file', true);
        await interaction.deferReply({ ephemeral: true });
        let prepared: PreparedAutoReplyImage;
        try {
          prepared = await prepareAttachmentImage(file);
        } catch (err: any) {
          await interaction.editReply({ content: `❌ ${err?.message || 'تعذّر تجهيز الصورة'}` });
          return;
        }
        applyDeviceImage(cfg, prepared);
        await save();
        await interaction.editReply({
          content:
            `✅ **تم حفظ صورة الرد التلقائي من جهازك**\n` +
            `> 🖼️ الاسم: ${prepared.name}\n` +
            `> 📦 الحجم بعد الضغط: ${Math.round(prepared.bytes / 1024)} KB` +
            (cfg.channelIds.length
              ? `\n> 📍 القنوات: ${channelsText()}`
              : '\n> ⚠️ لا توجد قنوات بعد — أضف قناة بـ `/autoreply setup` أو `/autoreply add`'),
        });
        return;
      }
      case 'remove_image': {
        clearDeviceImage(cfg);
        cfg.imageUrl = '';
        await save();
        await interaction.reply({ content: '🗑️ تم حذف صورة الرد التلقائي (الجهاز والرابط)', ephemeral: true });
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
              `> 🖼️ **الصورة:** ${
                String(cfg.imageData || '').trim()
                  ? `✅ من الجهاز${cfg.imageName ? ` (${cfg.imageName})` : ''}`
                  : cfg.imageUrl
                    ? `[عرض الرابط](${cfg.imageUrl})`
                    : '— لا توجد —'
              }\n` +
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
        (settings as any).autoReply = {
          ...DEFAULTS,
          channelIds: [],
          imageUrl: '',
          imageData: '',
          imageMimeType: '',
          imageName: '',
        };
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
