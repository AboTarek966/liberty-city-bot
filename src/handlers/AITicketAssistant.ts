// ============================================
// Omni Bot - AI Ticket Assistant
// ============================================
// الـ AI يستلم التذكرة، يحلل المشكلة، يحاول يحلها
// ويتابع محادثة صاحب التذكرة ويرد على رسائله الجديدة
// لو محتاج يعطي رول → يطلب موافقة أدمن أولاً
// لو فشل → يمنشن الإدارة العليا + يلخص المشكلة
//
// الموافقات محفوظة في MongoDB (AITicketApproval) — لا تضيع عند
// إعادة تشغيل البوت، وتُحترم إعدادات:
//   confidenceThreshold · maxAutoActionsPerTicket
//   requireAdminApprovalForRoles/Permissions/Bans
//   notifyAdminsOnFailure · logChannel

import {
  TextChannel,
  Guild,
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { randomUUID } from 'crypto';
import { OmniClient } from '../OmniClient';
import { getGuildSettings, KnowledgeEntry, AITicketApproval, IAITicketApproval } from '../models';
import { createLogger } from '../utils/helpers';
import { securityAlertsSilent } from '../utils/securityAlerts';
import { tokenize, invalidateKnowledgeCache } from '../utils/knowledge';
import { Colors } from '../utils/embeds';
import {
  TicketAction,
  ActionContext,
  actionNeedsApproval,
  executeTicketAction,
  normalizeId,
} from '../utils/aiTicketActions';

const logger = createLogger('AITicketAssistant');

const APPROVAL_TTL_MS = 15 * 60 * 1000;

export interface TicketAnalysis {
  category: 'technical' | 'billing' | 'complaint' | 'inquiry' | 'protection' | 'roles' | 'channels' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  suggestedSolution: string;
  needsAdminAction: boolean;
  requiredActions: RequiredAction[];
  confidence: number;
}

export type RequiredAction = TicketAction;

export interface AdminApprovalRequest {
  ticketId: string;
  channelId: string;
  action: RequiredAction;
  requestedBy: 'ai';
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface AdminResponseResult {
  ok: boolean;
  message: string;
}

interface AITicketConfig {
  enabled?: boolean;
  autoClaim?: boolean;
  analyzeOnCreate?: boolean;
  replyToMessages?: boolean;
  /** 🧠 التعلّم التلقائي من التذاكر المغلقة (افتراضي: مفعّل) */
  learnFromTickets?: boolean;
  /** 🎭 شخصية/تعليمات مخصصة لمساعد التذاكر — يلتزم بها حرفياً */
  customPersonality?: string;
  requireAdminApprovalForRoles?: boolean;
  requireAdminApprovalForPermissions?: boolean;
  requireAdminApprovalForBans?: boolean;
  maxAutoActionsPerTicket?: number;
  confidenceThreshold?: number;
  notifyAdminsOnFailure?: boolean;
  logChannel?: string;
}

export class AITicketAssistant {
  private client: OmniClient;
  /** 🛡️ منع ردّين متزامنين على نفس التذكرة عند وصول رسائل سريعة */
  private ticketReplyInFlight = new Set<string>();
  /** ⏳ فترة سماح بعد الرد الأولي حتى لا يردّ AI مرتين على نفس التذكرة */
  private ticketAutoCooldown = new Map<string, number>();

  constructor(client: OmniClient) {
    this.client = client;
  }

  // --------------------------------------------
  // إعدادات المساعد — تقرأ من protection أولاً ثم الجذر
  // --------------------------------------------
  private async getConfig(guildId: string): Promise<AITicketConfig | null> {
    const settings = await getGuildSettings(guildId);

    // 🔓 مساعد التذاكر مستقل تماماً عن مفتاح الذكاء العام — له مفتاحه الخاص
    const config =
      (settings as any).protection?.aiTicketAssistant ?? (settings as any).aiTicketAssistant;
    return config || null;
  }

  // --------------------------------------------
  // 🎭 كتلة الشخصية المخصصة — تعليمات السيرفر لمساعد التذاكر
  // تُحقن في كل مطالبة (رد أولي، ردود المتابعة، التحليل) وتُقدَّم على أي تعليمات أسلوب أخرى
  // --------------------------------------------
  private personaBlock(config?: AITicketConfig | null): string {
    const persona = String(config?.customPersonality || '').trim();
    if (!persona) return '';
    return (
      `\n\n**🎭 شخصية وتعليمات السيرفر المخصصة لمساعد التذاكر — التزم بها حرفياً ولا تخالفها مهما حدث (لها الأولوية على أي تعليمات أسلوب أخرى):**\n` +
      `${persona.slice(0, 2000)}\n`
    );
  }

  // --------------------------------------------
  // نقطة الدخول: عند فتح تذكرة جديدة
  // --------------------------------------------
  async onTicketCreated(ticket: any, channel: TextChannel): Promise<void> {
    try {
      const aiConfig = await this.getConfig(channel.guild.id);
      if (!aiConfig?.enabled) return;

      // 🤖 استلام التذكرة تلقائياً
      if (aiConfig.autoClaim) {
        try {
          await this.claimTicket(channel, ticket);
        } catch (error: any) {
          logger.warn(`Auto-claim failed: ${error.message}`);
        }
      }

      // ⚙️ خيار "تحليل عند الإنشاء" مستقل عن الاستلام التلقائي
      //    لو معطّل: يستلم التذكرة فقط ولا يحللها ولا يرد تلقائياً
      if (aiConfig.analyzeOnCreate === false) return;

      // قراءة الرسالة الأولى في التذكرة
      const messages = await channel.messages.fetch({ limit: 10 });
      let firstUserMessage: any = [...messages.values()]
        .reverse()
        .find(m => !m.author.bot && m.author.id !== this.client.user?.id);

      // لو التذكرة أُنشئت من نموذج (بدون رسالة من العضو) → نستخدم وصف التذكرة
      if (!firstUserMessage) {
        const description =
          String(ticket.subject || '').trim() ||
          (Array.isArray(ticket.fields)
            ? ticket.fields
                .map((f: any) => `${f.question || 'سؤال'}: ${f.answer || '—'}`)
                .join('\n')
            : '');

        if (!description.trim()) {
          logger.debug(`Ticket ${ticket._id} has no user message or description — skipping AI analysis`);
          return;
        }

        const user = await this.client.users.fetch(ticket.userId).catch(() => null);
        if (!user) return;

        firstUserMessage = {
          content: description,
          author: user,
          channel,
          attachments: new Map(),
        };
      }

      // 🤖 رد أولي فوري
      await this.sendAutoResponse(channel, firstUserMessage, ticket, aiConfig);
      // فترة سماح: لو العضو كتب رسالة تانية بسرعة، التحليل أو الرد الأولي يغطيها
      this.ticketAutoCooldown.set(channel.id, Date.now() + 8000);
      const cooldownTimer = setTimeout(() => this.ticketAutoCooldown.delete(channel.id), 9000);
      cooldownTimer.unref?.();

      // تحليل المشكلة
      const analysis = await this.analyzeTicket(firstUserMessage, channel.guild, ticket, aiConfig);

      // تنفيذ الحل المقترح
      await this.executeSolution(ticket, channel, analysis, aiConfig);
    } catch (error: any) {
      logger.error(`AITicketAssistant onTicketCreated error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // 💬 متابعة محادثة التذكرة — يرد على رسائل صاحب التذكرة
  // --------------------------------------------
  // --------------------------------------------
  // 🔒 كشف طلب إغلاق/قفل التذكرة من رسالة صاحب التذكرة/الإدارة
  //    مثال: "قفل تكت" / "أقفّل التذكرة" / "أغلق التكت شكراً"
  //    التنفيذ يكون على القناة الحالية — ولا حاجة لأي ID
  // --------------------------------------------
  private isCloseIntent(content: string): boolean {
    const text = content.toLowerCase().trim();
    // نفي ("لا تُقفل" / "متقفلش") → نترك للـ AI العادي
    if (/(لا\s*(ت?تقفل|ت?ت?غلق|ت?نها|ت?تنهي)|متقفلش|ماتقفلش|don'?t\s+close)/i.test(text)) return false;
    const hasCloseWord = /(اق?فل|قف?ل|اق?فلها?|ا?غلق|ا?غلقها?|انهي|انهِ?ي|ا?نهها?|انهاء|إنهاء)/i.test(text);
    const hasTicketWord = /(تكت|تذكرة|تذكره|ticket|تذكر)/i.test(text);
    return hasCloseWord && hasTicketWord;
  }

  async onTicketMessage(ticket: any, channel: TextChannel, message: Message): Promise<void> {
    try {
      if (!message.content.trim() && message.attachments.size === 0) return;
      if (['closed', 'deleted'].includes(String(ticket.status))) return;

      // 🔒 طلب قفل/إغلاق التذكرة من داخل التذكرة نفسها — أي مسؤول/صاحب التذكرة يقدر يطلبها (بدون ID)
      if (this.isCloseIntent(message.content || '')) {
        const member = message.member;
        const guild = channel.guild;
        const settings = await getGuildSettings(guild.id).catch(() => null);
        const isSupport = !!settings?.tickets?.supportRoleIds?.some((r: string) => member?.roles.cache.has(r));
        const isAdminRole = !!settings?.tickets?.adminRoleIds?.some((r: string) => member?.roles.cache.has(r));
        const isCreator = String(ticket.userId) === message.author.id;
        const canClose =
          isCreator ||
          isSupport ||
          isAdminRole ||
          member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
          member?.permissions.has(PermissionFlagsBits.Administrator);

        if (!canClose) {
          await message.reply({ content: '❌ ليس لديك صلاحية لإغلاق هذه التذكرة — يملكها فريق الدعم أو صاحب التذكرة فقط.' }).catch(() => {});
          return;
        }

        try {
          await message.reply({ content: '🔒 **جارٍ إغلاق التذكرة والقناة الحالية...**' }).catch(() => {});
          await (this.client as any).ticketHandler.closeTicket(
            channel.id,
            member,
            'إغلاق عبر طلب العضو/الإدارة من داخل التذكرة'
          );
        } catch (error: any) {
          logger.warn(`AI close ticket failed: ${error?.message || error}`);
          await (channel as any).send({ content: `❌ تعذّر إغلاق التذكرة: ${error?.message || 'خطأ غير معروف'}` }).catch(() => {});
        }
        return;
      }

      // من يتحدث الآن؟ صاحب التذكرة؟ الإدارة/المدّعي؟
      const settings = await getGuildSettings(channel.guild.id).catch(() => null);
      const member = message.member;
      const isOwner = String(ticket.userId) === message.author.id;
      const isClaimer = !!ticket.claimedBy && String(ticket.claimedBy) === message.author.id;
      const isStaff =
        !!settings?.tickets?.supportRoleIds?.some((r: string) => member?.roles.cache.has(r)) ||
        !!settings?.tickets?.adminRoleIds?.some((r: string) => member?.roles.cache.has(r)) ||
        !!member?.permissions.has(PermissionFlagsBits.ManageChannels) ||
        !!member?.permissions.has(PermissionFlagsBits.Administrator);
      // الـ AI يرد على صاحب التذكرة + الإدارة/المدّعي (طرد الناس اللي مش ذات صلة)
      if (!isOwner && !isClaimer && !isStaff) return;

      // لو إداري بشري استلم التذكرة → الـ AI يسكت أمام صاحب التذكرة فقط (يستلمها بشرياً)
      if (isOwner && ticket.claimedBy && ticket.claimedBy !== this.client.user?.id) return;

      const aiConfig = await this.getConfig(channel.guild.id);
      if (!aiConfig?.enabled) return;
      if (aiConfig.replyToMessages === false) return;

      // لو لسه في فترة الرد الأولي/التحليل → ما نكررش الرد
      const autoUntil = this.ticketAutoCooldown.get(channel.id) || 0;
      if (Date.now() < autoUntil) return;

      // منع ردّين متزامنين لنفس التذكرة
      if (this.ticketReplyInFlight.has(channel.id)) return;
      this.ticketReplyInFlight.add(channel.id);

      try {
        const recent = await channel.messages.fetch({ limit: 20 });
        const transcript = [...recent.values()]
          .reverse()
          .filter(m => m.content.trim())
          .map(m => {
            const who =
              m.author.id === this.client.user?.id
                ? 'المساعد'
                : m.author.bot
                  ? 'بوت'
                  : m.author.id === String(ticket.userId)
                    ? 'صاحب التذكرة'
                    : 'الإدارة';
            return `${who}: ${m.content.replace(/\s+/g, ' ').slice(0, 700)}`;
          })
          .slice(-14)
          .join('\n');

        const attachments = [...message.attachments.values()]
          .map(a => a.name)
          .filter(Boolean)
          .join(', ');

        const speakerRole = isOwner ? 'صاحب التذكرة' : isClaimer ? 'الإدارة (مستلم التذكرة)' : 'الإدارة/فريق الدعم';

        const prompt = `أنت مساعد الدعم الذكي داخل تذكرة Discord في سيرفر "${channel.guild.name}".
هذه محادثة التذكرة (الأحدث في الأسفل):
${transcript || 'لا توجد رسائل سابقة'}

رسالة المتحدث (${speakerRole}) الجديدة:
"${message.content || '(مرفق بدون نص)'}"
${attachments ? `المرفقات: ${attachments}` : ''}

${isOwner
  ? `أنت تتكلم مع صاحب التذكرة:
- جاوب على سؤاله/استفساره مباشرة بخطوات عملية.
- لو المشكلة تحتاج صلاحية أو إجراء إداري، قل له إنه سيتم تحويلها للإدارة.
- إذا أساء العضو (شتم/إهانة)، اطلب منه التوقف بأسلوب محترم وحذّره من الإجراءات بعد موافقة الإدارة.
- لا تخترع معلومات ولا تكرر الترحيب إذا كانت المحادثة مستمرة.
- لا تذكر أنك نموذج ذكاء اصطناعي إلا لو سألك.
- كن مختصراً (1-6 جمل).`
  : `أنت تتكلم مع الإدارة/المدّعي داخل تذكرتهم — مهمتك مساعدته كاملاً في مهام التذكرة:
- لخّصله المشكلة (Categorization) أو جواب جاهز على العضو لو طلب ذلك.
- اكتب رد للعضو فوراً لو قال "رد ده على العضو" أو "اكتب له...".
- أعطه كل التفاصيل: سبب المشكلة + الحل المقترح + الخطوات.
- أعطه معلومات التذكرة (الرقم/النوع/المواضيع) لو سأل.
- قل له إن يعرف أمر «قفل تكت» داخل التذكرة لو أراد إغلاقها من جهته مباشرة.
- لا تذكر أبداً أنك لا تستطيع إغلاق/نقل/تروس التذكرة — لو سأل عن فعل تستطيع إخباره بالأوامر المتاحة: "قفل تكت" للإغلاق.
- كن مختصراً وعملياً — 1-6 جمل. لا تخترع معلومات خارج سياق التذكرة.
- لا تذكر أنك نموذج ذكاء اصطناعي إلا لو سألك.`}
${this.personaBlock(aiConfig)}

ردك:`;

        if ('sendTyping' in channel) {
          await (channel as any).sendTyping().catch(() => {});
        }

        const response = await this.client.aiHandler.generateResponse(
          `ticket-ai:chat:${String(ticket._id)}`,
          channel.guild.id,
          channel.id,
          prompt,
          [],
          false,
          false,
          { fromCommand: true, ignoreGlobalToggle: true }
        );

        const content = response?.content?.trim().slice(0, 1900);
        if (!content) return;

        await message
          .reply({ content, allowedMentions: { parse: [], repliedUser: false } })
          .catch(async () => {
            await channel.send({ content }).catch(() => {});
          });

        logger.info(`AI ticket follow-up reply in ${channel.guild.name}`);
      } finally {
        this.ticketReplyInFlight.delete(channel.id);
      }
    } catch (error: any) {
      logger.warn(`AI ticket follow-up failed: ${error.message}`);
    }
  }

  // --------------------------------------------
  // Auto-claim ticket
  // --------------------------------------------
  private async claimTicket(channel: TextChannel, ticket: any): Promise<void> {
    try {
      if (ticket.claimedBy) {
        logger.debug(`Ticket ${ticket._id} already claimed`);
        return;
      }

      const { Ticket } = await import('../models');
      await Ticket.findByIdAndUpdate(ticket._id, {
        claimedBy: this.client.user?.id,
        claimedAt: new Date(),
        status: 'claimed',
      });

      // 🔓 استلام AI مش زي استلام إداري: لازم نفتح الكتابة لصاحب التذكرة وفريق الدعم
      //    وإلا التذكرة تتقفل على البوت ومحدش يقدر يرد غيره
      try {
        const settings = await getGuildSettings(channel.guild.id);
        const permissionJobs: Promise<unknown>[] = [];
        if (settings.tickets?.lockUntilClaim && ticket.userId) {
          permissionJobs.push(
            channel.permissionOverwrites
              .edit(String(ticket.userId), { SendMessages: true })
              .catch(() => {})
          );
        }
        for (const roleId of settings.tickets?.supportRoleIds || []) {
          permissionJobs.push(
            channel.permissionOverwrites
              .edit(roleId, { SendMessages: true })
              .catch(() => {})
          );
        }
        await Promise.allSettled(permissionJobs);
      } catch (error: any) {
        logger.warn(`AI claim permission update failed: ${error.message}`);
      }

      const embed = new EmbedBuilder()
        .setTitle('🤖 AI Assistant — استلام التذكرة')
        .setDescription('تم استلام التذكرة تلقائياً بواسطة الذكاء الاصطناعي. جاري تحليل المشكلة...')
        .setColor(0x5865f2)
        .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant` })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
      // 🤖 تحديث الأزرار: استلام من البوت + إلغاء استلام البوت (للمسؤول فقط)
      await this.client.ticketHandler.updateTicketButtons(channel, true, true).catch(() => {});
      logger.info(`AI auto-claimed ticket in ${channel.guild.name}`);
    } catch (error: any) {
      logger.error(`Auto-claim error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // Auto-response when ticket is created
  // --------------------------------------------
  private async sendAutoResponse(
    channel: TextChannel,
    firstMessage: any,
    ticket: any,
    aiConfig?: AITicketConfig | null
  ): Promise<void> {
    try {
      const prompt = `أنت مساعد دعم ذكي في سيرفر Discord "${channel.guild.name}".

صاحب التذكرة: ${firstMessage.author.tag} (${firstMessage.author.id})
رقم التذكرة: ${ticket.ticketNumber || ticket._id}

مستخدم فتح تذكرة وكتب:
"${firstMessage.content}"

رد رداً أولياً ودوداً باللغة العربية:
- رحب به
- أكد استلام التذكرة
- قل إنك ستحلل المشكلة وترد بالحل
- لا تبالغ في الوعود
- كن مختصراً وودوداً
${this.personaBlock(aiConfig)}

ردك:`;

      const response = await this.client.aiHandler.generateResponse(
        `ticket-ai:reply:${String(ticket._id)}`,
        channel.guild.id,
        channel.id,
        prompt,
        [],
        false,
        false,
        { fromCommand: true, ignoreGlobalToggle: true }
      );

      if (response?.content) {
        const embed = new EmbedBuilder()
          .setTitle('🤖 AI Assistant — رد أولي')
          .setDescription(response.content.slice(0, 4000))
          .setColor(0x5865f2)
          .setFooter({ text: `${channel.guild.name} • AI • جاري تحليل المشكلة...` })
          .setTimestamp();

        await channel.send({ embeds: [embed] }).catch(() => {});
        logger.info(`AI auto-response sent in ${channel.guild.name}`);
      }
    } catch (error: any) {
      logger.warn(`Auto-response failed: ${error.message}`);
    }
  }

  // --------------------------------------------
  // تحليل التذكرة بالـ AI
  // --------------------------------------------
  private async analyzeTicket(
    message: any,
    guild: Guild,
    ticket: any,
    aiConfig?: AITicketConfig | null
  ): Promise<TicketAnalysis> {
    const context = `
السيرفر: ${guild.name} (${guild.id})
صاحب التذكرة: ${message.author.tag} (${message.author.id})
رقم التذكرة: ${ticket.ticketNumber || ticket._id}
معرّف التذكرة في قاعدة البيانات: ${ticket._id}
قناة التذكرة: ${message.channel.id}
محتوى التذكرة: "${message.content}"
المرفقات: ${message.attachments?.size > 0 ? [...message.attachments.values()].map((a: any) => a.name).join(', ') : 'لا توجد'}
    `.trim();

    const prompt = `أنت مساعد دعم تقني ذكي (AI Ticket Assistant) في بوت Omni.

**السياق:**
${context}

**مهمتك:** حلّل المشكلة وصنفها، واقترح حل، وحدد لو محتاج إجراء إداري.

**التصنيفات المحتملة:**
- technical: مشاكل تقنية، أخطاء، بوت لا يعمل
- billing: اشتراكات، مدفوعات، عملات
- complaint: شكوى من عضو/إدارة
- inquiry: استفسار عام، كيف أعمل كذا
- protection: إعدادات الحماية، أنتينوك، سبام
- roles: مشاكل رولات، صلاحيات
- channels: مشاكل قنوات، صلاحيات قنوات
- other: غير ذلك

**الإجراءات المحتملة (لو محتاجة):**
- give_role: إعطاء رول لعضو
- remove_role: إزالة رول من عضو
- create_channel: إنشاء قناة
- modify_permissions: تعديل صلاحيات
- check_settings: فحص إعدادات معينة
- restore_backup: استعادة من نسخة احتياطية
- ban_user: حظر عضو
- timeout_user: كتم عضو
- close_ticket: إغلاق التذكرة (فقط إذا تم حل المشكلة فعلاً)
- custom: إجراء مخصص

**الإشراف (مهم جداً):**
- إذا أساء العضو (شتم، تهديد، إهانة، سبام، تحرش) → استخدم timeout_user (10-30 دقيقة) أو ban_user (للإساءة المتكررة/الخطيرة).
- targetUserId يجب أن يكون معرّف صاحب التذكرة (${message.author.id}) unless specified.
- أي إجراء إشرافي = requiresAdminApproval: true (لا تنفّذه تلقائياً).
- اشرح للمستخدم أن الإساءة غير مقبولة وستُحوّل للإدارة.
- لا تحظر/تكمت بدون سبب واضح.

**قواعد صارمة:**
- أي إجراء يعطي رول/يعدل صلاحيات/يحظر/يغلق = requiresAdminApproval: true
- الإجراءات المعلوماتية (فحص، استشارة) = requiresAdminApproval: false
- close_ticket: أضفه فقط إذا تم حل المشكلة وليست هناك حاجة لمتابعة. requiresAdminApproval: true.
- استخدم دائماً معرّفات Discord الرقمية (targetUserId / targetRoleId) من السياق — لا تكتب أسماء أو منشن.
- صاحب التذكرة هو المستخدم الافتراضي لأي إجراء عليه (targetUserId = ${message.author.id}).
- لو مش متأكد → needsAdminAction: true وقلل confidence.
- لا تخترع إجراءات غير مطلوبة فعلاً.
${this.personaBlock(aiConfig)}

**أجب بـ JSON فقط:**
{
  "category": "technical|billing|complaint|inquiry|protection|roles|channels|other",
  "severity": "low|medium|high|critical",
  "summary": "وصف مختصر للمشكلة (سطر واحد)",
  "suggestedSolution": "الحل المقترح خطوة بخطوة",
  "needsAdminAction": boolean,
  "requiredActions": [
    {
      "type": "give_role|remove_role|create_channel|modify_permissions|check_settings|restore_backup|ban_user|timeout_user|custom",
      "description": "وصف الإجراء",
      "params": {},
      "requiresAdminApproval": boolean,
      "targetUserId": "string|null",
      "targetRoleId": "string|null"
    }
  ],
  "confidence": 0-100
}`;

    try {
      const response = await this.client.aiHandler.generateResponse(
        `ticket-ai:analysis:${String(ticket._id)}`,
        guild.id,
        message.channel.id,
        prompt,
        [],
        false,
        false,
        { fromCommand: true, ignoreGlobalToggle: true }
      );

      if (!response?.content) {
        return this.getDefaultAnalysis();
      }

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.getDefaultAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);
      const rawActions = Array.isArray(parsed.requiredActions) ? parsed.requiredActions : [];

      const requiredActions: RequiredAction[] = rawActions
        .filter((item: any) => item && typeof item === 'object' && item.type)
        .slice(0, 10)
        .map((item: any) => ({
          type: item.type,
          description: String(item.description || item.type).slice(0, 500),
          params: item.params && typeof item.params === 'object' ? item.params : {},
          requiresAdminApproval: Boolean(item.requiresAdminApproval),
          targetUserId: normalizeId(item.targetUserId),
          targetRoleId: normalizeId(item.targetRoleId),
        }));

      const confidence = Number(parsed.confidence);
      return {
        category: parsed.category || 'other',
        severity: parsed.severity || 'medium',
        summary: String(parsed.summary || 'مشكلة غير محددة').slice(0, 1000),
        suggestedSolution: String(parsed.suggestedSolution || 'جارٍ المراجعة...').slice(0, 2000),
        needsAdminAction: parsed.needsAdminAction ?? true,
        requiredActions,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 50,
      };
    } catch (error: any) {
      logger.error(`AI Ticket analysis error: ${error.message}`);
      return this.getDefaultAnalysis();
    }
  }

  private getDefaultAnalysis(): TicketAnalysis {
    return {
      category: 'other',
      severity: 'medium',
      summary: 'تحليل آلي غير متاح',
      suggestedSolution: 'سيتولى فريق الدعم المراجعة يدوياً',
      needsAdminAction: true,
      requiredActions: [],
      confidence: 0,
    };
  }

  // --------------------------------------------
  // تنفيذ الحل
  // --------------------------------------------
  private async executeSolution(
    ticket: any,
    channel: TextChannel,
    analysis: TicketAnalysis,
    aiConfig: AITicketConfig
  ): Promise<void> {
    const guild = channel.guild;
    const threshold = Math.max(0, Math.min(100, Number(aiConfig.confidenceThreshold ?? 70)));
    const maxAuto = Math.max(0, Math.trunc(Number(aiConfig.maxAutoActionsPerTicket ?? 3)));
    const lowConfidence = analysis.confidence < threshold;

    // 1️⃣ رد بالتحليل والحل المقترح
    const initialEmbed = new EmbedBuilder()
      .setTitle('🤖 AI Ticket Assistant — تحليل التذكرة')
      .setColor(
        analysis.severity === 'critical'
          ? Colors.error
          : analysis.severity === 'high'
            ? Colors.warning
            : Colors.info
      )
      .addFields(
        { name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true },
        { name: '⚡ الخطورة', value: analysis.severity, inline: true },
        { name: '🎯 الثقة', value: `${analysis.confidence}% (الحد ${threshold}%)`, inline: true },
        { name: '📋 الملخص', value: analysis.summary || '—', inline: false },
        { name: '💡 الحل المقترح', value: analysis.suggestedSolution || '—', inline: false }
      )
      .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant` })
      .setTimestamp();

    const loggedAnalysis = await this.sendToTicketLog(channel, initialEmbed, aiConfig);
    // 🤫 التحليل كاملاً في اللوق فقط — لا رسائل تشويش داخل التذكرة
    await this.sendToTicketLog(channel, initialEmbed, aiConfig);

    const context: ActionContext = {
      ticketUserId: normalizeId(ticket.userId),
      ticketChannelId: channel.id,
    };

    // 2️⃣ تقسيم الإجراءات: تلقائي مقابل موافقة
    const autoActions: RequiredAction[] = [];
    const approvalActions: RequiredAction[] = [];
    let autoCount = 0;

    for (const action of analysis.requiredActions) {
      const needsApproval = actionNeedsApproval(action, aiConfig);

      // ثقة منخفضة أو تجاوز الحد → كل شيء يحتاج موافقة
      if (needsApproval || lowConfidence || autoCount >= maxAuto) {
        approvalActions.push(action);
      } else {
        autoActions.push(action);
        autoCount += 1;
      }
    }

    // 3️⃣ تنفيذ الإجراءات الآمنة
    let failedAuto = 0;
    const autoResults: string[] = [];
    for (const action of autoActions) {
      const result = await executeTicketAction(this.client, guild, action, context);
      if (result.ok) {
        autoResults.push(result.message);
      } else {
        failedAuto += 1;
        logger.warn(
          `AI Ticket auto action failed (${action.type}) in ${guild.name}: ${result.message}`
        );
        autoResults.push(`⚠️ فشل **${action.description || action.type}**: ${result.message}`);
        // إجراء فشل → نحوّله لطلب موافقة إدارية بدل تجاهله
        approvalActions.push(action);
      }
    }

    if (autoResults.length > 0) {
      const resultsEmbed = new EmbedBuilder()
        .setTitle('⚙️ نتائج الإجراءات التلقائية')
        .setColor(failedAuto > 0 ? Colors.warning : Colors.success)
        .setDescription(autoResults.map(r => `> ${r}`).join('\n').slice(0, 4000))
        .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant` })
        .setTimestamp();
      const loggedResults = await this.sendToTicketLog(channel, resultsEmbed, aiConfig);
      // 🤫 نشرة الإجراءات في اللوق فقط — لا تشويش داخل التذكرة
      await this.sendToTicketLog(channel, resultsEmbed, aiConfig);
    }

    // 4️⃣ طلبات الموافقة
    if (approvalActions.length > 0) {
      await this.requestAdminApproval(channel, ticket, approvalActions, analysis, aiConfig);
    }

    // 5️⃣ منشن الإدارة عند الحاجة
    const shouldNotify =
      Boolean(aiConfig.notifyAdminsOnFailure) &&
      (lowConfidence || failedAuto > 0 || (analysis.requiredActions.length === 0 && analysis.needsAdminAction));

    if (shouldNotify) {
      await this.notifyAdmins(channel, ticket, analysis);
    }

    await this.logAITicketEvent(channel, {
      title: '🤖 تحليل تذكرة',
      color: Colors.info,
      fields: [
        { name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true },
        { name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true },
        { name: '🎯 الثقة', value: `${analysis.confidence}%`, inline: true },
        { name: '⚙️ تلقائي', value: `${autoActions.length - failedAuto}`, inline: true },
        { name: '🔒 موافقات', value: `${approvalActions.length}`, inline: true },
        { name: '❌ فشل', value: `${failedAuto}`, inline: true },
      ],
    });
  }

  // --------------------------------------------
  // طلب موافقة الأدمن لإجراء حساس (محفوظ في DB)
  // --------------------------------------------
  private async requestAdminApproval(
    channel: TextChannel,
    ticket: any,
    actions: RequiredAction[],
    analysis: TicketAnalysis,
    aiConfig: AITicketConfig
  ): Promise<void> {
    const settings = await getGuildSettings(channel.guild.id);
    const adminRoles = settings.tickets?.adminRoleIds?.length
      ? settings.tickets.adminRoleIds
      : settings.tickets?.supportRoleIds || [];
    const mention = adminRoles.map(r => `<@&${r}>`).join(' ');

    for (const action of actions) {
      const approvalId = randomUUID();
      const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);

      try {
        await AITicketApproval.create({
          approvalId,
          guildId: channel.guild.id,
          ticketId: String(ticket._id),
          ticketUserId: normalizeId(ticket.userId) || undefined,
          channelId: channel.id,
          action,
          status: 'pending',
          requestedBy: 'ai',
          requestedAt: new Date(),
          expiresAt,
        });
      } catch (error: any) {
        logger.error(`Could not persist AI approval: ${error.message}`);
        continue;
      }

      const embed = new EmbedBuilder()
        .setTitle('🤖 AI Ticket Assistant — يطلب موافقة إدارية')
        .setColor(Colors.warning)
        .addFields(
          { name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true },
          { name: '🤖 مطلوب من', value: 'AI Assistant', inline: true },
          {
            name: '⏰ تنتهي',
            value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
            inline: true,
          },
          { name: '⚡ الإجراء', value: action.description || action.type, inline: false },
          { name: '📝 السبب', value: analysis.suggestedSolution || '—', inline: false },
          {
            name: '🔒 يحتاج موافقة',
            value: 'نعم — هذا الإجراء يعطي صلاحيات/رول/حظر',
            inline: true,
          }
        )
        .setFooter({ text: `Approval ID: ${approvalId}` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_ai:approve:${approvalId}`)
          .setLabel('✅ موافقة')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_ai:deny:${approvalId}`)
          .setLabel('❌ رفض')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ticket_ai:details:${approvalId}`)
          .setLabel('📋 تفاصيل')
          .setStyle(ButtonStyle.Secondary)
      );

      await channel
        .send({
          content: mention ? `${mention} — الذكاء الاصطناعي يطلب موافقتك على إجراء حساس` : undefined,
          embeds: [embed],
          components: [row],
        })
        .catch(() => {});

      // انتهاء الصلاحية — تحديث الحالة فقط (السجل يبقى للتدقيق)
      const timer = setTimeout(() => {
        void AITicketApproval.updateOne(
          { approvalId, status: 'pending' },
          { $set: { status: 'expired' } }
        ).catch(() => {});
      }, APPROVAL_TTL_MS);
      timer.unref?.();
    }
  }

  // --------------------------------------------
  // معالجة موافقة/رفض الأدمن — يُستدعى من زر ticket_ai
  // --------------------------------------------
  async handleAdminResponse(
    approvalId: string,
    adminId: string,
    approve: boolean,
    expectedGuildId?: string
  ): Promise<AdminResponseResult> {
    const approval = await AITicketApproval.findOne({ approvalId }).catch(() => null);
    if (!approval) {
      return { ok: false, message: '❌ لم أجد طلب الموافقة — ربما حُذف.' };
    }

    if (expectedGuildId && approval.guildId !== expectedGuildId) {
      return { ok: false, message: '❌ طلب الموافقة لا يخص هذا السيرفر.' };
    }

    if (approval.status !== 'pending') {
      const labels: Record<string, string> = {
        approved: 'تمت الموافقة مسبقاً',
        denied: 'تم رفضه مسبقاً',
        expired: 'انتهت صلاحيته',
      };
      return { ok: false, message: `⚠️ هذا الطلب ${labels[approval.status] || approval.status}.` };
    }

    if (new Date(approval.expiresAt).getTime() <= Date.now()) {
      await AITicketApproval.updateOne({ approvalId }, { $set: { status: 'expired' } }).catch(() => {});
      return { ok: false, message: '⏰ انتهت صلاحية طلب الموافقة.' };
    }

    const channel = (await this.client.channels
      .fetch(approval.channelId)
      .catch(() => null)) as TextChannel | null;

    if (!approve) {
      await AITicketApproval.updateOne(
        { approvalId, status: 'pending' },
        { $set: { status: 'denied', approvedBy: adminId, approvedAt: new Date() } }
      ).catch(() => {});

      if (channel) {
        await channel
          .send({
            content: `❌ **تم الرفض** بواسطة <@${adminId}> — الإجراء: ${
              approval.action?.description || approval.action?.type
            }`,
          })
          .catch(() => {});
      }
      logger.info(`AI Ticket: Admin ${adminId} denied ${approvalId}`);
      return { ok: true, message: '❌ تم رفض الإجراء.' };
    }

    // Claim atomically even though only one interaction can arrive at a time
    const claimed = await AITicketApproval.findOneAndUpdate(
      { approvalId, status: 'pending' },
      { $set: { status: 'approved', approvedBy: adminId, approvedAt: new Date() } },
      { new: true }
    ).catch(() => null);

    if (!claimed) {
      return { ok: false, message: '⚠️ تمت معالجة هذا الطلب بالفعل.' };
    }

    if (!channel) {
      return { ok: false, message: '❌ قناة التذكرة لم تعد موجودة — لم يُنفَّذ الإجراء.' };
    }

    const result = await executeTicketAction(
      this.client,
      channel.guild,
      claimed.action as unknown as RequiredAction,
      {
        ticketUserId:
          normalizeId((claimed as IAITicketApproval).ticketUserId) || undefined,
        ticketChannelId: channel.id,
      }
    );

    await channel
      .send({
        content: `${
          result.ok ? '✅ **تمت الموافقة**' : '⚠️ **تمت الموافقة لكن فشل التنفيذ**'
        } بواسطة <@${adminId}> — ${claimed.action?.description || claimed.action?.type}\n> ${result.message}`,
      })
      .catch(() => {});

    await AITicketApproval.updateOne(
      { approvalId },
      { $set: { resultMessage: result.message } }
    ).catch(() => {});

    logger.info(
      `AI Ticket: Admin ${adminId} approved ${approvalId} — ${result.ok ? 'ok' : 'failed'}`
    );
    return result;
  }

  // --------------------------------------------
  // منشن الإدارة العليا (لو AI مش قادر يحل)
  // --------------------------------------------
  private async notifyAdmins(
    channel: TextChannel,
    ticket: any,
    analysis: TicketAnalysis
  ): Promise<void> {
    const settings = await getGuildSettings(channel.guild.id);
    const adminRoles = settings.tickets?.adminRoleIds?.length
      ? settings.tickets.adminRoleIds
      : settings.tickets?.supportRoleIds || [];
    const mention = adminRoles.map(r => `<@&${r}>`).join(' ');

    const embed = new EmbedBuilder()
      .setTitle('🤖 AI Ticket Assistant — يحتاج تدخل إداري')
      .setColor(Colors.warning)
      .addFields(
        { name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true },
        { name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true },
        { name: '⚡ الخطورة', value: analysis.severity, inline: true },
        { name: '📋 الملخص', value: analysis.summary || '—', inline: false },
        {
          name: '💡 محاولة الحل',
          value: analysis.suggestedSolution || 'لم يتم اقتراح حل آلي',
          inline: false,
        },
        { name: '🎯 ثقة الـ AI', value: `${analysis.confidence}%`, inline: true }
      )
      .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant — يتطلب مراجعة بشرية` })
      .setTimestamp();

    await channel
      .send({
        content: mention
          ? `${mention} — الذكاء الاصطناعي لم يستطع حل المشكلة آلياً، يرجى المراجعة`
          : 'الذكاء الاصطناعي لم يستطع حل المشكلة آلياً، يرجى المراجعة',
        embeds: [embed],
      })
      .catch(() => {});
  }

  // --------------------------------------------
  // إرسال تحليل/سجلات إلى لوق التذاكر (إن وُجد) — fallback إلى التذكرة
  // --------------------------------------------
  private async sendToTicketLog(
    channel: TextChannel,
    embed: EmbedBuilder,
    aiConfig: AITicketConfig
  ): Promise<boolean> {
    try {
      // أولوية أولى: قناة لوق التذاكر المخصصة لإعدادات AI Ticket
      const logId = aiConfig?.logChannel;
      if (logId && logId !== channel.id) {
        const logChannel = channel.guild.channels.cache.get(logId) as TextChannel | undefined;
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({ embeds: [embed] }).catch(() => {});
          return true;
        }
      }
      // احتياط: قناة لوق الحماية (الأمن) — فقط إن لم يوجد لوق تذاكر، وبشرط عدم كتم التنبيهات الأمنية
      const settings = await getGuildSettings(channel.guild.id).catch(() => null);
      const plogId = settings?.protection?.logChannel;
      if (plogId && plogId !== channel.id && !securityAlertsSilent(settings || {})) {
        const logChannel = channel.guild.channels.cache.get(plogId) as TextChannel | undefined;
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({ embeds: [embed] }).catch(() => {});
          return true;
        }
      }
      logger.warn(`AI Ticket: لا توجد قناة لوق صالحة في ${channel.guild.name} — الرسالة لم تُرسل لأي قناة عامة`);
    } catch {
      /* ignore */
    }
    // ⛔ ممنوع إرسال التحليل في قناة التذكرة لقاعدة المستخدم: التحليل يذهب للوق فقط
    return false;
  }

  // --------------------------------------------
  // سجل أحداث AI Ticket
  // --------------------------------------------
  private async logAITicketEvent(
    channel: TextChannel,
    data: { title: string; color: any; fields: Array<{ name: string; value: string; inline?: boolean }> }
  ): Promise<void> {
    try {
      const aiConfig = await this.getConfig(channel.guild.id);
      const logId = aiConfig?.logChannel;
      if (!logId || logId === channel.id) return;

      const logChannel = channel.guild.channels.cache.get(logId) as TextChannel | undefined;
      if (!logChannel || !logChannel.isTextBased()) return;

      const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setColor(data.color)
        .addFields(data.fields)
        .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    } catch {
      /* السجل اختياري */
    }
  }

  private getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      technical: '🔧 تقني',
      billing: '💰 فواتير/مدفوعات',
      complaint: '😤 شكوى',
      inquiry: '❓ استفسار',
      protection: '🛡️ حماية',
      roles: '🎭 رولات/صلاحيات',
      channels: '📝 قنوات',
      other: '📦 أخرى',
    };
    return labels[category] || '📦 أخرى';
  }

  // --------------------------------------------
  // عرض تفاصيل طلب موافقة (زر 📋)
  // --------------------------------------------
  async getApprovalDetails(approvalId: string): Promise<AITicketApprovalDetails | null> {
    const approval = await AITicketApproval.findOne({ approvalId }).catch(() => null);
    if (!approval) return null;

    return {
      approvalId: approval.approvalId,
      guildId: approval.guildId,
      ticketId: approval.ticketId,
      channelId: approval.channelId,
      action: approval.action as unknown as RequiredAction,
      status: approval.status,
      requestedAt: approval.requestedAt,
      expiresAt: approval.expiresAt,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      resultMessage: (approval as any).resultMessage,
    };
  }

  // --------------------------------------------
  // 🧠 التعلّم التلقائي من التذاكر المغلقة
  // يقرأ سؤال صاحب التذكرة + حل الفريق (أو حل الذكاء الاصطناعي)
  // ويحوّله إلى معلومة في قاعدة المعرفة تُستخدم في الردود القادمة
  // --------------------------------------------
  async learnFromClosedTicket(ticket: any, resolution: string = ''): Promise<void> {
    try {
      if (!ticket?.guildId || !ticket?.channelId) return;

      // ⚙️ مفتاح التعلّم — افتراضي مفعّل، ويُعطَّل من لوحة إعدادات مساعد التذاكر
      const aiConfig = await this.getConfig(String(ticket.guildId)).catch(() => null);
      if (aiConfig && aiConfig.learnFromTickets === false) {
        logger.debug(`Learning disabled for guild ${ticket.guildId}`);
        return;
      }

      const channel = (await this.client.channels
        .fetch(String(ticket.channelId))
        .catch(() => null)) as TextChannel | null;
      if (!channel) return;

      const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
      const messages = fetched ? [...fetched.values()].reverse() : []; // الأقدم → الأحدث
      const ownerId = String(ticket.userId || '');
      const botId = this.client.user?.id;

      const clean = (text: string) => String(text || '').replace(/\s+/g, ' ').trim();
      const isNoise = (text: string) =>
        text.length < 12 ||
        /^(تم|شكرا|شكراً|مشكور|يعطيك العافيه|يعطيك العافية|جزاك الله|بارك الله|الله يعافيك|حياك الله|العفو|ok|okay|تمام|ماشي|طيب)[\s!،.…-]*$/i.test(
          text
        );

      // 📌 السؤال: أول رسالة جدية من صاحب التذكرة (أو وصف التذكرة/النموذج)
      const ownerMsgs = messages.filter(
        m => !m.author.bot && m.author.id === ownerId && clean(m.content).length >= 5
      );
      let question = clean(ownerMsgs[0]?.content || '');
      if (question.length < 5) question = clean(String(ticket.subject || ''));
      if (question.length < 5 && Array.isArray(ticket.fields)) {
        question = clean(
          ticket.fields.map((f: any) => `${f.question || ''}: ${f.answer || ''}`).join(' | ')
        );
      }
      if (question.length < 8) return; // لا يوجد ما نتعلّم منه

      // 🧑💼 الحل: آخر رسائل الفريق (غير البوت وغير صاحب التذكرة) — أو حل الـ AI إن لم يوجد فريق
      const staffMsgs = messages.filter(m => {
        const text = clean(m.content);
        return !m.author.bot && m.author.id !== ownerId && !isNoise(text);
      });
      const botMsgs = messages.filter(m => {
        if (m.author.id !== botId) return false;
        // الردود الحوارية فقط (content) — نتجاهل إيمبدات الإشعارات مثل "تم استلام التذكرة"/"تم الإغلاق"
        const text = clean(m.content);
        return text.length >= 30 && !isNoise(text);
      });

      const solutionParts: string[] = [];
      if (staffMsgs.length) {
        solutionParts.push(...staffMsgs.slice(-3).map(m => clean(m.content)));
      } else if (botMsgs.length) {
        const last = botMsgs[botMsgs.length - 1];
        solutionParts.push(clean(last.content));
      }

      const cleanResolution = clean(resolution);
      if (
        cleanResolution.length >= 5 &&
        cleanResolution !== 'غير محدد' &&
        !isNoise(cleanResolution)
      ) {
        solutionParts.push(`سبب الإغلاق: ${cleanResolution}`);
      }

      const solution = clean(solutionParts.filter(Boolean).join('\n')).slice(0, 1500);
      if (solution.length < 15) {
        logger.debug(`Skipping knowledge learn for ticket ${ticket._id}: no usable solution`);
        return;
      }

      const guildId = String(ticket.guildId);
      const title = `تذكرة — ${question.slice(0, 80)}`;
      const content =
        `المشكلة (تذكرة #${ticket.ticketNumber || String(ticket._id).slice(-6)}):\n` +
        `${question.slice(0, 900)}\n\n` +
        `الحل المعتمد من الفريق:\n${solution}`;

      const tags = [
        ...new Set<string>(
          [
            'تذاكر',
            clean(String(ticket.type || '')),
            ...tokenize(`${question} ${solution}`).slice(0, 12),
          ].filter(Boolean)
        ),
      ];

      const existing = await KnowledgeEntry.findOne({ guildId, title }).catch(() => null);
      if (existing) {
        existing.content = content;
        existing.tags = tags;
        existing.enabled = true;
        await existing.save();
      } else {
        await KnowledgeEntry.create({
          guildId,
          title,
          content,
          tags,
          category: 'تذاكر (تعلّم تلقائي)',
          createdBy: 'auto-learning',
          enabled: true,
        });
      }

      invalidateKnowledgeCache(guildId);
      await this.pruneAutoKnowledge(guildId);

      logger.info(
        `Learned solution from ticket ${ticket._id} (${question.slice(0, 60)}…) in guild ${guildId}`
      );
    } catch (error: any) {
      logger.warn(`learnFromClosedTicket failed: ${error.message}`);
    }
  }

  // 🗑️ حد أقصى لمعلومات التعلّم التلقائي لكل سيرفر — حذف الأقدم عند التجاوز
  private async pruneAutoKnowledge(guildId: string): Promise<void> {
    try {
      const MAX_AUTO_ENTRIES = 500;
      const count = await KnowledgeEntry.countDocuments({
        guildId,
        createdBy: 'auto-learning',
      });
      if (count <= MAX_AUTO_ENTRIES) return;

      const stale = await KnowledgeEntry.find({
        guildId,
        createdBy: 'auto-learning',
      })
        .sort({ updatedAt: 1 })
        .limit(count - MAX_AUTO_ENTRIES)
        .select('_id');

      if (stale.length) {
        await KnowledgeEntry.deleteMany({ _id: { $in: stale.map(e => e._id) } });
        invalidateKnowledgeCache(guildId);
      }
    } catch {
      /* التنظيف اختياري */
    }
  }
}

export interface AITicketApprovalDetails {
  approvalId: string;
  guildId: string;
  ticketId: string;
  channelId: string;
  action: RequiredAction;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  requestedAt: Date;
  expiresAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  resultMessage?: string;
}

export default AITicketAssistant;
