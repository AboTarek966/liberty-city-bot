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

/** خيارات الملفات المتاحة في الأمر (كل خيار يستوعب ملفاً واحداً) */
const FILE_OPTIONS = ['file', 'file2', 'file3'] as const;

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction: ChatInputCommandInteraction) {
    const rawText = interaction.options.getString('text') || '';
    const text = rawText.trim();
    const attachments = FILE_OPTIONS
      .map(name => interaction.options.getAttachment(name))
      .filter((a): a is NonNullable<typeof a> => !!a);

    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    if (!text && attachments.length === 0) {
      await interaction.reply({ content: '❌ اكتب نصاً أو ارفع ملفاً واحداً على الأقل', ephemeral: true });
      return;
    }

    // إرسال النص/الملفات باسم البوت
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '✅ تم الإرسال', ephemeral: true }).catch(() => {});
    }

    const files = attachments.map(a =>
      new AttachmentBuilder(a.url, { name: a.name, description: a.description || undefined })
    );

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
