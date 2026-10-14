// ============================================
// Liberty City Bot - Logging Handler (Complete)
// ============================================

import {
  Client,
  Guild,
  TextChannel,
  ChannelType,
  EmbedBuilder,
  AuditLogEvent,
  PermissionFlagsBits,
} from 'discord.js';
import { createLogger } from '../utils/helpers';
import { getGuildSettings } from '../models';

const logger = createLogger('LoggingHandler');

// All supported log event types
export const LOG_EVENTS = [
  'messageDelete',
  'messageEdit',
  'memberJoin',
  'memberLeave',
  'memberBan',
  'memberUnban',
  'memberUpdate',
  'memberTimeout',
  'roleCreate',
  'roleDelete',
  'roleUpdate',
  'channelCreate',
  'channelDelete',
  'channelUpdate',
  'voiceStateUpdate',
  'inviteCreate',
  'inviteDelete',
  'webhookUpdate',
  'threadCreate',
  'threadDelete',
  'threadUpdate',
  'emojiCreate',
  'emojiDelete',
  'stickerCreate',
  'stickerDelete',
  // تكتات
  'ticketCreate',
  'ticketClose',
  'ticketReopen',
  'ticketDelete',
  'ticketClaim',
  'ticketTransfer',
  'ticketAddUser',
  'ticketRemoveUser',
] as const;

export type LogEventType = typeof LOG_EVENTS[number];

// --------------------------------------------
// Event → Category Color System
// --------------------------------------------
const CATEGORY_COLORS = {
  moderation: 0xED4245, // 🔴 Moderation / automod actions
  member: 0x57F287,     // 🟢 Member events (join / leave / update)
  message: 0xFAA61A,    // 🟠 Message events
  channel: 0x9B59B6,    // 🟣 Channel & thread events
  role: 0x3498DB,       // 🔵 Role events
  voice: 0x1ABC9C,      // 🟦 Voice events
  guild: 0xFEE75C,      // 🟡 Server/guild events (invites, webhooks, emoji, stickers)
} as const;

// Every log event mapped to its category color
const EVENT_COLORS: Record<LogEventType, number> = {
  messageDelete: CATEGORY_COLORS.message,
  messageEdit: CATEGORY_COLORS.message,
  memberJoin: CATEGORY_COLORS.member,
  memberLeave: CATEGORY_COLORS.member,
  memberBan: CATEGORY_COLORS.moderation,
  memberUnban: CATEGORY_COLORS.moderation,
  memberUpdate: CATEGORY_COLORS.member,
  memberTimeout: CATEGORY_COLORS.moderation,
  roleCreate: CATEGORY_COLORS.role,
  roleDelete: CATEGORY_COLORS.role,
  roleUpdate: CATEGORY_COLORS.role,
  channelCreate: CATEGORY_COLORS.channel,
  channelDelete: CATEGORY_COLORS.channel,
  channelUpdate: CATEGORY_COLORS.channel,
  voiceStateUpdate: CATEGORY_COLORS.voice,
  inviteCreate: CATEGORY_COLORS.guild,
  inviteDelete: CATEGORY_COLORS.guild,
  webhookUpdate: CATEGORY_COLORS.guild,
  threadCreate: CATEGORY_COLORS.channel,
  threadDelete: CATEGORY_COLORS.channel,
  threadUpdate: CATEGORY_COLORS.channel,
  emojiCreate: CATEGORY_COLORS.guild,
  emojiDelete: CATEGORY_COLORS.guild,
  stickerCreate: CATEGORY_COLORS.guild,
  stickerDelete: CATEGORY_COLORS.guild,
  // تكتات
  ticketCreate: CATEGORY_COLORS.channel,
  ticketClose: CATEGORY_COLORS.moderation,
  ticketReopen: CATEGORY_COLORS.member,
  ticketDelete: CATEGORY_COLORS.moderation,
  ticketClaim: CATEGORY_COLORS.member,
  ticketTransfer: CATEGORY_COLORS.member,
  ticketAddUser: CATEGORY_COLORS.member,
  ticketRemoveUser: CATEGORY_COLORS.member,
};

// --------------------------------------------
  // Logging Handler Class
  // --------------------------------------------
  export class LoggingHandler {
    private client: Client;
    private enabledCache: Map<string, { channelId?: string; splits: Record<string, string>; types: Set<string>; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 30000; // 30 ثانية

    /**
     * ⚡ طابور إرسال لكل سيرفر — يحلّ مشاكل السجلات الثلاث:
     *   1) الترتيب: السجلات تُرسل كما وقعت فعلاً (لا سجلات مقلوبة أو مبعثرة)
     *   2) السرعة: الإرسال مستقل عن مسار الحدث → لا يعطّل الترحيب/الحماية/الأوامر
     *   3) عدم الضياع: تأخير واحد لا يُسقط بقية السجلات المكدّسة
     */
    private queues = new Map<string, Promise<void>>();

    /** ذاكرة محتوى الرسائل الأخيرة — لعرض "النص قبل التعديل" حتى لو الرسالة غير مخزّنة */
    private recentContent = new Map<string, { content: string; at: number }>();
    private contentCounter = 0;
    private readonly CONTENT_TTL = 30 * 60 * 1000; // 30 دقيقة
    private readonly CONTENT_MAX = 4000;           // حد أقصى لعدد الرسائل المحفوظة

    constructor(client: Client) {
      this.client = client;
    }

  // --------------------------------------------
  // Check if event should be logged
  // --------------------------------------------
  private async getLogConfig(
    guild: Guild
  ): Promise<{ channelId?: string; splits: Record<string, string>; types: Set<string>; timestamp: number } | null> {
    // Check cache first (with TTL) — النتيجة "غير مفعّل" تُخزَّن أيضاً
    // حتى لا نقرأ قاعدة البيانات مع كل حدث عندما تكون اللوقس مطفأة
    const cached = this.enabledCache.get(guild.id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) return cached;

    try {
      const settings = await getGuildSettings(guild.id);

      const OFF: { channelId?: string; splits: Record<string, string>; types: Set<string>; timestamp: number } = {
        channelId: undefined,
        splits: {},
        types: new Set<string>(),
        timestamp: Date.now(),
      };

      if (!settings.logging?.enabled) {
        this.enabledCache.set(guild.id, OFF);
        return null;
      }

      // 🔀 تقسيم: كل نوع حدث قد يملك قناة خاصة (وإلا → القناة الرئيسية)
      const splits: Record<string, string> = {
        ...(((settings.logging as any).channels as Record<string, string>) || {}),
      };

      const channelId = settings.logging.channelId;
      if (!channelId && Object.keys(splits).length === 0) {
        this.enabledCache.set(guild.id, OFF);
        return null;
      }

      const types = new Set(settings.logging.types || []);
      const config = { channelId, splits, types, timestamp: Date.now() };

      // Cache with timestamp
      this.enabledCache.set(guild.id, config);

      return config;
    } catch (error) {
      logger.error('Error getting log config:', error);
      return null;
    }
  }

  // Clear cache for a guild
  invalidateCache(guildId: string): void {
    this.enabledCache.delete(guildId);
  }

  /**
   * تتبّع فشل أي معالج سجل — بدون هذا الدالة كانت الأخطاء تُبتلع صامتاً
   * فلا يظهر للإدارة أي سبب لاختفاء السجل (وكأنه "ما انصلك أصلاً").
   */
  reportFailure(eventName: string, error: unknown): void {
    logger.error(`⚠️ Log handler "${eventName}" failed:`, error);
  }

  // --------------------------------------------
  // Send log embed (مُوجَّه لقناة نوع الحدث إن وُجدت)
  // الإرسال عبر طابور مُرتَّب لكل سيرفر — لا ينتظره مسار الحدث
  // --------------------------------------------
  private async sendLog(
    guild: Guild,
    eventType: LogEventType,
    embed: EmbedBuilder
  ): Promise<void> {
    try {
      const config = await this.getLogConfig(guild);
      if (!config) return;

      // ملاحظة: memberTimeout تُقبل ضمن memberUpdate للتوافق القديم
      const allowedByTypes =
        config.types.size === 0 ||
        config.types.has(eventType) ||
        (eventType === 'memberTimeout' && config.types.has('memberUpdate'));
      if (!allowedByTypes) return;

      const targetId = config.splits[eventType] || config.channelId;
      if (!targetId) return;

      embed.setFooter({ text: `Liberty City • ${eventType}` });
      embed.setTimestamp();
      this.sanitizeEmbed(embed);

      // ⚡ طابور السيرفر: ترتيب تام + استقلال عن الحدث (لا بطء ولا ضياع)
      this.enqueue(guild.id, () => this.deliverLog(guild.id, targetId, embed));
    } catch (error) {
      logger.error(`Error sending log for ${eventType}:`, error);
    }
  }

  /** إضافة مهمة إلى طابور السيرفر (تنفيذ تسلسلي بالترتيب) */
  private enqueue(guildId: string, job: () => Promise<void>): void {
    const previous = this.queues.get(guildId) ?? Promise.resolve();
    const next = previous.then(job).catch((err: any) => {
      logger.error(`Queued log job failed for ${guildId}:`, err);
    });
    this.queues.set(guildId, next);
    // تنظيف الوعاء بعد انتهائه لتجنّب تسرّب الذاكرة
    void next.then(() => {
      if (this.queues.get(guildId) === next) this.queues.delete(guildId);
    });
  }

  /** الإرسال الفعلي: جلب القناة (كاش ثم fetch) + تحقق الصلاحيات + إعادة محاولة واحدة */
  private async deliverLog(guildId: string, channelId: string, embed: EmbedBuilder): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return;

    // الكاش أولاً ثم الجلب الفعلي — يمنع ضياع السجل إذا لم تكن القناة في الكاش
    let channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) {
      channel = ((await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null) ?? undefined;
    }
    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.warn(`Log channel ${channelId} not found or not a text channel in ${guild.name}`);
      this.enabledCache.delete(guildId);
      return;
    }

    const me = guild.members.me;
    const perms = me ? channel.permissionsFor(me) : null;
    if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.EmbedLinks)) {
      logger.warn(`Missing SendMessages/EmbedLinks in log channel #${channel.name} in ${guild.name}`);
      return;
    }

    const payload = { embeds: [embed] };

    // المحاولة الأولى، ثم إعادة محاولة واحدة بعد 1.2 ثانية للأعطال المؤقتة
    const firstError: unknown = await channel.send(payload).then(() => null).catch((err) => err);
    if (firstError) {
      logger.warn(`Log send failed in ${guild.name} (#${channel.name}), retrying once:`, firstError);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await channel.send(payload).catch((err: any) => {
        logger.error(`Log send failed permanently in ${guild.name} (#${channel.name}):`, err);
      });
    }

    logger.debug(`Logged event in ${guild.name} → #${channel.name}`);
  }

  /**
   * تصحيح الإيمبد قبل الإرسال — يمنع رفض Discord للرسالة بالكامل
   * (خطأ 50035 = سجل ضائع بالكامل، وهو سبب "أوقات ما ترسل"):
   *   • حقل فارغ أو "undefined" → يُستبدل بـ "—"
   *   • تجاوز حد 1024 حرف للحقل أو 4096 للوصف أو 250 للعنوان → يُقصّر
   */
  private sanitizeEmbed(embed: EmbedBuilder): void {
    try {
      const data = embed.data as any;
      if (typeof data.title === 'string' && data.title.length > 250) {
        embed.setTitle(`${data.title.slice(0, 247)}…`);
      }
      if (typeof data.description === 'string' && data.description.length > 4000) {
        embed.setDescription(`${data.description.slice(0, 3997)}…`);
      }
      if (Array.isArray(data.fields)) {
        const fixed = data.fields.map((f: any) => {
          let name = typeof f?.name === 'string' && f.name.trim() ? f.name : '—';
          let value = typeof f?.value === 'string' && f.value.trim() ? f.value : '—';
          if (name.length > 250) name = `${name.slice(0, 247)}…`;
          if (value.length > 1020) value = `${value.slice(0, 1017)}…`;
          return { name, value, inline: !!f?.inline };
        });
        embed.setFields(fixed);
      }
    } catch (error) {
      logger.warn('sanitizeEmbed failed:', error);
    }
  }

  // --------------------------------------------
  // ذاكرة محتوى الرسائل (تعويض الرسائل غير المخزّنة)
  // --------------------------------------------
  /** يُستدعى من messageCreate — يخزّن نص الرسالة لاستخدامه عند التعديل أو الحذف */
  recordMessageContent(message: any): void {
    try {
      const id: string | undefined = message?.id;
      const content: unknown = message?.content;
      if (!id || typeof content !== 'string' || content.length === 0) return;

      this.recentContent.set(id, { content, at: Date.now() });

      // تنظيف دوري كل 400 رسالة (عملية رخيصة ولا تُحسّ في المسار الحارّ)
      if (++this.contentCounter % 400 === 0) {
        const now = Date.now();
        for (const [key, entry] of this.recentContent) {
          if (now - entry.at > this.CONTENT_TTL) this.recentContent.delete(key);
        }
        while (this.recentContent.size > this.CONTENT_MAX) {
          const oldest = this.recentContent.keys().next();
          if (oldest.done) break;
          this.recentContent.delete(oldest.value);
        }
      }
    } catch {
      /* لا نعطّل مسار الرسائل أبداً */
    }
  }

  /** جلب النص المخزّن لرسالة (إن وُجد ولم تنتهِ صلاحيته) */
  private getCachedContent(messageId?: string): string | null {
    if (!messageId) return null;
    const entry = this.recentContent.get(messageId);
    if (!entry) return null;
    if (Date.now() - entry.at > this.CONTENT_TTL) {
      this.recentContent.delete(messageId);
      return null;
    }
    return entry.content;
  }

  // --------------------------------------------
  // Shared formatting helpers
  // --------------------------------------------
  /** Truncate text for embed fields (max ~500 chars, "..." suffix) */
  private truncate(text: string | null | undefined, max = 500): string {
    if (!text || text.trim().length === 0) return 'فارغ';
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  }

  /** Format a user with tag + mention (handles unknown users) */
  private formatUser(user: any): string {
    if (!user) return 'غير معروف';
    const label = user.tag || user.username || 'مستخدم';
    return `${label} • <@${user.id}>`;
  }

  /** Account age in full days, or null if unknown */
  private getAccountAgeDays(user: any): number | null {
    if (!user?.createdAt) return null;
    const created = new Date(user.createdAt).getTime();
    if (Number.isNaN(created)) return null;
    return Math.max(0, Math.floor((Date.now() - created) / 86400000));
  }

  /** Account creation date + age fields (only when known) */
  private accountFields(user: any): Array<{ name: string; value: string; inline: boolean }> {
    const ageDays = this.getAccountAgeDays(user);
    if (ageDays === null || !user?.createdAt) return [];
    const ts = Math.floor(new Date(user.createdAt).getTime() / 1000);
    return [
      { name: '📅 تاريخ إنشاء الحساب', value: `<t:${ts}:F>`, inline: true },
      { name: '⏳ عمر الحساب', value: `${ageDays} يوم`, inline: true },
    ];
  }

  /**
   * Fetch the audit-log entry (executor + reason) for a recent action on a target.
   * ⚠️ سجل التدقيق قد يظهر بفارق ~1-2 ثانية عن الحدث نفسه،
   * لذلك نجرّب 3 مرات بفارق 600ms حتى لا يظهر "غير معروف" في السجل.
   */
  private async fetchAuditInfo(
    guild: Guild,
    type: AuditLogEvent,
    targetId: string,
    maxAgeMs = 20000
  ): Promise<{ executor: any; reason: string } | null> {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const logs = await guild.fetchAuditLogs({ type, limit: 10 }).catch(() => null);
        const entry = logs?.entries?.find(
          (e: any) => e.target?.id === targetId && Date.now() - e.createdTimestamp <= maxAgeMs
        );
        if (entry) {
          return { executor: entry.executor, reason: entry.reason || 'غير محدد' };
        }
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 600));
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Human-readable executor field value (moderator) */
  private executorValue(executor: any): string {
    return executor ? this.formatUser(executor) : 'غير معروف';
  }

  // --------------------------------------------
  // Member Join
  // --------------------------------------------
  async handleMemberJoin(member: any): Promise<void> {
    if (!member?.guild || !member.user) return;

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: '👤 العضو', value: this.formatUser(member.user), inline: true },
      ...this.accountFields(member.user),
      { name: '👥 إجمالي الأعضاء', value: `${member.guild.memberCount?.toLocaleString('en-US') ?? 'غير معروف'}`, inline: true },
    ];

    // Anti-raid hint: brand new account
    const ageDays = this.getAccountAgeDays(member.user);
    if (ageDays !== null && ageDays < 7) {
      fields.push({ name: '⚠️ تنبيه', value: 'حساب جديد (أقل من 7 أيام)', inline: false });
    }

    const embed = new EmbedBuilder()
      .setTitle('📥 انضمام عضو')
      .setColor(EVENT_COLORS.memberJoin)
      .addFields(fields);

    if (typeof member.user.displayAvatarURL === 'function') {
      embed.setThumbnail(member.user.displayAvatarURL());
    }

    await this.sendLog(member.guild, 'memberJoin', embed);
  }

  // --------------------------------------------
  // Member Leave
  // --------------------------------------------
  async handleMemberLeave(member: any): Promise<void> {
    if (!member?.guild || !member.user) return;

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: '👤 العضو', value: this.formatUser(member.user), inline: true },
      ...this.accountFields(member.user),
    ];

    if (member.joinedAt) {
      const joinedTs = Math.floor(new Date(member.joinedAt).getTime() / 1000);
      const daysInServer = Math.max(0, Math.floor((Date.now() - new Date(member.joinedAt).getTime()) / 86400000));
      fields.push(
        { name: '📅 تاريخ الانضمام', value: `<t:${joinedTs}:F>`, inline: true },
        { name: '⏳ مدة البقاء', value: `${daysInServer} يوم`, inline: true }
      );
    }

    fields.push({
      name: '👥 إجمالي الأعضاء',
      value: `${member.guild.memberCount?.toLocaleString('en-US') ?? 'غير معروف'}`,
      inline: true,
    });

    const embed = new EmbedBuilder()
      .setTitle('📤 مغادرة عضو')
      .setColor(EVENT_COLORS.memberLeave)
      .addFields(fields);

    if (typeof member.user.displayAvatarURL === 'function') {
      embed.setThumbnail(member.user.displayAvatarURL());
    }

    await this.sendLog(member.guild, 'memberLeave', embed);
  }

  // --------------------------------------------
  // Message Delete
  // --------------------------------------------
  async handleMessageDelete(message: any): Promise<void> {
    if (!message.guild) return;
    if (message.author?.bot) return;

    // Handle webhooks / uncached system messages with unknown authors
    const author = message.author
      ? this.formatUser(message.author)
      : message.webhookId
        ? `ويب هوك • \`#${message.webhookId}\``
        : 'غير معروف — رسالة نظام أو غير مخزّنة';

    const attachmentCount = message.attachments?.size ?? 0;
    let content: string;
    if (message.content && message.content.trim().length > 0) {
      content = this.truncate(message.content, 500);
    } else {
      // 🔁 الرسائل غير المقدّرة تصل بلا محتوى — نعوّض من ذاكرتنا الأخيرة
      const cached = this.getCachedContent(message.id);
      if (cached && cached.trim().length > 0) {
        content = this.truncate(cached, 500);
      } else if (attachmentCount > 0) {
        content = 'مرفق (بدون نص)';
      } else {
        content = 'رسالة نظام أو محتوى غير متاح';
      }
    }

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: '👤 الكاتب', value: author, inline: true },
      { name: '📍 القناة', value: message.channel?.id ? `<#${message.channel.id}>` : 'غير معروف', inline: true },
      { name: '🆔 معرّف الرسالة', value: `\`${message.id}\``, inline: true },
      { name: '📝 المحتوى', value: content, inline: false },
    ];

    if (attachmentCount > 0) {
      fields.push({ name: '📎 المرفقات', value: `${attachmentCount}`, inline: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🗑️ حذف رسالة')
      .setColor(EVENT_COLORS.messageDelete)
      .addFields(fields);

    if (message.author && typeof message.author.displayAvatarURL === 'function') {
      embed.setThumbnail(message.author.displayAvatarURL());
    }

    await this.sendLog(message.guild, 'messageDelete', embed);
  }

  // --------------------------------------------
  // Bulk Message Delete (حذف جماعي — كان غير موجود)
  // --------------------------------------------
  async handleMessageDeleteBulk(messages: any, channel: any): Promise<void> {
    try {
      const guild = channel?.guild ?? messages?.first?.()?.guild;
      if (!guild) return;

      // discord.js يمرّر Collection، وقد يمرّر مصفوفة أو Map — نتعامل مع الثلاثة
      const list: any[] = Array.isArray(messages)
        ? messages
        : typeof messages?.values === 'function'
          ? Array.from(messages.values())
          : [];

      const rows: string[] = [];
      for (const m of list.slice(0, 20)) {
        if (m?.author?.bot) continue;
        const who = m?.author ? this.formatUser(m.author) : 'غير معروف';
        const text =
          (typeof m?.content === 'string' && m.content.trim()) ||
          this.getCachedContent(m?.id) ||
          '(بدون نص)';
        rows.push(`• ${who}: ${this.truncate(text, 120)}`);
      }

      const fields: Array<{ name: string; value: string; inline: boolean }> = [
        { name: '📍 القناة', value: channel?.id ? `<#${channel.id}>` : 'غير معروف', inline: true },
        { name: '🔢 عدد الرسائل المحذوفة', value: `${list.length}`, inline: true },
      ];
      if (rows.length > 0) {
        fields.push({ name: '📝 عيّنة من المحتوى', value: this.truncate(rows.join('\n'), 1000), inline: false });
      }

      const embed = new EmbedBuilder()
        .setTitle('🗑️ حذف جماعي للرسائل')
        .setColor(EVENT_COLORS.messageDelete)
        .addFields(fields);

      await this.sendLog(guild, 'messageDelete', embed);
    } catch (error) {
      logger.error('handleMessageDeleteBulk failed:', error);
    }
  }

  // --------------------------------------------
  // Message Edit
  // --------------------------------------------
  async handleMessageEdit(oldMessage: any, newMessage: any): Promise<void> {
    if (!newMessage.guild) return;
    if (!newMessage.author || newMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    // 🔁 الرسائل غير المقدّرة (partials) تصل بلا نص قديم — نعوّض من ذاكرتنا
    //    حتى لا يظهر الحقل "فارغ" (وهو سبب الشكوى "أشياء مو كاملة")
    const cachedBefore = this.getCachedContent(oldMessage?.id);
    const before =
      typeof oldMessage.content === 'string' && oldMessage.content.trim().length > 0
        ? oldMessage.content
        : cachedBefore;

    const beforeText = before
      ? this.truncate(before, 500)
      : '⚠️ غير متاح — الرسالة الأصلية لم تكن مخزّنة';

    const embed = new EmbedBuilder()
      .setTitle('✏️ تعديل رسالة')
      .setColor(EVENT_COLORS.messageEdit)
      .addFields(
        { name: '👤 الكاتب', value: this.formatUser(newMessage.author), inline: true },
        { name: '📍 القناة', value: newMessage.channel?.id ? `<#${newMessage.channel.id}>` : 'غير معروف', inline: true },
        { name: '🆔 معرّف الرسالة', value: `\`${newMessage.id}\``, inline: true },
        { name: '📝 المحتوى قبل التعديل', value: beforeText, inline: false },
        { name: '📝 المحتوى بعد التعديل', value: this.truncate(newMessage.content, 500), inline: false },
      );

    if (typeof newMessage.author.displayAvatarURL === 'function') {
      embed.setThumbnail(newMessage.author.displayAvatarURL());
    }

    await this.sendLog(newMessage.guild, 'messageEdit', embed);
  }

  // --------------------------------------------
  // Member Ban
  // --------------------------------------------
  async handleGuildBanAdd(ban: any): Promise<void> {
    const audit = await this.fetchAuditInfo(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);

    const embed = new EmbedBuilder()
      .setTitle('🔨 حظر عضو')
      .setColor(EVENT_COLORS.memberBan)
      .addFields(
        { name: '👤 العضو', value: this.formatUser(ban.user), inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true },
        { name: '📝 السبب', value: this.truncate(audit?.reason, 500) || 'غير محدد', inline: false },
        ...this.accountFields(ban.user)
      );

    if (typeof ban.user.displayAvatarURL === 'function') {
      embed.setThumbnail(ban.user.displayAvatarURL());
    }

    await this.sendLog(ban.guild, 'memberBan', embed);
  }

  // --------------------------------------------
  // Member Unban
  // --------------------------------------------
  async handleGuildBanRemove(ban: any): Promise<void> {
    const audit = await this.fetchAuditInfo(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ رفع الحظر')
      .setColor(EVENT_COLORS.memberUnban)
      .addFields(
        { name: '👤 العضو', value: this.formatUser(ban.user), inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true },
        ...this.accountFields(ban.user)
      );

    if (typeof ban.user.displayAvatarURL === 'function') {
      embed.setThumbnail(ban.user.displayAvatarURL());
    }

    await this.sendLog(ban.guild, 'memberUnban', embed);
  }

  // --------------------------------------------
  // Member Update (roles, nickname, avatar, timeout)
  // --------------------------------------------
  async handleGuildMemberUpdate(oldMember: any, newMember: any): Promise<void> {
    const guild = newMember.guild;
    if (!guild || newMember.user?.bot) return;

    const changes: string[] = [];

    // Role changes
    const addedRoles = newMember.roles.cache.filter((r: any) => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter((r: any) => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0) {
      changes.push(`**رتب مُضاف:** ${addedRoles.map((r: any) => `<@&${r.id}>`).join(', ')}`);
    }
    if (removedRoles.size > 0) {
      changes.push(`**رتب مُزالة:** ${removedRoles.map((r: any) => `<@&${r.id}>`).join(', ')}`);
    }

    // Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      changes.push(`**الاسم المستعار:** ${oldMember.nickname || 'بدون'} ← ${newMember.nickname || 'بدون'}`);
    }

    // Avatar change
    if (oldMember.avatar !== newMember.avatar) {
      changes.push(newMember.avatar ? '**الصورة الشخصية:** تم تغيير الصورة' : '**الصورة الشخصية:** تمت الإزالة');
    }

    // Timeout (communication disable) change → حدث مستقل يذهب لقناة memberTimeout
    const oldTimeout = oldMember.communicationDisabledUntilTimestamp ?? 0;
    const newTimeout = newMember.communicationDisabledUntilTimestamp ?? 0;
    const timeoutChanged = oldTimeout !== newTimeout;

    if (changes.length === 0 && !timeoutChanged) return;

    const audit = await this.fetchAuditInfo(guild, AuditLogEvent.MemberUpdate, newMember.id);

    // ⏳ التايم أوت → إمبده خاصة (تسمح بتجهيز روم مخصص للكتم فقط)
    if (timeoutChanged) {
      const active = newTimeout > Date.now();
      const timeoutEmbed = new EmbedBuilder()
        .setTitle(active ? '🔇 كتم مؤقت (Timeout)' : '🔊 رفع الكتم المؤقت')
        .setColor(active ? EVENT_COLORS.memberTimeout : CATEGORY_COLORS.member)
        .setDescription(`${newMember}`)
        .addFields(
          { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true },
          {
            name: '📅 المدة',
            value: active ? `حتى <t:${Math.floor(newTimeout / 1000)}:F>` : 'تم رفع الكتم',
            inline: true,
          }
        );
      if (newMember.user && typeof newMember.user.displayAvatarURL === 'function') {
        timeoutEmbed.setThumbnail(newMember.user.displayAvatarURL());
      }
      await this.sendLog(guild, 'memberTimeout', timeoutEmbed);
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle('👤 تحديث عضو')
      .setColor(EVENT_COLORS.memberUpdate)
      .setDescription(`${newMember}`)
      .addFields(
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true },
        { name: '📋 التغييرات', value: changes.join('\n'), inline: false }
      );

    if (newMember.user && typeof newMember.user.displayAvatarURL === 'function') {
      embed.setThumbnail(newMember.user.displayAvatarURL());
    }

    await this.sendLog(guild, 'memberUpdate', embed);
  }

  // --------------------------------------------
  // Role Create
  // --------------------------------------------
  async handleRoleCreate(role: any): Promise<void> {
    if (!role.guild) return;

    const audit = await this.fetchAuditInfo(role.guild, AuditLogEvent.RoleCreate, role.id);

    const embed = new EmbedBuilder()
      .setTitle('➕ إنشاء رتبة')
      .setColor(EVENT_COLORS.roleCreate)
      .addFields(
        { name: '📛 الرتبة', value: role.name || 'غير معروف', inline: true },
        { name: '🎨 اللون', value: role.hexColor || 'غير محدد', inline: true },
        { name: '🔢 معرّف الرتبة', value: `\`${role.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true }
      );

    await this.sendLog(role.guild, 'roleCreate', embed);
  }

  // --------------------------------------------
  // Role Delete
  // --------------------------------------------
  async handleRoleDelete(role: any): Promise<void> {
    if (!role.guild) return;

    const audit = await this.fetchAuditInfo(role.guild, AuditLogEvent.RoleDelete, role.id);

    const embed = new EmbedBuilder()
      .setTitle('➖ حذف رتبة')
      .setColor(EVENT_COLORS.roleDelete)
      .addFields(
        { name: '📛 الرتبة', value: role.name || 'غير معروف', inline: true },
        { name: '🎨 اللون', value: role.hexColor || 'غير محدد', inline: true },
        { name: '🔢 معرّف الرتبة', value: `\`${role.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true }
      );

    await this.sendLog(role.guild, 'roleDelete', embed);
  }

  // --------------------------------------------
  // Role Update
  // --------------------------------------------
  async handleRoleUpdate(oldRole: any, newRole: any): Promise<void> {
    if (!newRole.guild) return;

    const changes: string[] = [];
    if (oldRole.name !== newRole.name) {
      changes.push(`**الاسم:** ${oldRole.name} ← ${newRole.name}`);
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push(`**اللون:** ${oldRole.hexColor} ← ${newRole.hexColor}`);
    }
    if (oldRole.hoist !== newRole.hoist) {
      changes.push(`**عرض منفصل:** ${oldRole.hoist ? 'نعم' : 'لا'} ← ${newRole.hoist ? 'نعم' : 'لا'}`);
    }
    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push(`**قابل للذكر:** ${oldRole.mentionable ? 'نعم' : 'لا'} ← ${newRole.mentionable ? 'نعم' : 'لا'}`);
    }
    if (typeof oldRole.permissions?.equals === 'function' && !oldRole.permissions.equals(newRole.permissions)) {
      changes.push('**الصلاحيات:** تم تعديل صلاحيات الرتبة');
    }

    if (changes.length === 0) return;

    const audit = await this.fetchAuditInfo(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

    const embed = new EmbedBuilder()
      .setTitle('🔄 تحديث رتبة')
      .setColor(EVENT_COLORS.roleUpdate)
      .addFields(
        { name: '📛 الرتبة', value: newRole.name || 'غير معروف', inline: true },
        { name: '🔢 معرّف الرتبة', value: `\`${newRole.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true },
        { name: '📋 التغييرات', value: changes.join('\n'), inline: false }
      );

    await this.sendLog(newRole.guild, 'roleUpdate', embed);
  }

  // --------------------------------------------
  // Channel Create
  // --------------------------------------------
  async handleChannelCreate(channel: any): Promise<void> {
    if (!channel.guild) return;

    const audit = await this.fetchAuditInfo(channel.guild, AuditLogEvent.ChannelCreate, channel.id);

    const embed = new EmbedBuilder()
      .setTitle('📢 إنشاء قناة')
      .setColor(EVENT_COLORS.channelCreate)
      .addFields(
        { name: '📍 القناة', value: channel.name ? `${channel.name} • <#${channel.id}>` : 'غير معروف', inline: true },
        { name: '📂 النوع', value: this.getChannelTypeName(channel.type), inline: true },
        { name: '🔢 معرّف القناة', value: `\`${channel.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true }
      );

    await this.sendLog(channel.guild, 'channelCreate', embed);
  }

  // --------------------------------------------
  // Channel Delete
  // --------------------------------------------
  async handleChannelDelete(channel: any): Promise<void> {
    if (!channel.guild) return;

    const audit = await this.fetchAuditInfo(channel.guild, AuditLogEvent.ChannelDelete, channel.id);

    const embed = new EmbedBuilder()
      .setTitle('🗑️ حذف قناة')
      .setColor(EVENT_COLORS.channelDelete)
      .addFields(
        { name: '📍 القناة', value: channel.name || 'غير معروف', inline: true },
        { name: '📂 النوع', value: this.getChannelTypeName(channel.type), inline: true },
        { name: '🔢 معرّف القناة', value: `\`${channel.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true }
      );

    await this.sendLog(channel.guild, 'channelDelete', embed);
  }

  // --------------------------------------------
  // Channel Update
  // --------------------------------------------
  async handleChannelUpdate(oldChannel: any, newChannel: any): Promise<void> {
    if (!newChannel.guild) return;

    const changes: string[] = [];

    if (oldChannel.name !== newChannel.name) {
      changes.push(`**الاسم:** ${oldChannel.name} ← ${newChannel.name}`);
    }
    if (oldChannel.topic !== newChannel.topic) {
      changes.push(
        `**الموضوع:** ${this.truncate(oldChannel.topic)} ← ${this.truncate(newChannel.topic)}`
      );
    }
    if (oldChannel.nsfw !== newChannel.nsfw) {
      changes.push(`**NSFW:** ${oldChannel.nsfw ? 'نعم' : 'لا'} ← ${newChannel.nsfw ? 'نعم' : 'لا'}`);
    }
    if (oldChannel.parentId !== newChannel.parentId) {
      changes.push(
        `**التصنيف:** ${oldChannel.parentId ? `<#${oldChannel.parentId}>` : 'بدون'} ← ${newChannel.parentId ? `<#${newChannel.parentId}>` : 'بدون'}`
      );
    }
    if ((oldChannel.rateLimitPerUser ?? 0) !== (newChannel.rateLimitPerUser ?? 0)) {
      changes.push(`**الهدوء:** ${oldChannel.rateLimitPerUser ?? 0} ← ${newChannel.rateLimitPerUser ?? 0} ثانية`);
    }

    if (changes.length === 0) return;

    const audit = await this.fetchAuditInfo(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);

    const embed = new EmbedBuilder()
      .setTitle('🔄 تحديث قناة')
      .setColor(EVENT_COLORS.channelUpdate)
      .addFields(
        { name: '📍 القناة', value: newChannel.id ? `<#${newChannel.id}>` : 'غير معروف', inline: true },
        { name: '📂 النوع', value: this.getChannelTypeName(newChannel.type), inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true },
        { name: '📋 التغييرات', value: changes.join('\n'), inline: false }
      );

    await this.sendLog(newChannel.guild, 'channelUpdate', embed);
  }

  // --------------------------------------------
  // Voice State Update (joining/leaving/moving)
  // --------------------------------------------
  async handleVoiceStateUpdate(oldState: any, newState: any): Promise<void> {
    const guild = newState.guild;
    if (!guild) return;

    const member = newState.member || oldState.member;
    if (!member || member.user?.bot) return;

    let title = '';
    let fields: Array<{ name: string; value: string; inline: boolean }> = [];

    if (!oldState.channelId && newState.channelId) {
      // Joined voice
      title = '🔊 انضمام لقناة صوتية';
      fields = [{ name: '📍 القناة', value: `<#${newState.channelId}>`, inline: true }];
    } else if (oldState.channelId && !newState.channelId) {
      // Left voice
      title = '🔇 مغادرة قناة صوتية';
      fields = [{ name: '📍 القناة', value: `<#${oldState.channelId}>`, inline: true }];
    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      // Moved
      title = '🔄 نقل بين القنوات الصوتية';
      fields = [
        { name: '📍 من', value: `<#${oldState.channelId}>`, inline: true },
        { name: '📍 إلى', value: `<#${newState.channelId}>`, inline: true },
      ];
    } else {
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(EVENT_COLORS.voiceStateUpdate)
      .addFields({ name: '👤 العضو', value: this.formatUser(member.user), inline: true }, ...fields);

    if (member.user && typeof member.user.displayAvatarURL === 'function') {
      embed.setThumbnail(member.user.displayAvatarURL());
    }

    await this.sendLog(guild, 'voiceStateUpdate', embed);
  }

  // --------------------------------------------
  // Invite Create/Delete
  // --------------------------------------------
  async handleInviteCreate(invite: any): Promise<void> {
    if (!invite.guild) return;

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: '📍 القناة', value: invite.channel ? `<#${invite.channel.id}>` : 'غير معروف', inline: true },
      { name: '👤 أنشأها', value: this.formatUser(invite.inviter), inline: true },
      { name: '🔗 الرابط', value: invite.url || 'غير متاح', inline: false },
    ];

    if (invite.maxUses) {
      fields.push({ name: '🔢 الاستخدامات القصوى', value: `${invite.maxUses}`, inline: true });
    }
    if (invite.expiresTimestamp) {
      fields.push({ name: '⏳ ينتهي في', value: `<t:${Math.floor(invite.expiresTimestamp / 1000)}:F>`, inline: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('📩 إنشاء دعوة')
      .setColor(EVENT_COLORS.inviteCreate)
      .addFields(fields);

    await this.sendLog(invite.guild, 'inviteCreate', embed);
  }

  async handleInviteDelete(invite: any): Promise<void> {
    if (!invite.guild) return;

    // Invites are audit-logged by code, not by id
    let executor: any = null;
    try {
      const logs = await invite.guild.fetchAuditLogs({ type: AuditLogEvent.InviteDelete, limit: 5 });
      const entry = logs.entries.find(
        (e: any) => e.target?.code === invite.code && Date.now() - e.createdTimestamp <= 15000
      );
      executor = entry?.executor ?? null;
    } catch {}

    const embed = new EmbedBuilder()
      .setTitle('🗑️ حذف دعوة')
      .setColor(EVENT_COLORS.inviteDelete)
      .addFields(
        { name: '📍 القناة', value: invite.channel ? `<#${invite.channel.id}>` : 'غير معروف', inline: true },
        { name: '👮 المسؤول', value: this.executorValue(executor), inline: true },
        { name: '🔗 الرابط', value: invite.url || 'غير متاح', inline: false }
      );

    await this.sendLog(invite.guild, 'inviteDelete', embed);
  }

  // --------------------------------------------
  // Webhook Update
  // --------------------------------------------
  async handleWebhookUpdate(channel: any): Promise<void> {
    if (!channel.guild) return;

    const embed = new EmbedBuilder()
      .setTitle('🪝 تحديث ويب هوك')
      .setColor(EVENT_COLORS.webhookUpdate)
      .addFields(
        { name: '📍 القناة', value: channel.id ? `<#${channel.id}>` : 'غير معروف', inline: true },
        { name: 'ℹ️ الحالة', value: 'تم إنشاء أو تعديل أو حذف ويب هوك في هذه القناة', inline: false }
      );

    await this.sendLog(channel.guild, 'webhookUpdate', embed);
  }

  // --------------------------------------------
  // Thread Create/Delete/Update
  // --------------------------------------------
  async handleThreadCreate(thread: any): Promise<void> {
    if (!thread.guild) return;

    const embed = new EmbedBuilder()
      .setTitle('🧵 إنشاء محادثة')
      .setColor(EVENT_COLORS.threadCreate)
      .addFields(
        { name: '🧵 المحادثة', value: thread.name ? `${thread.name} • \`#${thread.id}\`` : 'غير معروف', inline: true },
        { name: '📍 القناة الأصلية', value: thread.parentId ? `<#${thread.parentId}>` : 'غير معروف', inline: true },
        {
          name: '⏱️ الأرشفة التلقائية',
          value: thread.autoArchiveDuration ? `بعد ${thread.autoArchiveDuration} دقيقة` : 'غير معروف',
          inline: true,
        }
      );

    await this.sendLog(thread.guild, 'threadCreate', embed);
  }

  async handleThreadDelete(thread: any): Promise<void> {
    if (!thread.guild) return;

    const embed = new EmbedBuilder()
      .setTitle('🧵 حذف محادثة')
      .setColor(EVENT_COLORS.threadDelete)
      .addFields(
        { name: '🧵 المحادثة', value: thread.name || 'غير معروف', inline: true },
        { name: '📍 القناة الأصلية', value: thread.parentId ? `<#${thread.parentId}>` : 'غير معروف', inline: true },
        { name: '🔢 معرّف المحادثة', value: `\`${thread.id}\``, inline: true }
      );

    await this.sendLog(thread.guild, 'threadDelete', embed);
  }

  async handleThreadUpdate(oldThread: any, newThread: any): Promise<void> {
    if (!newThread.guild) return;

    const changes: string[] = [];
    if (oldThread.name !== newThread.name) {
      changes.push(`**الاسم:** ${oldThread.name} ← ${newThread.name}`);
    }
    if (oldThread.archived !== newThread.archived) {
      changes.push(`**الأرشفة:** ${newThread.archived ? 'تمت الأرشفة' : 'تم إلغاء الأرشفة'}`);
    }
    if (oldThread.locked !== newThread.locked) {
      changes.push(`**القفل:** ${newThread.locked ? 'تم القفل' : 'تم الفتح'}`);
    }
    if ((oldThread.rateLimitPerUser ?? 0) !== (newThread.rateLimitPerUser ?? 0)) {
      changes.push(`**الهدوء:** ${oldThread.rateLimitPerUser ?? 0} ← ${newThread.rateLimitPerUser ?? 0} ثانية`);
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setTitle('🧵 تحديث محادثة')
      .setColor(EVENT_COLORS.threadUpdate)
      .addFields(
        { name: '🧵 المحادثة', value: newThread.name || 'غير معروف', inline: true },
        { name: '📍 القناة الأصلية', value: newThread.parentId ? `<#${newThread.parentId}>` : 'غير معروف', inline: true },
        { name: '📋 التغييرات', value: changes.join('\n'), inline: false }
      );

    await this.sendLog(newThread.guild, 'threadUpdate', embed);
  }

  // --------------------------------------------
  // Emoji Create/Delete
  // --------------------------------------------
  async handleEmojiCreate(emoji: any): Promise<void> {
    if (!emoji.guild) return;

    const audit = await this.fetchAuditInfo(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);

    const embed = new EmbedBuilder()
      .setTitle('😀 إنشاء إيموجي')
      .setColor(EVENT_COLORS.emojiCreate)
      .addFields(
        { name: '😀 الإيموجي', value: `\`${emoji.name}\``, inline: true },
        { name: '🔢 معرّف الإيموجي', value: `\`${emoji.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true }
      );

    if (emoji.id) {
      embed.setThumbnail(`https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`);
    }

    await this.sendLog(emoji.guild, 'emojiCreate', embed);
  }

  async handleEmojiDelete(emoji: any): Promise<void> {
    if (!emoji.guild) return;

    const audit = await this.fetchAuditInfo(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);

    const embed = new EmbedBuilder()
      .setTitle('😀 حذف إيموجي')
      .setColor(EVENT_COLORS.emojiDelete)
      .addFields(
        { name: '😀 الإيموجي', value: `\`${emoji.name}\``, inline: true },
        { name: '🔢 معرّف الإيموجي', value: `\`${emoji.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true }
      );

    await this.sendLog(emoji.guild, 'emojiDelete', embed);
  }

  // --------------------------------------------
  // Sticker Create/Delete
  // --------------------------------------------
  async handleStickerCreate(sticker: any): Promise<void> {
    if (!sticker.guild) return;

    const audit = await this.fetchAuditInfo(sticker.guild, AuditLogEvent.StickerCreate, sticker.id);

    const embed = new EmbedBuilder()
      .setTitle('🏷️ إنشاء ملصق')
      .setColor(EVENT_COLORS.stickerCreate)
      .addFields(
        { name: '🏷️ الملصق', value: sticker.name || 'غير معروف', inline: true },
        { name: '🔢 معرّف الملصق', value: `\`${sticker.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true }
      );

    await this.sendLog(sticker.guild, 'stickerCreate', embed);
  }

  async handleStickerDelete(sticker: any): Promise<void> {
    if (!sticker.guild) return;

    const audit = await this.fetchAuditInfo(sticker.guild, AuditLogEvent.StickerDelete, sticker.id);

    const embed = new EmbedBuilder()
      .setTitle('🏷️ حذف ملصق')
      .setColor(EVENT_COLORS.stickerDelete)
      .addFields(
        { name: '🏷️ الملصق', value: sticker.name || 'غير معروف', inline: true },
        { name: '🔢 معرّف الملصق', value: `\`${sticker.id}\``, inline: true },
        { name: '👮 المسؤول', value: this.executorValue(audit?.executor), inline: true }
      );

    await this.sendLog(sticker.guild, 'stickerDelete', embed);
  }

  // --------------------------------------------
  // Helper: Channel type name (v14 ChannelType values)
  // --------------------------------------------
  private getChannelTypeName(type: number): string {
    const types: Record<number, string> = {
      0: 'نصي',
      2: 'صوتي',
      4: 'تصنيف',
      5: 'إعلانات',
      10: 'محادثة إعلانية',
      11: 'محادثة عامة',
      12: 'محادثة خاصة',
      13: 'مسرح',
      14: 'دليل',
      15: 'منتدى',
      16: 'وسائط',
    };
    return types[type] || 'غير معروف';
  }

  // --------------------------------------------
  // Ticket Events (سجل التكتات)
  // --------------------------------------------
  async handleTicketCreate(data: {
    guild: any;
    channel: any;
    creator: any;
    panelName?: string;
  }): Promise<void> {
    const { guild, channel, creator, panelName } = data;
    const fields = [
      { name: '👤 المنشئ', value: this.formatUser(creator), inline: true },
      { name: '🎫 التذكرة', value: `<#${channel.id}> (\`${channel.id}\`)`, inline: true },
      { name: '📋 اللوحة', value: panelName || 'غير محددة', inline: true },
    ];
    const embed = new EmbedBuilder()
      .setTitle('🎫 إنشاء تذكرة')
      .setColor(EVENT_COLORS.ticketCreate)
      .addFields(fields);
    await this.sendLog(guild, 'ticketCreate', embed);
  }

  async handleTicketClose(data: {
    guild: any;
    channel: any;
    closer: any;
    reason?: string;
    transcriptUrl?: string;
  }): Promise<void> {
    const { guild, channel, closer, reason, transcriptUrl } = data;
    const fields = [
      { name: '👤 المغلق', value: this.formatUser(closer), inline: true },
      { name: '🎫 التذكرة', value: `<#${channel.id}> (\`${channel.id}\`)`, inline: true },
      { name: '📋 السبب', value: reason || 'لم يُحدد', inline: false },
    ];
    if (transcriptUrl) fields.push({ name: '📄 النسخ', value: transcriptUrl, inline: false });
    const embed = new EmbedBuilder()
      .setTitle('🔒 إغلاق تذكرة')
      .setColor(EVENT_COLORS.ticketClose)
      .addFields(fields);
    await this.sendLog(guild, 'ticketClose', embed);
  }

  async handleTicketReopen(data: {
    guild: any;
    channel: any;
    reopener: any;
  }): Promise<void> {
    const { guild, channel, reopener } = data;
    const embed = new EmbedBuilder()
      .setTitle('🔓 إعادة فتح تذكرة')
      .setColor(EVENT_COLORS.ticketReopen)
      .addFields(
        { name: '👤 المُعيد', value: this.formatUser(reopener), inline: true },
        { name: '🎫 التذكرة', value: `<#${channel.id}>`, inline: true },
      );
    await this.sendLog(guild, 'ticketReopen', embed);
  }

  async handleTicketDelete(data: {
    guild: any;
    channelId: string;
    deleter: any;
  }): Promise<void> {
    const { guild, channelId, deleter } = data;
    const embed = new EmbedBuilder()
      .setTitle('🗑️ حذف تذكرة')
      .setColor(EVENT_COLORS.ticketDelete)
      .addFields(
        { name: '👤 المحذوف', value: this.formatUser(deleter), inline: true },
        { name: '🎫 التذكرة', value: `\`${channelId}\``, inline: true },
      );
    await this.sendLog(guild, 'ticketDelete', embed);
  }

  async handleTicketClaim(data: {
    guild: any;
    channel: any;
    claimer: any;
  }): Promise<void> {
    const { guild, channel, claimer } = data;
    const embed = new EmbedBuilder()
      .setTitle('📌 استلام تذكرة')
      .setColor(EVENT_COLORS.ticketClaim)
      .addFields(
        { name: '👤 المستلم', value: this.formatUser(claimer), inline: true },
        { name: '🎫 التذكرة', value: `<#${channel.id}>`, inline: true },
      );
    await this.sendLog(guild, 'ticketClaim', embed);
  }

  async handleTicketTransfer(data: {
    guild: any;
    channel: any;
    from: any;
    to: any;
  }): Promise<void> {
    const { guild, channel, from, to } = data;
    const embed = new EmbedBuilder()
      .setTitle('🔄 نقل تذكرة')
      .setColor(EVENT_COLORS.ticketTransfer)
      .addFields(
        { name: '👤 من', value: this.formatUser(from), inline: true },
        { name: '👤 إلى', value: this.formatUser(to), inline: true },
        { name: '🎫 التذكرة', value: `<#${channel.id}>`, inline: true },
      );
    await this.sendLog(guild, 'ticketTransfer', embed);
  }

  async handleTicketAddUser(data: {
    guild: any;
    channel: any;
    adder: any;
    added: any;
  }): Promise<void> {
    const { guild, channel, adder, added } = data;
    const embed = new EmbedBuilder()
      .setTitle('➕ إضافة عضو للتذكرة')
      .setColor(EVENT_COLORS.ticketAddUser)
      .addFields(
        { name: '👤 المضيف', value: this.formatUser(adder), inline: true },
        { name: '👤 المضاف', value: this.formatUser(added), inline: true },
        { name: '🎫 التذكرة', value: `<#${channel.id}>`, inline: true },
      );
    await this.sendLog(guild, 'ticketAddUser', embed);
  }

  async handleTicketRemoveUser(data: {
    guild: any;
    channel: any;
    remover: any;
    removed: any;
  }): Promise<void> {
    const { guild, channel, remover, removed } = data;
    const embed = new EmbedBuilder()
      .setTitle('➖ إزالة عضو من التذكرة')
      .setColor(EVENT_COLORS.ticketRemoveUser)
      .addFields(
        { name: '👤 المزيل', value: this.formatUser(remover), inline: true },
        { name: '👤 المزول', value: this.formatUser(removed), inline: true },
        { name: '🎫 التذكرة', value: `<#${channel.id}>`, inline: true },
      );
    await this.sendLog(guild, 'ticketRemoveUser', embed);
  }

  // --------------------------------------------
  // Cleanup
  // --------------------------------------------
  cleanup(): void {
    this.enabledCache.clear();
  }
}

export default LoggingHandler;
