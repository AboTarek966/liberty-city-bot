// ============================================
// Liberty City Bot - AI Ticket Assistant
// ============================================
// الـ AI يستلم التذكرة، يحلل المشكلة، يحاول يحلها
// لو محتاج يعطي رول → يطلب موافقة أدمن أولاً
// لو فشل → يمنشن الإدارة العليا + يلخص المشكلة

import {
  TextChannel,
  Guild,
  GuildMember,
  User,
  Role,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { LibertyClient } from '../LibertyClient';
import { getGuildSettings, Ticket } from '../models';
import { createLogger } from '../utils/helpers';
import { Colors } from '../utils/embeds';

const logger = createLogger('AITicketAssistant');

export interface TicketAnalysis {
  category: 'technical' | 'billing' | 'complaint' | 'inquiry' | 'protection' | 'roles' | 'channels' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  suggestedSolution: string;
  needsAdminAction: boolean;
  requiredActions: RequiredAction[];
  confidence: number;
}

export interface RequiredAction {
  type: 'give_role' | 'remove_role' | 'create_channel' | 'modify_permissions' | 'check_settings' | 'restore_backup' | 'ban_user' | 'timeout_user' | 'custom';
  description: string;
  params: Record<string, any>;
  requiresAdminApproval: boolean;
  targetUserId?: string;
  targetRoleId?: string;
}

export interface AdminApprovalRequest {
  ticketId: string;
  channelId: string;
  action: RequiredAction;
  requestedBy: 'ai';
  status: 'pending' | 'approved' | 'denied';
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

const ADMIN_APPROVALS = new Map<string, AdminApprovalRequest>(); // ticketId -> request

export class AITicketAssistant {
  private client: LibertyClient;

  constructor(client: LibertyClient) {
    this.client = client;
  }

  // --------------------------------------------
  // نقطة الدخول: عند فتح تذكرة جديدة
  // --------------------------------------------
  async onTicketCreated(ticket: any, channel: TextChannel): Promise<void> {
    try {
      const settings = await getGuildSettings(channel.guild.id);
      const aiConfig = (settings as any).aiTicketAssistant;
      if (!aiConfig?.enabled) return;

      // 🤖 Auto-claim the ticket if enabled
      if (aiConfig.autoClaim) {
        try {
          await this.claimTicket(channel, ticket);
        } catch (error: any) {
          logger.warn(`Auto-claim failed: ${error.message}`);
        }
      }

      // قراءة الرسالة الأولى في التذكرة
      const messages = await channel.messages.fetch({ limit: 10 });
      const firstUserMessage = [...messages.values()].reverse().find(m => !m.author.bot && m.author.id !== this.client.user?.id);
      
      if (!firstUserMessage) return;

      // 🤖 Auto-response immediately when ticket is created (if analyzeOnCreate is enabled)
      if (aiConfig.analyzeOnCreate) {
        await this.sendAutoResponse(channel, firstUserMessage);
      }

      // تحليل المشكلة
      const analysis = await this.analyzeTicket(firstUserMessage, channel.guild);

      // تنفيذ الحل المقترح
      await this.executeSolution(ticket, channel, firstUserMessage, analysis, aiConfig);

    } catch (error: any) {
      logger.error(`AITicketAssistant onTicketCreated error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // Auto-claim ticket
  // --------------------------------------------
  private async claimTicket(channel: TextChannel, ticket: any): Promise<void> {
    try {
      // Check if already claimed
      if (ticket.claimedBy) {
        logger.info(`Ticket ${ticket._id} already claimed`);
        return;
      }

      // Update ticket in database
      const { Ticket } = await import('../models');
      await Ticket.findByIdAndUpdate(ticket._id, {
        claimedBy: this.client.user?.id,
        claimedAt: new Date(),
        status: 'claimed',
      });

      // Send claim message
      const embed = new EmbedBuilder()
        .setTitle('🤖 AI Assistant — استلام التذكرة')
        .setDescription('تم استلام التذكرة تلقائياً بواسطة الذكاء الاصطناعي. جاري تحليل المشكلة...')
        .setColor(0x5865f2)
        .setFooter({ text: 'Liberty City AI Ticket Assistant' })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
      logger.info(`AI auto-claimed ticket in ${channel.guild.name}`);
    } catch (error: any) {
      logger.error(`Auto-claim error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // Auto-response when ticket is created
  // --------------------------------------------
  private async sendAutoResponse(channel: TextChannel, firstMessage: any): Promise<void> {
    try {
      const guild = channel.guild;
      const prompt = `أنت مساعد دعم ذكي في سيرفر Discord "${channel.guild.name}".
  
مستخدم فتح تذكرة وكتب:
"${firstMessage.content}"

رد رداً أولياً ودوداً باللغة العربية:
- رحب به
- أكد استلام التذكرة
- قل إنك ستحلل المشكلة وترد بالحل
- لا تبالغ في الوعود
- كن مختصراً وودوداً

ردك:`;

      const response = await this.client.aiHandler.generateResponse(
        'system-ticket-ai',
        channel.guild.id,
        channel.id,
        prompt,
        [],
        false,
        false,
        { fromCommand: true }
      );

      if (response?.content) {
        const embed = new EmbedBuilder()
          .setTitle('🤖 AI Assistant — رد أولي')
          .setDescription(response.content)
          .setColor(0x5865f2)
          .setFooter({ text: 'Liberty City AI • جاري تحليل المشكلة...' })
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
  private async analyzeTicket(message: any, guild: Guild): Promise<TicketAnalysis> {
    const context = `
السيرفر: ${guild.name} (${guild.id})
المستخدم: ${message.author.tag} (${message.author.id})
محتوى التذكرة: "${message.content}"
المرفقات: ${message.attachments.size > 0 ? message.attachments.map((a: any) => a.name).join(', ') : 'لا توجد'}
    `.trim();

    const prompt = `أنت مساعد دعم تقني ذكي (AI Ticket Assistant) في بوت Liberty City.

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
- custom: إجراء مخصص

**مهم جداً:** 
- أي إجراء يعطي رول/يعدل صلاحيات/يحظر = requiresAdminApproval: true
- الإجراءات المعلوماتية (فحص، استشارة) = requiresAdminApproval: false
- لو مش متأكد → needsAdminAction: true

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
        'system-ticket-ai',
        guild.id,
        message.channel.id,
        prompt,
        [],
        false,
        false,
        { fromCommand: true }
      );

      if (!response?.content) {
        return this.getDefaultAnalysis();
      }

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.getDefaultAnalysis();

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || 'other',
        severity: parsed.severity || 'medium',
        summary: parsed.summary || 'مشكلة غير محددة',
        suggestedSolution: parsed.suggestedSolution || 'جارٍ المراجعة...',
        needsAdminAction: parsed.needsAdminAction ?? true,
        requiredActions: parsed.requiredActions || [],
        confidence: parsed.confidence || 50,
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
      confidence: 30,
    };
  }

  // --------------------------------------------
  // تنفيذ الحل
  // --------------------------------------------
  private async executeSolution(
    ticket: any,
    channel: TextChannel,
    firstMessage: any,
    analysis: TicketAnalysis,
    aiConfig: any
  ): Promise<void> {
    const guild = channel.guild;

    // 1️⃣ رد أولي بالتحليل والحل المقترح
    const initialEmbed = new EmbedBuilder()
      .setTitle('🤖 AI Ticket Assistant — تحليل التذكرة')
      .setColor(analysis.severity === 'critical' ? Colors.error : analysis.severity === 'high' ? Colors.warning : Colors.info)
      .addFields(
        { name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true },
        { name: '⚡ الخطورة', value: analysis.severity, inline: true },
        { name: '🎯 الثقة', value: `${analysis.confidence}%`, inline: true },
        { name: '📋 الملخص', value: analysis.summary, inline: false },
        { name: '💡 الحل المقترح', value: analysis.suggestedSolution, inline: false },
      )
      .setFooter({ text: 'Liberty City AI Ticket Assistant' })
      .setTimestamp();

    await channel.send({ embeds: [initialEmbed] }).catch(() => {});

    // 2️⃣ تنفيذ الإجراءات اللي لا تحتاج موافقة
    const autoActions = analysis.requiredActions.filter(a => !a.requiresAdminApproval);
    for (const action of autoActions) {
      await this.executeAction(channel.guild, action, ticket);
    }

    // 3️⃣ الإجراءات اللي تحتاج موافقة → طلب من الأدمن
    const adminActions = analysis.requiredActions.filter(a => a.requiresAdminApproval);
    if (adminActions.length > 0) {
      await this.requestAdminApproval(channel, ticket, adminActions, analysis);
    }

    // 4️⃣ لو مفيش إجراءات والـ AI مش متأكد → منشن الإدارة
    if (analysis.requiredActions.length === 0 || analysis.needsAdminAction) {
      await this.notifyAdmins(channel, ticket, analysis);
    }
  }

  // --------------------------------------------
  // تنفيذ إجراء آلي (بدون موافقة)
  // --------------------------------------------
  private async executeAction(guild: Guild, action: RequiredAction, ticket: any): Promise<void> {
    try {
      switch (action.type) {
        case 'check_settings':
          // مجرد فحص إعدادات — الـ AI يقرأ الإعدادات ويرد
          logger.info(`AI Ticket: Check settings for ${guild.name}`);
          break;
        case 'restore_backup':
          await this.client.securityHandler?.restoreBackup(guild);
          break;
        case 'custom':
          // إجراءات مخصصة مستقبلاً
          break;
      }
    } catch (error: any) {
      logger.error(`AI Ticket executeAction error: ${error.message}`);
    }
  }

  // --------------------------------------------
  // طلب موافقة الأدمن لإجراء حساس
  // --------------------------------------------
  private async requestAdminApproval(
    channel: TextChannel,
    ticket: any,
    actions: RequiredAction[],
    analysis: TicketAnalysis
  ): Promise<void> {
    const settings = await getGuildSettings(channel.guild.id);
    const adminRoles = settings.tickets?.adminRoleIds || [];
    const mention = adminRoles.map(r => `<@&${r}>`).join(' ') || '@الإدارة';

    for (const action of actions) {
      const approvalId = `${ticket._id}-${action.type}-${Date.now()}`;
      
      ADMIN_APPROVALS.set(approvalId, {
        ticketId: ticket._id.toString(),
        channelId: channel.id,
        action,
        requestedBy: 'ai',
        status: 'pending',
        requestedAt: new Date(),
      });

      const embed = new EmbedBuilder()
        .setTitle('🤖 AI Ticket Assistant — يطلب موافقة إدارية')
        .setColor(Colors.warning)
        .addFields(
          { name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true },
          { name: '🤖 مطلوب من', value: 'AI Assistant', inline: true },
          { name: '⚡ الإجراء', value: action.description, inline: false },
          { name: '📝 السبب', value: analysis.suggestedSolution, inline: false },
          { name: '🔒 يحتاج موافقة', value: 'نعم — هذا الإجراء يعطي صلاحيات/رول/حظر', inline: true },
        )
        .setFooter({ text: `Approval ID: ${approvalId}` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_ai_approve:${approvalId}`)
          .setLabel('✅ موافقة')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`ticket_ai_deny:${approvalId}`)
          .setLabel('❌ رفض')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ticket_ai_details:${approvalId}`)
          .setLabel('📋 تفاصيل')
          .setStyle(ButtonStyle.Secondary),
      );

      await channel.send({ 
        content: `${mention} — الذكاء الاصطناعي يطلب موافقتك على إجراء حساس`, 
        embeds: [embed], 
        components: [row] 
      }).catch(() => {});

      // مهلة 10 دقائق للموافقة
      setTimeout(() => {
        const approval = ADMIN_APPROVALS.get(approvalId);
        if (approval && approval.status === 'pending') {
          approval.status = 'denied';
          channel.send({ content: `⏰ **انتهت مهلة الموافقة** — تم رفض الطلب تلقائياً: ${approvalId}` }).catch(() => {});
          ADMIN_APPROVALS.delete(approvalId);
        }
      }, 10 * 60 * 1000);
    }
  }

  // --------------------------------------------
  // معالجة موافقة/رفض الأدمن
  // --------------------------------------------
  async handleAdminResponse(approvalId: string, adminId: string, approve: boolean): Promise<void> {
    const approval = ADMIN_APPROVALS.get(approvalId);
    if (!approval || approval.status !== 'pending') return;

    const channel = this.client.channels.cache.get(approval.channelId) as TextChannel;
    if (!channel) return;

    if (approve) {
      approval.status = 'approved';
      approval.approvedBy = adminId;
      approval.approvedAt = new Date();

      // تنفيذ الإجراء
      await this.executeAction(channel.guild, approval.action, { _id: approval.ticketId });

      await channel.send({ content: `✅ **تمت الموافقة** بواسطة <@${adminId}> — جاري تنفيذ: ${approval.action.description}` }).catch(() => {});
      logger.info(`AI Ticket: Admin ${adminId} approved ${approvalId}`);
    } else {
      approval.status = 'denied';
      approval.approvedBy = adminId;
      approval.approvedAt = new Date();

      await channel.send({ content: `❌ **تم الرفض** بواسطة <@${adminId}> — الإجراء: ${approval.action.description}` }).catch(() => {});
      logger.info(`AI Ticket: Admin ${adminId} denied ${approvalId}`);
    }

    ADMIN_APPROVALS.delete(approvalId);
  }

  // --------------------------------------------
  // منشن الإدارة العليا (لو AI مش قادر يحل)
  // --------------------------------------------
  private async notifyAdmins(channel: TextChannel, ticket: any, analysis: TicketAnalysis): Promise<void> {
    const settings = await getGuildSettings(channel.guild.id);
    const adminRoles = settings.tickets?.adminRoleIds || [];
    const mention = adminRoles.map(r => `<@&${r}>`).join(' ') || '@الإدارة';

    const embed = new EmbedBuilder()
      .setTitle('🤖 AI Ticket Assistant — يحتاج تدخل إداري')
      .setColor(Colors.warning)
      .addFields(
        { name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true },
        { name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true },
        { name: '⚡ الخطورة', value: analysis.severity, inline: true },
        { name: '📋 الملخص', value: analysis.summary, inline: false },
        { name: '💡 محاولة الحل', value: analysis.suggestedSolution || 'لم يتم اقتراح حل آلي', inline: false },
        { name: '🎯 ثقة الـ AI', value: `${analysis.confidence}%`, inline: true },
      )
      .setFooter({ text: 'Liberty City AI Ticket Assistant — يتطلب مراجعة بشرية' })
      .setTimestamp();

    await channel.send({ 
      content: `${mention} — الذكاء الاصطناعي لم يستطع حل المشكلة آلياً، يرجى المراجعة`, 
      embeds: [embed] 
    }).catch(() => {});
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
  // تعلم من التذاكر المغلقة (Future)
  // --------------------------------------------
  async learnFromClosedTicket(ticket: any, resolution: string): Promise<void> {
    // تخزين الحل في قاعدة معرفة للتدريب المستقبلي
    // يمكن ربطه بنظام RAG أو fine-tuning لاحقاً
    logger.info(`AI Ticket learning from closed ticket ${ticket._id}: ${resolution.substring(0, 100)}`);
  }
// --------------------------------------------
  // Get approvals map for button handler
  // --------------------------------------------
  getApprovals(): Map<string, AdminApprovalRequest> {
    return ADMIN_APPROVALS;
  }
}

export default AITicketAssistant;