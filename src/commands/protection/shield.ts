// ============================================
// Omni Bot — Shield Command
// 🛡️ إدارة وحدات الحماية الموسّعة (35+ نوعاً)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  Channel,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getGuildSettings, invalidateGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';
import { gateProtectionOff } from '../../utils/ownerApproval';
import {
  SECURITY_MODULES,
  SECURITY_CATEGORIES,
  SEVERITY_LABELS,
  getSecurityModule,
  moduleDefaultConfig,
  type SecurityAction,
  type SecurityModuleDefinition,
} from '../../utils/securityModules';
import { getTrustedWhitelistConfig } from '../../utils/trustedWhitelist';

function ensureSecurityModules(settings: any): any {
  if (!settings.protection) settings.protection = {};
  if (!settings.protection.securityModules) {
    settings.protection.securityModules = { enabled: true, modules: {} };
  }
  const sm = settings.protection.securityModules;
  sm.enabled = sm.enabled !== false;
  sm.modules = sm.modules && typeof sm.modules === 'object' ? sm.modules : {};
  return sm;
}

interface ModuleView {
  enabled: boolean;
  limit: number;
  windowSeconds: number;
  action: SecurityAction;
}

function viewOf(sm: any, mod: SecurityModuleDefinition): ModuleView {
  const override = sm.modules?.[mod.key] || {};
  return {
    enabled: sm.enabled !== false && override.enabled !== false,
    limit:
      Number.isFinite(Number(override.limit)) && Number(override.limit) > 0
        ? Math.floor(Number(override.limit))
        : mod.defaultLimit,
    windowSeconds:
      Number.isFinite(Number(override.windowSeconds)) && Number(override.windowSeconds) >= 5
        ? Math.floor(Number(override.windowSeconds))
        : mod.defaultWindowSeconds,
    action: (override.action as SecurityAction) || mod.defaultAction,
  };
}

function moduleLine(sm: any, mod: SecurityModuleDefinition): string {
  const v = viewOf(sm, mod);
  return `${v.enabled ? '✅' : '⛔'} ${mod.emoji} \`${mod.key}\` — ${mod.name} • ${v.limit}/${v.windowSeconds}ث • ${v.action}`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shield')
    .setDescription('🛡️ إدارة وحدات الحماية الموسّعة (عشرات الأنواع)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('status').setDescription('عرض ملخص وحدات الحماية الموسّعة'))
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('عرض كل وحدات الحماية وحالتها')
        .addStringOption((opt) =>
          opt
            .setName('category')
            .setDescription('تصفية حسب الفئة')
            .setRequired(false)
            .addChoices(...SECURITY_CATEGORIES.map((c) => ({ name: c, value: c })))
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('toggle')
        .setDescription('تفعيل/تعطيل وحدة حماية محددة')
        .addStringOption((opt) =>
          opt
            .setName('module')
            .setDescription('مفتاح الوحدة (اكتب للبحث)')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('config')
        .setDescription('ضبط عتبة/نافذة/عقوبة وحدة حماية')
        .addStringOption((opt) =>
          opt
            .setName('module')
            .setDescription('مفتاح الوحدة (اكتب للبحث)')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('limit')
            .setDescription('عدد العمليات المسموح قبل التدخل (1-100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('window')
            .setDescription('النافذة الزمنية بالثواني (5-86400)')
            .setMinValue(5)
            .setMaxValue(86400)
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('العقوبة عند التجاوز')
            .setRequired(false)
            .addChoices(
              { name: 'تنبيه فقط', value: 'alert' },
              { name: 'سحب الرولات', value: 'strip' },
              { name: 'طرد', value: 'kick' },
              { name: 'حظر', value: 'ban' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('all')
        .setDescription('تفعيل/تعطيل كل وحدات الحماية الموسّعة دفعة واحدة')
        .addBooleanOption((opt) =>
          opt.setName('enabled').setDescription('تفعيل الكل أو تعطيل الكل').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('strict').setDescription('إعادة كل الوحدات لأقصى تشدد (مفعّلة + العتبات الافتراضية)')
    ),

  guildOnly: true,
  cooldown: 2,

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'module') {
      await interaction.respond([]);
      return;
    }
    const query = String(focused.value || '').toLowerCase();
    const matches = SECURITY_MODULES.filter(
      (m) =>
        !query ||
        m.key.toLowerCase().includes(query) ||
        m.name.toLowerCase().includes(query) ||
        m.category.toLowerCase().includes(query)
    ).slice(0, 25);
    await interaction.respond(
      matches.map((m) => ({
        name: `${m.emoji} ${m.name} (${m.key})`.slice(0, 100),
        value: m.key,
      }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand(true);
    const settings: any = await getGuildSettings(guild.id);
    const sm = ensureSecurityModules(settings);

    const persist = async () => {
      settings.markModified('protection.securityModules');
      await settings.save();
      invalidateGuildSettings(guild.id);
    };

    const gate = async (field: string): Promise<boolean> => {
      const member: GuildMember | null =
        guild.members.cache.get(interaction.user.id) ||
        (await guild.members.fetch(interaction.user.id).catch(() => null));
      const blocked = await gateProtectionOff({
        settings,
        guild,
        user: interaction.user,
        channel: interaction.channel as Channel,
        field,
        client: interaction.client,
        member,
      });
      if (blocked) {
        await interaction.editReply({ content: blocked });
        return false;
      }
      return true;
    };

    if (sub === 'status') {
      const enabled = SECURITY_MODULES.filter((m) => viewOf(sm, m).enabled);
      const critical = enabled.filter((m) => m.severity === 'critical').length;
      const high = enabled.filter((m) => m.severity === 'high').length;
      const medium = enabled.filter((m) => m.severity === 'medium').length;
      const low = enabled.filter((m) => m.severity === 'low').length;
      const trusted = getTrustedWhitelistConfig(settings);

      const embed = new EmbedBuilder()
        .setTitle('🛡️ درع الحماية الموسّع — الحالة')
        .setColor(sm.enabled === false ? Colors.warning : Colors.success)
        .setDescription(
          (sm.enabled === false
            ? '⛔ **نظام الوحدات مطفأ بالكامل** — الحماية الأساسية فقط تعمل.\n\n'
            : '✅ **نظام الوحدات مفعّل** — يعمل مع الحماية الأساسية.\n\n') +
            `📦 الوحدات المفعّلة: **${enabled.length}/${SECURITY_MODULES.length}**\n` +
            `🔴 حرجة: **${critical}** • 🟠 عالية: **${high}** • 🟡 متوسطة: **${medium}** • 🟢 منخفضة: **${low}**`
        )
        .addFields(
          {
            name: '👑 الوايت ليست الموثوقة',
            value:
              (trusted.enabled ? '✅ مفعّلة' : '⛔ معطّلة') +
              ` • الأعضاء: **${trusted.userIds.length}**\n` +
              `🟢 خفيف: ${trusted.minorActions}/${trusted.minorWindowSeconds}ث • 🔴 حساس: ${
                trusted.allowDestructive ? trusted.criticalActions : 0
              }/${trusted.criticalWindowSeconds}ث`,
            inline: false,
          },
          {
            name: 'ℹ️ ملاحظة',
            value:
              'هذه الوحدات تعمل فوق مضاد النيوك الأساسي. استخدم `/shield list` لرؤية التفاصيل، و`/shield toggle` للتحكم.',
            inline: false,
          }
        )
        .setFooter({ text: `${guild.name} • Shield` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'list') {
      const category = interaction.options.getString('category');
      const list = category
        ? SECURITY_MODULES.filter((m) => m.category === category)
        : SECURITY_MODULES;

      const groups = new Map<string, string[]>();
      for (const mod of list) {
        const line = moduleLine(sm, mod);
        const arr = groups.get(mod.category) || [];
        arr.push(line);
        groups.set(mod.category, arr);
      }

      let description = '';
      for (const [cat, lines] of groups) {
        const block = `\n**${cat}**\n${lines.join('\n')}\n`;
        if (description.length + block.length > 3900) break;
        description += block;
      }
      if (!description) description = 'لا توجد وحدات في هذه الفئة.';

      const embed = new EmbedBuilder()
        .setTitle(`🛡️ وحدات الحماية${category ? ` — ${category}` : ''}`)
        .setColor(Colors.primary)
        .setDescription(description.slice(0, 4090))
        .setFooter({
          text: `${guild.name} • ${list.filter((m) => viewOf(sm, m).enabled).length}/${list.length} مفعّلة`,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'toggle') {
      const key = interaction.options.getString('module', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      const mod = getSecurityModule(key);
      if (!mod) {
        await interaction.editReply({
          content: `❌ مفتاح غير معروف: \`${key}\`. استخدم \`/shield list\` لرؤية المفاتيح.`,
        });
        return;
      }

      // إطفاء وحدة = إطفاء حماية → يمر عبر بوابة موافقة المالك
      if (!enabled && !(await gate(`path:securityModules.modules.${mod.key}.enabled`))) {
        return;
      }

      const current = sm.modules[mod.key] || {};
      sm.modules[mod.key] = { ...current, enabled };
      await persist();

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(enabled ? '✅ فُعّلت وحدة الحماية' : '⛔ عُطّلت وحدة الحماية')
            .setColor(enabled ? Colors.success : Colors.warning)
            .setDescription(`${mod.emoji} **${mod.name}** (\`${mod.key}\`)\n${mod.description}`)
            .setFooter({ text: `${guild.name} • Shield` })
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === 'config') {
      const key = interaction.options.getString('module', true);
      const limit = interaction.options.getInteger('limit');
      const window = interaction.options.getInteger('window');
      const action = interaction.options.getString('action') as SecurityAction | null;
      const mod = getSecurityModule(key);
      if (!mod) {
        await interaction.editReply({ content: `❌ مفتاح غير معروف: \`${key}\`.` });
        return;
      }
      if (limit === null && window === null && action === null) {
        await interaction.editReply({
          content: 'ℹ️ حدّد على الأقل خياراً واحداً: `limit` أو `window` أو `action`.',
        });
        return;
      }

      const current = sm.modules[mod.key] || {};
      sm.modules[mod.key] = {
        ...current,
        ...(limit !== null ? { limit } : {}),
        ...(window !== null ? { windowSeconds: window } : {}),
        ...(action !== null ? { action } : {}),
      };
      await persist();

      const v = viewOf(sm, mod);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚙️ حُدّثت وحدة الحماية')
            .setColor(Colors.success)
            .setDescription(`${mod.emoji} **${mod.name}** (\`${mod.key}\`)`)
            .addFields(
              { name: 'الحالة', value: v.enabled ? '✅ مفعّلة' : '⛔ معطّلة', inline: true },
              { name: 'الحد / النافذة', value: `${v.limit} / ${v.windowSeconds}ث`, inline: true },
              { name: 'العقوبة', value: v.action, inline: true },
              { name: 'الوصف', value: mod.description, inline: false }
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === 'all') {
      const enabled = interaction.options.getBoolean('enabled', true);
      if (!enabled && !(await gate('path:securityModules.enabled'))) return;
      sm.enabled = enabled;
      await persist();
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(enabled ? '✅ فُعّلت كل وحدات الحماية' : '⛔ عُطّلت كل وحدات الحماية')
            .setColor(enabled ? Colors.success : Colors.warning)
            .setDescription(
              enabled
                ? `تعمل الآن **${SECURITY_MODULES.length}** وحدة حماية إضافية فوق مضاد النيوك الأساسي.`
                : 'نظام الوحدات مطفأ بالكامل — الحماية الأساسية فقط تعمل. يمكنك إعادة تفعيله بأمر `/shield all enabled:true`.'
            )
            .setTimestamp(),
        ],
      });
      return;
    }

    if (sub === 'strict') {
      sm.enabled = true;
      sm.modules = {};
      for (const mod of SECURITY_MODULES) {
        sm.modules[mod.key] = moduleDefaultConfig(mod);
      }
      await persist();
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🛡️ أقصى تشدد — كل الوحدات مفعّلة')
            .setColor(Colors.success)
            .setDescription(
              `أُعيد تفعيل **${SECURITY_MODULES.length}** وحدة حماية بالعتبات الافتراضية الصارمة.\n` +
                'أي تجاوز للحدود يُطلق العقوبة المحددة لكل وحدة (سحب/طرد/حظر).'
            )
            .setFooter({ text: `${guild.name} • Shield` })
            .setTimestamp(),
        ],
      });
      return;
    }
  },
};

export default command;
