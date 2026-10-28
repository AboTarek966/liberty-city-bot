// ============================================
// Liberty City Bot - AI Investigator Command
// ============================================
// /investigate run | status | findings | member | dismiss | config
// المحقق للقراءة فقط: لا ينفّذ أي عقوبة تلقائية.

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { getGuildSettings, invalidateGuildSettings, InvestigationFinding } from '../../models';
import { resolveInvestigatorConfig } from '../../handlers/AIInvestigator';
import { InvestigationReport, InvestigationSeverity } from '../../types/investigator';
import { severityRank } from '../../utils/investigatorHeuristics';
import { fitEmbed } from '../../utils/embedBudget';

const SEVERITY_LABELS: Record<InvestigationSeverity, string> = {
  critical: 'حرج',
  high: 'عالي',
  medium: 'متوسط',
  low: 'منخفض',
  info: 'معلوماتي',
};

const SEVERITY_EMOJI: Record<InvestigationSeverity, string> = {
  critical: '🚨',
  high: '🔴',
  medium: '🟠',
  low: '🟡',
  info: '🔵',
};

function colorFor(severity: InvestigationSeverity): number {
  switch (severity) {
    case 'critical': return 0xed4245;
    case 'high': return 0xe67e22;
    case 'medium': return 0xf1c40f;
    case 'low': return 0x3498db;
    default: return 0x95a5a6;
  }
}

function truncate(text: string, max: number): string {
  const value = String(text || '').trim();
  return value.length > max ? value.slice(0, Math.max(0, max - 1)) + '…' : value;
}

function discordTime(iso?: string | Date): string {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';
  return `<t:${Math.floor(ms / 1000)}:F>`;
}

function buildReportEmbed(report: InvestigationReport, titlePrefix = '🕵️ تحقيق أمني'): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(colorFor(report.riskLevel))
    .setTitle(`${titlePrefix} — ${report.guildName}`)
    .setDescription(
      [
        `**مستوى الخطر:** ${SEVERITY_EMOJI[report.riskLevel]} ${SEVERITY_LABELS[report.riskLevel]} (${report.riskScore}/100)`,
        `**الملخص:** ${truncate(report.summary, 1500)}`,
      ].join('\n')
    )
    .setFooter({
      text: `Liberty City AI Investigator • ${report.model} • ${report.runId} • ${(report.durationMs / 1000).toFixed(0)}s`,
    })
    .setTimestamp(new Date(report.completedAt));

  const counts = report.counts;
  embed.addFields({
    name: '📊 النتائج',
    value: [
      `${SEVERITY_EMOJI.critical} حرج: **${counts.critical}**`,
      `${SEVERITY_EMOJI.high} عالي: **${counts.high}**`,
      `${SEVERITY_EMOJI.medium} متوسط: **${counts.medium}**`,
      `${SEVERITY_EMOJI.low} منخفض: **${counts.low}**`,
      `${SEVERITY_EMOJI.info} معلوماتي: **${counts.info}**`,
    ].join(' • '),
    inline: false,
  });

  const top = report.findings.slice(0, 8);
  for (const finding of top) {
    const value = [
      truncate(finding.description, 350),
      finding.evidence?.length ? `**الدليل:** ${truncate(finding.evidence.slice(0, 2).join(' • '), 350)}` : '',
      finding.recommendation ? `**التوصية:** ${truncate(finding.recommendation, 300)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    embed.addFields({
      name: `${SEVERITY_EMOJI[finding.severity]} ${truncate(finding.title, 230)}`,
      value: truncate(value || '—', 1020),
    });
  }
  if (report.findings.length > top.length) {
    embed.addFields({
      name: '➕ نتائج إضافية',
      value: `يوجد ${report.findings.length - top.length} نتيجة أخرى — استخدم \`/investigate findings\`.`,
    });
  }

  const coverage = report.coverage?.sections || {};
  const coverageLine = [
    `أعضاء: ${coverage.members?.count ?? '—'}`,
    `رتب: ${coverage.roles?.count ?? '—'}`,
    `قنوات: ${coverage.channels?.count ?? '—'}`,
    `رسائل: ${coverage.messages?.count ?? '—'}`,
    `سجلات: ${coverage.auditLogs?.count ?? '—'}`,
  ].join(' • ');
  embed.addFields({ name: '🔎 التغطية', value: truncate(coverageLine, 1024) });

  if (report.observations.length || report.recommendedActions.length) {
    const extras = [
      ...report.observations.slice(0, 3).map((o) => `• ${o}`),
      ...report.recommendedActions.slice(0, 3).map((a) => `• ${a}`),
    ].join('\n');
    embed.addFields({ name: '📝 ملاحظات وتوصيات', value: truncate(extras, 1024) });
  }

  embed.addFields({
    name: '⚖️ وضع التحقيق',
    value: 'للقراءة فقط — لم يُنفَّذ أي حظر أو طرد أو تعديل رتب تلقائياً.',
  });

  fitEmbed(embed, { maxChars: 5800, keepFieldNames: ['وضع التحقيق', 'التغطية', 'النتائج'] });

  return embed;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('investigate')
    .setDescription('🕵️ المحقق الأمني الداخلي — فحص شامل للسيرفر وتقارير فقط')
    .addSubcommand((sub) =>
      sub.setName('run').setDescription('تشغيل تحقيق شامل الآن (يدوي — يعمل حتى لو كان التلقائي معطلاً)')
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('عرض حالة المحقق وآخر تقرير'))
    .addSubcommand((sub) =>
      sub
        .setName('findings')
        .setDescription('عرض نتائج التحقيقات المحفوظة')
        .addStringOption((opt) =>
          opt
            .setName('status')
            .setDescription('حالة النتيجة')
            .addChoices(
              { name: 'مفتوحة', value: 'open' },
              { name: 'مُعترف بها', value: 'acknowledged' },
              { name: 'مُتجاهلة', value: 'dismissed' },
              { name: 'مُعالجة', value: 'resolved' },
              { name: 'الكل', value: 'all' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('severity')
            .setDescription('تصفية حسب الخطورة')
            .addChoices(
              { name: 'حرج', value: 'critical' },
              { name: 'عالي', value: 'high' },
              { name: 'متوسط', value: 'medium' },
              { name: 'منخفض', value: 'low' },
              { name: 'معلوماتي', value: 'info' }
            )
        )
        .addIntegerOption((opt) =>
          opt.setName('limit').setDescription('عدد النتائج (1-20)').setMinValue(1).setMaxValue(20)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('member')
        .setDescription('تحقيق معمّق في عضو أو بوت محدد')
        .addUserOption((opt) => opt.setName('user').setDescription('العضو المراد التحقيق فيه').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('dismiss')
        .setDescription('تجاهل نتيجة محفوظة')
        .addStringOption((opt) =>
          opt.setName('fingerprint').setDescription('بصمة النتيجة (تظهر في /investigate findings)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('عرض/تعديل إعدادات المحقق')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('تشغيل/إيقاف المحقق كلياً'))
        .addBooleanOption((opt) => opt.setName('automatic').setDescription('الفحص التلقائي (بدء التشغيل + الجدولة + الأحداث)'))
        .addBooleanOption((opt) => opt.setName('scan_on_startup').setDescription('فحص عند بدء تشغيل البوت'))
        .addIntegerOption((opt) =>
          opt.setName('interval_hours').setDescription('الفاصل بين الفحوصات التلقائية (ساعات)').setMinValue(1).setMaxValue(168)
        )
        .addChannelOption((opt) =>
          opt
            .setName('alert_channel')
            .setDescription('قناة التنبيهات الإدارية')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addBooleanOption((opt) => opt.setName('clear_alerts').setDescription('إيقاف تنبيهات القناة'))
        .addStringOption((opt) =>
          opt
            .setName('min_severity')
            .setDescription('أقل خطورة تُرسل تنبيهاً')
            .addChoices(
              { name: 'حرج', value: 'critical' },
              { name: 'عالي', value: 'high' },
              { name: 'متوسط', value: 'medium' },
              { name: 'منخفض', value: 'low' },
              { name: 'معلوماتي', value: 'info' }
            )
        )
        .addBooleanOption((opt) => opt.setName('include_messages').setDescription('تحليل محتوى الرسائل'))
        .addIntegerOption((opt) =>
          opt.setName('lookback_hours').setDescription('نطاق الرسائل بالساعات').setMinValue(1).setMaxValue(720)
        )
        .addIntegerOption((opt) =>
          opt.setName('max_messages').setDescription('أقصى رسائل لكل قناة').setMinValue(5).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName('max_channels').setDescription('أقصى عدد قنوات تُفحص').setMinValue(5).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName('max_members').setDescription('أقصى عدد أعضاء في اللقطة').setMinValue(100).setMaxValue(5000)
        )
        .addIntegerOption((opt) =>
          opt.setName('max_findings').setDescription('أقصى عدد نتائج في التقرير').setMinValue(5).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt.setName('auto_resolve_days').setDescription('مدة تلقائية لاعتبار النتيجة مُعالجة').setMinValue(1).setMaxValue(365)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }

    const client = interaction.client as LibertyClient;
    const investigator = client.aiInvestigator;
    if (!investigator) {
      await interaction.reply({ content: '❌ المحقق الأمني غير مهيأ.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    // --------------------------------------------
    // run
    // --------------------------------------------
    if (subcommand === 'run') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const report = await investigator.run(guild, {
          trigger: 'manual',
          requestedBy: interaction.user.id,
          deep: true,
          aiMode: 'always',
        });
        await interaction.editReply({ embeds: [buildReportEmbed(report)] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ فشل التحقيق: ${truncate(String(error?.message || error), 1500)}`,
        });
      }
      return;
    }

    // --------------------------------------------
    // status
    // --------------------------------------------
    if (subcommand === 'status') {
      await interaction.deferReply({ ephemeral: true });
      const status = await investigator.getStatus(guild.id);
      const config = status.config;
      const latest = status.latest;
      const embed = new EmbedBuilder()
        .setColor(latest ? colorFor(String(latest.riskLevel || 'info') as InvestigationSeverity) : 0x5865f2)
        .setTitle('🕵️ حالة المحقق الأمني')
        .addFields(
          {
            name: '⚙️ الإعدادات',
            value: [
              `المحقق: ${config.enabled ? '✅ مفعّل' : '❌ معطّل'}`,
              `التلقائي: ${config.automatic ? '✅ مفعّل' : '❌ معطّل'}`,
              `فحص البدء: ${config.scanOnStartup ? '✅' : '❌'}`,
              `الفاصل: كل ${config.intervalHours} ساعة`,
              `قناة التنبيه: ${config.alertChannelId ? `<#${config.alertChannelId}>` : 'غير محددة'}`,
              `حد التنبيه: ${SEVERITY_LABELS[config.minSeverityToAlert]}`,
            ].join('\n'),
          },
          {
            name: '📊 النتائج المفتوحة',
            value: `حرج: **${status.criticalOpen}** • عالي: **${status.highOpen}** • الإجمالي: **${status.openFindings}**`,
          },
          {
            name: '🤖 مزودو الذكاء الاصطناعي',
            value: `${status.aiAvailable ? '✅ متاح' : '⚠️ غير متاح — التحليل المحلي فقط'}\n${status.providers.join(' • ') || '—'}`,
          },
          {
            name: '🕒 آخر تحقيق',
            value: latest
              ? [
                  `الوقت: ${discordTime(latest.startedAt)}`,
                  `النوع: ${latest.trigger || '—'}${latest.focus ? ` — ${latest.focus}` : ''}`,
                  `الحالة: ${latest.status || '—'}`,
                  `الخطر: ${latest.riskScore ?? 0}/100 (${SEVERITY_LABELS[(latest.riskLevel || 'info') as InvestigationSeverity] || latest.riskLevel})`,
                  `النتائج: ${latest.findingsCount ?? 0} (حرج ${latest.criticalCount ?? 0} • عالي ${latest.highCount ?? 0})`,
                  `النموذج: ${latest.aiModel || 'heuristic'} • ${latest.tokensUsed || 0} توكن`,
                  latest.error ? `الخطأ: ${truncate(latest.error, 300)}` : '',
                ]
                  .filter(Boolean)
                  .join('\n')
              : 'لا يوجد تحقيق محفوظ بعد.',
          }
        )
        .setFooter({ text: 'التحقيق للقراءة فقط — لا عقوبات تلقائية' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // --------------------------------------------
    // findings
    // --------------------------------------------
    if (subcommand === 'findings') {
      await interaction.deferReply({ ephemeral: true });
      const statusFilter = interaction.options.getString('status') || 'open';
      const severityFilter = interaction.options.getString('severity');
      const limit = interaction.options.getInteger('limit') || 10;

      const query: any = { guildId: guild.id };
      if (statusFilter !== 'all') query.status = statusFilter;
      if (severityFilter) query.severity = severityFilter;

      const docs: any[] = await InvestigationFinding.find(query)
        .sort({ lastSeenAt: -1 })
        .limit(100)
        .lean();
      docs.sort((a, b) => {
        const diff = severityRank(b.severity) - severityRank(a.severity);
        if (diff) return diff;
        return new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime();
      });
      const selected = docs.slice(0, limit);

      if (!selected.length) {
        await interaction.editReply({ content: '✅ لا توجد نتائج مطابقة.' });
        return;
      }

      const statusLabels: Record<string, string> = {
        open: 'مفتوحة',
        acknowledged: 'مُعترف بها',
        dismissed: 'مُتجاهلة',
        resolved: 'مُعالجة',
      };

      // تقسيم النتائج على عدة رسائل لضمان بقاء كل Embed ضمن حدود Discord
      const perPage = 5;
      const maxPages = 4;
      const pages: EmbedBuilder[] = [];
      for (let start = 0; start < selected.length && pages.length < maxPages; start += perPage) {
        const chunk = selected.slice(start, start + perPage);
        const embed = new EmbedBuilder()
          .setColor(colorFor((chunk[0]?.severity || 'info') as InvestigationSeverity))
          .setTitle(`🕵️ نتائج التحقيقات${pages.length ? ` — صفحة ${pages.length + 1}` : ''}`)
          .setDescription(
            `الحالة: **${statusFilter}**${severityFilter ? ` • الخطورة: **${severityFilter}**` : ''} • المعروض: **${selected.length}/${docs.length}**`
          )
          .setFooter({ text: 'استخدم /investigate dismiss <fingerprint> لتجاهل نتيجة' });

        for (const doc of chunk) {
          const value = [
            truncate(doc.description || '', 400),
            doc.evidence?.length ? `**الدليل:** ${truncate((doc.evidence || []).slice(0, 2).join(' • '), 380)}` : '',
            doc.recommendation ? `**التوصية:** ${truncate(doc.recommendation, 300)}` : '',
            `**الحالة:** ${statusLabels[doc.status] || doc.status} • **التكرار:** ${doc.occurrences || 1} • **آخر مشاهدة:** ${discordTime(doc.lastSeenAt)}`,
            `**البصمة:** \`${doc.fingerprint}\``,
          ]
            .filter(Boolean)
            .join('\n');
          embed.addFields({
            name: `${SEVERITY_EMOJI[(doc.severity || 'info') as InvestigationSeverity]} ${truncate(doc.title || 'بدون عنوان', 220)}`,
            value: truncate(value, 1020),
          });
        }

        pages.push(fitEmbed(embed, { maxChars: 5600 }));
      }

      await interaction.editReply({ embeds: [pages[0]] });
      for (let index = 1; index < pages.length; index++) {
        await interaction
          .followUp({ embeds: [pages[index]], ephemeral: true })
          .catch(() => {});
      }
      return;
    }

    // --------------------------------------------
    // member
    // --------------------------------------------
    if (subcommand === 'member') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('user', true);
      try {
        const report = await investigator.investigateMember(guild, user.id, interaction.user.id);
        const embed = buildReportEmbed(report, `🕵️ تحقيق في ${user.tag || user.username}`);
        if (!report.findings.length) {
          embed.addFields({
            name: '✅ لا نتائج',
            value: 'لم تُرصد مخاطر تتعلق بهذا العضو في البيانات المتاحة. هذا لا يعني ضمان البراءة الكاملة — راجع السجلات يدوياً عند الشك.',
          });
        }
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          content: `❌ فشل تحقيق العضو: ${truncate(String(error?.message || error), 1500)}`,
        });
      }
      return;
    }

    // --------------------------------------------
    // dismiss
    // --------------------------------------------
    if (subcommand === 'dismiss') {
      await interaction.deferReply({ ephemeral: true });
      const fingerprint = interaction.options.getString('fingerprint', true).trim();
      const doc = await InvestigationFinding.findOne({ guildId: guild.id, fingerprint });
      if (!doc) {
        await interaction.editReply({ content: '❌ لم يتم العثور على نتيجة بهذه البصمة.' });
        return;
      }
      doc.status = 'dismissed';
      doc.dismissedBy = interaction.user.id;
      doc.dismissedAt = new Date();
      await doc.save();
      await interaction.editReply({
        content: `✅ تم تجاهل النتيجة: **${truncate(doc.title, 300)}**\nستبقى محفوظة ولن تُرسل تنبيهات جديدة عنها.`,
      });
      return;
    }

    // --------------------------------------------
    // config
    // --------------------------------------------
    if (subcommand === 'config') {
      await interaction.deferReply({ ephemeral: true });
      const settings = await getGuildSettings(guild.id);
      if (!settings.aiInvestigator) {
        settings.aiInvestigator = {} as any;
      }
      const raw: any = settings.aiInvestigator;

      const enabled = interaction.options.getBoolean('enabled');
      const automatic = interaction.options.getBoolean('automatic');
      const scanOnStartup = interaction.options.getBoolean('scan_on_startup');
      const intervalHours = interaction.options.getInteger('interval_hours');
      const alertChannel = interaction.options.getChannel('alert_channel');
      const clearAlerts = interaction.options.getBoolean('clear_alerts');
      const minSeverity = interaction.options.getString('min_severity');
      const includeMessages = interaction.options.getBoolean('include_messages');
      const lookbackHours = interaction.options.getInteger('lookback_hours');
      const maxMessages = interaction.options.getInteger('max_messages');
      const maxChannels = interaction.options.getInteger('max_channels');
      const maxMembers = interaction.options.getInteger('max_members');
      const maxFindings = interaction.options.getInteger('max_findings');
      const autoResolveDays = interaction.options.getInteger('auto_resolve_days');

      let changed = false;
      if (enabled !== null) { raw.enabled = enabled; changed = true; }
      if (automatic !== null) { raw.automatic = automatic; changed = true; }
      if (scanOnStartup !== null) { raw.scanOnStartup = scanOnStartup; changed = true; }
      if (intervalHours !== null) { raw.intervalHours = intervalHours; changed = true; }
      if (clearAlerts) { raw.alertChannelId = undefined; changed = true; }
      else if (alertChannel) { raw.alertChannelId = alertChannel.id; changed = true; }
      if (minSeverity) { raw.minSeverityToAlert = minSeverity; changed = true; }
      if (includeMessages !== null) { raw.includeMessages = includeMessages; changed = true; }
      if (lookbackHours !== null) { raw.messageLookbackHours = lookbackHours; changed = true; }
      if (maxMessages !== null) { raw.maxMessagesPerChannel = maxMessages; changed = true; }
      if (maxChannels !== null) { raw.maxTextChannels = maxChannels; changed = true; }
      if (maxMembers !== null) { raw.maxMembers = maxMembers; changed = true; }
      if (maxFindings !== null) { raw.maxFindings = maxFindings; changed = true; }
      if (autoResolveDays !== null) { raw.autoResolveDays = autoResolveDays; changed = true; }

      if (changed) {
        settings.markModified('aiInvestigator');
        await settings.save();
        invalidateGuildSettings(guild.id);
      }

      const config = resolveInvestigatorConfig(settings);
      if (changed) {
        await investigator.reschedule(guild.id);
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('⚙️ إعدادات المحقق الأمني')
        .setDescription(changed ? '✅ تم حفظ التغييرات وإعادة جدولة الفحص التلقائي.' : 'عرض الإعدادات الحالية.')
        .addFields(
          {
            name: 'التشغيل',
            value: [
              `المحقق: **${config.enabled ? 'مفعّل' : 'معطّل'}**`,
              `التلقائي: **${config.automatic ? 'مفعّل' : 'معطّل'}**`,
              `فحص البدء: **${config.scanOnStartup ? 'مفعّل' : 'معطّل'}**`,
              `الفاصل: **${config.intervalHours}** ساعة`,
              `تلقائي المعالجة: **${config.autoResolveDays}** يوم`,
            ].join('\n'),
          },
          {
            name: 'التنبيهات',
            value: [
              `القناة: ${config.alertChannelId ? `<#${config.alertChannelId}>` : '**غير محددة** (لن تُرسل تنبيهات)'}`,
              `أقل خطورة: **${SEVERITY_LABELS[config.minSeverityToAlert]}**`,
            ].join('\n'),
          },
          {
            name: 'نطاق الفحص',
            value: [
              `الرسائل: **${config.includeMessages ? 'مفعّلة' : 'معطّلة'}**`,
              `النطاق: **${config.messageLookbackHours}** ساعة`,
              `لكل قناة: **${config.maxMessagesPerChannel}** رسالة`,
              `القنوات: **${config.maxTextChannels}**`,
              `الأعضاء: **${config.maxMembers}**`,
              `أقصى نتائج: **${config.maxFindings}**`,
            ].join('\n'),
          }
        )
        .setFooter({ text: 'المحقق لا ينفّذ عقوبات — تقارير وتنبيهات فقط' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};

export default command;
