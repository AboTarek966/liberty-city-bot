// ============================================
// Liberty City Bot - Ticket Handler (Enhanced)
// ============================================

import {
  Guild,
  GuildMember,
  TextChannel,
  CategoryChannel,
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
  Collection,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { createLogger } from '../utils/helpers';
import { getGuildSettings, Ticket, ITicket, ITicketLockSnapshot, Ticket as TicketModel } from '../models';
import { ticketEmbed, ticketTranscriptEmbed, createEmbed, Colors } from '../utils/embeds';
import { generateId, generateNumericId } from '../utils/helpers';
import { LibertyClient } from '../LibertyClient';

const logger = createLogger('TicketHandler');

// --------------------------------------------
// Types
// --------------------------------------------
export interface TicketPanelOption {
  label: string;
  description?: string;
  emoji?: string;
}

export interface TicketPanelData {
  id: string;
  name: string;
  description: string;
  emoji: string;
  channelId: string;
  messageId?: string;
  type: 'button' | 'select';
  fields: Array<{
    id: string;
    label: string;
    placeholder: string;
    style: 'short' | 'paragraph';
    required: boolean;
  }>;
  /** أنواع التذاكر في قائمة اللوحة (اسم الخيار = اسم قناة التذكرة) */
  options?: TicketPanelOption[];
  supportRoleIds: string[];
  image?: string;
}

/** الأنواع الافتراضية عندما لا يحدد المشرف أي أنواع */
export const DEFAULT_TICKET_TYPES: TicketPanelOption[] = [
  { label: 'دعم فني', description: 'للحصول على مساعدة تقنية', emoji: '🔧' },
  { label: 'استفسار', description: 'للاستفسارات العامة', emoji: '❓' },
  { label: 'إبلاغ', description: 'للإبلاغ عن مشكلة', emoji: '⚠️' },
];

export interface CreateTicketOptions {
  guild: Guild;
  user: GuildMember;
  type: string;
  panelId?: string;
  subject?: string;
  fields?: Array<{ question: string; answer: string }>;
}

// --------------------------------------------
// صلاحية إعادة فتح التذكرة (مصدر واحد للحقيقة)
// --------------------------------------------
// 1) من أغلق التذكرة نفسه
// 2) أي إداري معاه رول من رولات فريق الدعم أو رولات الإدارة
// 3) حاملو ManageChannels / Administrator
// 4) صاحب السيرفر
export interface ReopenAccessArgs {
  ticket: { closedBy?: string | null };
  member: {
    id: string;
    permissions?: { has: (p: bigint) => boolean };
    roles?: { cache?: { has: (id: string) => boolean } };
  };
  guildOwnerId?: string;
  supportRoleIds?: string[] | null;
  adminRoleIds?: string[] | null;
}

export function canReopenTicket(args: ReopenAccessArgs): boolean {
  const { ticket, member, guildOwnerId } = args;

  // من أغلقها يعاد فتحها دائماً
  if (ticket.closedBy && ticket.closedBy === member.id) return true;

  // رولات فريق الدعم + رولات الإدارة العليا
  const staffRoles = [...(args.supportRoleIds || []), ...(args.adminRoleIds || [])];
  if (staffRoles.length > 0) {
    const hasRole = staffRoles.some((roleId) => {
      try {
        return !!member.roles?.cache?.has(roleId);
      } catch {
        return false;
      }
    });
    if (hasRole) return true;
  }

  // صلاحيات رفعية (بما فيها Administrator)
  try {
    if (member.permissions?.has(PermissionFlagsBits.ManageChannels)) return true;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
  } catch {
    /* bitfield غير صالح — تجاهل */
  }

  // صاحب السيرفر لا يُعلَّق أبداً
  if (guildOwnerId && guildOwnerId === member.id) return true;

  return false;
}

// --------------------------------------------
// Ticket Handler Class
// --------------------------------------------
export class TicketHandler {
  private client: LibertyClient;
  private activeTickets: Collection<string, ITicket> = new Collection();
  private callCooldowns: Collection<string, number> = new Collection();

  /** ⚡ طابور إرسال سجلات التذاكر لكل سيرفر — ترتيب تام + لا يعطّل مسار التذكرة */
  private ticketLogQueues: Map<string, Promise<void>> = new Map();

  constructor(client: LibertyClient) {
    this.client = client;
  }

  // --------------------------------------------
  // بناء عناصر التحكم داخل التذكرة:
  // قائمة خيارات (Options) + زر استلام سريع
  // --------------------------------------------
  buildTicketControls(claimed: boolean): ActionRowBuilder<any>[] {
    const options: Array<{ label: string; value: string; description: string; emoji: string }> = [
      {
        label: 'إضافة عضو أو إداري',
        value: 'add_member',
        description: 'إضافة شخص معيّن للكتابة في التذكرة',
        emoji: '➕',
      },
      {
        label: 'استدعاء الإدارة العليا',
        value: 'call_admin',
        description: 'إشعار الإدارة العليا بالنظر في التذكرة',
        emoji: '👑',
      },
      claimed
        ? {
            label: 'إلغاء الاستلام',
            value: 'unclaim',
            description: 'تحرير التذكرة ليأخذها غيرك',
            emoji: '↩️',
          }
        : {
            label: 'استلام التذكرة',
            value: 'claim',
            description: 'استلام التذكرة والقفل عليها',
            emoji: '🤝',
          },
      {
        label: 'إغلاق التذكرة',
        value: 'close',
        description: 'إغلاق التذكرة مع الاحتفاظ بالسجل',
        emoji: '🔒',
      },
      {
        label: 'نسخة من المحادثة',
        value: 'transcript',
        description: 'تحميل نسخة نصية من المحادثة',
        emoji: '📄',
      },
      {
        label: 'حذف التذكرة',
        value: 'delete',
        description: 'حذف التذكرة نهائياً',
        emoji: '🗑️',
      },
    ];

    const selectRow = new ActionRowBuilder<any>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_options')
        .setPlaceholder('⚙️ خيارات التذكرة — اختر إجراءً')
        .addOptions(options)
    );

    const claimRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      claimed
        ? new ButtonBuilder()
            .setCustomId('ticket_unclaim')
            .setLabel('إلغاء الاستلام')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('↩️')
        : new ButtonBuilder()
            .setCustomId('ticket_claim')
            .setLabel('استلام التذكرة')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🤝')
    );

    return [selectRow, claimRow];
  }

  // --------------------------------------------
  // Create Ticket Category
  // --------------------------------------------
  async createTicketCategory(guild: Guild, name: string): Promise<CategoryChannel> {
    const existingCategory = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === name
    ) as CategoryChannel;

    if (existingCategory) return existingCategory;

    const category = await guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      reason: 'Liberty City - Ticket System',
    });

    logger.info(`Created ticket category: ${category.name}`);
    return category;
  }

  // --------------------------------------------
  // Create Log Channel
  // --------------------------------------------
  async createLogChannel(guild: Guild, name: string, category?: CategoryChannel): Promise<TextChannel> {
    const existingChannel = guild.channels.cache.find(
      c => c.type === ChannelType.GuildText && c.name === name
    ) as TextChannel;

    if (existingChannel) return existingChannel;

    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category?.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ],
      reason: 'Liberty City - Ticket Logs',
    });

    logger.info(`Created ticket log channel: ${channel.name}`);
    return channel;
  }

  // --------------------------------------------
  // Create Ticket
  // --------------------------------------------
  async createTicket(options: CreateTicketOptions): Promise<ITicket> {
    const { guild, user, type, panelId, subject, fields } = options;
    const settings = await getGuildSettings(guild.id);

    const userTickets = await TicketModel.find({
      guildId: guild.id,
      userId: user.id,
      status: { $in: ['open', 'claimed', 'waiting'] },
    });

    if (userTickets.length >= settings.tickets.maxPerUser) {
      throw new Error(`لديك بالفعل ${userTickets.length} تذاكر مفتوحة. الحد الأقصى هو ${settings.tickets.maxPerUser}`);
    }

    let category: CategoryChannel | undefined;
    if (settings.tickets.categoryId) {
      category = guild.channels.cache.get(settings.tickets.categoryId) as CategoryChannel;
    }
    if (!category) {
      category = await this.createTicketCategory(guild, '🎫│التذاكر');
      settings.tickets.categoryId = category.id;
      await settings.save();
    }

    // الترقيم التسلسلي: التذكرة الأولى = 1 ثم 2 ثم 3... (يُستأنف من عدد التذاكر السابقة عند أول استخدام)
    if (!settings.tickets.counter) {
      settings.tickets.counter = await TicketModel.countDocuments({ guildId: guild.id });
    }
    settings.tickets.counter += 1;
    const ticketId = String(settings.tickets.counter);
    await settings.save();
    // اسم القناة = اسم النوع المختار (مسافات → شرطات) + رقم التذكرة
    const slug = (type || '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}\-_]/gu, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    const channelName = slug && slug !== 'عام'
      ? `${slug}-${ticketId}`
      : `ticket-${ticketId}`;

    const supportRoles = settings.tickets.supportRoleIds
      .map((roleId: string) => guild.roles.cache.get(roleId))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    const lockClaim = settings.tickets.lockUntilClaim;

    // صلاحيات صاحب التذكرة: عرض + قراءة + مرفقات دائماً، والكتابة حسب خيار القفل
    const userAllow: bigint[] = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
    ];
    if (!lockClaim) userAllow.push(PermissionFlagsBits.SendMessages);

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: userAllow,
        // 🔒 خيار قفل التذكرة: صاحبها لا يكتب حتى يستلمها إداري
        ...(lockClaim ? { deny: [PermissionFlagsBits.SendMessages] } : {}),
      },
      {
        id: this.client.user!.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    // صلاحيات فريق الدعم: قراءة + أدوات دائماً.
    // ⛔ الكتابة ممنوعة على فريق الدعم حتى يستلم أحدٌهم التذكرة —
    //    (لا يُفعَّل بخيار الإعدادات — قاعدة ثابتة طلباً من الإدارة)
    const supportAllow: bigint[] = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.ManageMessages,
    ];

    for (const role of supportRoles) {
      permissionOverwrites.push({
        id: role.id,
        allow: supportAllow,
        deny: [PermissionFlagsBits.SendMessages],
      });
    }

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites,
      reason: `Liberty City - Ticket created by ${user.user.tag}`,
    }) as TextChannel;

    const ticket = await TicketModel.create({
      guildId: guild.id,
      channelId: channel.id,
      userId: user.id,
      type,
      panelId,
      status: 'open',
      priority: 'medium',
      subject,
      fields: fields || [],
    });

    this.activeTickets.set(channel.id, ticket);

    const pingContent = supportRoles.length > 0
      ? supportRoles.map(r => `<@&${r.id}>`).join(' ')
      : user.toString();

    // 🎫 رسالة الترحيب — يمكن تفعيلها/تعطيلها من الإعدادات (الافتراضي: معطّلة)
    if (settings.tickets.welcomeEnabled) {
      const welcomeMessage =
        `مرحباً ${user}! تم إنشاء تذكرتك بنجاح ✅\n\n` +
        `**رقم التذكرة:** \`${ticketId}\`\n` +
        `**النوع:** ${type}\n\n` +
        `فريق الدعم سيتواصل معك في أقرب وقت.\n` +
        `يرجى وصف مشكلتك بالتفصيل.\n\n` +
        `---\n` +
        `⚙️ **اختر من قائمة الخيارات بالأسفل:**\n` +
        `> ➕ إضافة عضو أو إداري • 👑 استدعاء الإدارة العليا\n` +
        `> 🤝 استلام التذكرة •↩️ إلغاء الاستلام\n` +
        `> 🔒 إغلاق • 🗑️ حذف • 📄 نسخة المحادثة`;

      await channel.send({
        content: `${pingContent}\n\n${welcomeMessage}`,
        components: this.buildTicketControls(false),
      });
    } else {
      // بدون رسالة ترحيب — أرسل فقط أزرار التحكم
      await channel.send({
        content: pingContent,
        components: this.buildTicketControls(false),
      });
    }

    // 🤖 AI Ticket Assistant — تحليل التذكرة ومحاولة الحل تلقائياً
    const aiTicketConfig = (settings as any).aiTicketAssistant;
    if (aiTicketConfig?.enabled && aiTicketConfig.analyzeOnCreate) {
      setTimeout(() => {
        this.client.aiTicketAssistant?.onTicketCreated(ticket, channel).catch((err: any) =>
          logger.error(`AI Ticket Assistant error: ${err.message}`)
        );
      }, 2000); // انتظار بسيط ليستقر الكاش
    }

    this.logTicketEvent(guild, 'create', ticket, user.user);

    logger.info(`Created ticket ${ticketId} for ${user.user.tag}`);
    return ticket;
  }

  // --------------------------------------------
  // Close Ticket
  // --------------------------------------------
  async closeTicket(
    channelId: string,
    closedBy: GuildMember,
    reason?: string
  ): Promise<{ ticket: ITicket; transcript: string }> {
    const ticket = await TicketModel.findOne({ channelId });
    if (!ticket) throw new Error('لم يتم العثور على التذكرة');
    if (ticket.status === 'closed') throw new Error('التذكرة مغلقة بالفعل');

    const guild = closedBy.guild;
    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) throw new Error('لم يتم العثور على القناة');

    const transcript = await this.generateTranscript(channel);

    ticket.status = 'closed';
    ticket.closedBy = closedBy.id;
    ticket.closeReason = reason || 'غير محدد';
    ticket.transcript = transcript;
    ticket.closedAt = new Date();

    // 🔒 قفل صلاحيات القناة أثناء الإغلاق — لا يكتب أحد (لا إداري ولا صاحب التذكرة)
    //    إعادة الفتح: من أغلقها، أو أي إداري معاه رول الدعم/الإدارة، أو Administrator.
    //    وعند إعادة الفتح تُرجع الصلاحيات كما كانت تماماً.
    ticket.closeSnapshots = await this.applyCloseLock(channel);

    await ticket.save();

    this.activeTickets.delete(channelId);

    const closer = guild.members.cache.get(closedBy.id);
    const closerName = closer?.displayName || closedBy.user.username;

    // إيمبد الإغلاق + أزرار "إعادة الفتح" و "حذف"
    const closingEmbed = createEmbed({
      title: '🔒 تم إغلاق التذكرة',
      description:
        `تم إغلاق التذكرة بواسطة ${closedBy}\n` +
        `السبب: ${reason || 'غير محدد'}\n\n` +
        `⛔ **القناة مقفلة الآن:** لا يمكن لأحد الكتابة — لا الإدارة ولا صاحب التذكرة.\n` +
        `🔓 **إعادة الفتح:** لـ **${closerName}** أو لأي إداري معاه رول فريق الدعم/الإدارة.\n` +
        `🛡️ حاملو **Administrator** يتجاوزون القفل ويقدرون الكتابة دائماً.`,
      color: Colors.error,
      footer: { text: 'Liberty City Tickets' },
    });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_reopen:${ticket._id}`)
        .setLabel('🔓 إعادة الفتح')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket_delete:${ticket._id}`)
        .setLabel('🗑️ حذف نهائي')
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ embeds: [closingEmbed], components: [actionRow] });
    await this.saveTranscript(guild, ticket, transcript);

    this.logTicketEvent(guild, 'close', ticket, closedBy.user, reason);

    // ⭐ استبيان الرضا — رسالة خاصة لصاحب التذكرة بعد الإغلاق
    try {
      const settings = await getGuildSettings(guild.id);
      if (settings.tickets.surveyEnabled) {
        const owner = await guild.client.users.fetch(ticket.userId).catch(() => null);
        if (owner) {
          const surveyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            [1, 2, 3, 4, 5].map(n =>
              new ButtonBuilder()
                .setCustomId(`ticket_survey:${ticket._id}:${n}`)
                .setLabel(String(n))
                .setEmoji('⭐')
                .setStyle(ButtonStyle.Secondary)
            )
          );
          await owner.send({
            embeds: [
              createEmbed({
                title: '⭐ كيف كانت خدمة الدعم؟',
                description:
                  `تم إغلاق تذكرتك في سيرفر **${guild.name}** (النوع: ${ticket.type})\n` +
                  `قيّم تجربتك مع فريق الدعم — رأيك يساعدنا على التحسين 💙`,
                color: Colors.primary,
              }),
            ],
            components: [surveyRow],
          }).catch(() => {});
        }
      }
    } catch {
      /* لا يعطّل إغلاق التذكرة */
    }

    logger.info(`Closed ticket for channel ${channelId}`);
    return { ticket, transcript };
  }

  // --------------------------------------------
  // فحص التذاكر الخاملة: تحذير ثم إغلاق تلقائي
  // الساعات من الإعدادات: autoCloseHours (0 = المعطّل)
  // يُستدعى من حدّ دوري كل 15 دقيقة في حدث ready
  // --------------------------------------------
  async sweepInactiveTickets(client: any): Promise<void> {
    for (const guild of client.guilds.cache.values()) {
      try {
        const settings = await getGuildSettings(guild.id);
        const hours = settings.tickets.autoCloseHours || 0;
        if (hours <= 0) continue;

        const closeCutoff = new Date(Date.now() - hours * 3600_000);
        const warnCutoff = new Date(Date.now() - Math.max(1, hours - 1) * 3600_000);

        // 1) تحذير التذاكر الخاملة (ساعة قبل الإغلاق) — مرة واحدة فقط
        const toWarn = await TicketModel.find({
          guildId: guild.id,
          status: { $in: ['open', 'claimed', 'waiting'] },
          lastActivityAt: { $lt: warnCutoff },
          idleWarned: { $ne: true },
        }).limit(25);

        for (const t of toWarn) {
          const ch = guild.channels.cache.get(t.channelId) as TextChannel;
          if (!ch) continue;
          await ch
            .send({
              embeds: [
                createEmbed({
                  title: '⏳ التذكرة خاملة',
                  description:
                    'لم يحدث نشاط في هذه التذكرة منذ فترة — **سيتم إغلاقها تلقائياً خلال ساعة** إذا لم يكتب أحد 💬',
                  color: Colors.warning,
                }),
              ],
            })
            .catch(() => {});
          t.idleWarned = true;
          await t.save().catch(() => {});
        }

        // 2) إغلاق التذاكر الميتة تماماً
        const toClose = await TicketModel.find({
          guildId: guild.id,
          status: { $in: ['open', 'claimed', 'waiting'] },
          lastActivityAt: { $lt: closeCutoff },
        }).limit(25);

        const me = guild.members.me;
        for (const t of toClose) {
          if (!me) break;
          try {
            await this.closeTicket(t.channelId, me, 'إغلاق تلقائي — عدم نشاط في التذكرة');
            logger.info(`Auto-closed inactive ticket channel ${t.channelId} in ${guild.name}`);
          } catch {
            /* قناة محذوفة أو تذكرة أُغلقت بالتوازي */
          }
        }
      } catch (error) {
        logger.error(`Inactivity sweep failed for guild ${guild.id}:`, error);
      }
    }
  }

  // --------------------------------------------
  // Delete Ticket (Hard Delete)
  // --------------------------------------------
  async deleteTicket(channelId: string, deletedBy: GuildMember): Promise<void> {
    const ticket = await TicketModel.findOne({ channelId });
    if (!ticket) throw new Error('لم يتم العثور على التذكرة');

    const guild = deletedBy.guild;
    const channel = guild.channels.cache.get(channelId) as TextChannel;

    // Save transcript before deleting
    if (channel) {
      const transcript = await this.generateTranscript(channel);
      ticket.transcript = transcript;
      ticket.status = 'deleted';
      ticket.closedBy = deletedBy.id;
      ticket.closedAt = new Date();
      await ticket.save();
      await this.saveTranscript(guild, ticket, transcript);
    }

    // Delete channel
    if (channel) {
      await channel.delete('Liberty City - Ticket deleted').catch(() => {});
    }

    this.activeTickets.delete(channelId);
    this.logTicketEvent(guild, 'delete', ticket, deletedBy.user);

    logger.info(`Deleted ticket channel ${channelId}`);
  }

  // --------------------------------------------
  // Claim Ticket
  // --------------------------------------------
  async claimTicket(channelId: string, claimedBy: GuildMember): Promise<ITicket> {
    // ⚡ قراءتان متوازيتان ثم نُعيد النتيجة فوراً — كل الأعمال الثقيلة في الخلفية
    const [ticket, settings] = await Promise.all([
      TicketModel.findOne({ channelId }),
      getGuildSettings(claimedBy.guild.id),
    ]);

    if (!ticket) throw new Error('لم يتم العثور على التذكرة');
    if (ticket.status === 'claimed') {
      const claimer = claimedBy.guild.members.cache.get(ticket.claimedBy!);
      throw new Error(`التذكرة مستلمة بالفعل بواسطة ${claimer || 'مشرف آخر'}`);
    }

    ticket.status = 'claimed';
    ticket.claimedBy = claimedBy.id;

    // 📊 تحديث إحصائيات الاستلام — فقط إذا كان إدارياً جديداً لم يستلم هذه التذكرة من قبل
    const claimHistory = ticket.claimHistory || [];
    const isNewClaimer = !claimHistory.includes(claimedBy.id);
    
    let currentCount = 0;
    if (isNewClaimer) {
      currentCount = settings.tickets.claimStats?.get(claimedBy.id) || 0;
      settings.tickets.claimStats.set(claimedBy.id, currentCount + 1);
      claimHistory.push(claimedBy.id);
      ticket.claimHistory = claimHistory;
    } else {
      // إداري سبق واستلم هذه التذكرة — لا نحتسب نقاطاً، نعرض العدد الحالي
      currentCount = settings.tickets.claimStats?.get(claimedBy.id) || 0;
    }

    await Promise.all([ticket.save(), settings.save()]);

    this.activeTickets.set(channelId, ticket);

    const channel = claimedBy.guild.channels.cache.get(channelId) as TextChannel | undefined;
    logger.info(`Claimed ticket by ${claimedBy.user.tag} (newClaimer: ${isNewClaimer})`);

    // 🔒 القفل + رسالة القناة + الأزرار + السجل → تعمل بعد الرد حتى لا يتأخر البوت
    void this.finalizeClaim(claimedBy.guild, ticket, channel, claimedBy, settings, currentCount, isNewClaimer);

    return ticket;
  }

  /** الأعمال الثقيلة بعد الاستلام — تعمل في الخلفية حتى يظهر الرد فوراً */
  private async finalizeClaim(
    guild: Guild,
    ticket: ITicket,
    channel: TextChannel | undefined,
    claimedBy: GuildMember,
    settings: Awaited<ReturnType<typeof getGuildSettings>>,
    currentCount: number,
    isNewClaimer: boolean
  ): Promise<void> {
    try {
      const jobs: Promise<unknown>[] = [];

      if (channel) {
        // 🔒 قفل التذكرة: الكتابة للمستلم + الأدمن فقط
        jobs.push(
          this.applyClaimLock(guild, ticket, channel, claimedBy).catch(err =>
            logger.warn('Failed to apply claim lock:', err)
          )
        );

        // ✅ منح صاحب التذكرة صلاحية الكتابة إن كان القفل مفعّلاً عند الفتح
        if (settings.tickets.lockUntilClaim && ticket.userId !== claimedBy.id) {
          jobs.push(
            channel.permissionOverwrites
              .edit(ticket.userId, { SendMessages: true })
              .catch(() => {})
          );
        }

        const claimEmbed = createEmbed({
          title: '🤝 تم استلام التذكرة',
          description:
            `تم استلام التذكرة بواسطة ${claimedBy}\n\n` +
            `🔒 **تم قفل التذكرة حصرية:** الكتابة للمستلم وصاحب التذكرة فقط — بقية فريق الدعم للقراءة فقط.\n` +
            `📌 لمنح إداري معيّن صلاحية الكتابة اختر **➕ إضافة عضو أو إداري** من قائمة الخيارات.\n\n` +
            (isNewClaimer
              ? `📊 **إجمالي تذاكرك المستلمة:** \`${currentCount + 1}\``
              : `📊 **إجمالي تذاكرك المستلمة:** \`${currentCount}\` (لا تُحتسب نقطة — سبق واستلمت هذه التذكرة)`),
          color: Colors.success,
          footer: { text: 'Liberty City Tickets' },
        });

        jobs.push(channel.send({ embeds: [claimEmbed] }));

        // Update buttons (show unclaim instead of claim)
        jobs.push(this.updateTicketButtons(channel, true));
      }

      this.logTicketEvent(guild, 'claim', ticket, claimedBy.user);
      await Promise.allSettled(jobs);
    } catch (err) {
      logger.warn('finalizeClaim failed:', err);
    }
  }

  // --------------------------------------------
  // Unclaim Ticket
  // --------------------------------------------
  async unclaimTicket(channelId: string, unclaimedBy: GuildMember): Promise<ITicket> {
    const guild = unclaimedBy.guild;
    const ticket = await TicketModel.findOne({ channelId });
    if (!ticket) throw new Error('لم يتم العثور على التذكرة');
    if (ticket.status !== 'claimed') throw new Error('التذكرة غير مستلمة');

    const isClaimer = ticket.claimedBy === unclaimedBy.id;

    // ⛔ إلغاء الاستلام للمستلم فقط — لا يمكن لإداري آخر تحرير تذكرة استلمها زميله
    if (!isClaimer) {
      throw new Error('فقط المستلم هو من يستطيع إلغاء استلام التذكرة');
    }

    const previousClaimer = guild.members.cache.get(ticket.claimedBy!);
    ticket.status = 'open';
    ticket.claimedBy = undefined;
    await ticket.save();

    this.activeTickets.set(channelId, ticket);

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;
    logger.info(`Unclaimed ticket by ${unclaimedBy.user.tag}`);

    // 🔓 إلغاء القفل والرسائل والأزرار والسجل → في الخلفية بعد الرد
    void this.finalizeUnclaim(guild, ticket, channel, unclaimedBy, previousClaimer);

    return ticket;
  }

  /** الأعمال الثقيلة بعد إلغاء الاستلام — تعمل في الخلفية حتى يظهر الرد فوراً */
  private async finalizeUnclaim(
    guild: Guild,
    ticket: ITicket,
    channel: TextChannel | undefined,
    unclaimedBy: GuildMember,
    previousClaimer?: GuildMember | null
  ): Promise<void> {
    try {
      const jobs: Promise<unknown>[] = [];

      if (channel) {
        // 🔓 إلغاء القفل وإرجاع صلاحيات الكتابة لفريق الدعم
        if (ticket.locked) {
          jobs.push(
            this.releaseClaimLock(guild, ticket, channel).catch(err =>
              logger.warn('Failed to release claim lock:', err)
            )
          );
        }

        const embed = createEmbed({
          title: '↩️ تم إلغاء استلام التذكرة',
          description:
            `تم تحرير التذكرة${previousClaimer ? ` من ${previousClaimer}` : ''}\n` +
            `تم إلغاء الاستلام بواسطة ${unclaimedBy}\n\n` +
            `🔓 تم إلغاء القفل — يمكن لفريق الدعم الكتابة مجدداً.\n` +
            `يمكن لأي مشرف استلامها الآن.`,
          color: Colors.warning,
          footer: { text: 'Liberty City Tickets' },
        });

        jobs.push(channel.send({ embeds: [embed] }));
        jobs.push(this.updateTicketButtons(channel, false));
      }

      this.logTicketEvent(guild, 'unclaim', ticket, unclaimedBy.user);
      await Promise.allSettled(jobs);
    } catch (err) {
      logger.warn('finalizeUnclaim failed:', err);
    }
  }

  // --------------------------------------------
  // Reopen Ticket (إعادة فتح تذكرة مغلقة)
  // --------------------------------------------
  async reopenTicket(channelId: string, reopenedBy: GuildMember): Promise<ITicket> {
    const guild = reopenedBy.guild;
    const ticket = await TicketModel.findOne({ channelId });
    if (!ticket) throw new Error('لم يتم العثور على التذكرة');
    if (ticket.status !== 'closed') throw new Error('التذكرة غير مغلقة');

    // ⛔ من يُسمح له بإعادة الفتح — القاعدة كاملة في canReopenTicket()
    const settings = await getGuildSettings(guild.id);
    const allowed = canReopenTicket({
      ticket,
      member: reopenedBy,
      guildOwnerId: guild.ownerId,
      supportRoleIds: settings.tickets.supportRoleIds,
      adminRoleIds: settings.tickets.adminRoleIds,
    });

    if (!allowed) {
      throw new Error(
        'فقط من أغلق التذكرة أو أعضاء فريق الدعم/الإدارة يمكنهم إعادة فتحها'
      );
    }

    const channel = guild.channels.cache.get(channelId) as TextChannel | undefined;

    // 🔓 إرجاع صلاحيات القناة كما كانت قبل الإغلاق تماماً
    if (channel && ticket.closeSnapshots && ticket.closeSnapshots.length > 0) {
      await this.restoreSnapshots(channel, ticket.closeSnapshots).catch((err) =>
        logger.warn('Failed to restore close snapshots:', err)
      );
      ticket.closeSnapshots = [];
    }

    // 🔁 الاستلام يبقى كما كان (غالباً من أعاد الفتح هو المستلم نفسه)
    ticket.status = ticket.claimedBy ? 'claimed' : 'open';
    ticket.closedBy = undefined;
    ticket.closeReason = undefined;
    ticket.closedAt = undefined;
    await ticket.save();

    this.activeTickets.set(channelId, ticket);

    logger.info(`Reopened ticket by ${reopenedBy.user.tag}`);

    // الأعمال في الخلفية
    void this.finalizeReopen(guild, ticket, channel, reopenedBy);

    return ticket;
  }

  /** الأعمال الثقيلة بعد إعادة الفتح — تعمل في الخلفية */
  private async finalizeReopen(
    guild: Guild,
    ticket: ITicket,
    channel: TextChannel | undefined,
    reopenedBy: GuildMember
  ): Promise<void> {
    try {
      const jobs: Promise<unknown>[] = [];

      if (channel) {
        // إزالة رسالة الإغلاق القديمة (الرسالة الأخيرة في القناة)
        try {
          const messages = await channel.messages.fetch({ limit: 5 });
          const closingMsg = messages.find(m => 
            m.embeds[0]?.title === '🔒 تم إغلاق التذكرة'
          );
          if (closingMsg) await closingMsg.delete().catch(() => {});
        } catch {}

        const reopenEmbed = createEmbed({
          title: '🔓 تم إعادة فتح التذكرة',
          description:
            `تم إعادة فتح التذكرة بواسطة ${reopenedBy}\n\n` +
            `يمكن لفريق الدعم استلامها والمتابعة.`,
          color: Colors.success,
          footer: { text: 'Liberty City Tickets' },
        });

        jobs.push(channel.send({ embeds: [reopenEmbed] }));
        // الاستلام محفوظ → نعرض زر "إلغاء الاستلام" لا زر "استلام"
        jobs.push(this.updateTicketButtons(channel, !!ticket.claimedBy));
      }

      this.logTicketEvent(guild, 'close', ticket, reopenedBy.user, 'إعادة فتح');
      await Promise.allSettled(jobs);
    } catch (err) {
      logger.warn('finalizeReopen failed:', err);
    }
  }

  // --------------------------------------------
  // 🔒 قفل التذكرة بعد الاستلام
  // الكتابة فقط: المستلم + الإدارة العليا (Administrator/ManageGuild)
  // + صاحب التذكرة (overwrite العضو يتفوق على الرولات)
  // --------------------------------------------
  private async applyClaimLock(
    guild: Guild,
    ticket: ITicket,
    channel: TextChannel,
    claimedBy: GuildMember
  ): Promise<void> {
    const settings = await getGuildSettings(guild.id);
    const granted: string[] = [];
    // لقطة لحالة كل overwrite قبل تعديله — لنُرجعها كما كانت عند إلغاء القفل
    const snapshots: ITicketLockSnapshot[] = [];
    // 📝 نجمع الأهداف أولاً ثم ننفّذ كل التعديلات بالتوازي (بدل تتابعها)
    const supportRoleIds: string[] = [];
    const grantTargets: string[] = [];
    const seenTargets = new Set<string>();
    const grantWrite = (id: string) => {
      if (seenTargets.has(id)) return;
      seenTargets.add(id);
      grantTargets.push(id);
    };

    const snapshotOverwrite = (id: string) => {
      const ow = channel.permissionOverwrites.cache.get(id);
      snapshots.push(
        ow
          ? { id, allow: ow.allow.bitfield.toString(), deny: ow.deny.bitfield.toString(), existed: true }
          : { id, allow: '0', deny: '0', existed: false }
      );
    };

    // 1) منع فريق الدعم من الكتابة (إضافة رفض لصلاحية الإرسال)
    for (const roleId of settings.tickets.supportRoleIds) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;
      snapshotOverwrite(roleId);
      supportRoleIds.push(roleId);
    }

    // 2) المستلم يكتب دائماً (overwrite عضو يتفوق على رفض الرولات)
    if (claimedBy.id !== ticket.userId) {
      const ow = channel.permissionOverwrites.cache.get(claimedBy.id);
      if (!ow?.allow.has(PermissionFlagsBits.SendMessages)) {
        snapshotOverwrite(claimedBy.id);
        granted.push(claimedBy.id);
        grantWrite(claimedBy.id);
      }
    }

    // 3) ❌ لم نمنح صلاحية الكتابة لكل من يملك Administrator تلقائياً بعد الاستلام.
    //    الاستلام صار حصرياً: الكتابة للمستلم + صاحب التذكرة فقط،
    //    وأي إداري آخر يحتاج ➕ إضافة عضو أو إداري ليدخل الكتابة.
    //    (من يملك Administrator يتجاوز قفل القناة بقاعدة ديسكورد نفسها — لا يمكن منعه بالـoverwrites)

    // ⚡ كل التعديلات في نفس اللحظة — كانت تُنفَّذ واحدة تلو الأخرى وهو سبب البطء
    await Promise.all([
      ...supportRoleIds.map(id =>
        channel.permissionOverwrites.edit(id, { SendMessages: false }).catch(() => {})
      ),
      ...grantTargets.map(id =>
        channel.permissionOverwrites
          .edit(id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
          })
          .catch(() => {})
      ),
    ]);

    ticket.locked = true;
    ticket.lockGrantedUsers = granted;
    ticket.lockSnapshots = snapshots;
    await ticket.save();

    logger.info(
      `🔒 Ticket locked: ${ticket.channelId} | claimer=${claimedBy.id} | granted=${granted.length} users | snapshotted=${snapshots.length}`
    );
  }

  // --------------------------------------------
  // 🔓 إلغاء القفل عند إلغاء الاستلام
  // --------------------------------------------
  private async releaseClaimLock(
    guild: Guild,
    ticket: ITicket,
    channel: TextChannel
  ): Promise<void> {
    const snapshots = ticket.lockSnapshots || [];

    for (const snap of snapshots) {
      try {
        if (!snap.existed) {
          // لم يكن هناك overwrite أصلاً → نحذف ما أنشأه القفل
          await channel.permissionOverwrites.delete(snap.id);
          continue;
        }

        // كان هناك overwrite → نُرجعه تماماً كما كان (allow/deny قبل القفل)
        const allow = new PermissionsBitField(BigInt(snap.allow));
        const deny = new PermissionsBitField(BigInt(snap.deny));
        const perms: Record<string, boolean | null> = {};
        for (const [name, bit] of Object.entries(PermissionFlagsBits)) {
          // true = allow, false = deny, null = إلغاء (غير محدد)
          perms[name] = allow.has(bit) ? true : deny.has(bit) ? false : null;
        }
        await channel.permissionOverwrites.edit(snap.id, perms);
      } catch (err) {
        logger.warn(`Failed to restore overwrite for ${snap.id}:`, err);
      }
    }

    // تراجع آمن للسجلات القديمة: إن لم توجد لقطات، ننظّف يدويًا دون المساس بصاحب التذكرة
    if (snapshots.length === 0) {
      const settings = await getGuildSettings(guild.id);
      for (const roleId of settings.tickets.supportRoleIds) {
        if (!guild.roles.cache.get(roleId)) continue;
        // إزالة رفض الكتابة فقط (null = إلغاء Entrée بدل منح allow)
        await channel.permissionOverwrites
          .edit(roleId, { SendMessages: null })
          .catch(() => {});
      }
      for (const userId of ticket.lockGrantedUsers || []) {
        if (userId === ticket.userId) continue;
        await channel.permissionOverwrites.delete(userId).catch(() => {});
      }
    }

    ticket.locked = false;
    ticket.lockGrantedUsers = [];
    ticket.lockSnapshots = [];
    await ticket.save();

    logger.info(`🔓 Ticket unlocked: ${ticket.channelId}`);
  }

  // --------------------------------------------
  // 🔒 قفل التذكرة عند الإغلاق — لا يكتب أحد أثناء الإغلاق
  //    (لا صاحب التذكرة ولا فريق الدعم ولا المستلم)
  //    يُرفض الكتابة على كل overwrite موجود في القناة عدا البوت،
  //    وتُحفظ لقطة كاملة حتى تُرجع الصلاحيات كما كانت عند إعادة الفتح.
  //    حاملو Administrator يتجاوزون هذا القفل بقاعدة ديسكورد نفسها.
  // --------------------------------------------
  private async applyCloseLock(channel: TextChannel): Promise<ITicketLockSnapshot[]> {
    const snapshots: ITicketLockSnapshot[] = [];
    const meId = this.client.user?.id;

    for (const [id, ow] of channel.permissionOverwrites.cache) {
      // البوت يبقى قادراً على الإرسال (لرسالة الإغلاق وأزرار إعادة الفتح)
      if (id === meId) continue;

      snapshots.push({
        id,
        allow: ow.allow.bitfield.toString(),
        deny: ow.deny.bitfield.toString(),
        existed: true,
      });
    }

    await Promise.all(
      snapshots.map(snap =>
        channel.permissionOverwrites.edit(snap.id, { SendMessages: false }).catch(() => {})
      )
    );

    logger.info(`🔒 Ticket close-lock applied: ${channel.id} (${snapshots.length} overwrites)`);
    return snapshots;
  }

  // --------------------------------------------
  // 🔓 إرجاع صلاحيات القناة كما كانت تماماً (من لقطات محفوظة)
  // --------------------------------------------
  private async restoreSnapshots(channel: TextChannel, snapshots: ITicketLockSnapshot[]): Promise<void> {
    for (const snap of snapshots) {
      try {
        if (!snap.existed) {
          // لم يكن هناك overwrite → نحذف ما أنشأه القفل
          await channel.permissionOverwrites.delete(snap.id);
          continue;
        }

        const allow = new PermissionsBitField(BigInt(snap.allow));
        const deny = new PermissionsBitField(BigInt(snap.deny));
        const perms: Record<string, boolean | null> = {};
        for (const [name, bit] of Object.entries(PermissionFlagsBits)) {
          // true = allow, false = deny, null = إلغاء (غير محدد)
          perms[name] = allow.has(bit) ? true : deny.has(bit) ? false : null;
        }
        await channel.permissionOverwrites.edit(snap.id, perms);
      } catch (err) {
        logger.warn(`Failed to restore close snapshot for ${snap.id}:`, err);
      }
    }
  }

  // --------------------------------------------
  // Call Admin (Senior/Higher Administration)
  // --------------------------------------------
  async callAdmin(channelId: string, calledBy: GuildMember): Promise<void> {
    const guild = calledBy.guild;
    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) throw new Error('لم يتم العثور على القناة');

    // Cooldown: 5 minutes per ticket
    const lastCall = this.callCooldowns.get(channelId) || 0;
    if (Date.now() - lastCall < 5 * 60 * 1000) {
      const remaining = Math.ceil((5 * 60 * 1000 - (Date.now() - lastCall)) / 60000);
      throw new Error(`يرجى الانتظار ${remaining} دقيقة قبل طلب استدعاء الإدارة مجدداً`);
    }

    const settings = await getGuildSettings(guild.id);

    // منشن الرولات المُعدّدة فقط (رولات الإدارة العليا من الإعدادات)
    // إذا لم تُحدَّد → رولات الدعم فقط (لا كشف تلقائي لأي رول)
    const roleIds = (settings.tickets.adminRoleIds?.length
      ? settings.tickets.adminRoleIds
      : settings.tickets.supportRoleIds) as string[];

    const mentions: string[] = [];
    for (const roleId of roleIds) {
      const role = guild.roles.cache.get(roleId);
      if (role && role.id !== guild.roles.everyone.id) mentions.push(`<@&${role.id}>`);
    }

    const isAdminConfig = (settings.tickets.adminRoleIds?.length || 0) > 0;

    const embed = createEmbed({
      title: '🔔 استدعاء الإدارة العليا',
      description:
        `${calledBy} يستدعي الإدارة العليا!\n\n` +
        `يرجى الاطلاع على هذه التذكرة في أقرب وقت.\n` +
        `**القناة:** ${channel}\n` +
        `**المنشور لـ:** ${isAdminConfig ? 'رولات الإدارة العليا المُعدّدة' : 'رولات فريق الدعم'}`,
      color: Colors.warning,
      footer: { text: 'Liberty City Tickets | استدعاء الإدارة' },
    });

    await channel.send({
      content: mentions.length > 0 ? mentions.join(' ') : undefined,
      embeds: [embed],
    });

    this.callCooldowns.set(channelId, Date.now());
    logger.info(`Admin called in ticket ${channelId} by ${calledBy.user.tag}`);
  }

  // --------------------------------------------
  // Update Ticket Buttons
  // --------------------------------------------
  async updateTicketButtons(channel: TextChannel, claimed: boolean): Promise<void> {
    try {
      const messages = await channel.messages.fetch({ limit: 10 });
      // Find the last message with components (the ticket action message)
      const actionMessage = messages.find(
        m => m.components.length > 0 && m.author.id === this.client.user!.id
      );

      if (actionMessage) {
        await actionMessage.edit({ components: this.buildTicketControls(claimed) });
      }
    } catch (error) {
      logger.warn('Failed to update ticket buttons:', error);
    }
  }

  // --------------------------------------------
  // Add Member to Ticket
  // --------------------------------------------
  async addMemberToTicket(channelId: string, member: GuildMember, addedBy: GuildMember): Promise<void> {
    const channel = member.guild.channels.cache.get(channelId) as TextChannel;
    if (!channel) throw new Error('لم يتم العثور على التذكرة');

    await channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true,
    });

    const embed = createEmbed({
      title: '➕ تمت إضافة عضو',
      description: `تمت إضافة ${member} بواسطة ${addedBy}`,
      color: Colors.info,
      footer: { text: 'Liberty City Tickets' },
    });

    await channel.send({ embeds: [embed] });
  }

  // --------------------------------------------
  // Get Transcript Only
  // --------------------------------------------
  async getTranscript(channelId: string): Promise<string> {
    const channel = this.client.channels.cache.get(channelId) as TextChannel;
    if (!channel) throw new Error('لم يتم العثور على القناة');
    return this.generateTranscript(channel);
  }

  // --------------------------------------------
  // Generate Transcript
  // --------------------------------------------
  private async generateTranscript(channel: TextChannel): Promise<string> {
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      const sortedMessages = Array.from(messages.values()).reverse();

      const transcript = sortedMessages.map(msg => {
        const timestamp = new Date(msg.createdAt).toLocaleString('ar-SA');
        const author = msg.author.tag;
        const content = msg.content || '[مرفق]';
        return `[${timestamp}] ${author}: ${content}`;
      }).join('\n');

      return transcript;
    } catch (error) {
      logger.error('Failed to generate transcript:', error);
      return 'فشل في توليد النسخة';
    }
  }

  // --------------------------------------------
  // Save Transcript
  // --------------------------------------------
  private async saveTranscript(guild: Guild, ticket: ITicket, transcript: string): Promise<void> {
    try {
      const settings = await getGuildSettings(guild.id);
      if (!settings.tickets.transcriptChannelId) return;

      const transcriptChannel = guild.channels.cache.get(settings.tickets.transcriptChannelId) as TextChannel;
      if (!transcriptChannel) return;

      const user = await this.client.users.fetch(ticket.userId);

      const transcriptEmbed = ticketTranscriptEmbed({
        ticketId: ticket.channelId.slice(-6),
        user,
        type: ticket.type,
        status: 'closed',
        messages: [],
        closeReason: ticket.closeReason,
      });

      const { AttachmentBuilder } = require('discord.js');
      const attachment = new AttachmentBuilder(
        Buffer.from(transcript, 'utf-8'),
        { name: `transcript-${ticket.channelId.slice(-6)}.txt` }
      );

      await transcriptChannel.send({
        embeds: [transcriptEmbed],
        files: [attachment],
      });
    } catch (error) {
      logger.error('Failed to save transcript:', error);
    }
  }

  // --------------------------------------------
  // Log Ticket Event
  // ⚡ لا يعطّل مسار التذكرة: يُنفَّذ عبر طابور مستقل لكل سيرفر،
  //    مع جلب القناة من الكاش ثم fetch، وإعادة محاولة واحدة عند الفشل.
  //    (سابقاً كان السجل يضيع صامتاً إذا لم تكن القناة في الكاش أو حدث خطأ مؤقت)
  // --------------------------------------------
  private logTicketEvent(
    guild: Guild,
    event: 'create' | 'close' | 'claim' | 'delete' | 'unclaim' | 'call' | 'add_member',
    ticket: ITicket,
    user: any,
    reason?: string
  ): void {
    const previous = this.ticketLogQueues.get(guild.id) ?? Promise.resolve();
    const next = previous
      .then(() => this.emitTicketLog(guild, event, ticket, user, reason))
      .catch((err: any) => logger.error('Ticket log job failed:', err));
    this.ticketLogQueues.set(guild.id, next);
    // تنظيف الوعاء بعد انتهائه لتجنّب تسرّب الذاكرة
    void next.then(() => {
      if (this.ticketLogQueues.get(guild.id) === next) this.ticketLogQueues.delete(guild.id);
    });
  }

  /** الإرسال الفعلي لسجل التذكرة */
  private async emitTicketLog(
    guild: Guild,
    event: 'create' | 'close' | 'claim' | 'delete' | 'unclaim' | 'call' | 'add_member',
    ticket: ITicket,
    user: any,
    reason?: string
  ): Promise<void> {
    try {
      const settings = await getGuildSettings(guild.id);
      const logChannelId = settings.tickets.logChannelId;
      if (!logChannelId) return;

      const eventEmojis: Record<string, string> = {
        create: '➕', close: '➖', claim: '🤝', unclaim: '↩️',
        delete: '🗑️', call: '🔔', add_member: '👤',
      };
      const eventNames: Record<string, string> = {
        create: 'إنشاء', close: 'إغلاق', claim: 'استلام', unclaim: 'إلغاء استلام',
        delete: 'حذف', call: 'استدعاء إدارة', add_member: 'إضافة عضو',
      };

      // رقم التذكرة — حتى يُميّز المشرف أي تذكرة إن اختفت القناة بعد الحذف
      const ticketRef = ticket.channelId ? `\`#${ticket.channelId.slice(-6)}\`` : 'غير معروف';
      const opener = await guild.members.fetch(ticket.userId).catch(() => null);
      const claimer = ticket.claimedBy
        ? await guild.members.fetch(ticket.claimedBy).catch(() => null)
        : null;

      const fields: Array<{ name: string; value: string; inline: boolean }> = [
        { name: '🎫 رقم التذكرة', value: ticketRef, inline: true },
        { name: '📂 النوع', value: ticket.type || 'غير محدد', inline: true },
        { name: '📍 القناة', value: `<#${ticket.channelId}>`, inline: true },
        { name: `${eventEmojis[event] || '👤'} المنفِّذ`, value: user ? `${user}` : 'غير معروف', inline: true },
        { name: '🙋 فتحها', value: opener ? `${opener}` : `\`${ticket.userId}\``, inline: true },
      ];

      if (claimer) fields.push({ name: '🤝 المستلم', value: `${claimer}`, inline: true });

      if (reason && reason.trim()) {
        // ⚠️ حقل يتجاوز 1024 حرف = رفض Discord للإيمبد بالكامل = سجل ضائع
        const safeReason = reason.length > 1000 ? `${reason.slice(0, 997)}…` : reason;
        fields.push({ name: '📝 السبب', value: safeReason, inline: false });
      }

      const logEmbed = createEmbed({
        title: `${eventEmojis[event] || '📌'} ${eventNames[event] || event} تذكرة`,
        color: event === 'close' || event === 'delete' ? Colors.error : Colors.success,
        fields,
        footer: { text: 'Liberty City Ticket Logs' },
      });

      // الكاش أولاً ثم الجلب الفعلي — يمنع ضياع السجل إذا لم تكن القناة مخزّنة
      let channel = guild.channels.cache.get(logChannelId) as TextChannel | undefined;
      if (!channel) {
        channel = ((await guild.channels.fetch(logChannelId).catch(() => null)) as TextChannel | null) ?? undefined;
      }
      if (!channel || !channel.isTextBased?.()) return;

      const payload = { embeds: [logEmbed] };
      const firstError: unknown = await channel.send(payload).then(() => null).catch((err) => err);
      if (firstError) {
        logger.warn(`Ticket log send failed in ${guild.name}, retrying once:`, firstError);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await channel.send(payload).catch((err: any) => {
          logger.error(`Ticket log failed permanently in ${guild.name}:`, err);
        });
      }

      // 📡 إعادة الإرسال إلى LoggingHandler (قنوات اللوقس المخصّصة) — في الخلفية
      const loggingHandler = (this.client as any).loggingHandler;
      if (loggingHandler) {
        const map: Record<string, 'ticketCreate' | 'ticketClose' | 'ticketReopen' | 'ticketDelete' | 'ticketClaim'> = {
          create: 'ticketCreate',
          close: 'ticketClose',
          unclaim: 'ticketReopen',
          delete: 'ticketDelete',
          claim: 'ticketClaim',
        };
        const logEvent = map[event];
        const base = { guild, channel: { id: ticket.channelId } };
        if (logEvent === 'ticketCreate') loggingHandler.handleTicketCreate({ ...base, creator: user }).catch(() => {});
        else if (logEvent === 'ticketClose') loggingHandler.handleTicketClose({ ...base, closer: user, reason }).catch(() => {});
        else if (logEvent === 'ticketReopen') loggingHandler.handleTicketReopen({ ...base, reopener: user }).catch(() => {});
        else if (logEvent === 'ticketDelete') loggingHandler.handleTicketDelete({ guild, channelId: ticket.channelId, deleter: user }).catch(() => {});
        else if (logEvent === 'ticketClaim') loggingHandler.handleTicketClaim({ ...base, claimer: user }).catch(() => {});
      }
    } catch (error) {
      logger.error('Failed to log ticket event:', error);
    }
  }

  // --------------------------------------------
  // Create Ticket Panel
  // يستبدل اللوحة السابقة (لوحة واحدة فقط لكل سيرفر)
  // ويرث العنوان/الوصف/الأنواع/الصورة من اللوحة الحالية إن لم تمرَّر
  // --------------------------------------------
  async createPanel(
    guild: Guild,
    channel: TextChannel,
    panelData: Omit<TicketPanelData, 'channelId' | 'messageId'>
  ): Promise<{ panel: TicketPanelData; messageId: string }> {
    const settings = await getGuildSettings(guild.id);
    const oldPanelsCount = settings.tickets.panels.length;
    const previous = oldPanelsCount > 0 ? settings.tickets.panels[oldPanelsCount - 1] : null;

    // الوراثة: الأنواع والصورة من اللوحة السابقة إن لم تُحدَّد صراحة
    const options =
      panelData.options && panelData.options.length > 0
        ? panelData.options
        : previous?.options?.length
          ? (previous.options as TicketPanelOption[])
          : undefined;
    const image = panelData.image ?? previous?.image ?? undefined;

    const panelId = generateNumericId(4);

    const panel: TicketPanelData = {
      ...panelData,
      options,
      image,
      id: panelId,
      channelId: channel.id,
      supportRoleIds:
        panelData.supportRoleIds && panelData.supportRoleIds.length > 0
          ? panelData.supportRoleIds
          : [...settings.tickets.supportRoleIds],
    };

    const message = await channel.send({
      embeds: [this.buildPanelEmbed(panel)],
      components: this.buildPanelComponents(panel),
    });
    panel.messageId = message.id;

    // استبدال اللوحات القديمة: حذف رسائلها من القنوات ومسحها من الإعدادات
    for (const old of settings.tickets.panels) {
      if (old.channelId && old.messageId) {
        const oldChannel = guild.channels.cache.get(old.channelId);
        if (oldChannel && 'messages' in oldChannel) {
          const oldMsg = await (oldChannel as TextChannel).messages
            .fetch(old.messageId)
            .catch(() => null);
          if (oldMsg) await oldMsg.delete().catch(() => {});
        }
      }
    }
    settings.tickets.panels = [panel as any];
    await settings.save();

    logger.info(
      `Created ticket panel ${panelId} in ${channel.name}` +
        (oldPanelsCount > 0 ? ` (replaced ${oldPanelsCount} old panel(s))` : '')
    );
    return { panel, messageId: message.id };
  }

  // --------------------------------------------
  // الأنواع المعروضة في اللوحة (المخصصة أو الافتراضية)
  // --------------------------------------------
  private getPanelTypes(panel: Partial<TicketPanelData>): TicketPanelOption[] {
    if (panel.options && panel.options.length > 0) return panel.options;
    if (panel.fields && panel.fields.length > 0) {
      return panel.fields.map(f => ({
        label: f.label,
        description: f.placeholder,
        emoji: '🎫',
      }));
    }
    return DEFAULT_TICKET_TYPES;
  }

  // --------------------------------------------
  // بناء إمبد اللوحة (مشترك: إنشاء / تعديل / نقل)
  // --------------------------------------------
  buildPanelEmbed(panel: Partial<TicketPanelData>): EmbedBuilder {
    const types = this.getPanelTypes(panel).slice(0, 25);
    const typeList = types
      .map(o => `> • ${o.emoji || '🎫'} **${o.label}**${o.description ? ` — ${o.description}` : ''}`)
      .join('\n');

    return createEmbed({
      title: `${panel.emoji || '🎫'} ${panel.name || 'تذاكر الدعم'}`,
      description:
        `${panel.description || 'افتح تذكرة جديدة وسيقوم فريق الدعم بالرد عليك في أقرب وقت 💬'}\n\n` +
        `📋 **اختر نوع التذكرة من القائمة بالأسفل** — سيُفتح التذكرة بنفس الاسم:\n` +
        `${typeList}`,
      image: panel.image || undefined,
      color: Colors.primary,
      footer: { text: 'Liberty City Tickets' },
      timestamp: true,
    });
  }

  // --------------------------------------------
  // بناء مكوّنات اللوحة: قائمة الأنواع + زر تذكرة عامة
  // --------------------------------------------
  buildPanelComponents(panel: TicketPanelData): any[] {
    const seen = new Set<string>();
    const options: Array<{ label: string; description?: string; value: string; emoji?: string }> = [];

    for (const o of this.getPanelTypes(panel)) {
      const label = (o.label || '').trim().substring(0, 100);
      if (!label || seen.has(label)) continue; // قيم مكررة ترفضها Discord
      seen.add(label);
      options.push({
        label,
        description: (o.description || '').trim().substring(0, 100) || undefined,
        value: label, // اسم النوع = قيمة الاختيار = اسم قناة التذكرة
        emoji: (o.emoji || '').trim() || undefined,
      });
      if (options.length >= 25) break;
    }

    if (options.length === 0) {
      for (const o of DEFAULT_TICKET_TYPES) {
        options.push({ label: o.label, description: o.description, value: o.label, emoji: o.emoji });
      }
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`ticket_select_${panel.id}`)
      .setPlaceholder('🎫 اختر نوع التذكرة')
      .addOptions(options);

    const selectRow = new ActionRowBuilder<any>().addComponents(selectMenu);

    // زر "إعادة تعيين الطلب" — يحذف تذكرتك المفتوحة حتى تتمكن من فتح تذكرة جديدة
    const resetBtn = new ButtonBuilder()
      .setCustomId('ticket_reset')
      .setLabel('إعادة تعيين الطلب')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄');

    const buttonRow = new ActionRowBuilder<any>().addComponents(resetBtn);

    return [selectRow, buttonRow];
  }

  // --------------------------------------------
  // تحديث رسالة لوحة موجودة بعد تعديل محتواها
  // --------------------------------------------
  async updatePanelMessage(guild: Guild, panel: TicketPanelData): Promise<void> {
    if (!panel || !panel.messageId || !panel.channelId) return;
    const channel = guild.channels.cache.get(panel.channelId);
    if (!channel || !('messages' in channel)) return;

    const message = await (channel as TextChannel).messages
      .fetch(panel.messageId)
      .catch(() => null);
    if (!message) return;

    await message
      .edit({
        embeds: [this.buildPanelEmbed(panel)],
        components: this.buildPanelComponents(panel),
      })
      .catch(() => {});
  }

  // --------------------------------------------
  // نقل لوحة إلى قناة أخرى (حذف القديمة + إرسال جديدة)
  // --------------------------------------------
  async movePanel(guild: Guild, panel: TicketPanelData, newChannel: TextChannel): Promise<void> {
    // حذف الرسالة القديمة إن وُجدت
    if (panel.messageId && panel.channelId) {
      const oldChannel = guild.channels.cache.get(panel.channelId);
      if (oldChannel && 'messages' in oldChannel) {
        const oldMessage = await (oldChannel as TextChannel).messages
          .fetch(panel.messageId)
          .catch(() => null);
        if (oldMessage) await oldMessage.delete().catch(() => {});
      }
    }

    const message = await newChannel.send({
      embeds: [this.buildPanelEmbed(panel)],
      components: this.buildPanelComponents(panel),
    });

    panel.channelId = newChannel.id;
    panel.messageId = message.id;
  }

  // --------------------------------------------
  // Get Active Tickets
  // --------------------------------------------
  getActiveTickets(guildId: string): Promise<ITicket[]> {
    return TicketModel.find({
      guildId,
      status: { $in: ['open', 'claimed', 'waiting'] },
    });
  }

  // --------------------------------------------
  // Get User Tickets
  // --------------------------------------------
  getUserTickets(guildId: string, userId: string): Promise<ITicket[]> {
    return TicketModel.find({
      guildId,
      userId,
      status: { $in: ['open', 'claimed', 'waiting'] },
    });
  }

  // --------------------------------------------
  // Get Ticket Stats
  // --------------------------------------------
  async getTicketStats(guildId: string): Promise<{
    total: number;
    open: number;
    claimed: number;
    closed: number;
    waiting: number;
  }> {
    const [total, open, claimed, closed, waiting] = await Promise.all([
      TicketModel.countDocuments({ guildId }),
      TicketModel.countDocuments({ guildId, status: 'open' }),
      TicketModel.countDocuments({ guildId, status: 'claimed' }),
      TicketModel.countDocuments({ guildId, status: 'closed' }),
      TicketModel.countDocuments({ guildId, status: 'waiting' }),
    ]);

    return { total, open, claimed, closed, waiting };
  }

  // --------------------------------------------
  // Cleanup
  // --------------------------------------------
  cleanup(): void {
    this.activeTickets.clear();
    this.callCooldowns.clear();
  }
}

export default TicketHandler;
