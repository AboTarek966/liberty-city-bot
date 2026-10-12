"use strict";
// ============================================
// Liberty City Bot - Ticket Handler (Enhanced)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketHandler = exports.DEFAULT_TICKET_TYPES = void 0;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const models_1 = require("../models");
const embeds_1 = require("../utils/embeds");
const helpers_2 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('TicketHandler');
/** الأنواع الافتراضية عندما لا يحدد المشرف أي أنواع */
exports.DEFAULT_TICKET_TYPES = [
    { label: 'دعم فني', description: 'للحصول على مساعدة تقنية', emoji: '🔧' },
    { label: 'استفسار', description: 'للاستفسارات العامة', emoji: '❓' },
    { label: 'إبلاغ', description: 'للإبلاغ عن مشكلة', emoji: '⚠️' },
];
// --------------------------------------------
// Ticket Handler Class
// --------------------------------------------
class TicketHandler {
    client;
    activeTickets = new discord_js_1.Collection();
    callCooldowns = new discord_js_1.Collection();
    constructor(client) {
        this.client = client;
    }
    // --------------------------------------------
    // بناء عناصر التحكم داخل التذكرة:
    // قائمة خيارات (Options) + زر استلام سريع
    // --------------------------------------------
    buildTicketControls(claimed) {
        const options = [
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
        const selectRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.StringSelectMenuBuilder()
            .setCustomId('ticket_options')
            .setPlaceholder('⚙️ خيارات التذكرة — اختر إجراءً')
            .addOptions(options));
        const claimRow = new discord_js_1.ActionRowBuilder().addComponents(claimed
            ? new discord_js_1.ButtonBuilder()
                .setCustomId('ticket_unclaim')
                .setLabel('إلغاء الاستلام')
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setEmoji('↩️')
            : new discord_js_1.ButtonBuilder()
                .setCustomId('ticket_claim')
                .setLabel('استلام التذكرة')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setEmoji('🤝'));
        return [selectRow, claimRow];
    }
    // --------------------------------------------
    // Create Ticket Category
    // --------------------------------------------
    async createTicketCategory(guild, name) {
        const existingCategory = guild.channels.cache.find(c => c.type === discord_js_1.ChannelType.GuildCategory && c.name === name);
        if (existingCategory)
            return existingCategory;
        const category = await guild.channels.create({
            name,
            type: discord_js_1.ChannelType.GuildCategory,
            reason: 'Liberty City - Ticket System',
        });
        logger.info(`Created ticket category: ${category.name}`);
        return category;
    }
    // --------------------------------------------
    // Create Log Channel
    // --------------------------------------------
    async createLogChannel(guild, name, category) {
        const existingChannel = guild.channels.cache.find(c => c.type === discord_js_1.ChannelType.GuildText && c.name === name);
        if (existingChannel)
            return existingChannel;
        const channel = await guild.channels.create({
            name,
            type: discord_js_1.ChannelType.GuildText,
            parent: category?.id,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [discord_js_1.PermissionFlagsBits.ViewChannel] },
            ],
            reason: 'Liberty City - Ticket Logs',
        });
        logger.info(`Created ticket log channel: ${channel.name}`);
        return channel;
    }
    // --------------------------------------------
    // Create Ticket
    // --------------------------------------------
    async createTicket(options) {
        const { guild, user, type, panelId, subject, fields } = options;
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        const userTickets = await models_1.Ticket.find({
            guildId: guild.id,
            userId: user.id,
            status: { $in: ['open', 'claimed', 'waiting'] },
        });
        if (userTickets.length >= settings.tickets.maxPerUser) {
            throw new Error(`لديك بالفعل ${userTickets.length} تذاكر مفتوحة. الحد الأقصى هو ${settings.tickets.maxPerUser}`);
        }
        let category;
        if (settings.tickets.categoryId) {
            category = guild.channels.cache.get(settings.tickets.categoryId);
        }
        if (!category) {
            category = await this.createTicketCategory(guild, '🎫│التذاكر');
            settings.tickets.categoryId = category.id;
            await settings.save();
        }
        // الترقيم التسلسلي: التذكرة الأولى = 1 ثم 2 ثم 3... (يُستأنف من عدد التذاكر السابقة عند أول استخدام)
        if (!settings.tickets.counter) {
            settings.tickets.counter = await models_1.Ticket.countDocuments({ guildId: guild.id });
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
            .map((roleId) => guild.roles.cache.get(roleId))
            .filter((r) => Boolean(r));
        const lockClaim = settings.tickets.lockUntilClaim;
        // صلاحيات صاحب التذكرة: عرض + قراءة + مرفقات دائماً، والكتابة حسب خيار القفل
        const userAllow = [
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.ReadMessageHistory,
            discord_js_1.PermissionFlagsBits.AttachFiles,
            discord_js_1.PermissionFlagsBits.EmbedLinks,
        ];
        if (!lockClaim)
            userAllow.push(discord_js_1.PermissionFlagsBits.SendMessages);
        const permissionOverwrites = [
            {
                id: guild.roles.everyone.id,
                deny: [discord_js_1.PermissionFlagsBits.ViewChannel],
            },
            {
                id: user.id,
                allow: userAllow,
                // 🔒 خيار قفل التذكرة: صاحبها لا يكتب حتى يستلمها إداري
                ...(lockClaim ? { deny: [discord_js_1.PermissionFlagsBits.SendMessages] } : {}),
            },
            {
                id: this.client.user.id,
                allow: [
                    discord_js_1.PermissionFlagsBits.ViewChannel,
                    discord_js_1.PermissionFlagsBits.SendMessages,
                    discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                    discord_js_1.PermissionFlagsBits.ManageChannels,
                    discord_js_1.PermissionFlagsBits.ManageMessages,
                    discord_js_1.PermissionFlagsBits.AttachFiles,
                    discord_js_1.PermissionFlagsBits.EmbedLinks,
                ],
            },
        ];
        // صلاحيات فريق الدعم: قراءة + أدوات دائماً، والكتابة حسب خيار القفل
        const supportAllow = [
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.ReadMessageHistory,
            discord_js_1.PermissionFlagsBits.AttachFiles,
            discord_js_1.PermissionFlagsBits.EmbedLinks,
            discord_js_1.PermissionFlagsBits.ManageMessages,
        ];
        if (!lockClaim)
            supportAllow.push(discord_js_1.PermissionFlagsBits.SendMessages);
        for (const role of supportRoles) {
            permissionOverwrites.push({
                id: role.id,
                allow: supportAllow,
                ...(lockClaim ? { deny: [discord_js_1.PermissionFlagsBits.SendMessages] } : {}),
            });
        }
        const channel = await guild.channels.create({
            name: channelName,
            type: discord_js_1.ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites,
            reason: `Liberty City - Ticket created by ${user.user.tag}`,
        });
        const ticket = await models_1.Ticket.create({
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
            const welcomeMessage = `مرحباً ${user}! تم إنشاء تذكرتك بنجاح ✅\n\n` +
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
        }
        else {
            // بدون رسالة ترحيب — أرسل فقط أزرار التحكم
            await channel.send({
                content: pingContent,
                components: this.buildTicketControls(false),
            });
        }
        await this.logTicketEvent(guild, 'create', ticket, user.user);
        logger.info(`Created ticket ${ticketId} for ${user.user.tag}`);
        return ticket;
    }
    // --------------------------------------------
    // Close Ticket
    // --------------------------------------------
    async closeTicket(channelId, closedBy, reason) {
        const ticket = await models_1.Ticket.findOne({ channelId });
        if (!ticket)
            throw new Error('لم يتم العثور على التذكرة');
        if (ticket.status === 'closed')
            throw new Error('التذكرة مغلقة بالفعل');
        const guild = closedBy.guild;
        const channel = guild.channels.cache.get(channelId);
        if (!channel)
            throw new Error('لم يتم العثور على القناة');
        const transcript = await this.generateTranscript(channel);
        ticket.status = 'closed';
        ticket.closedBy = closedBy.id;
        ticket.closeReason = reason;
        ticket.transcript = transcript;
        ticket.closedAt = new Date();
        await ticket.save();
        this.activeTickets.delete(channelId);
        const closingEmbed = (0, embeds_1.createEmbed)({
            title: '🔒 تم إغلاق التذكرة',
            description: `تم إغلاق التذكرة بواسطة ${closedBy}\n\n` +
                `السبب: ${reason || 'غير محدد'}\n\n` +
                `سيتم حذف القناة خلال 10 ثوانٍ...`,
            color: embeds_1.Colors.error,
            footer: { text: 'Liberty City Tickets' },
        });
        await channel.send({ embeds: [closingEmbed] });
        await this.saveTranscript(guild, ticket, transcript);
        setTimeout(async () => {
            await channel.delete('Liberty City - Ticket closed').catch(() => { });
        }, 10000);
        await this.logTicketEvent(guild, 'close', ticket, closedBy.user, reason);
        // ⭐ استبيان الرضا — رسالة خاصة لصاحب التذكرة بعد الإغلاق
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            if (settings.tickets.surveyEnabled) {
                const owner = await guild.client.users.fetch(ticket.userId).catch(() => null);
                if (owner) {
                    const surveyRow = new discord_js_1.ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map(n => new discord_js_1.ButtonBuilder()
                        .setCustomId(`ticket_survey:${ticket._id}:${n}`)
                        .setLabel(String(n))
                        .setEmoji('⭐')
                        .setStyle(discord_js_1.ButtonStyle.Secondary)));
                    await owner.send({
                        embeds: [
                            (0, embeds_1.createEmbed)({
                                title: '⭐ كيف كانت خدمة الدعم؟',
                                description: `تم إغلاق تذكرتك في سيرفر **${guild.name}** (النوع: ${ticket.type})\n` +
                                    `قيّم تجربتك مع فريق الدعم — رأيك يساعدنا على التحسين 💙`,
                                color: embeds_1.Colors.primary,
                            }),
                        ],
                        components: [surveyRow],
                    }).catch(() => { });
                }
            }
        }
        catch {
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
    async sweepInactiveTickets(client) {
        for (const guild of client.guilds.cache.values()) {
            try {
                const settings = await (0, models_1.getGuildSettings)(guild.id);
                const hours = settings.tickets.autoCloseHours || 0;
                if (hours <= 0)
                    continue;
                const closeCutoff = new Date(Date.now() - hours * 3600_000);
                const warnCutoff = new Date(Date.now() - Math.max(1, hours - 1) * 3600_000);
                // 1) تحذير التذاكر الخاملة (ساعة قبل الإغلاق) — مرة واحدة فقط
                const toWarn = await models_1.Ticket.find({
                    guildId: guild.id,
                    status: { $in: ['open', 'claimed', 'waiting'] },
                    lastActivityAt: { $lt: warnCutoff },
                    idleWarned: { $ne: true },
                }).limit(25);
                for (const t of toWarn) {
                    const ch = guild.channels.cache.get(t.channelId);
                    if (!ch)
                        continue;
                    await ch
                        .send({
                        embeds: [
                            (0, embeds_1.createEmbed)({
                                title: '⏳ التذكرة خاملة',
                                description: 'لم يحدث نشاط في هذه التذكرة منذ فترة — **سيتم إغلاقها تلقائياً خلال ساعة** إذا لم يكتب أحد 💬',
                                color: embeds_1.Colors.warning,
                            }),
                        ],
                    })
                        .catch(() => { });
                    t.idleWarned = true;
                    await t.save().catch(() => { });
                }
                // 2) إغلاق التذاكر الميتة تماماً
                const toClose = await models_1.Ticket.find({
                    guildId: guild.id,
                    status: { $in: ['open', 'claimed', 'waiting'] },
                    lastActivityAt: { $lt: closeCutoff },
                }).limit(25);
                const me = guild.members.me;
                for (const t of toClose) {
                    if (!me)
                        break;
                    try {
                        await this.closeTicket(t.channelId, me, 'إغلاق تلقائي — عدم نشاط في التذكرة');
                        logger.info(`Auto-closed inactive ticket channel ${t.channelId} in ${guild.name}`);
                    }
                    catch {
                        /* قناة محذوفة أو تذكرة أُغلقت بالتوازي */
                    }
                }
            }
            catch (error) {
                logger.error(`Inactivity sweep failed for guild ${guild.id}:`, error);
            }
        }
    }
    // --------------------------------------------
    // Delete Ticket (Hard Delete)
    // --------------------------------------------
    async deleteTicket(channelId, deletedBy) {
        const ticket = await models_1.Ticket.findOne({ channelId });
        if (!ticket)
            throw new Error('لم يتم العثور على التذكرة');
        const guild = deletedBy.guild;
        const channel = guild.channels.cache.get(channelId);
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
            await channel.delete('Liberty City - Ticket deleted').catch(() => { });
        }
        this.activeTickets.delete(channelId);
        await this.logTicketEvent(guild, 'delete', ticket, deletedBy.user);
        logger.info(`Deleted ticket channel ${channelId}`);
    }
    // --------------------------------------------
    // Claim Ticket
    // --------------------------------------------
    async claimTicket(channelId, claimedBy) {
        const ticket = await models_1.Ticket.findOne({ channelId });
        if (!ticket)
            throw new Error('لم يتم العثور على التذكرة');
        if (ticket.status === 'claimed') {
            const claimer = claimedBy.guild.members.cache.get(ticket.claimedBy);
            throw new Error(`التذكرة مستلمة بالفعل بواسطة ${claimer || 'مشرف آخر'}`);
        }
        ticket.status = 'claimed';
        ticket.claimedBy = claimedBy.id;
        await ticket.save();
        // 📊 تحديث إحصائيات الاستلام لهذا الإداري
        const settings = await (0, models_1.getGuildSettings)(claimedBy.guild.id);
        const currentCount = settings.tickets.claimStats?.get(claimedBy.id) || 0;
        settings.tickets.claimStats.set(claimedBy.id, currentCount + 1);
        await settings.save();
        this.activeTickets.set(channelId, ticket);
        const channel = claimedBy.guild.channels.cache.get(channelId);
        if (channel) {
            // 🔒 قفل التذكرة: الكتابة للمستلم + الأدمن فقط
            await this.applyClaimLock(claimedBy.guild, ticket, channel, claimedBy).catch(err => logger.warn('Failed to apply claim lock:', err));
            // ✅ منح صاحب التذكرة صلاحية الكتابة إن كان القفل مفعّلاً عند الفتح
            if (settings.tickets.lockUntilClaim && ticket.userId !== claimedBy.id) {
                await channel.permissionOverwrites
                    .edit(ticket.userId, {
                    SendMessages: true,
                })
                    .catch(() => { });
            }
            const claimEmbed = (0, embeds_1.createEmbed)({
                title: '🤝 تم استلام التذكرة',
                description: `تم استلام التذكرة بواسطة ${claimedBy}\n\n` +
                    `🔒 **تم قفل التذكرة:** الكتابة للمستلم + الأدمن فقط — بقية فريق الدعم للقراءة فقط.\n` +
                    `📌 لمنح إداري معيّن صلاحية الكتابة اختر **➕ إضافة عضو أو إداري** من قائمة الخيارات.\n\n` +
                    `📊 **إجمالي تذاكرك المستلمة:** \`${currentCount + 1}\``,
                color: embeds_1.Colors.success,
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
    async unclaimTicket(channelId, unclaimedBy) {
        const ticket = await models_1.Ticket.findOne({ channelId });
        if (!ticket)
            throw new Error('لم يتم العثور على التذكرة');
        if (ticket.status !== 'claimed')
            throw new Error('التذكرة غير مستلمة');
        const guild = unclaimedBy.guild;
        const isClaimer = ticket.claimedBy === unclaimedBy.id;
        const canManage = unclaimedBy.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels);
        if (!isClaimer && !canManage) {
            throw new Error('فقط المستلم أو مشرف القنوات يمكنه إلغاء الاستلام');
        }
        const previousClaimer = guild.members.cache.get(ticket.claimedBy);
        ticket.status = 'open';
        ticket.claimedBy = undefined;
        await ticket.save();
        this.activeTickets.set(channelId, ticket);
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
            // 🔓 إلغاء القفل وإرجاع صلاحيات الكتابة لفريق الدعم
            if (ticket.locked) {
                await this.releaseClaimLock(guild, ticket, channel).catch(err => logger.warn('Failed to release claim lock:', err));
            }
            const embed = (0, embeds_1.createEmbed)({
                title: '↩️ تم إلغاء استلام التذكرة',
                description: `تم تحرير التذكرة${previousClaimer ? ` من ${previousClaimer}` : ''}\n` +
                    `تم إلغاء الاستلام بواسطة ${unclaimedBy}\n\n` +
                    `🔓 تم إلغاء القفل — يمكن لفريق الدعم الكتابة مجدداً.\n` +
                    `يمكن لأي مشرف استلامها الآن.`,
                color: embeds_1.Colors.warning,
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
    async applyClaimLock(guild, ticket, channel, claimedBy) {
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        const granted = [];
        // لقطة لحالة كل overwrite قبل تعديله — لنُرجعها كما كانت عند إلغاء القفل
        const snapshots = [];
        const snapshotOverwrite = (id) => {
            const ow = channel.permissionOverwrites.cache.get(id);
            snapshots.push(ow
                ? { id, allow: ow.allow.bitfield.toString(), deny: ow.deny.bitfield.toString(), existed: true }
                : { id, allow: '0', deny: '0', existed: false });
        };
        // 1) منع فريق الدعم من الكتابة (إضافة رفض لصلاحية الإرسال)
        for (const roleId of settings.tickets.supportRoleIds) {
            const role = guild.roles.cache.get(roleId);
            if (!role)
                continue;
            snapshotOverwrite(roleId);
            await channel.permissionOverwrites
                .edit(roleId, { SendMessages: false })
                .catch(() => { });
        }
        // 2) المستلم يكتب دائماً (overwrite عضو يتفوق على رفض الرولات)
        if (claimedBy.id !== ticket.userId) {
            const ow = channel.permissionOverwrites.cache.get(claimedBy.id);
            if (!ow?.allow.has(discord_js_1.PermissionFlagsBits.SendMessages)) {
                snapshotOverwrite(claimedBy.id);
                await channel.permissionOverwrites
                    .edit(claimedBy.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true,
                })
                    .catch(() => { });
                granted.push(claimedBy.id);
            }
        }
        // 3) الإدارة العليا (Administrator فقط) — يمكنهم الكتابة دائماً
        // ⚠️ لا يُمنح صلاحية الكتابة لمن يملك ManageGuild فقط — المستلم فقط + الأدمن
        const adminRoles = guild.roles.cache.filter(r => r.id !== guild.roles.everyone.id &&
            r.permissions.has(discord_js_1.PermissionFlagsBits.Administrator));
        for (const role of adminRoles.values()) {
            for (const [memberId, member] of guild.members.cache) {
                if (granted.includes(memberId))
                    continue;
                if (member.id === ticket.userId)
                    continue; // صاحب التذكرة يملك الوصول أصلاً
                if (member.id === this.client.user?.id)
                    continue; // البوت
                if (!member.roles.cache.has(role.id))
                    continue;
                const ow = channel.permissionOverwrites.cache.get(memberId);
                if (ow?.allow.has(discord_js_1.PermissionFlagsBits.SendMessages))
                    continue; // يملك الكتابة أصلاً
                snapshotOverwrite(memberId);
                await channel.permissionOverwrites
                    .edit(memberId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true,
                })
                    .catch(() => { });
                granted.push(memberId);
            }
        }
        ticket.locked = true;
        ticket.lockGrantedUsers = granted;
        ticket.lockSnapshots = snapshots;
        await ticket.save();
        logger.info(`🔒 Ticket locked: ${ticket.channelId} | claimer=${claimedBy.id} | granted=${granted.length} users | snapshotted=${snapshots.length}`);
    }
    // --------------------------------------------
    // 🔓 إلغاء القفل عند إلغاء الاستلام
    // --------------------------------------------
    async releaseClaimLock(guild, ticket, channel) {
        const snapshots = ticket.lockSnapshots || [];
        for (const snap of snapshots) {
            try {
                if (!snap.existed) {
                    // لم يكن هناك overwrite أصلاً → نحذف ما أنشأه القفل
                    await channel.permissionOverwrites.delete(snap.id);
                    continue;
                }
                // كان هناك overwrite → نُرجعه تماماً كما كان (allow/deny قبل القفل)
                const allow = new discord_js_1.PermissionsBitField(BigInt(snap.allow));
                const deny = new discord_js_1.PermissionsBitField(BigInt(snap.deny));
                const perms = {};
                for (const [name, bit] of Object.entries(discord_js_1.PermissionFlagsBits)) {
                    // true = allow, false = deny, null = إلغاء (غير محدد)
                    perms[name] = allow.has(bit) ? true : deny.has(bit) ? false : null;
                }
                await channel.permissionOverwrites.edit(snap.id, perms);
            }
            catch (err) {
                logger.warn(`Failed to restore overwrite for ${snap.id}:`, err);
            }
        }
        // تراجع آمن للسجلات القديمة: إن لم توجد لقطات، ننظّف يدويًا دون المساس بصاحب التذكرة
        if (snapshots.length === 0) {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            for (const roleId of settings.tickets.supportRoleIds) {
                if (!guild.roles.cache.get(roleId))
                    continue;
                // إزالة رفض الكتابة فقط (null = إلغاء Entrée بدل منح allow)
                await channel.permissionOverwrites
                    .edit(roleId, { SendMessages: null })
                    .catch(() => { });
            }
            for (const userId of ticket.lockGrantedUsers || []) {
                if (userId === ticket.userId)
                    continue;
                await channel.permissionOverwrites.delete(userId).catch(() => { });
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
    async callAdmin(channelId, calledBy) {
        const guild = calledBy.guild;
        const channel = guild.channels.cache.get(channelId);
        if (!channel)
            throw new Error('لم يتم العثور على القناة');
        // Cooldown: 5 minutes per ticket
        const lastCall = this.callCooldowns.get(channelId) || 0;
        if (Date.now() - lastCall < 5 * 60 * 1000) {
            const remaining = Math.ceil((5 * 60 * 1000 - (Date.now() - lastCall)) / 60000);
            throw new Error(`يرجى الانتظار ${remaining} دقيقة قبل طلب استدعاء الإدارة مجدداً`);
        }
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        // منشن الرولات المُعدّدة فقط (رولات الإدارة العليا من الإعدادات)
        // إذا لم تُحدَّد → رولات الدعم فقط (لا كشف تلقائي لأي رول)
        const roleIds = (settings.tickets.adminRoleIds?.length
            ? settings.tickets.adminRoleIds
            : settings.tickets.supportRoleIds);
        const mentions = [];
        for (const roleId of roleIds) {
            const role = guild.roles.cache.get(roleId);
            if (role && role.id !== guild.roles.everyone.id)
                mentions.push(`<@&${role.id}>`);
        }
        const isAdminConfig = (settings.tickets.adminRoleIds?.length || 0) > 0;
        const embed = (0, embeds_1.createEmbed)({
            title: '🔔 استدعاء الإدارة العليا',
            description: `${calledBy} يستدعي الإدارة العليا!\n\n` +
                `يرجى الاطلاع على هذه التذكرة في أقرب وقت.\n` +
                `**القناة:** ${channel}\n` +
                `**المنشور لـ:** ${isAdminConfig ? 'رولات الإدارة العليا المُعدّدة' : 'رولات فريق الدعم'}`,
            color: embeds_1.Colors.warning,
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
    async updateTicketButtons(channel, claimed) {
        try {
            const messages = await channel.messages.fetch({ limit: 10 });
            // Find the last message with components (the ticket action message)
            const actionMessage = messages.find(m => m.components.length > 0 && m.author.id === this.client.user.id);
            if (actionMessage) {
                await actionMessage.edit({ components: this.buildTicketControls(claimed) });
            }
        }
        catch (error) {
            logger.warn('Failed to update ticket buttons:', error);
        }
    }
    // --------------------------------------------
    // Add Member to Ticket
    // --------------------------------------------
    async addMemberToTicket(channelId, member, addedBy) {
        const channel = member.guild.channels.cache.get(channelId);
        if (!channel)
            throw new Error('لم يتم العثور على التذكرة');
        await channel.permissionOverwrites.edit(member.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
        });
        const embed = (0, embeds_1.createEmbed)({
            title: '➕ تمت إضافة عضو',
            description: `تمت إضافة ${member} بواسطة ${addedBy}`,
            color: embeds_1.Colors.info,
            footer: { text: 'Liberty City Tickets' },
        });
        await channel.send({ embeds: [embed] });
    }
    // --------------------------------------------
    // Get Transcript Only
    // --------------------------------------------
    async getTranscript(channelId) {
        const channel = this.client.channels.cache.get(channelId);
        if (!channel)
            throw new Error('لم يتم العثور على القناة');
        return this.generateTranscript(channel);
    }
    // --------------------------------------------
    // Generate Transcript
    // --------------------------------------------
    async generateTranscript(channel) {
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
        }
        catch (error) {
            logger.error('Failed to generate transcript:', error);
            return 'فشل في توليد النسخة';
        }
    }
    // --------------------------------------------
    // Save Transcript
    // --------------------------------------------
    async saveTranscript(guild, ticket, transcript) {
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            if (!settings.tickets.transcriptChannelId)
                return;
            const transcriptChannel = guild.channels.cache.get(settings.tickets.transcriptChannelId);
            if (!transcriptChannel)
                return;
            const user = await this.client.users.fetch(ticket.userId);
            const transcriptEmbed = (0, embeds_1.ticketTranscriptEmbed)({
                ticketId: ticket.channelId.slice(-6),
                user,
                type: ticket.type,
                status: 'closed',
                messages: [],
                closeReason: ticket.closeReason,
            });
            const { AttachmentBuilder } = require('discord.js');
            const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript-${ticket.channelId.slice(-6)}.txt` });
            await transcriptChannel.send({
                embeds: [transcriptEmbed],
                files: [attachment],
            });
        }
        catch (error) {
            logger.error('Failed to save transcript:', error);
        }
    }
    // --------------------------------------------
    // Log Ticket Event
    // --------------------------------------------
    async logTicketEvent(guild, event, ticket, user, reason) {
        try {
            const settings = await (0, models_1.getGuildSettings)(guild.id);
            if (!settings.tickets.logChannelId)
                return;
            const logChannel = guild.channels.cache.get(settings.tickets.logChannelId);
            if (!logChannel)
                return;
            const eventEmojis = {
                create: '➕',
                close: '➖',
                claim: '🤝',
                unclaim: '↩️',
                delete: '🗑️',
                call: '🔔',
                add_member: '👤',
            };
            const eventNames = {
                create: 'إنشاء',
                close: 'إغلاق',
                claim: 'استلام',
                unclaim: 'إلغاء استلام',
                delete: 'حذف',
                call: 'استدعاء إدارة',
                add_member: 'إضافة عضو',
            };
            const logEmbed = (0, embeds_1.createEmbed)({
                title: `${eventEmojis[event] || '📌'} ${eventNames[event] || event} تذكرة`,
                color: event === 'close' || event === 'delete' ? embeds_1.Colors.error : embeds_1.Colors.success,
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
            // Also send to LoggingHandler for ticket event tracking
            const libertyClient = this.client; // LibertyClient
            const loggingHandler = libertyClient.loggingHandler;
            if (loggingHandler) {
                const map = {
                    create: 'ticketCreate',
                    close: 'ticketClose',
                    claim: 'ticketClaim',
                    delete: 'ticketDelete',
                    unclaim: 'ticketReopen',
                    call_admin: 'ticketTransfer', // closest match
                    add_member: 'ticketAddUser',
                };
                const logEvent = map[event];
                if (logEvent) {
                    const ticketData = {
                        guild,
                        channel: { id: ticket.channelId },
                        creator: user,
                        panelName: 'Ticket',
                        closer: user,
                        reason: reason,
                        transcriptUrl: undefined,
                        reopener: user,
                        deleter: user,
                        claimer: user,
                        from: user,
                        to: user,
                        adder: user,
                        added: user,
                        removed: user,
                    };
                    // Call the appropriate handler
                    if (logEvent === 'ticketCreate')
                        loggingHandler.handleTicketCreate({ guild, channel: { id: ticket.channelId }, creator: user });
                    else if (logEvent === 'ticketClose')
                        loggingHandler.handleTicketClose({ guild, channel: { id: ticket.channelId }, closer: user, reason });
                    else if (logEvent === 'ticketReopen')
                        loggingHandler.handleTicketReopen({ guild, channel: { id: ticket.channelId }, reopener: user });
                    else if (logEvent === 'ticketDelete')
                        loggingHandler.handleTicketDelete({ guild, channelId: ticket.channelId, deleter: user });
                    else if (logEvent === 'ticketClaim')
                        loggingHandler.handleTicketClaim({ guild, channel: { id: ticket.channelId }, claimer: user });
                }
            }
        }
        catch (error) {
            logger.error('Failed to log ticket event:', error);
        }
    }
    // --------------------------------------------
    // Create Ticket Panel
    // يستبدل اللوحة السابقة (لوحة واحدة فقط لكل سيرفر)
    // ويرث العنوان/الوصف/الأنواع/الصورة من اللوحة الحالية إن لم تمرَّر
    // --------------------------------------------
    async createPanel(guild, channel, panelData) {
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        const oldPanelsCount = settings.tickets.panels.length;
        const previous = oldPanelsCount > 0 ? settings.tickets.panels[oldPanelsCount - 1] : null;
        // الوراثة: الأنواع والصورة من اللوحة السابقة إن لم تُحدَّد صراحة
        const options = panelData.options && panelData.options.length > 0
            ? panelData.options
            : previous?.options?.length
                ? previous.options
                : undefined;
        const image = panelData.image ?? previous?.image ?? undefined;
        const panelId = (0, helpers_2.generateNumericId)(4);
        const panel = {
            ...panelData,
            options,
            image,
            id: panelId,
            channelId: channel.id,
            supportRoleIds: panelData.supportRoleIds && panelData.supportRoleIds.length > 0
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
                    const oldMsg = await oldChannel.messages
                        .fetch(old.messageId)
                        .catch(() => null);
                    if (oldMsg)
                        await oldMsg.delete().catch(() => { });
                }
            }
        }
        settings.tickets.panels = [panel];
        await settings.save();
        logger.info(`Created ticket panel ${panelId} in ${channel.name}` +
            (oldPanelsCount > 0 ? ` (replaced ${oldPanelsCount} old panel(s))` : ''));
        return { panel, messageId: message.id };
    }
    // --------------------------------------------
    // الأنواع المعروضة في اللوحة (المخصصة أو الافتراضية)
    // --------------------------------------------
    getPanelTypes(panel) {
        if (panel.options && panel.options.length > 0)
            return panel.options;
        if (panel.fields && panel.fields.length > 0) {
            return panel.fields.map(f => ({
                label: f.label,
                description: f.placeholder,
                emoji: '🎫',
            }));
        }
        return exports.DEFAULT_TICKET_TYPES;
    }
    // --------------------------------------------
    // بناء إمبد اللوحة (مشترك: إنشاء / تعديل / نقل)
    // --------------------------------------------
    buildPanelEmbed(panel) {
        const types = this.getPanelTypes(panel).slice(0, 25);
        const typeList = types
            .map(o => `> • ${o.emoji || '🎫'} **${o.label}**${o.description ? ` — ${o.description}` : ''}`)
            .join('\n');
        return (0, embeds_1.createEmbed)({
            title: `${panel.emoji || '🎫'} ${panel.name || 'تذاكر الدعم'}`,
            description: `${panel.description || 'افتح تذكرة جديدة وسيقوم فريق الدعم بالرد عليك في أقرب وقت 💬'}\n\n` +
                `📋 **اختر نوع التذكرة من القائمة بالأسفل** — سيُفتح التذكرة بنفس الاسم:\n` +
                `${typeList}`,
            image: panel.image || undefined,
            color: embeds_1.Colors.primary,
            footer: { text: 'Liberty City Tickets' },
            timestamp: true,
        });
    }
    // --------------------------------------------
    // بناء مكوّنات اللوحة: قائمة الأنواع + زر تذكرة عامة
    // --------------------------------------------
    buildPanelComponents(panel) {
        const seen = new Set();
        const options = [];
        for (const o of this.getPanelTypes(panel)) {
            const label = (o.label || '').trim().substring(0, 100);
            if (!label || seen.has(label))
                continue; // قيم مكررة ترفضها Discord
            seen.add(label);
            options.push({
                label,
                description: (o.description || '').trim().substring(0, 100) || undefined,
                value: label, // اسم النوع = قيمة الاختيار = اسم قناة التذكرة
                emoji: (o.emoji || '').trim() || undefined,
            });
            if (options.length >= 25)
                break;
        }
        if (options.length === 0) {
            for (const o of exports.DEFAULT_TICKET_TYPES) {
                options.push({ label: o.label, description: o.description, value: o.label, emoji: o.emoji });
            }
        }
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId(`ticket_select_${panel.id}`)
            .setPlaceholder('🎫 اختر نوع التذكرة')
            .addOptions(options);
        const selectRow = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
        // زر "إعادة تعيين الطلب" — يحذف تذكرتك المفتوحة حتى تتمكن من فتح تذكرة جديدة
        const resetBtn = new discord_js_1.ButtonBuilder()
            .setCustomId('ticket_reset')
            .setLabel('إعادة تعيين الطلب')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🔄');
        const buttonRow = new discord_js_1.ActionRowBuilder().addComponents(resetBtn);
        return [selectRow, buttonRow];
    }
    // --------------------------------------------
    // تحديث رسالة لوحة موجودة بعد تعديل محتواها
    // --------------------------------------------
    async updatePanelMessage(guild, panel) {
        if (!panel || !panel.messageId || !panel.channelId)
            return;
        const channel = guild.channels.cache.get(panel.channelId);
        if (!channel || !('messages' in channel))
            return;
        const message = await channel.messages
            .fetch(panel.messageId)
            .catch(() => null);
        if (!message)
            return;
        await message
            .edit({
            embeds: [this.buildPanelEmbed(panel)],
            components: this.buildPanelComponents(panel),
        })
            .catch(() => { });
    }
    // --------------------------------------------
    // نقل لوحة إلى قناة أخرى (حذف القديمة + إرسال جديدة)
    // --------------------------------------------
    async movePanel(guild, panel, newChannel) {
        // حذف الرسالة القديمة إن وُجدت
        if (panel.messageId && panel.channelId) {
            const oldChannel = guild.channels.cache.get(panel.channelId);
            if (oldChannel && 'messages' in oldChannel) {
                const oldMessage = await oldChannel.messages
                    .fetch(panel.messageId)
                    .catch(() => null);
                if (oldMessage)
                    await oldMessage.delete().catch(() => { });
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
    getActiveTickets(guildId) {
        return models_1.Ticket.find({
            guildId,
            status: { $in: ['open', 'claimed', 'waiting'] },
        });
    }
    // --------------------------------------------
    // Get User Tickets
    // --------------------------------------------
    getUserTickets(guildId, userId) {
        return models_1.Ticket.find({
            guildId,
            userId,
            status: { $in: ['open', 'claimed', 'waiting'] },
        });
    }
    // --------------------------------------------
    // Get Ticket Stats
    // --------------------------------------------
    async getTicketStats(guildId) {
        const [total, open, claimed, closed, waiting] = await Promise.all([
            models_1.Ticket.countDocuments({ guildId }),
            models_1.Ticket.countDocuments({ guildId, status: 'open' }),
            models_1.Ticket.countDocuments({ guildId, status: 'claimed' }),
            models_1.Ticket.countDocuments({ guildId, status: 'closed' }),
            models_1.Ticket.countDocuments({ guildId, status: 'waiting' }),
        ]);
        return { total, open, claimed, closed, waiting };
    }
    // --------------------------------------------
    // Cleanup
    // --------------------------------------------
    cleanup() {
        this.activeTickets.clear();
        this.callCooldowns.clear();
    }
}
exports.TicketHandler = TicketHandler;
exports.default = TicketHandler;
//# sourceMappingURL=TicketHandler.js.map