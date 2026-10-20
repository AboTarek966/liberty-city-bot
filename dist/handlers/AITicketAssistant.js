"use strict";
// ============================================
// Liberty City Bot - AI Ticket Assistant
// ============================================
// الـ AI يستلم التذكرة، يحلل المشكلة، يحاول يحلها
// لو محتاج يعطي رول → يطلب موافقة أدمن أولاً
// لو فشل → يمنشن الإدارة العليا + يلخص المشكلة
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AITicketAssistant = void 0;
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const helpers_1 = require("../utils/helpers");
const embeds_1 = require("../utils/embeds");
const logger = (0, helpers_1.createLogger)('AITicketAssistant');
const ADMIN_APPROVALS = new Map(); // ticketId -> request
class AITicketAssistant {
    client;
    constructor(client) {
        this.client = client;
    }
    // --------------------------------------------
    // نقطة الدخول: عند فتح تذكرة جديدة
    // --------------------------------------------
    async onTicketCreated(ticket, channel) {
        try {
            const settings = await (0, models_1.getGuildSettings)(channel.guild.id);
            const aiConfig = settings.aiTicketAssistant;
            if (!aiConfig?.enabled)
                return;
            // 🤖 Auto-claim the ticket if enabled
            if (aiConfig.autoClaim) {
                try {
                    await this.claimTicket(channel, ticket);
                }
                catch (error) {
                    logger.warn(`Auto-claim failed: ${error.message}`);
                }
            }
            // قراءة الرسالة الأولى في التذكرة
            const messages = await channel.messages.fetch({ limit: 10 });
            const firstUserMessage = [...messages.values()].reverse().find(m => !m.author.bot && m.author.id !== this.client.user?.id);
            if (!firstUserMessage)
                return;
            // 🤖 Auto-response immediately when ticket is created (if analyzeOnCreate is enabled)
            if (aiConfig.analyzeOnCreate) {
                await this.sendAutoResponse(channel, firstUserMessage);
            }
            // تحليل المشكلة
            const analysis = await this.analyzeTicket(firstUserMessage, channel.guild);
            // تنفيذ الحل المقترح
            await this.executeSolution(ticket, channel, firstUserMessage, analysis, aiConfig);
        }
        catch (error) {
            logger.error(`AITicketAssistant onTicketCreated error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // Auto-claim ticket
    // --------------------------------------------
    async claimTicket(channel, ticket) {
        try {
            // Check if already claimed
            if (ticket.claimedBy) {
                logger.info(`Ticket ${ticket._id} already claimed`);
                return;
            }
            // Update ticket in database
            const { Ticket } = await Promise.resolve().then(() => __importStar(require('../models')));
            await Ticket.findByIdAndUpdate(ticket._id, {
                claimedBy: this.client.user?.id,
                claimedAt: new Date(),
                status: 'claimed',
            });
            // Send claim message
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🤖 AI Assistant — استلام التذكرة')
                .setDescription('تم استلام التذكرة تلقائياً بواسطة الذكاء الاصطناعي. جاري تحليل المشكلة...')
                .setColor(0x5865f2)
                .setFooter({ text: 'Liberty City AI Ticket Assistant' })
                .setTimestamp();
            await channel.send({ embeds: [embed] }).catch(() => { });
            logger.info(`AI auto-claimed ticket in ${channel.guild.name}`);
        }
        catch (error) {
            logger.error(`Auto-claim error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // Auto-response when ticket is created
    // --------------------------------------------
    async sendAutoResponse(channel, firstMessage) {
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
            const response = await this.client.aiHandler.generateResponse('system-ticket-ai', channel.guild.id, channel.id, prompt, [], false, false, { fromCommand: true });
            if (response?.content) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🤖 AI Assistant — رد أولي')
                    .setDescription(response.content)
                    .setColor(0x5865f2)
                    .setFooter({ text: 'Liberty City AI • جاري تحليل المشكلة...' })
                    .setTimestamp();
                await channel.send({ embeds: [embed] }).catch(() => { });
                logger.info(`AI auto-response sent in ${channel.guild.name}`);
            }
        }
        catch (error) {
            logger.warn(`Auto-response failed: ${error.message}`);
        }
    }
    // --------------------------------------------
    // تحليل التذكرة بالـ AI
    // --------------------------------------------
    async analyzeTicket(message, guild) {
        const context = `
السيرفر: ${guild.name} (${guild.id})
المستخدم: ${message.author.tag} (${message.author.id})
محتوى التذكرة: "${message.content}"
المرفقات: ${message.attachments.size > 0 ? message.attachments.map((a) => a.name).join(', ') : 'لا توجد'}
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
            const response = await this.client.aiHandler.generateResponse('system-ticket-ai', guild.id, message.channel.id, prompt, [], false, false, { fromCommand: true });
            if (!response?.content) {
                return this.getDefaultAnalysis();
            }
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                return this.getDefaultAnalysis();
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
        }
        catch (error) {
            logger.error(`AI Ticket analysis error: ${error.message}`);
            return this.getDefaultAnalysis();
        }
    }
    getDefaultAnalysis() {
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
    async executeSolution(ticket, channel, firstMessage, analysis, aiConfig) {
        const guild = channel.guild;
        // 1️⃣ رد أولي بالتحليل والحل المقترح
        const initialEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🤖 AI Ticket Assistant — تحليل التذكرة')
            .setColor(analysis.severity === 'critical' ? embeds_1.Colors.error : analysis.severity === 'high' ? embeds_1.Colors.warning : embeds_1.Colors.info)
            .addFields({ name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true }, { name: '⚡ الخطورة', value: analysis.severity, inline: true }, { name: '🎯 الثقة', value: `${analysis.confidence}%`, inline: true }, { name: '📋 الملخص', value: analysis.summary, inline: false }, { name: '💡 الحل المقترح', value: analysis.suggestedSolution, inline: false })
            .setFooter({ text: 'Liberty City AI Ticket Assistant' })
            .setTimestamp();
        await channel.send({ embeds: [initialEmbed] }).catch(() => { });
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
    async executeAction(guild, action, ticket) {
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
        }
        catch (error) {
            logger.error(`AI Ticket executeAction error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // طلب موافقة الأدمن لإجراء حساس
    // --------------------------------------------
    async requestAdminApproval(channel, ticket, actions, analysis) {
        const settings = await (0, models_1.getGuildSettings)(channel.guild.id);
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
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🤖 AI Ticket Assistant — يطلب موافقة إدارية')
                .setColor(embeds_1.Colors.warning)
                .addFields({ name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true }, { name: '🤖 مطلوب من', value: 'AI Assistant', inline: true }, { name: '⚡ الإجراء', value: action.description, inline: false }, { name: '📝 السبب', value: analysis.suggestedSolution, inline: false }, { name: '🔒 يحتاج موافقة', value: 'نعم — هذا الإجراء يعطي صلاحيات/رول/حظر', inline: true })
                .setFooter({ text: `Approval ID: ${approvalId}` })
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_ai_approve:${approvalId}`)
                .setLabel('✅ موافقة')
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_ai_deny:${approvalId}`)
                .setLabel('❌ رفض')
                .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_ai_details:${approvalId}`)
                .setLabel('📋 تفاصيل')
                .setStyle(discord_js_1.ButtonStyle.Secondary));
            await channel.send({
                content: `${mention} — الذكاء الاصطناعي يطلب موافقتك على إجراء حساس`,
                embeds: [embed],
                components: [row]
            }).catch(() => { });
            // مهلة 10 دقائق للموافقة
            setTimeout(() => {
                const approval = ADMIN_APPROVALS.get(approvalId);
                if (approval && approval.status === 'pending') {
                    approval.status = 'denied';
                    channel.send({ content: `⏰ **انتهت مهلة الموافقة** — تم رفض الطلب تلقائياً: ${approvalId}` }).catch(() => { });
                    ADMIN_APPROVALS.delete(approvalId);
                }
            }, 10 * 60 * 1000);
        }
    }
    // --------------------------------------------
    // معالجة موافقة/رفض الأدمن
    // --------------------------------------------
    async handleAdminResponse(approvalId, adminId, approve) {
        const approval = ADMIN_APPROVALS.get(approvalId);
        if (!approval || approval.status !== 'pending')
            return;
        const channel = this.client.channels.cache.get(approval.channelId);
        if (!channel)
            return;
        if (approve) {
            approval.status = 'approved';
            approval.approvedBy = adminId;
            approval.approvedAt = new Date();
            // تنفيذ الإجراء
            await this.executeAction(channel.guild, approval.action, { _id: approval.ticketId });
            await channel.send({ content: `✅ **تمت الموافقة** بواسطة <@${adminId}> — جاري تنفيذ: ${approval.action.description}` }).catch(() => { });
            logger.info(`AI Ticket: Admin ${adminId} approved ${approvalId}`);
        }
        else {
            approval.status = 'denied';
            approval.approvedBy = adminId;
            approval.approvedAt = new Date();
            await channel.send({ content: `❌ **تم الرفض** بواسطة <@${adminId}> — الإجراء: ${approval.action.description}` }).catch(() => { });
            logger.info(`AI Ticket: Admin ${adminId} denied ${approvalId}`);
        }
        ADMIN_APPROVALS.delete(approvalId);
    }
    // --------------------------------------------
    // منشن الإدارة العليا (لو AI مش قادر يحل)
    // --------------------------------------------
    async notifyAdmins(channel, ticket, analysis) {
        const settings = await (0, models_1.getGuildSettings)(channel.guild.id);
        const adminRoles = settings.tickets?.adminRoleIds || [];
        const mention = adminRoles.map(r => `<@&${r}>`).join(' ') || '@الإدارة';
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🤖 AI Ticket Assistant — يحتاج تدخل إداري')
            .setColor(embeds_1.Colors.warning)
            .addFields({ name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true }, { name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true }, { name: '⚡ الخطورة', value: analysis.severity, inline: true }, { name: '📋 الملخص', value: analysis.summary, inline: false }, { name: '💡 محاولة الحل', value: analysis.suggestedSolution || 'لم يتم اقتراح حل آلي', inline: false }, { name: '🎯 ثقة الـ AI', value: `${analysis.confidence}%`, inline: true })
            .setFooter({ text: 'Liberty City AI Ticket Assistant — يتطلب مراجعة بشرية' })
            .setTimestamp();
        await channel.send({
            content: `${mention} — الذكاء الاصطناعي لم يستطع حل المشكلة آلياً، يرجى المراجعة`,
            embeds: [embed]
        }).catch(() => { });
    }
    getCategoryLabel(category) {
        const labels = {
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
    async learnFromClosedTicket(ticket, resolution) {
        // تخزين الحل في قاعدة معرفة للتدريب المستقبلي
        // يمكن ربطه بنظام RAG أو fine-tuning لاحقاً
        logger.info(`AI Ticket learning from closed ticket ${ticket._id}: ${resolution.substring(0, 100)}`);
    }
    // --------------------------------------------
    // Get approvals map for button handler
    // --------------------------------------------
    getApprovals() {
        return ADMIN_APPROVALS;
    }
}
exports.AITicketAssistant = AITicketAssistant;
exports.default = AITicketAssistant;
//# sourceMappingURL=AITicketAssistant.js.map