// ============================================
// Omni Bot - Say Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  AttachmentBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { OmniClient } from '../../OmniClient';
import { getGuildSettings } from '../../models';
import { getAllGuildAliases } from '../../utils/aliasCache';
import { executeAliasCommand } from '../../events/messageCreate';
import { isSafePublicHttpUrl } from '../../utils/linkSummary';

/** خيارات الملفات المتاحة في الأمر (كل خيار يستوعب ملفاً واحداً) */
const FILE_OPTIONS = ['file', 'file2', 'file3'] as const;

/** أقصى حجم يُقبل تحميله من رابط خارجي (نفس حد ديسكورد للملفات) */
const MAX_LINK_BYTES = 25 * 1024 * 1024;

const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'text/plain': '.txt',
};

type LinkFileResult = { buffer: Buffer; name: string } | { error: string };

function fileNameFromLink(url: URL, contentType: string, disposition: string | null): string {
  let name = '';
  if (disposition) {
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
    if (match?.[1]) {
      try {
        name = decodeURIComponent(match[1]);
      } catch {
        name = match[1];
      }
    }
  }
  if (!name) {
    const last = url.pathname.split('/').filter(Boolean).pop();
    if (last) {
      try {
        name = decodeURIComponent(last);
      } catch {
        name = last;
      }
    }
  }

  name = name.replace(/[\\/:*?"<>|\r\n]/g, '_').trim().slice(0, 100) || 'file';
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    const ext = CONTENT_TYPE_EXT[contentType.split(';')[0].trim().toLowerCase()] || '';
    if (ext) name += ext;
  }
  return name;
}

/**
 * 🔗 تحميل ملف من رابط مباشر — بديل رفع الملفات من الجهاز
 * (مفيد لو ديسكورد رفض رفع الملف من حساب المستخدم مؤقتاً).
 * يتحقق من الرابط ضد العناوين الداخلية ويحدّ الحجم والمهل.
 */
async function fetchLinkFile(raw: string): Promise<LinkFileResult> {
  const safe = isSafePublicHttpUrl(raw);
  if (!safe.ok || !safe.url) return { error: safe.reason || 'رابط غير مسموح' };

  let current = safe.url;
  let response: Response | null = null;

  // نتّبع التحويلات يدوياً مع فحص كل عنوان (منع الوصول لعناوين داخلية)
  for (let hop = 0; hop < 4; hop++) {
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(20_000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; OmniBot/2.0)',
          Accept: 'image/*,video/*,audio/*,application/*;q=0.8,*/*;q=0.5',
        },
      });
    } catch {
      return { error: 'تعذّر الوصول للرابط — تأكد أنه يعمل' };
    }

    if (![301, 302, 303, 307, 308].includes(response.status)) break;

    const location = response.headers.get('location');
    if (!location) return { error: 'الرابط يحوّل لمكان غير معروف' };
    const next = isSafePublicHttpUrl(new URL(location, current).toString());
    if (!next.ok || !next.url) return { error: 'الرابط يحوّل لعنوان غير مسموح' };
    current = next.url;
    response = null;
  }

  if (!response) return { error: 'الرابط يحوّل كثيراً — استخدم رابطاً مباشراً' };
  if (!response.ok) return { error: `تعذّر تحميل الرابط (HTTP ${response.status})` };

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.startsWith('text/html') || contentType.startsWith('application/xhtml')) {
    return { error: 'الرابط صفحة ويب مش ملف مباشر — استخدم رابط الصورة/الملف نفسه' };
  }

  const declared = Number(response.headers.get('content-length') || 0);
  if (declared && declared > MAX_LINK_BYTES) {
    return { error: 'حجم الملف أكبر من 25MB' };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await response.arrayBuffer());
  } catch {
    return { error: 'انقطع تحميل الرابط' };
  }
  if (!buffer.length) return { error: 'الملف فارغ' };
  if (buffer.length > MAX_LINK_BYTES) return { error: 'حجم الملف أكبر من 25MB' };

  return {
    buffer,
    name: fileNameFromLink(current, contentType, response.headers.get('content-disposition')),
  };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('إرسال نص و/أو ملفات من جهازك باسم البوت (ويدعم تنفيذ اختصارات/أوامر الألياس)')
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('النص المراد إرساله (اختياري إذا كنت سترفع ملفاً)')
        .setRequired(false)
        .setMaxLength(2000)
    )
    .addAttachmentOption(option =>
      option
        .setName('file')
        .setDescription('📎 ملف أو صورة من جهازك (اختياري)')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('file2')
        .setDescription('📎 ملف أو صورة ثاني (اختياري)')
        .setRequired(false)
    )
    .addAttachmentOption(option =>
      option
        .setName('file3')
        .setDescription('📎 ملف أو صورة ثالث (اختياري)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('link')
        .setDescription('🔗 رابط مباشر لصورة/ملف بدل الرفع من الجهاز (اختياري)')
        .setRequired(false)
        .setMaxLength(1000)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction: ChatInputCommandInteraction) {
    const rawText = interaction.options.getString('text') || '';
    const text = rawText.trim();
    const linkRaw = (interaction.options.getString('link') || '').trim();
    const attachments = FILE_OPTIONS
      .map(name => interaction.options.getAttachment(name))
      .filter((a): a is NonNullable<typeof a> => !!a);

    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    if (!text && attachments.length === 0 && !linkRaw) {
      await interaction.reply({
        content: '❌ اكتب نصاً، أو ارفع ملفاً، أو الصق رابطاً مباشراً لملف',
        ephemeral: true,
      });
      return;
    }

    // تأجيل الرد حتى ننتهي من تحميل الرابط (قد يستغرق ثوانٍ) وإرسال الملفات
    await interaction.deferReply({ ephemeral: true }).catch(() => {});

    const files = attachments.map(a =>
      new AttachmentBuilder(a.url, { name: a.name, description: a.description || undefined })
    );

    let linkError = '';
    if (linkRaw) {
      const downloaded = await fetchLinkFile(linkRaw);
      if ('error' in downloaded) linkError = downloaded.error;
      else files.push(new AttachmentBuilder(downloaded.buffer, { name: downloaded.name }));
    }

    if (!text && files.length === 0) {
      await interaction
        .editReply({ content: `❌ تعذّر تجهيز الملف: ${linkError || 'لا يوجد ما يُرسل'}` })
        .catch(() => {});
      return;
    }

    const channel: any = interaction.channel;
    let sent = false;
    if (channel && typeof channel.send === 'function') {
      try {
        await channel.send({
          content: text || undefined,
          files,
          allowedMentions: { parse: ['everyone', 'roles', 'users'] },
        });
        sent = true;
      } catch {
        /* يُبلَّغ عن الفشل بالأسفل */
      }
    }

    if (!sent) {
      await interaction
        .editReply({ content: '❌ فشل إرسال الرسالة — تأكد من صلاحية **إرسال الرسائل/الملفات** في القناة' })
        .catch(() => {});
      return;
    }

    await interaction
      .editReply({
        content: linkError
          ? `⚠️ تم الإرسال، لكن تعذّر تحميل الرابط: ${linkError}`
          : '✅ تم الإرسال',
      })
      .catch(() => {});

    // محاولة تنفيذ النص كاختصار/أمر ألياس (مثل .روليت أو أمر إعطاء رول عبر alias)
    if (text) {
      try {
        await tryExecuteAliasFromSay(interaction, text, attachments);
      } catch {
        // لا نُفشل /say إذا فشل تنفيذ الأمر
      }
    }
  },
};

async function tryExecuteAliasFromSay(
  interaction: ChatInputCommandInteraction,
  text: string,
  attachments: Array<{ id: string; name: string; url: string }> = []
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const client = interaction.client as OmniClient;
  const settings = await getGuildSettings(guild.id);
  const prefix = settings.prefix || 'omni!';

  const allAliases = await getAllGuildAliases(guild.id);
  if (allAliases.size === 0) return;

  let matched: any[] | undefined;
  let args: string[] = [];
  let shortcut = '';

  // 1) أمر ببادئة (مثال: omni!...)
  if (text.startsWith(prefix)) {
    const words = text.slice(prefix.length).trim().split(/\s+/);
    const maxWords = Math.min(words.length, 5);
    for (let n = maxWords; n >= 1; n--) {
      const candidate = words.slice(0, n).join(' ').toLowerCase();
      if (!candidate || candidate.length > 30) continue;
      const m = allAliases.get(candidate);
      if (m && m.length > 0) {
        matched = m;
        args = words.slice(n);
        shortcut = candidate;
        break;
      }
    }
  }

  // 2) اختصار مستقل (مثال: .روليت / رول @user ...)
  if (!matched) {
    const words = text.trim().split(/\s+/);
    const maxWords = Math.min(words.length, 5);
    for (let n = maxWords; n >= 1; n--) {
      const candidate = words.slice(0, n).join(' ').toLowerCase();
      if (!candidate || candidate.length > 30) continue;
      const m = allAliases.get(candidate);
      if (m && m.length > 0) {
        matched = m;
        args = words.slice(n);
        shortcut = candidate;
        break;
      }
    }
  }

  if (!matched || matched.length === 0) return;

  const member =
    interaction.member instanceof GuildMember
      ? interaction.member
      : await guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) return;

  // رسالة وهمية لتوافق منطق تنفيذ الألياس (الردود/الصلاحيات تعتمد على منفّذ الأمر)
  const fakeMessage: any = {
    id: `${interaction.id}-say`,
    guild,
    channel: interaction.channel,
    channelId: interaction.channelId,
    client,
    author: interaction.user,
    member,
    content: text,
    createdTimestamp: Date.now(),
    mentions: {
      users: new Map(),
      members: new Map(),
      roles: new Map(),
      channels: new Map(),
      repliedUser: null,
      everyone: /@everyone/.test(text),
    },
    attachments: new Map(attachments.map(a => [a.id, a])),
    reference: null,
    deletable: false,
    delete: async () => {},
    reply: async (payload: any) => {
      try {
        if (interaction.channel && 'send' in (interaction.channel as any)) {
          return await (interaction.channel as any).send(payload);
        }
      } catch {}
      return null;
    },
  };

  // تنفيذ مطابق واحد (الأبسط والأكثر أماناً عبر /say). لو فيه أكثر من أمر مرتبط
  // بنفس الاختصار (toggle/pick)، ننفذ المطابق الأول لتجنب تعقيد قوائم الاختيار هنا.
  await executeAliasCommand(fakeMessage, client, matched[0].command, args, shortcut);
}

export default command;
