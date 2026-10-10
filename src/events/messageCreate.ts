// ============================================
// Liberty City Bot - Message Create Event
// ============================================

import {
  Message,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';
import { getGuildSettings, CommandAlias } from '../models';
import { Colors } from '../utils/embeds';
import { executeAIModeration } from '../handlers/AIModeration';
import { executeCommandFromMessage } from '../utils/aliasRunner';
import { handleScamFilter } from '../utils/scamFilter';
import { handleCustomCommand, touchTicketActivity, earnCreditsRandom } from '../utils/messageSystems';
import { hasPendingImageUpload, consumePendingImageUpload } from '../utils/pendingUploads';

const logger = createLogger('Event:MessageCreate');

const event: Event = {
  name: 'messageCreate',
  async execute(message: Message) {
    const client = message.client as LibertyClient;

    // Ignore bots and webhooks
    if (message.author.bot) return;
    if (message.webhookId) return;

    // Ignore DMs
    if (!message.guild) return;
    if (message.channel.type === ChannelType.DM) return;

    // 📤 رفع مباشر لصورة لوحة التذاكر (استجابة فورية — قبل أي فحوصات)
    if (hasPendingImageUpload(message.author.id) && message.attachments.size > 0) {
      try {
        const upload = consumePendingImageUpload(message.author.id);
        if (upload && upload.guildId === message.guild.id) {
          const attachment = message.attachments.first();
          if (attachment && /\.(png|jpe?g|gif|webp)$/i.test(attachment.name || attachment.url)) {
            const settings = await getGuildSettings(message.guild.id);
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

    // Protection checks (anti-spam, anti-link, etc.)
    try {
      await client.protectionHandler.checkMessage(message);
    } catch (error) {
      logger.error('Error in protection check:', error);
    }

    // فلتر الروابط الاحتيالية (صيد النيترو والمشاريع المزيفة)
    try {
      const blocked = await handleScamFilter(message, client);
      if (blocked) return; // رسالة احتيالية — لا تُعالَج بقية الأنظمة
    } catch (error) {
      logger.error('Error in scam filter:', error);
    }

    // Activity tracking (messages)
    try {
      await client.activityTracker.trackMessage(message.guild.id, message.author.id);
    } catch (error) {
      logger.error('Error tracking activity:', error);
    }

    // تحديث آخر نشاط في التذاكر المفتوحة (للإغلاق التلقائي عند الخمول)
    try {
      await touchTicketActivity(message);
    } catch (error) {
      logger.error('Error touching ticket activity:', error);
    }

    // الأوامر المخصصة (ردود تلقائية لكلمات محددة من الإعدادات)
    try {
      const customHandled = await handleCustomCommand(message);
      if (customHandled) return;
    } catch (error) {
      logger.error('Error in custom command:', error);
    }

    // رصيد عشوائي أثناء التحدث (25% = +5 عملات)
    try {
      await earnCreditsRandom(message);
    } catch {
      /* لا يعطّل باقي الأنظمة */
    }

    // Alias / prefix commands
    try {
      const handled = await handleAliasCommand(message, client);
      if (handled) return;
    } catch (error) {
      logger.error('Error handling alias command:', error);
    }

    // AI auto-reply (mention or reply to bot)
    try {
      await handleAIResponse(message, client);
    } catch (error) {
      logger.error('Error in AI response:', error);
    }

    // Leveling system (add XP via centralized handler)
    try {
      await client.levelingHandler.addMessageXp(message.member!, message.channel.id);
    } catch (error) {
      logger.error('Error in leveling:', error);
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
      const alias = await CommandAlias.findOne({ guildId: message.guild!.id, alias: shortcut });
      if (alias) {
        logger.info(`⌨️ Alias matched (prefix): "${shortcut}" → "${alias.command}" | by ${message.author.tag}`);
        await executeAliasCommand(message, client, alias.command, args.slice(1), shortcut);
        return true;
      }
    }
  }

  // Check standalone shortcut (e.g., user types just "تايم @user")
  const parts = message.content.trim().split(/\s+/);
  const potentialAlias = parts[0]?.toLowerCase();

  if (potentialAlias && potentialAlias.length <= 15) {
    const alias = await CommandAlias.findOne({ guildId: message.guild!.id, alias: potentialAlias });
    if (alias) {
      logger.info(`⌨️ Alias matched: "${potentialAlias}" → "${alias.command}" | by ${message.author.tag}`);
      await executeAliasCommand(message, client, alias.command, parts.slice(1), potentialAlias);
      return true;
    }
  }

  return false;
}

// --------------------------------------------
// Send a response, with fallback if replying fails
// (e.g., original message already deleted by protection)
// --------------------------------------------
async function respond(
  message: Message,
  payload: string | { embeds: EmbedBuilder[] }
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
async function executeAliasCommand(
  message: Message,
  client: LibertyClient,
  commandName: string,
  args: string[],
  shortcut: string
): Promise<void> {
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

  // Delete the command message for cleanliness
  await message.delete().catch(() => {});
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
      return respond(message, { embeds: [result.embed] });
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
      return respond(message, { embeds: [result.embed] });
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
      return respond(message, { embeds: [result.embed] });
    }

    case 'warn': {
      const userId = parseUserId(args[0]);
      if (!userId) return usage('<@المستخدم> [السبب]');
      const reason = args.slice(1).join(' ') || 'لم يتم تحديد سبب';

      const target =
        (await guild.members.fetch(userId).catch(() => null)) ||
        (await client.users.fetch(userId).catch(() => null));
      if (!target) return respond(message, '❌ لم يتم العثور على المستخدم');

      const result = await client.moderationHandler.warn({
        guild,
        moderator: member,
        target,
        reason,
      });
      return respond(message, { embeds: [result.embed] });
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
      return respond(message, { embeds: [result.embed] });
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
      return respond(message, { embeds: [result.embed] });
    }

    // ---------- UTILITY ----------
    case 'purge': {
      const amount = parseInt(args[0], 10);
      if (!amount || amount < 1 || amount > 100) return usage('<1-100> • مثال: 50');
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
async function handleAIResponse(message: Message, client: LibertyClient): Promise<void> {
  if (!client.aiHandler) return;

  const botId = client.user?.id;
  if (!botId) return;

  // Check if bot was mentioned
  const isMention = message.mentions.has(client.user!);

  // Check if reply to bot's message
  let repliedToBot = false;
  if (message.reference?.messageId) {
    try {
      const refMessage = await message.channel.messages.fetch(message.reference.messageId);
      repliedToBot = refMessage.author.id === botId;
    } catch {}
  }

  if (!isMention && !repliedToBot) return;

  // Extract question (remove bot mention)
  const question = message.content
    .replace(/<@!?\d+>/g, '')
    .trim();

  if (!question) {
    await message.reply('👋 نعم؟ اكتب سؤالك وسأجيبك!').catch(() => {});
    return;
  }

  // أوامر العقوبات باللغة الطبيعية (تنفيذ حتمي وسريع قبل الذكاء الاصطناعي)
  try {
    const executed = await executeAIModeration(message, client, question);
    if (executed) return;
  } catch (error) {
    logger.error('Error in AI moderation:', error);
  }

  // Typing indicator
  if ('sendTyping' in message.channel) {
    await (message.channel as any).sendTyping().catch(() => {});
  }

  const memberRoles = message.member?.roles.cache.map(r => r.id) || [];

  // سياق المستخدم: هل هو إداري؟ (يحدد ما يمكن للـ AI إظهاره)
  const memberPerms = message.member?.permissions;
  const isPrivileged =
    !!memberPerms &&
    (memberPerms.has(PermissionFlagsBits.Administrator) ||
      memberPerms.has(PermissionFlagsBits.ManageGuild));

  const userContext = {
    username: message.member?.displayName || message.author.username,
    isPrivileged,
    roleNames:
      message.member?.roles.cache
        .filter(r => r.name !== '@everyone')
        .map(r => r.name)
        .slice(0, 20) || [],
  };

  const response = await client.aiHandler.generateResponse(
    message.author.id,
    message.guild!.id,
    message.channel.id,
    question,
    memberRoles,
    isMention,
    repliedToBot,
    { userContext }
  );

  if (response) {
    await message.reply(response.content).catch(() => {});
  }
}

export default event;