// ============================================
// Omni Bot - Abuse Test Command
// اختبار كاشف الإساءة على نص بدون تنفيذ أي عقوبة
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { diagnoseAbuse } from '../../utils/abuseDetector';
import { BotAbuseStrike } from '../../models/BotAbuseStrike';
import { getGuildSettings } from '../../models';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('abusetest')
    .setDescription('اختبار كاشف الإساءة على نص (بدون تنفيذ أي عقوبة)')
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('النص المراد فحصه — جرّب صيغ التمويه')
        .setRequired(true)
        .setMaxLength(1000)
    )
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('عرض عدد إساءات عضو مسجل في النظام')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('reset')
        .setDescription('تصفير عدّاد الإساءات للعضو المحدد (يتطلب تحديد user)')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction) {
    const text = interaction.options.getString('text', true);
    const user = interaction.options.getUser('user');

    await interaction.deferReply({ ephemeral: true });

    const diag = diagnoseAbuse(text);
    const guild = interaction.guild;
    const botMember = guild?.members.me;
    const targetUser = user && guild
      ? (guild.members.cache.get(user.id) || (await guild.members.fetch(user.id).catch(() => null)))
      : null;
    const selfMember = guild?.members.cache.get(interaction.user.id) || null;

    let antiEnabled = true;
    try {
      const settings: any = guild ? await getGuildSettings(guild.id) : null;
      const anti = settings?.protection?.antiBotAbuse;
      antiEnabled = !(anti && anti.enabled === false);
    } catch {
      antiEnabled = true; // البوت يعمل بالافتراضي عند تعذر قراءة الإعدادات
    }

    const hierarchyLine = (
      botPosition: number | undefined,
      memberPosition: number | undefined,
      memberRoleName: string | undefined
    ) => {
      if (botPosition === undefined || memberPosition === undefined) return '—';
      return botPosition > memberPosition
        ? `✅ البوت أعلى (${botPosition} > ${memberPosition}) — التصعيد متاح`
        : `⛔ العضو أعلى (${memberPosition} ≥ ${botPosition})${
            memberRoleName ? ` — رول «${memberRoleName}»` : ''
          } — التصعيد غير متاح`;
    };

    const embed = new EmbedBuilder()
      .setTitle('🧪 اختبار كاشف الإساءة')
      .setColor(diag.match ? 0xed4245 : 0x57f287)
      .addFields(
        {
          name: '⚙️ مكافحة الإساءة في هذا السيرفر',
          value: antiEnabled ? '✅ مفعّلة' : '⛔ مطفية — لن يتم حذف أو معاقبة أي رسالة',
          inline: true,
        },
        {
          name: '🎯 سب صريح بلا منشن',
          value: diag.hardSlur ? 'نعم — تُعدّ موجهة للبوت تلقائيًا' : 'لا',
          inline: true,
        },
        {
          name: '📝 النص',
          value: `\`\`\`${text.slice(0, 500)}\`\`\``,
          inline: false,
        },
        {
          name: '🔎 النتيجة',
          value: diag.match
            ? `**إساءة** — الكلمة: \`${diag.match.term}\` (${diag.match.kind})`
            : '**لا توجد إساءة** في قاموس الكاشف',
          inline: false,
        },
        {
          name: '🧹 بعد التطبيع العربي',
          value: `\`${diag.normalizedArabic.slice(0, 400) || '—'}\``,
          inline: false,
        },
        {
          name: '🔤 بعد تطبيع الإنجليزية (leetspeak)',
          value: `\`${diag.normalizedEnglish.slice(0, 300) || '—'}\``,
          inline: false,
        },
        {
          name: '🏗️ ترتيبك مقابل البوت',
          value: hierarchyLine(
            botMember?.roles.highest.position,
            selfMember?.roles.highest.position,
            selfMember?.roles.highest.name
          ),
          inline: false,
        },
        {
          name: 'ℹ️ ملاحظة',
          value: 'التوجيه (منشن/ردّ/اسم البوت) يُفحص من الرسالة نفسها، وليس من هذا النص.',
          inline: false,
        }
      )
      .setFooter({ text: 'Omni • Abuse Detector' });

    if (user) {
      const reset = interaction.options.getBoolean('reset') ?? false;
      if (reset) {
        await BotAbuseStrike.deleteOne({
          guildId: interaction.guildId || interaction.guild?.id,
          userId: user.id,
        }).catch(() => null);
      }
      const record = await BotAbuseStrike.findOne({
        guildId: interaction.guildId || interaction.guild?.id,
        userId: user.id,
      }).lean();
      const recordLine = reset
        ? '♻️ تم تصفير عدّاد الإساءات'
        : record
          ? `عدد الإساءات: **${(record as any).count ?? 0}**`
          : 'لا يوجد سجل إساءات';
      embed.addFields({
        name: `👤 سجل ${user.tag}`,
        value: `${recordLine}${
          targetUser
            ? `\n${hierarchyLine(
                botMember?.roles.highest.position,
                targetUser.roles.highest.position,
                targetUser.roles.highest.name
              )}`
            : ''
        }`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
