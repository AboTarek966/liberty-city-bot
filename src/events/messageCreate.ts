// ============================================
// Liberty City Bot - Message Create Event
// ============================================

import {
  Message,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger, formatDuration } from '../utils/helpers';
import { getGuildSettings, Warning, MuteRole } from '../models';
import { ICommandAlias } from '../models/CommandAlias';
import { Colors } from '../utils/embeds';
import { executeAIModeration, runSequentialWarn } from '../handlers/AIModeration';
import { executeCommandFromMessage } from '../utils/aliasRunner';
import { handleTopCommand } from '../utils/topCommand';
import { getAliasesForShortcut } from '../utils/aliasCache';
import { getAFK, removeAFK } from '../utils/afk';
import { handleScamFilter } from '../utils/scamFilter';
import { handleCustomCommand, touchTicketActivity, earnCreditsRandom } from '../utils/messageSystems';
import { hasPendingImageUpload, consumePendingImageUpload } from '../utils/pendingUploads';
import { detectImagePrompt, generateImageWithRetry, translateForImage } from '../utils/imageGen';
import {
  detectMusicPrompt,
  generateMusic,
  generateSong,
  songFailText,
  isInstrumentalOnly,
  mediaGenAvailable,
  DEFAULT_INSTRUMENTAL_PROMPT,
} from '../utils/mediaGen';

const logger = createLogger('Event:MessageCreate');

const event: Event = {
  name: 'messageCreate',
  async execute(message: Message) {
    const client = message.client as LibertyClient;

    // Ignore bots and webhooks
    if (message.author.bot) return;
    if (message.webhookId) return;

    const isDM = !message.guild;

    // 🧠 خزّن نص الرسائل (سيرفر فقط) — يُستخدم لاحقاً بسجلات "التعديل/الحذف"
    //    حتى لا تظهر "فارغ" عندما لا تكون الرسالة مخزّنة عند Discord
    if (!isDM) {
      try {
        client.loggingHandler?.recordMessageContent(message);
      } catch {
        /* لا نعطّل مسار الرسائل */
      }
    }

    // 📤 رفع مباشر لصورة لوحة التذاكر (سيرفرات فقط)
    if (!isDM && hasPendingImageUpload(message.author.id) && message.attachments.size > 0) {
      try {
        const upload = consumePendingImageUpload(message.author.id);
        if (upload && upload.guildId === message.guild.id) {
          const attachment = message.attachments.first();
          if (attachment && /\.(png|jpe?g|gif|webp)$/i.test(attachment.name || attachment.url)) {
            const settings = await getGuildSettings(message.guild.id);

            // 🎴 خلفية بطاقة الترحيب
            if (upload.kind === 'welcomeCard') {
              settings.set('welcome.card.backgroundUrl', attachment.url);
              await settings.save();
              await message
                .reply('✅ تم ضبط الصورة كخلفية لبطاقة الترحيب — افتح الإعدادات ← الترحيب ← 🎴 للتعديل والمعاينة')
                .catch(() => {});
              return;
            }

            // 🎫 صورة لوحة التذاكر
            const panels = settings.tickets.panels;
            const panel = panels[panels.length - 1];
            if (panel) {
              panel.image = attachment.url;
              await settings.save();
              await client.ticketHandler.updatePanelMessage(message.guild, panel).catch(() => {});
              await message.reply('✅ تم ضبط الصورة كبانر للوحة التذاكر وتم تحديثها فوراً').catch(() => {});
              return;
            }
          }
        }
      } catch (error) {
        logger.error('Error in pending image upload:', error);
      }
    }

    // ======== سيرفرات فقط: الحماية، AFK، Aliases، أوامر مخصصة، اقتصاد، AI، Leveling ========
    if (!isDM) {
      // Protection checks + فلتر الاحتيال بالتوازي (كلاهما فحوصات أمان تسبق كل شيء)
      try {
        const results = await Promise.allSettled([
          client.protectionHandler.checkMessage(message),
          handleScamFilter(message, client),
        ]);
        const scamResult = results[1];
        const blocked =
          scamResult.status === 'fulfilled' ? scamResult.value : false;
        if (blocked) return; // رسالة احتيالية — لا تُعالَج بقية الأنظمة
      } catch (error) {
        logger.error('Error in safety checks:', error);
      }

      // 💤 نظام AFK (إلغاء تلقائي عند الرسالة + إخبار المنشنزين بالسبب)
      try {
        await handleAfkActivity(message);
      } catch (error) {
        logger.error('Error in AFK system:', error);
      }

      // Activity tracking (messages) — يعمل في الخلفية حتى لا يبطئ أمر المستخدم
      try {
        void client.activityTracker.trackMessage(message.guild.id, message.author.id).catch(() => {});
      } catch (error) {
        logger.error('Error tracking activity:', error);
      }

      // تحديث آخر نشاط في التذاكر المفتوحة (للإغلاق التلقائي عند الخمول) — في الخلفية
      try {
        void touchTicketActivity(message).catch(() => {});
      } catch (error) {
        logger.error('Error touching ticket activity:', error);
      }

      // Alias / prefix commands — يُنفَّذ مبكراً حتى يرد البوت بسرعة
      try {
        const handled = await handleAliasCommand(message, client);
        if (handled) return;
      } catch (error) {
        logger.error('Error handling alias command:', error);
      }

      // 🏆 أمر النصي `top` (يومي/أسبوعي/شهري) — بعد الألياس حتى لا يعطّل اختصارات المستخدم
      try {
        const topHandled = await handleTopCommand(message, client);
        if (topHandled) return;
      } catch (error) {
        logger.error('Error in top command:', error);
      }

      // الأوامر المخصصة (ردود تلقائية لكلمات محددة من الإعدادات)
      try {
        const customHandled = await handleCustomCommand(message);
        if (customHandled) return;
      } catch (error) {
        logger.error('Error in custom command:', error);
      }

      // رصيد عشوائي أثناء التحدث (25% = +5 عملات) — بدون انتظار حتى لا يبطئ الرد
      try {
        void earnCreditsRandom(message).catch(() => {});
      } catch {
        /* لا يعطّل باقي الأنظمة */
      }

      // AI auto-reply (mention or reply to bot) — يعمل في السيرفرات
      try {
        await handleAIResponse(message, client);
      } catch (error) {
        logger.error('Error in AI response:', error);
      }

      // Leveling system (add XP via centralized handler) — في الخلفية
      try {
        void client.levelingHandler.addMessageXp(message.member!, message.channel.id).catch(() => {});
      } catch (error) {
        logger.error('Error in leveling:', error);
      }
    } // end if (!isDM)

    // ======== DMs: AI response only ========
    else {
      // AI auto-reply في الخاص — يرد على أي رسالة مباشرة
      try {
        await handleAIResponse(message, client);
      } catch (error) {
        logger.error('Error in AI response (DM):', error);
      }
    }
  },
};

// --------------------------------------------
// Alias / Prefix Command Handler
// --------------------------------------------
async function handleAliasCommand(message: Message, client: LibertyClient): Promise<boolean> {
  const settings = await getGuildSettings(message.guild!.id);
  const prefix = settings.prefix || 'lc!';

  // Check prefix command (e.g., "lc!تايم @user")
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const shortcut = args[0]?.toLowerCase();

    if (shortcut) {
      const matched = await getAliasesForShortcut(message.guild!.id, shortcut);
      if (matched.length > 0) {
        logger.info(`⌨️ Alias matched (prefix): "${shortcut}" → ${matched.map(a => a.command).join(', ')} | by ${message.author.tag}`);
        await runMatchedAliases(message, client, matched, args.slice(1), shortcut);
        return true;
      }
    }
  }

  // Check standalone shortcut (e.g., user types just "تايم @user")
  const parts = message.content.trim().split(/\s+/);
  const potentialAlias = parts[0]?.toLowerCase();

  if (potentialAlias && potentialAlias.length <= 15) {
    const matched = await getAliasesForShortcut(message.guild!.id, potentialAlias);
    if (matched.length > 0) {
      logger.info(`⌨️ Alias matched: "${potentialAlias}" → ${matched.map(a => a.command).join(', ')} | by ${message.author.tag}`);
      await runMatchedAliases(message, client, matched, parts.slice(1), potentialAlias);
      return true;
    }
  }

  return false;
}

// --------------------------------------------
// تنفيذ الاختصار — واحد أو أكثر (نظام التبديل/Toggle)
// نفس الكلمة قد ترتبط بأكثر من أمر مثل: `ت` → تحذير و `ت` → إزالة تحذير
// --------------------------------------------
async function runMatchedAliases(
  message: Message,
  client: LibertyClient,
  matches: ICommandAlias[],
  args: string[],
  shortcut: string
): Promise<void> {
  if (matches.length === 1) {
    await executeAliasCommand(message, client, matches[0].command, args, shortcut);
    return;
  }

  // أكثر من أمر → نحدد أيهما ينفّذ حسب حالة الهدف (تبديل تلقائي)
  const resolved = await resolveToggle(message, matches, args);
  if (resolved) {
    await executeAliasCommand(message, client, resolved, args, shortcut);
    return;
  }

  // لا يوجد زوج تبديل معروف → قائمة اختيار يدوية
  await showAliasPickMenu(message, client, matches, args, shortcut);
}

// أزواج التبديل: إذا كان الاختصار مرتبط بالأمر وعكسه، نحدد أيهما ينفّذ حسب الحالة
const TOGGLE_PAIRS: Array<[string, string]> = [
  ['warn', 'unwarn'],
  ['ban', 'unban'],
  ['timeout', 'untimeout'],
  ['mute', 'unmute'],
  ['roleadd', 'roleremove'],
  ['jail', 'unjail'],
];

async function resolveToggle(
  message: Message,
  matches: ICommandAlias[],
  args: string[]
): Promise<string | null> {
  const commands = matches.map(a => a.command);
  const has = (c: string) => commands.includes(c);
  const pick = (c: string) => matches.find(a => a.command === c)!.command;
  const guild = message.guild!;
  const userId = parseUserId(args[0]);

  for (const [addCmd, removeCmd] of TOGGLE_PAIRS) {
    if (!(has(addCmd) && has(removeCmd))) continue;

    // تحذير ⇐ العضو عنده تحذيرات؟
    if (addCmd === 'warn') {
      const count = userId
        ? await Warning.countDocuments({ guildId: guild.id, userId }).catch(() => 0)
        : 0;
      return pick(count > 0 ? removeCmd : addCmd);
    }

    const member = userId ? await guild.members.fetch(userId).catch(() => null) : null;

    // حظر ⇐ العضو موجود في السيرفر؟ (موجود ⇐ حظر، محذوف ⇐ إلغاء حظر)
    if (addCmd === 'ban') {
      return pick(member ? addCmd : removeCmd);
    }

    // تايم أوت ⇐ مكتوم حالياً؟
    if (addCmd === 'timeout') {
      return pick(member?.isCommunicationDisabled() ? removeCmd : addCmd);
    }

    // كتم ⇐ يملك رول الكتم؟
    if (addCmd === 'mute') {
      const muteRole = await MuteRole.findOne({ guildId: guild.id }).catch(() => null);
      const muted = !!(member && muteRole && member.roles.cache.has(muteRole.roleId));
      return pick(muted ? removeCmd : addCmd);
    }

    // رولات ⇐ الرول محدد والعضو يملكه؟
    if (addCmd === 'roleadd') {
      const roleId = args[1]?.replace(/[<@&>]/g, '');
      const role = /^\d{17,20}$/.test(roleId || '') ? guild.roles.cache.get(roleId!) : null;
      if (role && member) return pick(member.roles.cache.has(role.id) ? removeCmd : addCmd);
      return pick(addCmd); // بدون رول محدد → لوحة الاختيار (إضافة)
    }

    // سجن ⇐ العضو مسجون حالياً؟ (مسجون ⇐ إلغاء السجن، حر ⇐ سجن)
    if (addCmd === 'jail') {
      if (!member) return pick(addCmd);
      let jailed = false;
      try {
        const { JailData } = await import('../models');
        jailed = !!(await JailData.findOne({ guildId: guild.id, userId: member.id }));
      } catch { /* تجاهل */ }
      return pick(jailed ? removeCmd : addCmd);
    }
  }

  return null;
}

// --------------------------------------------
// قائمة اختيار يدوية (عند ارتباط الكلمة بأكثر من أمر غير متكامل)
// --------------------------------------------
const ALIAS_PICK_TTL = 10 * 60 * 1000;

interface AliasPickState {
  matches: ICommandAlias[];
  args: string[];
  shortcut: string;
  userId: string;
  message: Message;
  client: LibertyClient;
  createdAt: number;
}

const aliasPickStates = new Map<string, AliasPickState>();

const ALIAS_LABELS: Record<string, string> = {
  ban: '🔨 حظر', kick: '👢 طرد', timeout: '⏱️ تايم أوت', warn: '⚠️ تحذير',
  unwarn: '✅ إزالة تحذير', mute: '🔇 كتم', unmute: '🔊 فك الكتم',
  untimeout: '🔓 إلغاء تايم أوت', unban: '🔓 إلغاء حظر', purge: '🗑️ مسح',
  roleadd: '➕ إضافة رول', roleremove: '➖ إزالة رول', promote: '⬆️ ترقية',
  jail: '🔒 سجن', unjail: '🔓 إلغاء سجن', lockdown: '🚨 وضع الطوارئ', settings: '⚙️ إعدادات',
  afk: '💤 AFK', snipe: '🕵️ سنايب', ping: '🏓 بينج',
};

function cleanupAliasPick(): void {
  const now = Date.now();
  for (const [k, v] of aliasPickStates) {
    if (now - v.createdAt > ALIAS_PICK_TTL) aliasPickStates.delete(k);
  }
}

async function showAliasPickMenu(
  message: Message,
  client: LibertyClient,
  matches: ICommandAlias[],
  args: string[],
  shortcut: string
): Promise<void> {
  cleanupAliasPick();
  const sid = message.id;
  aliasPickStates.set(sid, {
    matches, args, shortcut,
    userId: message.author.id,
    message, client,
    createdAt: Date.now(),
  });

  const options = matches.slice(0, 25).map(a => ({
    label: (ALIAS_LABELS[a.command] || `/${a.command}`).substring(0, 100),
    value: a.command,
  }));

  const row = new ActionRowBuilder<any>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`alias_pick:${sid}`)
      .setPlaceholder(`🔁 "${shortcut}" مرتبط بأكثر من أمر — اختر ما تريد تنفيذه`)
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions(options)
  );

  await respond(message, {
    content: `🔁 الاختصار \`${shortcut}\` مرتبط بأكثر من أمر — اختر الإجراء المطلوب:`,
    components: [row],
  });
}

// يُستدعى من معالج القائمة (interactions/selectMenus/aliasPick.ts)
export async function handleAliasPickSelect(
  interaction: StringSelectMenuInteraction,
  sid: string
): Promise<boolean> {
  cleanupAliasPick();
  const state = aliasPickStates.get(sid);
  if (!state) {
    await interaction
      .reply({ content: '❌ انتهت صلاحية القائمة — اكتب الاختصار من جديد', ephemeral: true })
      .catch(() => {});
    return false;
  }
  if (state.userId !== interaction.user.id) {
    await interaction
      .reply({ content: '❌ هذه القائمة مخصصة لمن كتب الاختصار فقط', ephemeral: true })
      .catch(() => {});
    return false;
  }
  aliasPickStates.delete(sid);
  const commandName = interaction.values[0];
  await interaction
    .update({ content: `✅ يتم التنفيذ: \`${commandName}\`…`, components: [] })
    .catch(() => {});
  await executeAliasCommand(state.message, state.client, commandName, state.args, state.shortcut);
  return true;
}

// --------------------------------------------
// 💤 نظام AFK — إلغاء تلقائي + إخبار المنشنزين
// --------------------------------------------

// هل هذه الرسالة نفسها ستُنفّذ أمر AFK عبر اختصار؟
// (في هذه الحالة نترك الأمر يُدير التبديل بنفسه بدل إلغاء مزدوج)
async function messageTriggersAfkCommand(message: Message, guildId: string): Promise<boolean> {
  try {
    const raw = message.content.trim();
    if (!raw) return false;
    const settings = await getGuildSettings(guildId);
    const prefix = settings.prefix || 'lc!';
    let first = raw.split(/\s+/)[0]?.toLowerCase() || '';
    if (first.startsWith(prefix.toLowerCase())) {
      first = first.slice(prefix.length).split(/\s+/)[0] || '';
    }
    if (!first || first.length > 15) return false;
    const aliases = await getAliasesForShortcut(guildId, first);
    return aliases.some(a => a.command === 'afk');
  } catch {
    return false;
  }
}

async function handleAfkActivity(message: Message): Promise<void> {
  const guild = message.guild!;
  const authorId = message.author.id;
  const parts: string[] = [];

  // 1) صاحب الرسالة كان AFK → إلغاء الحالة + رسالة عودة
  const mine = await getAFK(guild.id, authorId);
  if (mine && !(await messageTriggersAfkCommand(message, guild.id))) {
    await removeAFK(guild.id, authorId);
    parts.push(
      `👋 **مرحباً بعودتك <@${authorId}>!** تم إلغاء وضع AFK ` +
      `(كنت غائباً لمدة ${formatDuration(Date.now() - mine.since, { compact: true })})`
    );
  }

  // 2) منشن أعضاء في وضع AFK → إخبار صاحب الرسالة بسبب غيابهم
  const mentioned = [...message.mentions.users.values()]
    .filter(u => !u.bot && u.id !== authorId)
    .slice(0, 5);
  for (const user of mentioned) {
    const afk = await getAFK(guild.id, user.id);
    if (afk) {
      parts.push(
        `💤 <@${user.id}> في وضع AFK — **${afk.reason}** ` +
        `(منذ ${formatDuration(Date.now() - afk.since, { compact: true })})`
      );
    }
  }

  if (parts.length) {
    await message.reply({ content: parts.join('\n') }).catch(() => {});
  }
}

// --------------------------------------------
// Send a response, with fallback if replying fails
// (e.g., original message already deleted by protection)
// --------------------------------------------
async function respond(
  message: Message,
  payload: string | { embeds?: EmbedBuilder[]; content?: string; components?: any[] }
): Promise<void> {
  const body = typeof payload === 'string' ? { content: payload } : payload;

  try {
    await message.reply(body);
    return;
  } catch (error: any) {
    logger.warn(`Alias reply failed (${error.message}) — falling back to channel.send`);
  }

  try {
    if (message.channel.isTextBased() && 'send' in message.channel) {
      const fallback =
        typeof payload === 'string'
          ? { content: `<@${message.author.id}> ${payload}` }
          : payload;
      await message.channel.send(fallback);
    }
  } catch (error: any) {
    logger.error(`Alias fallback send also failed: ${error.message}`);
  }
}

// Extract a user ID from a mention (<@id>, <@!id>) or a raw ID token
function parseUserId(token?: string): string | null {
  if (!token) return null;
  const mention = token.match(/^<@!?(\d{17,20})>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(token)) return token;
  return null;
}

// --------------------------------------------
// Execute an alias target command from a message
// --------------------------------------------
export async function executeAliasCommand(
  message: Message,
  client: LibertyClient,
  commandName: string,
  args: string[],
  shortcut: string
): Promise<void> {
  // 🎫 أوامر تذاكر مخصصة (لا تحتاج أمر سلاش منفصل)
  if (commandName === 'ticket_mystats' || commandName === 'ticket_top') {
    const member = message.member;
    if (!member) return;
    if (!member.permissions.has(PermissionFlagsBits.SendMessages)) {
      await respond(message, '❌ ليس لديك الصلاحيات الكافية');
      return;
    }
    const settings = await getGuildSettings(message.guild!.id);

    if (commandName === 'ticket_mystats') {
      const count = settings.tickets.claimStats?.get(message.author.id) || 0;
      const embed = new EmbedBuilder()
        .setTitle('📊 إحصائياتك في التذاكر')
        .setColor(Colors.primary)
        .setDescription(
          `👤 ${message.author}\n\n` +
          `🤝 **التذاكر التي استلمتها:** \`${count}\`\n\n` +
          `📌 هذا العداد يشمل فقط التذاكر التي قمت باستلامها (وليس فتحها).`
        )
        .setFooter({ text: 'Liberty City Tickets' })
        .setTimestamp();
      await respond(message, { embeds: [embed] });
      return;
    }

    // ticket_top
    const stats = settings.tickets.claimStats;
    if (!stats || stats.size === 0) {
      await respond(message, '📊 لا توجد إحصائيات استلام بعد.');
      return;
    }
    const sorted = [...stats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    const lines = sorted.map(([userId, count], i) => {
      const medal = medals[i] || `\`${i + 1}.\``;
      return `${medal} <@${userId}> — **${count}** تذكرة`;
    });
    const embed = new EmbedBuilder()
      .setTitle('🏆 أعلى 10 إداريين في استلام التذاكر')
      .setColor(Colors.primary)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Liberty City Tickets' })
      .setTimestamp();
    await respond(message, { embeds: [embed] });
    return;
  }

  const command = client.commandHandler.getCommand(commandName);
  if (!command) {
    logger.warn(`Alias target command not found: "${commandName}"`);
    await respond(message, `❌ الأمر \`${commandName}\` غير موجود في البوت`);
    return;
  }

  const member = message.member;
  if (!member) {
    logger.warn(`Alias: message.member is null for ${message.author.tag}`);
    return;
  }

  // Permission check (same permissions as the slash command)
  if (command.permissions && command.permissions.length > 0) {
    const hasPermission = command.permissions.every(p => member.permissions.has(p));
    if (!hasPermission) {
      logger.info(`Alias denied: ${message.author.tag} lacks permissions for "${commandName}"`);
      await respond(message, '❌ ليس لديك الصلاحيات الكافية لاستخدام هذا الأمر');
      return;
    }
  }

  try {
    await runAliasCommand(message, client, commandName, args, shortcut, member);
    logger.info(`✅ Alias executed: "${shortcut}" → "${commandName}" | by ${message.author.tag}`);
  } catch (error: any) {
    logger.error(`Alias execution failed for "${commandName}": ${error.message}`);
    await respond(message, `❌ حدث خطأ: ${error.message}`);
  }

  // ✅ لا نحذف رسالة المستخدم — تبقى ظاهرة مع رد البوت
}

// --------------------------------------------
// Message-based command executors (by command name)
// --------------------------------------------
async function runAliasCommand(
  message: Message,
  client: LibertyClient,
  commandName: string,
  args: string[],
  shortcut: string,
  member: GuildMember
): Promise<void> {
  const guild = message.guild!;
  const usage = (syntax: string) =>
    respond(message, `📋 **الاستخدام:** \`${shortcut} ${syntax}\``);

  switch (commandName) {
    // ---------- MODERATION ----------
    case 'ban': {
      const userId = parseUserId(args[0]);
      if (!userId) return usage('<@المستخدم> [السبب]');
      const reason = args.slice(1).join(' ') || 'لم يتم تحديد سبب';
      if (userId === message.author.id) return respond(message, '❌ لا يمكنك حظر نفسك');

      const target = await client.users.fetch(userId).catch(() => null);
      if (!target) return respond(message, '❌ لم يتم العثور على المستخدم');

      const result = await client.moderationHandler.ban({
        guild,
        moderator: member,
        target,
        reason,
      });
      return respond(message, result.simpleMsg);
    }

    case 'kick': {
      const userId = parseUserId(args[0]);
      if (!userId) return usage('<@المستخدم> [السبب]');
      const reason = args.slice(1).join(' ') || 'لم يتم تحديد سبب';
      if (userId === message.author.id) return respond(message, '❌ لا يمكنك طرد نفسك');

      const target = await guild.members.fetch(userId).catch(() => null);
      if (!target) return respond(message, '❌ العضو غير موجود في السيرفر');

      const result = await client.moderationHandler.kick({
        guild,
        moderator: member,
        target,
        reason,
      });
      return respond(message, result.simpleMsg);
    }

    case 'timeout': {
      const userId = parseUserId(args[0]);
      const duration = args[1];
      if (!userId || !duration) return usage('<@المستخدم> <المدة> [السبب] • مثال: 10m, 1h, 1d');
      const reason = args.slice(2).join(' ') || 'لم يتم تحديد سبب';
      if (userId === message.author.id) return respond(message, '❌ لا يمكنك كتم نفسك');

      const target = await guild.members.fetch(userId).catch(() => null);
      if (!target) return respond(message, '❌ العضو غير موجود في السيرفر');
      if (!target.moderatable)
        return respond(message, '❌ لا أستطيع كتم هذا العضو — تأكد أن رتبتي أعلى من رتبته');

      const result = await client.moderationHandler.timeout({
        guild,
        moderator: member,
        target,
        reason,
        duration,
      });
      return respond(message, result.simpleMsg);
    }

    case 'warn': {
      // 🔢 تحذير تسلسلي: "ت 2 @user" ← رقم المستوى قبل المنشن
      let level = 0;
      let rest = args;
      const lvl = args[0]?.match(/^([١٢٣123])$/);
      if (lvl) {
        level = parseInt(lvl[1].replace('١', '1').replace('٢', '2').replace('٣', '3'), 10);
        rest = args.slice(1);
      }

      const userId = parseUserId(rest[0]);
      if (!userId) return usage(level ? '<1|2|3> <@المستخدم> [السبب]' : '<@المستخدم> [السبب]');
      const reason = rest.slice(1).join(' ') || 'لم يتم تحديد سبب';

      const targetMember = await guild.members.fetch(userId).catch(() => null);

      // 🔢 فيه رقم → تحذير تسلسلي مع رول (للإداريين فقط)
      if (level > 0) {
        if (!targetMember) return respond(message, '❌ لم يتم العثور على المستخدم');
        try {
          const note = await runSequentialWarn({ guild, moderator: member, targetMember, level, reason });
          return respond(message, note);
        } catch (e: any) {
          return respond(message, `❌ ${e.message}`);
        }
      }

      // ✅ بدون رقم → تحذير عادي (عدّاد فقط، بدون أي رول)
      const target = targetMember || (await client.users.fetch(userId).catch(() => null));
      if (!target) return respond(message, '❌ لم يتم العثور على المستخدم');

      const result = await client.moderationHandler.warn({
        guild,
        moderator: member,
        target,
        reason,
      });
      return respond(message, result.simpleMsg);
    }

    case 'unwarn': {
      // 🔢 "شيل 2 @admin" ← الرقم مجرد تمييز لمسار الإداريين (يُتجاهل)
      //    "شيل @member" ← إزالة عادية
      //    في الحالتين: يُشال تحذير واحد فقط + مزامنة الرولات التراكمية
      let rest = args;
      if (args[0]?.match(/^([١-٩1-9])$/)) rest = args.slice(1);

      // نبحث عن المنشن (نتجاهل الكلمات الزائدة قبله مثل "تحذير")
      const mentionIdx = rest.findIndex(t => parseUserId(t));
      if (mentionIdx === -1) return usage('<@المستخدم> [السبب]');

      const userId = parseUserId(rest[mentionIdx])!;
      const reason = rest.slice(mentionIdx + 1).join(' ') || 'إزالة تحذير';

      const targetMember = await guild.members.fetch(userId).catch(() => null);
      if (!targetMember) return respond(message, '❌ لم يتم العثور على المستخدم');

      try {
        const result = await client.moderationHandler.unwarn({
          guild,
          moderator: member,
          target: targetMember,
          reason,
        });
        return respond(message, result.simpleMsg);
      } catch (e: any) {
        return respond(message, `❌ ${e.message}`);
      }
    }

    case 'mute': {
      const userId = parseUserId(args[0]);
      if (!userId) return usage('<@المستخدم> [السبب]');
      const reason = args.slice(1).join(' ') || 'لم يتم تحديد سبب';

      const target = await guild.members.fetch(userId).catch(() => null);
      if (!target) return respond(message, '❌ العضو غير موجود في السيرفر');

      const result = await client.moderationHandler.mute({
        guild,
        moderator: member,
        target,
        reason,
      });
      return respond(message, result.simpleMsg);
    }

    case 'unmute': {
      const userId = parseUserId(args[0]);
      if (!userId) return usage('<@المستخدم> [السبب]');
      const reason = args.slice(1).join(' ') || 'لم يتم تحديد سبب';

      const target = await guild.members.fetch(userId).catch(() => null);
      if (!target) return respond(message, '❌ العضو غير موجود في السيرفر');

      const result = await client.moderationHandler.unmute({
        guild,
        moderator: member,
        target,
        reason,
      });
      return respond(message, result.simpleMsg);
    }

    case 'untimeout': {
      const userId = parseUserId(args[0]);
      if (!userId) return usage('<@المستخدم>');
      const target = await guild.members.fetch(userId).catch(() => null);
      if (!target) return respond(message, '❌ العضو غير موجود في السيرفر');
      if (!target.moderatable)
        return respond(message, '❌ لا أستطيع إلغاء كتم هذا العضو — تأكد أن رتبتي أعلى من رتبته');
      if (!target.isCommunicationDisabled())
        return respond(message, 'ℹ️ هذا العضو غير مكتوم أصلاً');

      await target.timeout(null, `إلغاء تايم أوت بواسطة ${member.user.tag}`).catch(() => {
        return respond(message, '❌ فشل إلغاء التايم أوت — تحقق من صلاحيات البوت');
      });
      return respond(message, `✅ **تم إلغاء تايم أوت** <@${userId}>`);
    }

    case 'unban': {
      const userId = parseUserId(args[0]);
      if (!userId) return usage('<@المستخدم / ID>');
      const reason = args.slice(1).join(' ') || 'إلغاء حظر';
      try {
        await guild.members.unban(userId, reason).catch(() => {
          return respond(message, '❌ فشل إلغاء الحظر — المستخدم غير محظور أو صلاحيات البوت');
        });
        return respond(message, `✅ **تم إلغاء الحظر** عن \`${userId}\``);
      } catch {
        return respond(message, '❌ فشل إلغاء الحظر');
      }
    }

    case 'roleadd': {
      const userId = parseUserId(args[0]);
      if (!userId) return usage('<@المستخدم> [@رول1 @رول2 ... — أو اختر من القائمة]');

      const target = await guild.members.fetch(userId).catch(() => null);
      if (!target) return respond(message, '❌ العضو غير موجود في السيرفر');

      // ✅ جمع كل الرولات من نفس الرسالة (mentions أو IDs) بدلا من تكرار الأمر
      const roleIds: string[] = [];
      let reasonStart = 1;
      for (let i = 1; i < args.length; i++) {
        const raw = args[i];
        const isMention = /^<@&\d+>$/.test(raw);
        const isId = /^\d{17,20}$/.test(raw);
        if (!isMention && !isId) break;
        const id = raw.replace(/[<@&>]/g, '');
        if (!guild.roles.cache.has(id)) break;
        if (!roleIds.includes(id)) roleIds.push(id);
        reasonStart = i + 1;
      }

      // إذا لم يُحدد رول → أرسل قائمة اختيار الرولات (متعددة)
      if (roleIds.length === 0) {
        const { RoleSelectMenuBuilder, ActionRowBuilder } = await import('discord.js') as any;
        const select = new RoleSelectMenuBuilder()
          .setCustomId(`alias_roleadd:${target.id}`)
          .setPlaceholder(`➕ اختر الرولات التي تريد إضافتها لـ ${target.user.username} (يمكن أكثر من واحدة)`)
          .setMinValues(1)
          .setMaxValues(10);
        const row = new ActionRowBuilder().addComponents(select);
        await respond(message, {
          content: `➕ **اختر الرولات** التي تريد إضافتها لـ ${target} (يمكنك اختيار أكثر من رول في نفس القائمة):`,
          components: [row],
        } as any);
        return;
      }

      const reason = args.slice(reasonStart).join(' ') || 'إضافة رول';
      try {
        const result = await client.moderationHandler.addRoles({
          guild,
          moderator: member,
          target,
          reason,
          roleIds,
        });
        return respond(message, result.simpleMsg);
      } catch (e: any) {
        return respond(message, `❌ ${e.message}`);
      }
    }

    case 'roleremove': {
      const userId = parseUserId(args[0]);
      const roleId = args[1]?.replace(/[<@&>]/g, '');
      if (!userId || !roleId) return usage('<@المستخدم> <@الرول / ID>');
      const reason = args.slice(2).join(' ') || 'إزالة رول';
      const target = await guild.members.fetch(userId).catch(() => null);
      if (!target) return respond(message, '❌ العضو غير موجود في السيرفر');
      const role = guild.roles.cache.get(roleId);
      if (!role) return respond(message, '❌ الرول غير موجود');
      try {
        const result = await client.moderationHandler.removeRole({
          guild,
          moderator: member,
          target,
          reason,
          roleId,
        });
        return respond(message, result.simpleMsg);
      } catch (e: any) {
        return respond(message, `❌ ${e.message}`);
      }
    }

    // ---------- UTILITY ----------
    case 'purge': {
      // 🧹 "م all" / "مسح الكل" → حذف كل رسائل الروم (بالكامل)
      const firstArg = (args[0] || '').toLowerCase();
      if (firstArg === 'all' || firstArg === 'الكل' || firstArg === 'كل') {
        if (!('bulkDelete' in message.channel))
          return respond(message, '❌ لا يمكن الحذف في هذا النوع من القنوات');
        let total = 0;
        for (let i = 0; i < 30; i++) {
          const fetched = await (message.channel as any).messages.fetch({ limit: 100 });
          if (fetched.size === 0) break;
          const deleted = await (message.channel as any).bulkDelete(fetched, true);
          total += deleted.size;
          if (deleted.size < fetched.size) break; // الباقي أقدم من 14 يوم (غير قابل للحذف الجماعي)
          await new Promise(r => setTimeout(r, 1200));
        }
        if (message.channel.isTextBased() && 'send' in message.channel) {
          await message.channel
            .send(`🧹 **تم حذف كل الرسائل — الإجمالي: ${total} رسالة**`)
            .then(m => setTimeout(() => m.delete().catch(() => {}), 6000))
            .catch(() => {});
        }
        return;
      }

      const amount = parseInt(args[0], 10);
      if (!amount || amount < 1 || amount > 100) return usage('<1-100 | all> • مثال: 50 أو all');
      if (!('bulkDelete' in message.channel))
        return respond(message, '❌ لا يمكن الحذف في هذا النوع من القنوات');

      const deleted = await (message.channel as any).bulkDelete(amount, true);
      if (message.channel.isTextBased() && 'send' in message.channel) {
        await message.channel
          .send(`🗑️ **تم حذف ${deleted.size} رسالة بنجاح**`)
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5000))
          .catch(() => {});
      }
      return;
    }

    case 'ping': {
      if (!message.channel.isTextBased() || !('send' in message.channel)) return;
      const start = Date.now();
      const msg = await message.channel.send('🏓 جاري القياس...');
      const latency = Date.now() - start;
      await msg
        .edit(
          `🏓 **Pong!**\n• سرعة الرد: **${latency}ms**\n• WebSocket: **${client.ws.ping}ms**`
        )
        .catch(() => {});
      return;
    }

    case 'say': {
      const text = args.join(' ').trim();
      if (!text) return usage('<النص المراد إرساله>');
      if (!message.channel.isTextBased() || !('send' in message.channel)) return;
      await message.delete().catch(() => {});
      await message.channel.send(text.substring(0, 2000)).catch((e: any) => {
        logger.error(`Alias "say" failed: ${e.message}`);
      });
      return;
    }

    case 'avatar': {
      const userId = parseUserId(args[0]) || message.author.id;
      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) return respond(message, '❌ لم يتم العثور على المستخدم');

      const embed = new EmbedBuilder()
        .setColor(Colors.primary)
        .setTitle(`🖼️ صورة ${user.tag}`)
        .setImage(user.displayAvatarURL({ size: 512 }))
        .setFooter({ text: `ID: ${user.id}` })
        .setTimestamp();
      return respond(message, { embeds: [embed] });
    }

    case 'userinfo': {
      const userId = parseUserId(args[0]) || message.author.id;
      const gm = await guild.members.fetch(userId).catch(() => null);
      const user = gm?.user || (await client.users.fetch(userId).catch(() => null));
      if (!user) return respond(message, '❌ لم يتم العثور على المستخدم');

      const created = Math.floor(user.createdTimestamp / 1000);
      const fields = [
        { name: '👤 الحساب', value: `\`${user.tag}\` • <@${user.id}>`, inline: false },
        { name: '🆔 المعرّف', value: `\`${user.id}\``, inline: true },
        { name: '📅 تاريخ الإنشاء', value: `<t:${created}:R>`, inline: true },
      ];
      if (gm) {
        const joined = Math.floor((gm.joinedTimestamp || Date.now()) / 1000);
        fields.push({ name: '📥 انضم للسيرفر', value: `<t:${joined}:R>`, inline: true });
        fields.push({
          name: '🎭 أعلى الرتب',
          value:
            gm.roles.cache
              .filter(r => r.id !== guild.id)
              .sort((a, b) => b.position - a.position)
              .first(5)
              .map(r => r.toString())
              .join(' , ') || 'بدون رتب',
          inline: false,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.info)
        .setTitle(`ℹ️ معلومات ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(fields)
        .setTimestamp();
      return respond(message, { embeds: [embed] });
    }

    // ---------- Fallback: تنفيذ عام لأي أمر سلاش ----------
    default: {
      const executed = await executeCommandFromMessage(message, client, commandName, args);
      if (!executed) {
        return respond(
          message,
          `⌨️ الاختصار **${shortcut}** ← \`/${commandName}\`\nهذا الأمر لا يُنفّذ من المحادثة — استخدم الأمر الكامل \`/${commandName}\` مباشرة.`
        );
      }
      return;
    }
  }
}

// --------------------------------------------
// AI Auto-Reply (Mention / Reply)
// --------------------------------------------
/**
 * 🎨 توليد صورة بالذكاء الاصطناعي (مجاني — Pollinations.ai)
 * يرد في نفس الروم، كرد على رسالة المستخدم، بعد ~6-12 ثانية.
 */
async function handleImageGeneration(message: Message, prompt: string): Promise<void> {
  const short = prompt.length > 120 ? prompt.slice(0, 120) + '…' : prompt;

  // رد فوري حتى لا يظن المستخدم أن البوت عطِل
  const placeholder = await message.reply('🎨 برسملك الصورة…').catch(() => null);
  if (!placeholder) return;

  const started = Date.now();

  // ⚠️ موديل الرسم (flux) لا يفهم العربية إطلاقاً — تجربة مثبتة:
  //    "كلب على شط البحر" رسمت وجه فتاة! لذلك نُترجم أولاً (Groq، < 1 ثانية)
  const englishPrompt = await translateForImage(prompt);

  const image = await generateImageWithRetry(englishPrompt, {
    width: 1024,
    height: 1024,
    model: 'flux',
  });

  if (!image) {
    await placeholder
      .edit('❌ فشل توليد الصورة — الخدمة المجانية مشغولة الآن، حاول بعد دقيقة.')
      .catch(() => {});
    return;
  }

  await placeholder
    .edit({
      content: `🎨 **${short}**`,
      files: [{ attachment: image.data, name: `image.${image.ext}` }],
    })
    .catch(() => {});

  logger.info(`Image generated for ${message.author.tag} in ${Date.now() - started}ms`);
}

/**
 * 🎤 توليد أغنية كاملة بالذكاء الاصطناعي (مجاني — Hugging Face)
 *
 * الافتراضي: أغنية كاملة = كلمات باللهجة المطلوبة + غناء + لحن (ACE-Step).
 * إذا طلب المستخدم عزفاً فقط ("لحن بس"، "بدون كلمات") نستخدم Stable Audio.
 * إن فشل توليد الأغنية نسقط إلى العزف حتى لا يخرج المستخدم بلا شيء.
 */
async function handleMusicGeneration(message: Message, prompt: string, question: string): Promise<void> {
  const avail = mediaGenAvailable();
  if (!avail.music) {
    await message.reply(`❌ توليد الموسيقى غير مفعّل — ${avail.reason}`).catch(() => {});
    return;
  }

  const short = prompt.length > 100 ? prompt.slice(0, 100) + '…' : prompt;
  const topic = prompt === DEFAULT_INSTRUMENTAL_PROMPT ? '' : prompt;
  const instrumental = isInstrumentalOnly(question);

  // رد فوري — التوليد يستغرق ثوانٍ إلى دقائق، ولا نريد أن يظن المستخدم أن البوت عطِل
  const placeholder = await message
    .reply(instrumental ? '🎵 بعزّف لك اللحن… (~30-60 ثانية)' : '🎤 بكتب الكلمات وببني الأغنية… (~1 دقيقة)')
    .catch(() => null);
  if (!placeholder) return;

  let music: Awaited<ReturnType<typeof generateMusic>> = null;
  let lyrics = '';
  let note = '';
  let label: string | null = null;

  if (!instrumental) {
    const outcome = await generateSong({ topic, question });

    if (outcome.ok) {
      music = outcome.media;
      lyrics = outcome.media.lyrics;
      label = outcome.media.dialectLabel;
    } else if (outcome.lyrics) {
      // لا معالج متاح — نرسل الكلمات المكتوبة (مجانية بلا حدود) حتى لا يخرج المستخدم خالي الوفاض
      await placeholder
        .edit({
          content: [
            `✍️ **${short}** · اللهجة ${outcome.dialectLabel}`,
            outcome.lyrics,
            `\n_(${songFailText(outcome.reason)} — الغناء يعود خلال 24 ساعة)_`,
          ].join('\n'),
        })
        .catch(() => {});
      return;
    } else {
      note = `⚠️ ${songFailText(outcome.reason)} — أرسلت لك لحن موسيقي بدلها.`;
      logger.warn(`Song generation failed [${outcome.reason}] — falling back to instrumental for "${short}"`);
    }
  }

  if (!music) music = await generateMusic(prompt, { seconds: 20 });

  if (!music) {
    await placeholder
      .edit('❌ فشل توليد الموسيقى — المساحة المجانية مشغولة الآن، حاول بعد دقيقة.')
      .catch(() => {});
    return;
  }

  const title = `🎵 **${short}**${label ? ` · اللهجة ${label}` : ''}`;
  await placeholder
    .edit({
      content: [title, note, lyrics].filter(Boolean).join('\n'),
      files: [{ attachment: music.data, name: `song.${music.ext}` }],
    })
    .catch(() => {});
}

async function handleAIResponse(message: Message, client: LibertyClient): Promise<void> {
  if (!client.aiHandler) return;

  const botId = client.user?.id;
  if (!botId) return;

  const isDM = !message.guild;

  // Check if bot was mentioned
  const isMention = message.mentions.has(client.user!);

  // في DMs: يرد على أي رسالة مباشرة (بدون حاجة لمنشن/رد)
  // في السيرفرات: يشترط منشن أو رد على البوت
  let repliedToBot = false;

  if (!isDM) {
    if (!isMention && !message.reference?.messageId) return;

    // Check if reply to bot's message (الذاكرة المؤقتة أولاً — بدون طلب API إن أمكن)
    if (!isMention && message.reference?.messageId) {
      try {
        const cached = message.channel.messages.cache.get(message.reference.messageId);
        const refMessage = cached || (await message.channel.messages.fetch(message.reference.messageId));
        repliedToBot = refMessage.author.id === botId;
      } catch {}
    }

    if (!isMention && !repliedToBot) return;
  }

  // Extract question (remove bot mention)
  const question = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  // 📎 الوسائط المرفقة (صور/رسائل صوتية/فيديو/ملفات)
  // رسالة صوتية في ديسكورد → flag IsVoiceMessage (1 << 13)
  const isVoiceNote = typeof (message.flags as any)?.bitfield === 'number'
    ? ((message.flags as any).bitfield & (1 << 13)) !== 0
    : false;

  const attachments = [...message.attachments.values()].map((a) => ({
    id: a.id,
    name: a.name,
    url: a.url,
    contentType: a.contentType,
    size: a.size,
    duration: a.duration,
    flags: isVoiceNote ? 1 << 13 : (Number((a.flags as any)?.bitfield ?? 0) || undefined),
    height: a.height ?? undefined,
    width: a.width ?? undefined,
  }));

  // فارغ وبدون مرفق → لا شيء لتحليله
  if (!question && attachments.length === 0) {
    await message.reply('👋 نعم؟ اكتب سؤالك وسأجيبك!').catch(() => {});
    return;
  }

  // أوامر العقوبات باللغة الطبيعية (فقط في السيرفرات، وعند وجود نص)
  if (message.guild && question) {
    try {
      const executed = await executeAIModeration(message, client, question);
      if (executed) return;
    } catch (error) {
      logger.error('Error in AI moderation:', error);
    }
  }

  // 🎵 طلب توليد موسيقى — أولاً لأن بعض صياغاتها ("ارسملي أغنية") تُشابه طلبات الرسم
  //   يُولَّد عبر Hugging Face Spaces (مجاني، يتطلب HF_TOKEN)
  if (question && attachments.length === 0) {
    const musicPrompt = detectMusicPrompt(question);
    if (musicPrompt) {
      await handleMusicGeneration(message, musicPrompt, question);
      return;
    }
  }

  // 🎨 طلب توليد صورة — نُولّدها فوراً بدل إرسال الطلب للنموذج النصي
  //   (يعمل في السيرفرات مع المنشن، وفي الرسائل الخاصة بدون منشن)
  //   ⚠️ كاشف الصور يرفض بدوره الطلبات الموسيقية المتبقية ("صمملي أغنية")
  if (question && attachments.length === 0) {
    const imagePrompt = detectImagePrompt(question);
    if (imagePrompt) {
      await handleImageGeneration(message, imagePrompt);
      return;
    }
  }

  // Typing indicator
  if ('sendTyping' in message.channel) {
    await (message.channel as any).sendTyping().catch(() => {});
  }

  // التعامل مع DMs — لا يوجد guild أو member
  const memberRoles = message.member?.roles.cache.map(r => r.id) || [];
  const guildId = message.guild?.id;

  // سياق المستخدم: هل هو إداري؟ (يحدد ما يمكن للـ AI إظهاره)
  let isPrivileged = false;
  const userContext = {
    username: message.member?.displayName || message.author.username,
    isPrivileged: false,
    roleNames: [] as string[],
  };

  if (message.member) {
    const memberPerms = message.member.permissions;
    isPrivileged = !!memberPerms && (memberPerms.has(PermissionFlagsBits.Administrator) || memberPerms.has(PermissionFlagsBits.ManageGuild));
    userContext.isPrivileged = isPrivileged;
    userContext.username = message.member.displayName || message.author.username;
    userContext.roleNames = message.member.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => r.name)
      .slice(0, 20);
  }

  // 📡 بث مباشر — أول كلمات من الذكاء الاصطناعي تظهر فوراً
  let streamedMsg: any = null;
  let lastEditAt = 0;
  // أثناء البث قد تظهر علامة الأداة [[SEARCH:...]] — نُخفيها عن المستخدم
  const preview = (text: string): string => {
    const clean = text.replace(/\[\[\s*(SEARCH|FETCH)\s*:[\s\S]{1,400}?\]\]/gi, '').trimEnd();
    const shown = clean || text.replace(/\[\[\s*(SEARCH|FETCH)\s*:/gi, '🔍 ');
    return shown.length > 1900 ? shown.slice(0, 1900) + '\n…' : shown;
  };

  // خيارات الرسالة للإيموجي والمنشنز بشكل صحيح
  const msgOptions = (text: string) => ({
    content: text,
    allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
  });

  const stream = {
    onFirstChunk: async (text: string) => {
      // إن كان هناك رسالة بديلة مُرسلة مسبقاً (مؤشر "جارٍ التحليل") نُحرّرها بدل إرسال رسالة جديدة
      if (streamedMsg) {
        lastEditAt = Date.now();
        await streamedMsg.edit(msgOptions(preview(text))).catch(() => {});
        return;
      }
      streamedMsg = await message.reply(msgOptions(preview(text)));
      lastEditAt = Date.now();
    },
    onUpdate: async (text: string) => {
      if (!streamedMsg) return;
      const now = Date.now();
      if (now - lastEditAt < 1000) return;
      lastEditAt = now;
      await streamedMsg.edit(msgOptions(preview(text))).catch(() => {});
    },
  };

  // ⏳ الوسائط (صور/فيديو/رسائل صوتية) تحتاج ثوانٍ للتحليل — نُجيب فوراً حتى لا يظن المستخدم أن البوت عطِل.
  //   ستُستبدل هذه الرسالة تلقائياً بالرد النهائي.
  if (attachments.length > 0) {
    try { await stream.onFirstChunk('👀 بحلّل المرفق…'); } catch {}
  }

  const response = await client.aiHandler.generateResponse(
    message.author.id,
    guildId,
    message.channel.id,
    question,
    memberRoles,
    isMention,
    repliedToBot,
    { userContext, stream, safeMode: isDM, attachments }
  );

  if (response) {
    const parts = splitAiText(response.content, 1900);

    if (streamedMsg) {
      // الرد الأول مُرسَل أثناء البث — نضبطه بالمحتوى النهائي ثم نُكمل البقية
      await streamedMsg.edit(msgOptions(parts[0])).catch(() => {});
      for (let i = 1; i < parts.length; i++) {
        if (message.channel.isTextBased() && 'send' in message.channel) {
          await message.channel.send(msgOptions(parts[i])).catch(() => {});
        }
      }
    } else {
      // بدون بث (رزيرف/فشل) — رد عادي مع تقسيم الردود الطويلة
      await message.reply(msgOptions(parts[0])).catch(async () => {
        if (message.channel.isTextBased() && 'send' in message.channel) {
          await message.channel.send(msgOptions(`<@${message.author.id}> ${parts[0]}`)).catch(() => {});
        }
      });
      for (let i = 1; i < parts.length; i++) {
        if (message.channel.isTextBased() && 'send' in message.channel) {
          await message.channel.send(msgOptions(parts[i])).catch(() => {});
        }
      }
    }
  } else if (streamedMsg) {
    // لا يوجد رد (محجوب/معطّل) — نحذف مؤشر "جارٍ التحليل" حتى لا يبقى عالقاً
    await streamedMsg.delete().catch(() => {});
  }
}

// تقسيم نص الرد حسب حد ديسكورد (2000 حرف) عند أقرب سطر/مسافة
function splitAiText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf('\n', max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(' ', max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

export default event;