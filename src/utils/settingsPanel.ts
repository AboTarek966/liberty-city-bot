// ============================================
// Liberty City Bot - Settings Panel UI Builder
// (Professional ProBot-style design)
// ============================================

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  Guild,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { getGuildSettings } from '../models';
import { Colors } from './embeds';

export type SettingsCategory =
  | 'home'
  | 'general'
  | 'protection'
  | 'tickets'
  | 'ai'
  | 'welcome'
  | 'leave'
  | 'logging'
  | 'levels'
  | 'automod'
  | 'verification'
  | 'commands';

type PanelComponent = ActionRowBuilder<any>;

export interface BuiltPanel {
  embeds: EmbedBuilder[];
  components: PanelComponent[];
}

// --------------------------------------------
// Permission helper
// --------------------------------------------
export function canManageSettings(
  interaction: ChatInputCommandInteraction | { member: any; user: any }
): boolean {
  const perms = (interaction.member as any)?.permissions;
  return (
    !!perms &&
    (perms.has(PermissionFlagsBits.ManageGuild) ||
      perms.has(PermissionFlagsBits.Administrator))
  );
}

// --------------------------------------------
// Visual helpers
// --------------------------------------------
export const ICONS: Record<SettingsCategory, string> = {
  home: '🎛️',
  general: '🌐',
  protection: '🛡️',
  tickets: '🎫',
  ai: '🤖',
  welcome: '👋',
  leave: '📤',
  logging: '📋',
  levels: '📈',
  automod: '🔇',
  verification: '✅',
  commands: '📝',
};

export const TITLES: Record<SettingsCategory, string> = {
  home: 'لوحة التحكم',
  general: 'الإعدادات العامة',
  protection: 'نظام الحماية',
  tickets: 'نظام التذاكر',
  ai: 'الذكاء الاصطناعي',
  welcome: 'رسائل الترحيب',
  leave: 'رسائل المغادرة',
  logging: 'نظام السجلات',
  levels: 'نظام المستويات',
  automod: 'الأوتو مود',
  verification: 'توثيق الأعضاء',
  commands: 'الأوامر المخصصة',
};

export const CATEGORY_COLORS: Record<SettingsCategory, number> = {
  home: Colors.primary,
  general: 0x5865f2,
  protection: 0x57f287,
  tickets: 0xfee75c,
  ai: 0x9b59b6,
  welcome: 0x2ecc71,
  leave: 0xe74c3c,
  logging: 0x3498db,
  levels: 0xe67e22,
  automod: 0xe74c3c,
  verification: 0x57f287,
  commands: 0x3498db,
};

function on(off?: boolean): string {
  return off ? '🟢' : '🔴';
}

function btn(id: string, label: string, style: ButtonStyle, emoji: string): ButtonBuilder {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setEmoji(emoji);
}

function backRow(current: SettingsCategory): PanelComponent {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_cat:home', 'القائمة الرئيسية', ButtonStyle.Secondary, '🏠'),
    btn('settings_back', '🔄 تحديث', ButtonStyle.Primary, '🔄')
  );
}

function toggleBtn(section: string, field: string, label: string, emoji: string, enabled: boolean): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`settings_tog:${section}:${field}`)
    .setLabel(`${label} ${enabled ? 'مفعّل' : 'معطّل'}`)
    .setStyle(enabled ? ButtonStyle.Success : ButtonStyle.Danger)
    .setEmoji(enabled ? '✅' : '❌');
}

// --------------------------------------------
// Main builder
// --------------------------------------------
export async function buildPanel(
  category: SettingsCategory,
  guild: Guild,
  userId: string
): Promise<BuiltPanel> {
  const settings = await getGuildSettings(guild.id);

  switch (category) {
    case 'home':
      return buildHome(guild, userId, settings);
    case 'general':
      return buildGeneral(guild, settings);
    case 'protection':
      return buildProtection(guild, settings);
    case 'tickets':
      return buildTickets(guild, settings);
    case 'ai':
      return buildAI(guild, settings);
    case 'welcome':
      return buildWelcome(guild, settings);
    case 'leave':
      return buildLeave(guild, settings);
    case 'logging':
      return buildLogging(guild, settings);
    case 'levels':
      return buildLevels(guild, settings);
    case 'automod':
      return buildAutoMod(guild, settings);
    case 'commands':
      return buildCommands(guild, settings);
    default:
      return buildHome(guild, userId, settings);
  }
}

// --------------------------------------------
// Category header embed
// --------------------------------------------
function categoryEmbed(category: SettingsCategory, guild: Guild, desc: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`${ICONS[category]} ${TITLES[category]}`)
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━\n${desc}\n━━━━━━━━━━━━━━━━━━━━━`
    )
    .setColor(CATEGORY_COLORS[category])
    .setThumbnail(guild.iconURL({ size: 128 }) || null)
    .setFooter({ text: `${guild.name} • Liberty City Settings` })
    .setTimestamp();
}

// --------------------------------------------
// Home
// --------------------------------------------
function buildHome(guild: Guild, userId: string, s: any): BuiltPanel {
  const protCount = [
    s.protection.antiRaid.enabled,
    s.protection.antiSpam.enabled,
    s.protection.antiLink.enabled,
    s.protection.antiInvite.enabled,
    s.protection.antiMention.enabled,
    s.protection.antiCaps.enabled,
    s.protection.antiEmoji.enabled,
  ].filter(Boolean).length;

  const embed = new EmbedBuilder()
    .setTitle('🎛️ Liberty City — لوحة التحكم')
    .setDescription(
      `**مرحباً <@${userId}> 👋**\n` +
      `اختر القسم الذي تريده، وكل شيء يتم بضغطة واحدة ⚡\n\n` +
      `━━━━━━━━━━━ **حالة السيرفر** ━━━━━━━━━━━`
    )
    .setColor(Colors.primary)
    .addFields(
      { name: '🌐 عام', value: `${s.language === 'ar' ? '🇸🇦 عربي' : '🇺🇸 English'}\nبادئة: \`${s.prefix}\``, inline: true },
      { name: '🛡️ الحماية', value: `${protCount}/7 محميات\nمفعّلة`, inline: true },
      { name: '🎫 التذاكر', value: s.tickets.categoryId ? '🟢 مُعدّة' : '🔴 غير مُعدّة', inline: true },
      { name: '🤖 الذكاء', value: `${on(s.ai.enabled)} ${s.ai.enabled ? 'مفعّل' : 'معطّل'}`, inline: true },
      { name: '👋 الترحيب', value: `${on(s.welcome.enabled)} ${s.welcome.enabled ? 'مفعّل' : 'معطّل'}`, inline: true },
      { name: '📤 المغادرة', value: `${on(s.leave.enabled)} ${s.leave.enabled ? 'مفعّل' : 'معطّل'}`, inline: true },
      { name: '📋 السجلات', value: `${on(s.logging.enabled)} ${s.logging.channelId ? `<#${s.logging.channelId}>` : 'بدون قناة'}`, inline: true },
      { name: '📈 المستويات', value: `${on(s.leveling.enabled)} ${s.leveling.enabled ? 'مفعّل' : 'معطّل'}`, inline: true },
      { name: '🔇 الأوتو مود', value: `${on(s.automod.enabled)} ${s.automod.enabled ? 'مفعّل' : 'معطّل'}`, inline: true },
      { name: '📝 أوامر مخصصة', value: `${(s.customCommands || []).length} أمر`, inline: true },
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || null)
    .setFooter({ text: `الأعضاء: ${guild.memberCount} • اضغط زر للانتقال إلى القسم` })
    .setTimestamp();

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_cat:general', 'عام', ButtonStyle.Primary, '🌐'),
    btn('settings_cat:protection', 'الحماية', ButtonStyle.Success, '🛡️'),
    btn('settings_cat:tickets', 'التذاكر', ButtonStyle.Secondary, '🎫'),
    btn('settings_cat:ai', 'الذكاء', ButtonStyle.Danger, '🤖'),
    btn('settings_cat:welcome', 'الترحيب', ButtonStyle.Success, '👋'),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_cat:leave', 'المغادرة', ButtonStyle.Danger, '📤'),
    btn('settings_cat:logging', 'السجلات', ButtonStyle.Primary, '📋'),
    btn('settings_cat:levels', 'المستويات', ButtonStyle.Secondary, '📈'),
    btn('settings_cat:automod', 'الأوتو مود', ButtonStyle.Danger, '🔇'),
    btn('settings_back', '🔄 تحديث', ButtonStyle.Secondary, '🔄'),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_cat:commands', 'أوامر مخصصة', ButtonStyle.Primary, '📝'),
    btn('settings_btn:general:shop', '🛍️ المتجر', ButtonStyle.Success, '🛍️'),
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

// --------------------------------------------
// General
// --------------------------------------------
function buildGeneral(guild: Guild, s: any): BuiltPanel {
  const embed = categoryEmbed(
    'general',
    guild,
    `اللغة والبادئة وهوية البوت في سيرفرك\n\n` +
    `> **🌐 اللغة الحالية:** ${s.language === 'ar' ? '🇸🇦 **العربية**' : '🇺🇸 **English**'}\n` +
    `> **💬 بادئة الأوامر:** \`${s.prefix}\`\n` +
    `> **🌍 المنطقة الزمنية:** \`${s.timezone || 'غير محددة'}\`\n\n` +
    `💡 *البادئة تُستخدم للأوامر المختصرة مثل \`${s.prefix}ban @عضو\`*`
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_btn:general:lang', s.language === 'ar' ? 'تبديل: English' : 'تبديل: العربية', ButtonStyle.Primary, '🌐'),
    btn('settings_btn:general:prefix', 'تغيير البادئة', ButtonStyle.Success, '💬'),
    btn('settings_btn:general:tz', 'المنطقة الزمنية', ButtonStyle.Secondary, '🌍'),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  return { embeds: [embed], components: [row1] };
}

// --------------------------------------------
// Protection
// --------------------------------------------
function buildProtection(guild: Guild, s: any): BuiltPanel {
  const p = s.protection;
  const active = [
    p.antiRaid.enabled, p.antiSpam.enabled, p.antiLink.enabled,
    p.antiInvite.enabled, p.antiMention.enabled, p.antiCaps.enabled, p.antiEmoji.enabled,
    p.antiNuke?.enabled, p.antiBot?.enabled, p.antiAdmin?.enabled, p.autoBackup?.enabled,
    p.scamFilter?.enabled,
  ].filter(Boolean).length;

  const embed = categoryEmbed(
    'protection',
    guild,
    `حماية شاملة لسيرفرك من الرويد والسبام والهجمات\n` +
    `**المحميات المفعّلة: ${active}/12**\n\n` +
    `> ${on(p.antiRaid.enabled)} **مكافحة الرويد** — يحمي من الانضمام السريع\n` +
    `> ${on(p.antiSpam.enabled)} **مكافحة السبام** — يوقف تكرار الرسائل\n` +
    `> ${on(p.antiLink.enabled)} **مكافحة الروابط** — يمنع الروابط الخارجية\n` +
    `> ${on(p.antiInvite.enabled)} **مكافحة الدعوات** — يمنع روابط الدعوة\n` +
    `> ${on(p.antiMention.enabled)} **مكافحة المنشنز** — يمنع المنشن الجماعي\n` +
    `> ${on(p.antiCaps.enabled)} **مكافحة الكابس** — يمنع الحروف الكبيرة\n` +
    `> ${on(p.antiEmoji.enabled)} **مكافحة الإيموجي** — يمنع الإيموجي المتكرر\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `> ${on(p.antiNuke?.enabled)} **مضاد النيوك** — يوقف الحذف الجماعي ويعاقب المخالف\n` +
    `> ${on(p.antiBot?.enabled)} **مضاد البوتات** — يطرد البوتات غير المصرح بها\n` +
    `> ${on(p.antiAdmin?.enabled)} **مراقبة الصلاحيات** — تنبيه فوري عند منح أدمن\n` +
    `> ${on(p.autoBackup?.enabled)} **نسخ احتياطي تلقائي** — يحفظ بنية السيرفر ويستعيدها\n` +
    `> ${on(p.scamFilter?.enabled)} **فلتر الاحتيال** — يحذف روابط الصيد والمشاريع المزيفة\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `> ${p.lockdown ? '🔒' : '🔓'} **وضع الطوارئ** — ${p.lockdown ? 'مفعّل (السيرفر مقفول!)' : 'معطّل'} — زر واحد يقفل كل القنوات\n` +
    `> ${on(s.verification?.enabled)} **توثيق بالزر** — رسالة يحصل فيها العضو على رول التوثيق\n\n` +
    `⚙️ *إعدادات متقدمة (العتاد، الأدوار، الاستعادة):* \`/protection\` • \`/backup\``
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('protection', 'antiRaid', 'رويد', '🛡️', p.antiRaid.enabled),
    toggleBtn('protection', 'antiSpam', 'سبام', '🚫', p.antiSpam.enabled),
    toggleBtn('protection', 'antiLink', 'روابط', '🔗', p.antiLink.enabled),
    toggleBtn('protection', 'antiInvite', 'دعوات', '📨', p.antiInvite.enabled),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('protection', 'antiMention', 'منشنز', '📣', p.antiMention.enabled),
    toggleBtn('protection', 'antiCaps', 'كابس', '🔠', p.antiCaps.enabled),
    toggleBtn('protection', 'antiEmoji', 'إيموجي', '😀', p.antiEmoji.enabled),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('protection', 'antiNuke', 'أنتينوك', '💣', !!p.antiNuke?.enabled),
    toggleBtn('protection', 'antiBot', 'مضاد البوتات', '🤖', !!p.antiBot?.enabled),
    toggleBtn('protection', 'antiAdmin', 'مراقبة أدمن', '⚠️', !!p.antiAdmin?.enabled),
    toggleBtn('protection', 'autoBackup', 'نسخ تلقائي', '💾', !!p.autoBackup?.enabled),
  );

  const row4 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('protection', 'scamFilter', 'فلتر احتيال', '🎣', !!p.scamFilter?.enabled),
    toggleBtn(
      'protection',
      'lockdown',
      p.lockdown ? 'إلغاء الطوارئ' : 'وضع الطوارئ',
      p.lockdown ? '🔓' : '🔒',
      !!p.lockdown
    ),
    btn('settings_btn:verification:open', 'توثيق الأعضاء', ButtonStyle.Success, '✅'),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  return { embeds: [embed], components: [row1, row2, row3, row4] };
}

// --------------------------------------------
// Verification — نظام التوثيق بالزر (لوحة فرعية)
// --------------------------------------------
export function buildVerificationPanel(guild: Guild, s: any): BuiltPanel {
  const v = s.verification || {};
  const role = v.roleId ? guild.roles.cache.get(v.roleId) : null;
  const channel = v.channelId ? guild.channels.cache.get(v.channelId) : null;

  const embed = new EmbedBuilder()
    .setTitle('✅ نظام التوثيق بالزر')
    .setDescription(
      `رسالة بزر واحد يحصل فيها العضو على رول التوثيق — تمنع الحسابات الوهمية والبوتات\n\n` +
        `> ⚡ **الحالة:** ${on(v.enabled)} ${v.enabled ? 'مفعّل' : 'معطّل'}\n` +
        `> 🛡️ **رول التوثيق:** ${role ? `${role}` : '❌ غير محدد'}\n` +
        `> 📢 **قناة الرسالة:** ${channel ? `${channel}` : '❌ غير محددة'}\n` +
        `> 🏷️ **نص الزر:** ${v.buttonEmoji || '✅'} ${v.buttonLabel || 'توثيق'}\n` +
        `> 📝 **العنوان:** ${v.title || '—'}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 **الخطوات:** حدد الرول ← حدد القناة ← اضغط **📤 إرسال رسالة التوثيق**\n` +
        `⚠️ *ارفع رتبة البوت فوق رول التوثيق حتى يعمل*`
    )
    .setColor(v.enabled ? 0x2ecc71 : 0xe74c3c)
    .setThumbnail(guild.iconURL({ size: 128 }) || null)
    .setFooter({ text: `${guild.name} • Liberty City` })
    .setTimestamp();

  const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('settings_sel:verification:role')
      .setPlaceholder('🛡️ اختر رول التوثيق (الذي يُعطى عند الضغط)')
      .setMinValues(0)
      .setMaxValues(1)
  );

  const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:verification:channel')
      .setPlaceholder('📢 اختر قناة رسالة التوثيق')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('verification', 'enabled', 'التوثيق', '⚡', !!v.enabled),
    btn('settings_btn:verification:msg', 'تعديل الرسالة', ButtonStyle.Primary, '📝'),
    btn('settings_btn:verification:send', 'إرسال الرسالة', ButtonStyle.Success, '📤'),
    btn('settings_cat:protection', 'رجوع', ButtonStyle.Secondary, '↩️'),
  );

  return { embeds: [embed], components: [roleSelect, channelSelect, row1] };
}

// --------------------------------------------
// Tickets
// --------------------------------------------
// --------------------------------------------
// اللوحة النشطة (الأحدث — الأخيرة في المصفوفة)
// الإعدادات تعالج اللوحة الأحدث دائماً بغض النظر عن اللوحات القديمة
// --------------------------------------------
export function getActivePanel(settings: any): any {
  const panels = settings?.tickets?.panels;
  if (!Array.isArray(panels) || panels.length === 0) return undefined;
  return panels[panels.length - 1];
}

// --------------------------------------------
// الأوامر المخصصة (ردود تلقائية لكلمات محددة)
// --------------------------------------------
export function buildCommands(guild: Guild, s: any): BuiltPanel {
  const cmds = s.customCommands || [];
  const list = cmds.length
    ? cmds.slice(0, 15)
        .map((c: any, i: number) => `> \`${i + 1}.\` **${c.name}** → ${String(c.content).substring(0, 60)}${String(c.content).length > 60 ? '…' : ''} *(الاستخدامات: ${c.uses || 0})*`)
        .join('\n')
    : '> 🔴 **لا توجد أوامر مخصصة بعد** — اضغط **➕ إضافة أمر** لإنشاء أول أمر';

  const embed = categoryEmbed(
    'commands',
    guild,
    `اكتب الكلمة المُعرّفة في أي قناة — يرد بها البوت فوراً (بدون شرطة مائلة)\n\n` +
    `📋 **الأوامر الحالية (${cmds.length}/25):**\n${list}\n\n` +
    `💡 *مثال: أضف كلمة \`.rules\` ورد \`قوانين السيرفر هنا...\` — أي عضو يكتب rules يرد البوت*\n` +
    `🔤 *متغيرات متاحة في الرد: {user} = منشن صاحب الرسالة، {server} = اسم السيرفر*`
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_btn:commands:add', '➕ إضافة أمر', ButtonStyle.Success, '➕'),
    btn('settings_btn:commands:clear', '🗑️ حذف الكل', ButtonStyle.Danger, '🗑️'),
  );

  const rows: PanelComponent[] = [row1];

  if (cmds.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('settings_sel:commands:remove')
      .setPlaceholder('🗑️ اختر أمراً لحذفه')
      .addOptions(
        cmds.slice(0, 25).map((c: any) => ({
          label: String(c.name).substring(0, 100),
          description: String(c.content).substring(0, 90),
          value: String(c.name),
        }))
      );
    rows.push(new ActionRowBuilder<any>().addComponents(select) as any);
  }

  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '↩️'),
  ) as any);

  return { embeds: [embed], components: rows };
}

// --------------------------------------------
// متجر السيرفر (شراء رولات بالرصيد)
// --------------------------------------------
export function buildShop(guild: Guild, s: any): BuiltPanel {
  const items = s.shop?.items || [];
  const list = items.length
    ? items.slice(0, 15)
        .map((it: any) => `> ${it.emoji || '🛍️'} **${it.name}** — 💰 \`${it.price}\` → <@&${it.roleId}>`)
        .join('\n')
    : '> 🔴 **لا توجد عناصر بعد** — اضغط **➕ إضافة عنصر** واختر الرول ثم حدد الاسم والسعر';

  const embed = categoryEmbed(
    'general',
    guild,
    `الأعضاء يشترون رولات من المتجر باستخدام رصيدهم (يجمعونه من أوامر \`/daily\` والنشر)\n\n` +
    `> **حالة المتجر:** ${on(s.shop?.enabled)} ${s.shop?.enabled ? '🟢 مفتوح' : '🔴 مغلق'}\n\n` +
    `🛍️ **عناصر المتجر (${items.length}/15):**\n${list}\n\n` +
    `💡 *الأمر: \`/shop\` يعرض المتجر، والأعضاء يختارون العنصر ويشترونه*`
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_tog:shop:enabled', s.shop?.enabled ? '🟢 المتجر مفتوح — اضغط للإغلاق' : '🔴 المتجر مغلق — اضغط للفتح', s.shop?.enabled ? ButtonStyle.Success : ButtonStyle.Danger, '🛍️'),
    btn('settings_btn:shop:add', '➕ إضافة عنصر', ButtonStyle.Success, '➕'),
  );

  const rows: PanelComponent[] = [row1];

  if (items.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('settings_sel:shop:remove')
      .setPlaceholder('🗑️ اختر عنصراً لحذفه من المتجر')
      .addOptions(
        items.slice(0, 25).map((it: any) => ({
          label: `${it.name} — ${it.price}`,
          value: it.id,
        }))
      );
    rows.push(new ActionRowBuilder<any>().addComponents(select) as any);
  }

  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '↩️'),
  ) as any);

  return { embeds: [embed], components: rows };
}

function buildTickets(guild: Guild, s: any): BuiltPanel {
  const t = s.tickets;
  const roleList = t.supportRoleIds
    .map((id: string) => {
      const r = guild.roles.cache.get(id);
      return r ? `> • ${r}` : `> • \`${id}\` (محذوفة)`;
    })
    .join('\n');

  const panel = getActivePanel(s);
  const panelLine = panel
    ? `${panel.emoji || '🎫'} **${panel.name}** ${panel.channelId ? `<#${panel.channelId}>` : ''}${panel.image ? ' 🖼️' : ''}`
    : '🔴 لم تُنشأ بعد — اختر قناة اللوحة من القائمة';

  // الأنواع المضبوطة في اللوحة (أو الافتراضية)
  const DEFAULT_TYPES = ['🔧 دعم فني', '❓ استفسار', '⚠️ إبلاغ'];
  const typeOptions: any[] = panel && panel.options && panel.options.length > 0
    ? panel.options
    : panel && panel.fields && panel.fields.length > 0
      ? panel.fields.map((f: any) => ({ label: f.label, description: f.placeholder }))
      : DEFAULT_TYPES.map(l => ({ label: l, description: undefined }));
  const typesLine = typeOptions
    .slice(0, 25)
    .map((o: any) => `> • ${o.label}${o.description ? ` — ${o.description}` : ''}`)
    .join('\n');

  const embed = categoryEmbed(
    'tickets',
    guild,
    `نظام تذاكر متكامل — أعضاؤك يفتحون تذكرات وفريق الدعم يرد\n\n` +
    `> 📁 **فئة التذاكر:** ${t.categoryId ? `<#${t.categoryId}>` : '🔴 غير محددة'}\n` +
    `> 📋 **قناة السجلات:** ${t.logChannelId ? `<#${t.logChannelId}>` : '🔴 غير محددة'}\n` +
    `> 🔢 **الحد الأقصى/عضو:** \`${t.maxPerUser}\` تذكرة\n` +
    `> 🛡️ **فريق الدعم:**\n${roleList || '> 🔴 لا يوجد — اختر من القائمة بالأسفل'}\n` +
    `> 🎨 **لوحة التذاكر:** ${panelLine}\n` +
    `> 🏷️ **أنواع التذاكر** (اسم الخيار = اسم قناة التذكرة):\n${typesLine}\n` +
    `> 🤖 **رسالة تلقائية:** ${on(t.autoMessageEnabled)} ${t.autoMessageEnabled ? 'مفعّلة داخل التذكرة' : 'معطّلة'}\n` +
    `> ⏳ **الإغلاق التلقائي:** ${t.autoCloseHours > 0 ? `\`${t.autoCloseHours}\` ساعة بدون نشاط` : '🔴 معطّل'} *(اضبطه: \`/ticket idle\`)*\n` +
    `> ⭐ **استبيان الرضا:** ${on(t.surveyEnabled)} ${t.surveyEnabled ? 'يُرسل لصاحب التذكرة بعد الإغلاق' : 'معطّل'}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *اختر الفئة والقنوات من القوائم، وعدّل المحتوى والأنواع من الأزرار*`
  );

  // ✅ قاعدة Discord: كل صف يحوي قائمة منسدلة واحدة فقط (أو 5 أزرار كحد أقصى)
  // الفئة وقناة السجلات في صفين منفصلين
  const categorySelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:tickets:category')
      .setPlaceholder('📁 اختر فئة التذاكر')
      .setChannelTypes(ChannelType.GuildCategory)
      .setMinValues(0)
      .setMaxValues(1)
  );

  const logSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:tickets:log')
      .setPlaceholder('📋 قناة سجل التذاكر')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('settings_sel:tickets:roles')
      .setPlaceholder('🛡️ اختر رولات فريق الدعم (يمكنك اختيار عدة رولات)')
      .setMinValues(0)
      .setMaxValues(10)
  );

  const rowBtns = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('settings_btn:tickets:dec')
      .setLabel('−')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('settings_btn:tickets:inc')
      .setLabel('+')
      .setStyle(ButtonStyle.Success),
    btn(
      'settings_btn:tickets:auto',
      `رسالة تلقائية: ${t.autoMessageEnabled ? '🟢' : '🔴'}`,
      t.autoMessageEnabled ? ButtonStyle.Success : ButtonStyle.Secondary,
      '🤖'
    ),
    btn(
      'settings_tog:tickets:survey',
      `استبيان: ${t.surveyEnabled ? '🟢' : '🔴'}`,
      t.surveyEnabled ? ButtonStyle.Success : ButtonStyle.Secondary,
      '⭐'
    ),
    btn('settings_btn:tickets:advanced', 'إعدادات متقدمة', ButtonStyle.Secondary, '⚙️'),
  );

  const rowEdit = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_btn:tickets:panel', 'محتوى اللوحة', ButtonStyle.Primary, '📝'),
    btn('settings_btn:tickets:types', 'أنواع التذاكر', ButtonStyle.Primary, '🏷️'),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  return { embeds: [embed], components: [categorySelect, logSelect, roleSelect, rowBtns, rowEdit] };
}

// --------------------------------------------
// Tickets — نقل/إنشاء لوحة التذاكر (لوحة فرعية)
// --------------------------------------------
export function buildTicketMovePanel(guild: Guild, s: any): BuiltPanel {
  const panel = getActivePanel(s);
  const panelLine = panel
    ? `${panel.emoji || '🎫'} **${panel.name}**\n> 📍 القناة: ${panel.channelId ? `<#${panel.channelId}>` : 'غير محددة'}\n> 🆔 الرسالة: \`${panel.messageId || '—'}\``
    : '🔴 لا توجد لوحة بعد — اختر قناة لإنشائها';

  const embed = new EmbedBuilder()
    .setTitle('🎨 لوحة التذاكر — النقل والإنشاء')
    .setDescription(
      `اختر القناة من القائمة بالأسفل — سيتم **إنشاء اللوحة هناك واستبدال القديمة** تلقائياً\n` +
        `✅ *اللوحة الجديدة **ترث** عنوانك وأنواع تذاكرك وصورتك من اللوحة الحالية*\n\n` +
        `━━━ **اللوحة الحالية** ━━━\n${panelLine}\n\n` +
        `💡 *عدّل النصوص من أزرار **محتوى اللوحة** و**أنواع التذاكر** — التغييرات تظهر في رسالة اللوحة فوراً*`
    )
    .setColor('#5865F2')
    .setThumbnail(guild.iconURL({ size: 128 }) || null)
    .setFooter({ text: `${guild.name} • Liberty City Tickets` })
    .setTimestamp();

  const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:tickets:panel')
      .setPlaceholder('🎨 اختر قناة اللوحة (إنشاء أو نقل)')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  const back = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_cat:tickets', 'رجوع للتذاكر', ButtonStyle.Secondary, '↩️')
  );

  return { embeds: [embed], components: [channelSelect, back] };
}

// --------------------------------------------
// التذاكر — إعدادات متقدمة (صورة اللوحة + رولات الإدارة العليا)
// --------------------------------------------
export function buildTicketAdvancedPanel(guild: Guild, s: any): BuiltPanel {
  const t = s.tickets;
  const panel = getActivePanel(s);
  const adminRoles = (t.adminRoleIds || [])
    .map((id: string) => {
      const role = guild.roles.cache.get(id);
      return role ? `<@&${id}>` : null;
    })
    .filter(Boolean);

  const embed = categoryEmbed(
    'tickets',
    guild,
    `إعدادات متقدمة لتذكرة اللوحة — الصورة وإدارية الاستدعاء\n\n` +
    `> 🖼️ **صورة اللوحة (بانر):** ${panel?.image ? '✅ مُضافة' : '🔴 بدون صورة'}\n` +
    `> 🤖 **رسالة تلقائية:** ${on(t.autoMessageEnabled)}\n\n` +
    `━━━ **👮 رولات الإدارة العليا** ━━━\n` +
    `عند الضغط على **🔔 استدعاء الإدارة** في أي تذكرة — يتم منشن **هذه الرولات فقط**:\n` +
    `${adminRoles.length ? adminRoles.join(' , ') : '🔴 **لم تُحدَّد بعد** — اختر من القائمة بالأسفل (أو تُستخدم رولات الدعم تلقائياً)'}\n\n` +
    `💡 *الصورة اختيارية — تظهر أعلى رسالة اللوحة. استخدم رفع مباشر أو رابط*`
  );

  const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('settings_sel:tickets:adminroles')
      .setPlaceholder('👮 اختر رولات الإدارة العليا (يُمنشنون عند الاستدعاء)')
      .setMinValues(0)
      .setMaxValues(10)
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_btn:tickets:pimg', '🖼️ صورة اللوحة', ButtonStyle.Primary, '🖼️'),
    btn('settings_btn:tickets:pupimg', '📤 رفع صورة', ButtonStyle.Success, '📤'),
    btn('settings_btn:tickets:autotext', 'نص التلقائية', ButtonStyle.Secondary, '✏️'),
    btn('settings_btn:tickets:move', 'نقل اللوحة', ButtonStyle.Secondary, '🎨'),
    btn('settings_cat:tickets', 'رجوع للتذاكر', ButtonStyle.Secondary, '↩️'),
  );

  return { embeds: [embed], components: [roleSelect, buttons] };
}

// --------------------------------------------
// AI
// --------------------------------------------
function buildAI(guild: Guild, s: any): BuiltPanel {
  const ai = s.ai;
  const embed = categoryEmbed(
    'ai',
    guild,
    `ذكاء اصطناعي يرد على أعضائك عند المنشن أو الرد على رسائله\n\n` +
    `> ⚡ **الحالة:** ${on(ai.enabled)} ${ai.enabled ? 'مفعّل' : 'معطّل'}\n` +
    `> 💬 **لغة الردود:** ${ai.responseLanguage === 'en' ? '🇺🇸 English' : ai.responseLanguage === 'both' ? '🌐 كلاهما' : '🇸🇦 العربية'}\n` +
    `> 🧠 **المزود:** Groq (مجاني — gpt-oss-120b)\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔒 **الأمان:** المعلومات الحساسة في السيرفر (الإعدادات، السجلات، التذاكر) **لا تظهر إلا للإداريين** — الأعضاء العاديين يحصلون على معلومات عامة فقط (عدد الأعضاء، القنوات، الرتب...)\n\n` +
    `🎭 استخدم زر *تعديل الشخصية* لتعريف شخصية البوت`
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('ai', 'enabled', 'الذكاء', '⚡', ai.enabled),
    new ButtonBuilder().setCustomId('settings_btn:ai:dec').setLabel('كولداون −').setStyle(ButtonStyle.Danger).setEmoji('⏪'),
    new ButtonBuilder().setCustomId('settings_btn:ai:inc').setLabel('كولداون +').setStyle(ButtonStyle.Success).setEmoji('⏩'),
    btn('settings_btn:ai:personality', 'الشخصية', ButtonStyle.Primary, '🎭'),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  const langSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('settings_sel:ai:lang')
      .setPlaceholder('💬 اختر لغة ردود الذكاء الاصطناعي')
      .addOptions([
        { label: '🇸🇦 العربية', value: 'ar', description: 'رد بالعربية دائماً' },
        { label: '🇺🇸 English', value: 'en', description: 'Reply in English' },
        { label: '🌐 كلاهما', value: 'both', description: 'يتبع لغة المستخدم' },
      ])
  );

  return { embeds: [embed], components: [row1, langSelect] };
}

// --------------------------------------------
// Welcome
// --------------------------------------------
function buildWelcome(guild: Guild, s: any): BuiltPanel {
  const w = s.welcome;
  const preview = (w.message || 'لا توجد رسالة')
    .replace(/\{user\}/g, '@عضو')
    .replace(/\{server\}/g, guild.name)
    .replace(/\{count\}/g, String(guild.memberCount))
    .replace(/\{user\.name\}/g, 'اسم_العضو');

  const embed = categoryEmbed(
    'welcome',
    guild,
    `رسالة ترحيب تلقائية عند انضمام أي عضو جديد\n\n` +
    `> ⚡ **الحالة:** ${on(w.enabled)} ${w.enabled ? 'مفعّل' : 'معطّل'}\n` +
    `> 📢 **القناة:** ${w.channelId ? `<#${w.channelId}>` : '🔴 غير محددة'}\n` +
    `> 📩 **رسالة خاصة (DM):** ${on(w.dmEnabled)} ${w.dmEnabled ? 'مفعّل' : 'معطّل'}\n` +
    `> 📌 **العنوان:** ${w.embedTitle || 'مرحباً بك!'}\n` +
    `> 🎨 **اللون:** \`${w.embedColor || '#00D4FF'}\`\n` +
    `> 🖼️ **الصورة:** ${on(w.imageEnabled)} ${w.imageEnabled ? (w.imageBackground ? 'رابط مخصص 🌐' : 'بانر السيرفر 🏞️') : 'معطّلة'}\n\n` +
    `━━━━━━━ **معاينة الرسالة** ━━━━━━━\n` +
    `📌 **${w.embedTitle || 'مرحباً بك!'}**\n` +
    `${preview.substring(0, 400)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💡 **المتغيرات المتاحة:**\n` +
    `> \`{user}\` منشن العضو • \`{user.name}\` اسمه\n` +
    `> \`{server}\` اسم السيرفر • \`{count}\` عدد الأعضاء`
  );

  const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:welcome:channel')
      .setPlaceholder('📢 اختر قناة الترحيب')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('welcome', 'enabled', 'الترحيب', '⚡', w.enabled),
    btn('settings_btn:welcome:msg', 'تعديل الرسالة', ButtonStyle.Primary, '📝'),
    btn('settings_btn:welcome:dm', `DM ${w.dmEnabled ? 'مفعّل' : 'معطّل'}`, w.dmEnabled ? ButtonStyle.Success : ButtonStyle.Secondary, '📩'),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_btn:welcome:title', 'العنوان', ButtonStyle.Primary, '📌'),
    btn('settings_btn:welcome:color', 'اللون', ButtonStyle.Primary, '🎨'),
    btn(
      'settings_btn:welcome:img',
      w.imageEnabled ? 'الصورة: مفعّلة' : 'الصورة: معطّلة',
      w.imageEnabled ? ButtonStyle.Success : ButtonStyle.Secondary,
      '🖼️'
    ),
    btn('settings_btn:welcome:imgurl', 'رابط الصورة', ButtonStyle.Secondary, '🔗'),
    btn('settings_btn:welcome:test', 'تجربة الآن', ButtonStyle.Success, '🧪'),
  );

  return { embeds: [embed], components: [channelSelect, row1, row2] };
}

// --------------------------------------------
// Leave
// --------------------------------------------
function buildLeave(guild: Guild, s: any): BuiltPanel {
  const l = s.leave;
  const preview = (l.message || 'لا توجد رسالة')
    .replace(/\{user\}/g, '@عضو')
    .replace(/\{server\}/g, guild.name)
    .replace(/\{count\}/g, String(guild.memberCount));

  const embed = categoryEmbed(
    'leave',
    guild,
    `رسالة تلقائية عند مغادرة أي عضو للسيرفر\n\n` +
    `> ⚡ **الحالة:** ${on(l.enabled)} ${l.enabled ? 'مفعّل' : 'معطّل'}\n` +
    `> 📢 **القناة:** ${l.channelId ? `<#${l.channelId}>` : '🔴 غير محددة'}\n\n` +
    `━━━━━━━ **معاينة الرسالة** ━━━━━━━\n` +
    `${preview.substring(0, 400)}\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `💡 **المتغيرات:** \`{user}\` • \`{server}\` • \`{count}\``
  );

  const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:leave:channel')
      .setPlaceholder('📢 اختر قناة المغادرة')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('leave', 'enabled', 'المغادرة', '⚡', l.enabled),
    btn('settings_btn:leave:msg', 'تعديل الرسالة', ButtonStyle.Primary, '📝'),
    btn('settings_btn:leave:test', 'تجربة الآن', ButtonStyle.Success, '🧪'),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  return { embeds: [embed], components: [channelSelect, row1] };
}

// --------------------------------------------
// Logging
// --------------------------------------------
function buildLogging(guild: Guild, s: any): BuiltPanel {
  const l = s.logging;
  const eventsLabel = !l.types || l.types.length === 0 ? '🔴 لا شيء' : `🟢 ${l.types.length} حدث`;

  const embed = categoryEmbed(
    'logging',
    guild,
    `تسجيل أحداث السيرفر تلقائياً في قناة مخصصة\n\n` +
    `> ⚡ **الحالة:** ${on(l.enabled)} ${l.enabled ? 'مفعّل' : 'معطّل'}\n` +
    `> 📢 **القناة:** ${l.channelId ? `<#${l.channelId}>` : '🔴 غير محددة'}\n` +
    `> 📊 **الأحداث:** ${eventsLabel}\n\n` +
    `📝 **الأحداث المسجلة:**\n` +
    `> ${l.types && l.types.length ? l.types.slice(0, 10).join('، ') + (l.types.length > 10 ? `... (+${l.types.length - 10})` : '') : 'الكل — حذف/تعديل رسائل، أعضاء، قنوات، رتب، صوت، دعوات...'}\n\n` +
    `💡 *اختر الأنواع من القائمة بالأسفل (الكل / رسائل / أعضاء...)*`
  );

  const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:logging:channel')
      .setPlaceholder('📢 اختر قناة السجلات')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  const eventsSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('settings_sel:logging:events')
      .setPlaceholder('📊 اختر أنواع الأحداث')
      .addOptions([
        { label: 'الكل', value: 'all', description: 'تسجيل كل الأحداث', emoji: { name: '📋' } },
        { label: 'الرسائل', value: 'messages', description: 'حذف وتعديل الرسائل', emoji: { name: '🗑️' } },
        { label: 'الأعضاء', value: 'members', description: 'دخول/خروج/حظر', emoji: { name: '👥' } },
        { label: 'القنوات', value: 'channels', description: 'إنشاء/حذف/تعديل', emoji: { name: '📢' } },
        { label: 'الرتب', value: 'roles', description: 'إنشاء/حذف الرتب', emoji: { name: '📛' } },
        { label: 'الصوت', value: 'voice', description: 'دخول/خروج الغرف الصوتية', emoji: { name: '🔊' } },
        { label: 'الدعوات', value: 'invites', description: 'إنشاء/حذف الدعوات', emoji: { name: '📩' } },
        { label: 'لا شيء', value: 'none', description: 'إيقاف كل السجلات', emoji: { name: '🚫' } },
      ])
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('logging', 'enabled', 'السجلات', '⚡', l.enabled),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  return { embeds: [embed], components: [channelSelect, eventsSelect, row1] };
}

// --------------------------------------------
// Levels
// --------------------------------------------
function styleLabel(style?: string): string {
  return style === 'text' ? '📝 نص' : '💎 إمبد';
}

function buildLevels(guild: Guild, s: any): BuiltPanel {
  const lv = s.leveling;
  const cooldownSec = Math.round((lv.xpCooldown || 60000) / 1000);
  const rewardsCount = Array.isArray(lv.levelRewards) ? lv.levelRewards.length : 0;

  const embed = categoryEmbed(
    'levels',
    guild,
    `نظام XP والمستويات — الأعضاء يربحون خبرة بالمشاركة في الشات والصوت\n\n` +
    `> ⚡ **الحالة:** ${on(lv.enabled)} ${lv.enabled ? 'مفعّل' : 'معطّل'}\n` +
    `> ✨ **XP لكل رسالة:** \`${lv.xpPerMessage}\`\n` +
    `> ⏱️ **كولداون XP:** \`${cooldownSec} ثانية\`\n` +
    `> 🔊 **XP الصوت (لكل دقيقة):** \`${lv.voiceXpPerMinute}\`\n` +
    `> 📢 **قناة الترقية:** ${lv.levelUpChannelId ? `<#${lv.levelUpChannelId}>` : 'قناة الحالية'}\n` +
    `> 🎨 **نمط رسالة الترقية:** ${styleLabel(lv.levelUpStyle)}\n` +
    `> 🎁 **مكافآت المستويات:** \`${rewardsCount}\`\n` +
    `> 🔇 **قنوات متجاهلة:** \`${lv.ignoredChannels?.length || 0}\` • **رولات:** \`${lv.ignoredRoles?.length || 0}\`\n\n` +
    `💡 *الأعضاء يتصاعدون مستوى كلما تفاعلوا أكثر — استخدم \`/rank\` لعرض البطاقة*`
  );

  // قناة إعلانات الترقية
  const channelSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:levels:channel')
      .setPlaceholder('📢 اختر قناة إعلانات الترقية')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  // التفاصيل: تفعيل + XP ± + النمط + رسالة الترقية
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('levels', 'enabled', 'المستويات', '⚡', lv.enabled),
    new ButtonBuilder().setCustomId('settings_btn:levels:inc').setLabel('XP +').setStyle(ButtonStyle.Success).setEmoji('✨'),
    new ButtonBuilder().setCustomId('settings_btn:levels:dec').setLabel('XP −').setStyle(ButtonStyle.Danger).setEmoji('✨'),
    new ButtonBuilder()
      .setCustomId('settings_btn:levels:style')
      .setLabel(`النمط: ${lv.levelUpStyle === 'text' ? 'نص' : 'إمبد'}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎨'),
    new ButtonBuilder().setCustomId('settings_btn:levels:msg').setLabel('رسالة الترقية').setStyle(ButtonStyle.Primary).setEmoji('📝'),
  );

  // صوت ± + كولداون ± + المكافآت
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('settings_btn:levels:voice_inc').setLabel('صوت +').setStyle(ButtonStyle.Success).setEmoji('🔊'),
    new ButtonBuilder().setCustomId('settings_btn:levels:voice_dec').setLabel('صوت −').setStyle(ButtonStyle.Danger).setEmoji('🔊'),
    new ButtonBuilder().setCustomId('settings_btn:levels:cooldown_inc').setLabel('كولداون +').setStyle(ButtonStyle.Success).setEmoji('⏱️'),
    new ButtonBuilder().setCustomId('settings_btn:levels:cooldown_dec').setLabel('كولداون −').setStyle(ButtonStyle.Danger).setEmoji('⏱️'),
    new ButtonBuilder().setCustomId('settings_btn:levels:rewards').setLabel(`المكافآت (${rewardsCount})`).setStyle(ButtonStyle.Success).setEmoji('🎁'),
  );

  // تجربة + تجاهل + رجوع
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('settings_btn:levels:test').setLabel('تجربة الترقية').setStyle(ButtonStyle.Primary).setEmoji('🧪'),
    new ButtonBuilder().setCustomId('settings_btn:levels:ignore').setLabel('التجاهل').setStyle(ButtonStyle.Secondary).setEmoji('🔇'),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  return { embeds: [embed], components: [channelSelect, row1, row2, row3] };
}

// --------------------------------------------
// Levels — قنوات/رولات التجاهل (لوحة فرعية)
// --------------------------------------------
export function buildLevelIgnorePanel(guild: Guild, s: any): BuiltPanel {
  const lv = s.leveling;
  const ignoredChannels: string[] = lv.ignoredChannels || [];
  const ignoredRoles: string[] = lv.ignoredRoles || [];

  const chList = ignoredChannels.length
    ? ignoredChannels.map((id: string) => `<#${id}>`).join(' ')
    : '— لا شيء';
  const roleList = ignoredRoles.length
    ? ignoredRoles.map((id: string) => `<@&${id}>`).join(' ')
    : '— لا شيء';

  const embed = new EmbedBuilder()
    .setTitle('🔇 تجاهل نظام المستويات')
    .setDescription(
      `اختر القنوات والرولات التي **لا** يربح أعضاؤها خبرة\n\n` +
      `> 🔇 **قنوات متجاهلة:**\n${chList}\n\n` +
      `> 🔇 **رولات متجاهلة:**\n${roleList}`
    )
    .setColor(CATEGORY_COLORS.levels)
    .setThumbnail(guild.iconURL({ size: 128 }) || null)
    .setFooter({ text: `${guild.name} • اختر صفر للإزالة` })
    .setTimestamp();

  const chSelect = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('settings_sel:levels:ignore_channels')
      .setPlaceholder('🔇 اختر القنوات المتجاهلة (متعدد)')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(10)
  );

  const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('settings_sel:levels:ignore_roles')
      .setPlaceholder('🔇 اختر الرولات المتجاهلة (متعدد)')
      .setMinValues(0)
      .setMaxValues(10)
  );

  const back = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn('settings_btn:levels:back', 'رجوع للمستويات', ButtonStyle.Secondary, '↩️')
  );

  return { embeds: [embed], components: [chSelect, roleSelect, back] };
}

// --------------------------------------------
// Levels — مكافآت الرولات (لوحة فرعية)
// --------------------------------------------
export function buildLevelRewardsPanel(guild: Guild, s: any): BuiltPanel {
  const lv = s.leveling;
  const rewards: Array<{ level: number; roleId: string }> = Array.isArray(lv.levelRewards)
    ? lv.levelRewards.filter((r: any) => r && typeof r.level === 'number' && r.roleId)
    : [];
  const sorted = [...rewards].sort((a, b) => a.level - b.level);

  const list = sorted.length
    ? sorted
        .map(r => {
          const role = guild.roles.cache.get(r.roleId);
          return `> 🎁 **المستوى \`${r.level}\`** → ${role ? role : `<@&${r.roleId}>`}`;
        })
        .join('\n')
    : '📭 لا توجد مكافآت بعد';

  const embed = new EmbedBuilder()
    .setTitle('🎁 مكافآت المستويات')
    .setDescription(
      `اختر رولًا من القائمة بالأسفل ثم أدخل المستوى ليُضاف تلقائياً\n\n` +
      `━━━ **المكافآت الحالية (${sorted.length})** ━━━\n${list}\n\n` +
      `💡 *يُمنح الرول عند بلوغ المستوى — والأعلى يشمل الأدنى (تراكمي)*`
    )
    .setColor(CATEGORY_COLORS.levels)
    .setThumbnail(guild.iconURL({ size: 128 }) || null)
    .setFooter({ text: `${guild.name} • اضغط ❌ بجانب المكافأة لحذفها` })
    .setTimestamp();

  const roleSelect = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('settings_sel:levels:reward_role')
      .setPlaceholder('🎁 اختر رول المكافأة (ثم أدخل المستوى)')
      .setMinValues(1)
      .setMaxValues(1)
  );

  const components: PanelComponent[] = [roleSelect];

  // أزرار الحذف (حتى 5 في صف)
  const removeButtons = sorted.slice(0, 5).map(
    r =>
      new ButtonBuilder()
        .setCustomId(`settings_btn:levels:reward_remove:${r.level}:${r.roleId}`)
        .setLabel(`حذف lvl ${r.level}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
  );
  if (removeButtons.length) {
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...removeButtons));
  }

  components.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      btn('settings_btn:levels:back', 'رجوع للمستويات', ButtonStyle.Secondary, '↩️')
    )
  );

  return { embeds: [embed], components };
}

// --------------------------------------------
// AutoMod
// --------------------------------------------
function buildAutoMod(guild: Guild, s: any): BuiltPanel {
  const a = s.automod;
  const wordsPreview =
    a.badWords && a.badWords.length
      ? a.badWords.slice(0, 12).map((w: string) => `> • \`${w}\``).join('\n') +
        (a.badWords.length > 12 ? `\n> • ... و${a.badWords.length - 12} أخرى` : '')
      : '🔴 لا توجد كلمات محظورة';

  const actionLabels: Record<string, string> = {
    delete: '🗑️ حذف الرسالة',
    warn: '⚠️ تحذير',
    mute: '🔇 كتم',
    kick: '👢 طرد',
    ban: '🔨 حظر',
  };

  const embed = categoryEmbed(
    'automod',
    guild,
    `فلترة تلقائية للرسائل المسيئة والمحظورة والـ Zalgo\n\n` +
    `> ⚡ **الحالة:** ${on(a.enabled)} ${a.enabled ? 'مفعّل' : 'معطّل'}\n` +
    `> 🎯 **الإجراء عند المخالفة:** ${actionLabels[a.badWordsAction] || a.badWordsAction}\n` +
    `> 😀 **مكافحة Zalgo:** ${on(a.zalgoEnabled)} ${a.zalgoEnabled ? 'مفعّل' : 'معطّل'}\n\n` +
    `━━━━━ **الكلمات المحظورة (${a.badWords?.length || 0})** ━━━━━\n` +
    `${wordsPreview}`
  );

  const actionSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('settings_sel:automod:action')
      .setPlaceholder('🎯 اختر إجراء المخالفات')
      .addOptions([
        { label: 'حذف الرسالة', value: 'delete', emoji: { name: '🗑️' } },
        { label: 'تحذير', value: 'warn', emoji: { name: '⚠️' } },
        { label: 'كتم (10 دقائق)', value: 'mute', emoji: { name: '🔇' } },
        { label: 'طرد', value: 'kick', emoji: { name: '👢' } },
        { label: 'حظر', value: 'ban', emoji: { name: '🔨' } },
      ])
  );

  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    toggleBtn('automod', 'enabled', 'الأوتو مود', '⚡', a.enabled),
    btn('settings_btn:automod:words', 'الكلمات', ButtonStyle.Primary, '🚫'),
    toggleBtn('automod', 'zalgo', 'Zalgo', '😀', a.zalgoEnabled),
    btn('settings_cat:home', 'رجوع', ButtonStyle.Secondary, '🏠'),
  );

  return { embeds: [embed], components: [actionSelect, row1] };
}
