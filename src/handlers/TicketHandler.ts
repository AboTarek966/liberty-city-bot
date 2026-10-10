// ============================================
// Liberty City Bot - Ticket Handler (Enhanced)
// ============================================

import {
  Client,
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
// Ticket Handler Class
// --------------------------------------------
export class TicketHandler {
  private client: Client;
  private activeTickets: Collection<string, ITicket> = new Collection();
  private callCooldowns: Collection<string, number> = new Collection();

  constructor(client: Client) {
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

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
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

    for (const role of supportRoles) {
      permissionOverwrites.push({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
        ],
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

    const welcomeEmbed = ticketEmbed({
      title: `تذكرة ${type}`,
      description:
        `مرحباً ${user}! تم إنشاء تذكرتك بنجاح.\n\n` +
        `**رقم التذكرة:** \`${ticketId}\`\n` +
        `**النوع:** ${type}\n\n` +
        `فريق الدعم سيتواصل معك في أقرب وقت.\n` +
        `يرجى وصف مشكلتك بالتفصيل.\n\n` +
        `---\n` +
        `⚙️ **اختر من قائمة الخيارات بالأسفل:**\n` +
        `> ➕ إضافة عضو أو إداري • 👑 استدعاء الإدارة العليا\n` +
        `> 🤝 استلام التذكرة •↩️ إلغاء الاستلام\n` +
        `> 🔒 إغلاق • 🗑️ حذف • 📄 نسخة المحادثة`,
      user: user.user,
      type,
      status: 'open',
      priority: 'medium',
      fields,
    });

    await channel.send({
      content: supportRoles.length > 0
        ? supportRoles.map(r => `<@&${r.id}>`).join(' ')
        : user.toString(),
      embeds: [welcomeEmbed],
      components: this.buildTicketControls(false),
    });

    // الرسالة التلقائية المخصصة داخل التذكرة (إن كانت مفعّلة من الإعدادات)
    const autoMessage =
      settings.tickets.autoMessage ||
      '🎫 تم فتح تذكرتك رقم **{ticket}**!\nفريق الدعم سيرد عليك في أقرب وقت — صف مشكلتك بوضوح لتسريع الرد 💬';
    if (settings.tickets.autoMessageEnabled) {
      const autoText = autoMessage
        .replace(/\{user\}/g, `<@${user.id}>`)
        .replace(/\{ticket\}/g, ticketId)
        .replace(/\{server\}/g, guild.name);
      if (autoText.trim()) {
        await channel.send({ content: autoText.substring(0, 2000) }).catch(() => {});
      }
    }

    await this.logTicketEvent(guild, 'create', ticket, user.user);

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
    ticket.closeReason = reason;
    ticket.transcript = transcript;
    ticket.closedAt = new Date();
    await ticket.save();

    this.activeTickets.delete(channelId);

    const closingEmbed = createEmbed({
      title: '🔒 تم إغلاق التذكرة',
      description:
        `تم إغلاق التذكرة بواسطة ${closedBy}\n\n` +
        `السبب: ${reason || 'غير محدد'}\n\n` +
        `سيتم حذف القناة خلال 10 ثوانٍ...`,
      color: Colors.error,
      footer: { text: 'Liberty City Tickets' },
    });

    await channel.send({ embeds: [closingEmbed] });
    await this.saveTranscript(guild, ticket, transcript);

    setTimeout(async () => {
      await channel.delete('Liberty City - Ticket closed').catch(() => {});
    }, 10000);

    await this.logTicketEvent(guild, 'close', ticket, closedBy.user, reason);

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
  async sweepInactiveTickets(client: Client): Promise<void> {
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
    await this.logTicketEvent(guild, 'delete', ticket, deletedBy.user);

    logger.info(`Deleted ticket channel ${channelId}`);
  }

  // --------------------------------------------
  // Claim Ticket
  // --------------------------------------------
  async claimTicket(channelId: string, claimedBy: GuildMember): Promise<ITicket> {
    const ticket = await TicketModel.findOne({ channelId });
    if (!ticket) throw new Error('لم يتم العثور على التذكرة');
    if (ticket.status === 'claimed') {
      const claimer = claimedBy.guild.members.cache.get(ticket.claimedBy!);
      throw new Error(`التذكرة مستلمة بالفعل بواسطة ${claimer || 'مشرف آخر'}`);
    }

    ticket.status = 'claimed';
    ticket.claimedBy = claimedBy.id;
    await ticket.save();

    this.activeTickets.set(channelId, ticket);

    const channel = claimedBy.guild.channels.cache.get(channelId) as TextChannel;
    if (channel) {
      // 🔒 قفل التذكرة: الكتابة للمستلم والإدارة العليا فقط
      await this.applyClaimLock(claimedBy.guild, ticket, channel, claimedBy).catch(err =>
        logger.warn('Failed to apply claim lock:', err)
      );

      const claimEmbed = createEmbed({
        title: '🤝 تم استلام التذكرة',
        description:
          `تم استلام التذكرة بواسطة ${claimedBy}\n\n` +
          `🔒 **تم قفل التذكرة:** فريق الدعم يمكنهم **القراءة فقط** — الكتابة للمستلم والإدارة العليا.\n` +
          `📌 لمنح إداري معيّن صلاحية الكتابة اختر **➕ إضافة عضو أو إداري** من قائمة الخيارات.\n\n` +
          `يمكن لغيره طلب **إلغاء الاستلام** إذا لزم الأمر.`,
        color: Colors.success,
        footer: { text: 'Liberty City Tickets' },
      });

      await channel.send({ embeds: [claimEmbed] });

      // Update buttons (show unclaim instead of claim)
      await this.updateTicketButtons(channel, true);
    }

    await this.logTicketEvent(claimedBy.guild, 'claim', ticket, claimedBy.user);
    logger.info(`Claimed ticket by ${claimedBy.user.tag}`);
    return ticket;
  }

  // --------------------------------------------
  // Unclaim Ticket
  // --------------------------------------------
  async unclaimTicket(channelId: string, unclaimedBy: GuildMember): Promise<ITicket> {
    const ticket = await TicketModel.findOne({ channelId });
    if (!ticket) throw new Error('لم يتم العثور على التذكرة');
    if (ticket.status !== 'claimed') throw new Error('التذكرة غير مستلمة');

    const guild = unclaimedBy.guild;
    const isClaimer = ticket.claimedBy === unclaimedBy.id;
    const canManage = unclaimedBy.permissions.has(PermissionFlagsBits.ManageChannels);

    if (!isClaimer && !canManage) {
      throw new Error('فقط المستلم أو مشرف القنوات يمكنه إلغاء الاستلام');
    }

    const previousClaimer = guild.members.cache.get(ticket.claimedBy!);
    ticket.status = 'open';
    ticket.claimedBy = undefined;
    await ticket.save();

    this.activeTickets.set(channelId, ticket);

    const channel = guild.channels.cache.get(channelId) as TextChannel;
    if (channel) {
      // 🔓 إلغاء القفل وإرجاع صلاحيات الكتابة لفريق الدعم
      if (ticket.locked) {
        await this.releaseClaimLock(guild, ticket, channel).catch(err =>
          logger.warn('Failed to release claim lock:', err)
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

      await channel.send({ embeds: [embed] });
      await this.updateTicketButtons(channel, false);
    }

    await this.logTicketEvent(guild, 'unclaim', ticket, unclaimedBy.user);
    logger.info(`Unclaimed ticket by ${unclaimedBy.user.tag}`);
    return ticket;
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
      await channel.permissionOverwrites
        .edit(roleId, { SendMessages: false })
        .catch(() => {});
    }

    // 2) المستلم يكتب دائماً (overwrite عضو يتفوق على رفض الرولات)
    if (claimedBy.id !== ticket.userId) {
      const ow = channel.permissionOverwrites.cache.get(claimedBy.id);
      if (!ow?.allow.has(PermissionFlagsBits.SendMessages)) {
        snapshotOverwrite(claimedBy.id);
        await channel.permissionOverwrites
          .edit(claimedBy.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
          })
          .catch(() => {});
        granted.push(claimedBy.id);
      }
    }

    // 3) الإدارة العليا (Administrator أو ManageGuild) — منح كتابة للأعضاء
    const seniorRoles = guild.roles.cache.filter(
      r =>
        r.id !== guild.roles.everyone.id &&
        (r.permissions.has(PermissionFlagsBits.Administrator) ||
          r.permissions.has(PermissionFlagsBits.ManageGuild))
    );

    for (const role of seniorRoles.values()) {
      for (const [memberId, member] of guild.members.cache) {
        if (granted.includes(memberId)) continue;
        if (member.id === ticket.userId) continue; // صاحب التذكرة يملك الوصول أصلاً
        if (member.id === this.client.user?.id) continue; // البوت
        if (!member.roles.cache.has(role.id)) continue;

        const ow = channel.permissionOverwrites.cache.get(memberId);
        if (ow?.allow.has(PermissionFlagsBits.SendMessages)) continue; // يملك الكتابة أصلاً

        snapshotOverwrite(memberId);
        await channel.permissionOverwrites
          .edit(memberId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
          })
          .catch(() => {});
        granted.push(memberId);
      }
    }

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
  // --------------------------------------------
  private async logTicketEvent(
    guild: Guild,
    event: 'create' | 'close' | 'claim' | 'delete' | 'unclaim' | 'call' | 'add_member',
    ticket: ITicket,
    user: any,
    reason?: string
  ): Promise<void> {
    try {
      const settings = await getGuildSettings(guild.id);
      if (!settings.tickets.logChannelId) return;

      const logChannel = guild.channels.cache.get(settings.tickets.logChannelId) as TextChannel;
      if (!logChannel) return;

      const eventEmojis: Record<string, string> = {
        create: '➕',
        close: '➖',
        claim: '🤝',
        unclaim: '↩️',
        delete: '🗑️',
        call: '🔔',
        add_member: '👤',
      };

      const eventNames: Record<string, string> = {
        create: 'إنشاء',
        close: 'إغلاق',
        claim: 'استلام',
        unclaim: 'إلغاء استلام',
        delete: 'حذف',
        call: 'استدعاء إدارة',
        add_member: 'إضافة عضو',
      };

      const logEmbed = createEmbed({
        title: `${eventEmojis[event] || '📌'} ${eventNames[event] || event} تذكرة`,
        color: event === 'close' || event === 'delete' ? Colors.error : Colors.success,
        fields: [
          { name: '👤 المستخدم', value: `${user}`, inline: true },
          { name: '📍 القناة', value: `<#${ticket.channelId}>`, inline: true },
          { name: '📂 النوع', value: ticket.type, inline: true },
        ],
        footer: { text: 'Liberty City Ticket Logs' },
      });

      if (reason) {
        logEmbed.addFields({ name: '📝 السبب', value: reason, inline: false });
      }

      await logChannel.send({ embeds: [logEmbed] });
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

    // زر "تذكرة عامة" أُزيل بناءً على طلب المالك — القائمة المنسدلة هي الوسيلة الوحيدة لفتح تذكرة
    return [selectRow];
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
