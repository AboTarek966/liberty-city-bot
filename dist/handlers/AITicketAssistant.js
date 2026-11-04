"use strict";
// ============================================
// Omni Bot - AI Ticket Assistant
// ============================================
// الـ AI يستلم التذكرة، يحلل المشكلة، يحاول يحلها
// لو محتاج يعطي رول → يطلب موافقة أدمن أولاً
// لو فشل → يمنشن الإدارة العليا + يلخص المشكلة
//
// الموافقات محفوظة في MongoDB (AITicketApproval) — لا تضيع عند
// إعادة تشغيل البوت، وتُحترم إعدادات:
//   confidenceThreshold · maxAutoActionsPerTicket
//   requireAdminApprovalForRoles/Permissions/Bans
//   notifyAdminsOnFailure · logChannel
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
const crypto_1 = require("crypto");
const models_1 = require("../models");
const helpers_1 = require("../utils/helpers");
const embeds_1 = require("../utils/embeds");
const aiTicketActions_1 = require("../utils/aiTicketActions");
const logger = (0, helpers_1.createLogger)('AITicketAssistant');
const APPROVAL_TTL_MS = 15 * 60 * 1000;
class AITicketAssistant {
    client;
    constructor(client) {
        this.client = client;
    }
    // --------------------------------------------
    // إعدادات المساعد — تقرأ من protection أولاً ثم الجذر
    // --------------------------------------------
    async getConfig(guildId) {
        const settings = await (0, models_1.getGuildSettings)(guildId);
        const config = settings.protection?.aiTicketAssistant ?? settings.aiTicketAssistant;
        return config || null;
    }
    // --------------------------------------------
    // نقطة الدخول: عند فتح تذكرة جديدة
    // --------------------------------------------
    async onTicketCreated(ticket, channel) {
        try {
            const aiConfig = await this.getConfig(channel.guild.id);
            if (!aiConfig?.enabled)
                return;
            // 🤖 استلام التذكرة تلقائياً
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
            let firstUserMessage = [...messages.values()]
                .reverse()
                .find(m => !m.author.bot && m.author.id !== this.client.user?.id);
            // لو التذكرة أُنشئت من نموذج (بدون رسالة من العضو) → نستخدم وصف التذكرة
            if (!firstUserMessage) {
                const description = String(ticket.subject || '').trim() ||
                    (Array.isArray(ticket.fields)
                        ? ticket.fields
                            .map((f) => `${f.question || 'سؤال'}: ${f.answer || '—'}`)
                            .join('\n')
                        : '');
                if (!description.trim()) {
                    logger.debug(`Ticket ${ticket._id} has no user message or description — skipping AI analysis`);
                    return;
                }
                const user = await this.client.users.fetch(ticket.userId).catch(() => null);
                if (!user)
                    return;
                firstUserMessage = {
                    content: description,
                    author: user,
                    channel,
                    attachments: new Map(),
                };
            }
            // 🤖 رد أولي فوري
            if (aiConfig.analyzeOnCreate) {
                await this.sendAutoResponse(channel, firstUserMessage, ticket);
            }
            // تحليل المشكلة
            const analysis = await this.analyzeTicket(firstUserMessage, channel.guild, ticket);
            // تنفيذ الحل المقترح
            await this.executeSolution(ticket, channel, analysis, aiConfig);
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
            if (ticket.claimedBy) {
                logger.debug(`Ticket ${ticket._id} already claimed`);
                return;
            }
            const { Ticket } = await Promise.resolve().then(() => __importStar(require('../models')));
            await Ticket.findByIdAndUpdate(ticket._id, {
                claimedBy: this.client.user?.id,
                claimedAt: new Date(),
                status: 'claimed',
            });
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🤖 AI Assistant — استلام التذكرة')
                .setDescription('تم استلام التذكرة تلقائياً بواسطة الذكاء الاصطناعي. جاري تحليل المشكلة...')
                .setColor(0x5865f2)
                .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant` })
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
    async sendAutoResponse(channel, firstMessage, ticket) {
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

ردك:`;
            const response = await this.client.aiHandler.generateResponse(firstMessage.author.id || 'system-ticket-ai', channel.guild.id, channel.id, prompt, [], false, false, { fromCommand: true });
            if (response?.content) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🤖 AI Assistant — رد أولي')
                    .setDescription(response.content.slice(0, 4000))
                    .setColor(0x5865f2)
                    .setFooter({ text: `${channel.guild.name} • AI • جاري تحليل المشكلة...` })
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
    async analyzeTicket(message, guild, ticket) {
        const context = `
السيرفر: ${guild.name} (${guild.id})
صاحب التذكرة: ${message.author.tag} (${message.author.id})
رقم التذكرة: ${ticket.ticketNumber || ticket._id}
معرّف التذكرة في قاعدة البيانات: ${ticket._id}
قناة التذكرة: ${message.channel.id}
محتوى التذكرة: "${message.content}"
المرفقات: ${message.attachments?.size > 0 ? [...message.attachments.values()].map((a) => a.name).join(', ') : 'لا توجد'}
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
- custom: إجراء مخصص

**قواعد صارمة:**
- أي إجراء يعطي رول/يعدل صلاحيات/يحظر = requiresAdminApproval: true
- الإجراءات المعلوماتية (فحص، استشارة) = requiresAdminApproval: false
- استخدم دائماً معرّفات Discord الرقمية (targetUserId / targetRoleId) من السياق — لا تكتب أسماء أو منشن.
- صاحب التذكرة هو المستخدم الافتراضي لأي إجراء عليه (targetUserId = ${message.author.id}).
- لو مش متأكد → needsAdminAction: true وقلل confidence.
- لا تخترع إجراءات غير مطلوبة فعلاً.

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
            const response = await this.client.aiHandler.generateResponse(message.author.id || 'system-ticket-ai', guild.id, message.channel.id, prompt, [], false, false, { fromCommand: true });
            if (!response?.content) {
                return this.getDefaultAnalysis();
            }
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                return this.getDefaultAnalysis();
            const parsed = JSON.parse(jsonMatch[0]);
            const rawActions = Array.isArray(parsed.requiredActions) ? parsed.requiredActions : [];
            const requiredActions = rawActions
                .filter((item) => item && typeof item === 'object' && item.type)
                .slice(0, 10)
                .map((item) => ({
                type: item.type,
                description: String(item.description || item.type).slice(0, 500),
                params: item.params && typeof item.params === 'object' ? item.params : {},
                requiresAdminApproval: Boolean(item.requiresAdminApproval),
                targetUserId: (0, aiTicketActions_1.normalizeId)(item.targetUserId),
                targetRoleId: (0, aiTicketActions_1.normalizeId)(item.targetRoleId),
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
            confidence: 0,
        };
    }
    // --------------------------------------------
    // تنفيذ الحل
    // --------------------------------------------
    async executeSolution(ticket, channel, analysis, aiConfig) {
        const guild = channel.guild;
        const threshold = Math.max(0, Math.min(100, Number(aiConfig.confidenceThreshold ?? 70)));
        const maxAuto = Math.max(0, Math.trunc(Number(aiConfig.maxAutoActionsPerTicket ?? 3)));
        const lowConfidence = analysis.confidence < threshold;
        // 1️⃣ رد بالتحليل والحل المقترح
        const initialEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🤖 AI Ticket Assistant — تحليل التذكرة')
            .setColor(analysis.severity === 'critical'
            ? embeds_1.Colors.error
            : analysis.severity === 'high'
                ? embeds_1.Colors.warning
                : embeds_1.Colors.info)
            .addFields({ name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true }, { name: '⚡ الخطورة', value: analysis.severity, inline: true }, { name: '🎯 الثقة', value: `${analysis.confidence}% (الحد ${threshold}%)`, inline: true }, { name: '📋 الملخص', value: analysis.summary || '—', inline: false }, { name: '💡 الحل المقترح', value: analysis.suggestedSolution || '—', inline: false })
            .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant` })
            .setTimestamp();
        await channel.send({ embeds: [initialEmbed] }).catch(() => { });
        const context = {
            ticketUserId: (0, aiTicketActions_1.normalizeId)(ticket.userId),
            ticketChannelId: channel.id,
        };
        // 2️⃣ تقسيم الإجراءات: تلقائي مقابل موافقة
        const autoActions = [];
        const approvalActions = [];
        let autoCount = 0;
        for (const action of analysis.requiredActions) {
            const needsApproval = (0, aiTicketActions_1.actionNeedsApproval)(action, aiConfig);
            // ثقة منخفضة أو تجاوز الحد → كل شيء يحتاج موافقة
            if (needsApproval || lowConfidence || autoCount >= maxAuto) {
                approvalActions.push(action);
            }
            else {
                autoActions.push(action);
                autoCount += 1;
            }
        }
        // 3️⃣ تنفيذ الإجراءات الآمنة
        let failedAuto = 0;
        const autoResults = [];
        for (const action of autoActions) {
            const result = await (0, aiTicketActions_1.executeTicketAction)(this.client, guild, action, context);
            if (result.ok) {
                autoResults.push(result.message);
            }
            else {
                failedAuto += 1;
                logger.warn(`AI Ticket auto action failed (${action.type}) in ${guild.name}: ${result.message}`);
                autoResults.push(`⚠️ فشل **${action.description || action.type}**: ${result.message}`);
                // إجراء فشل → نحوّله لطلب موافقة إدارية بدل تجاهله
                approvalActions.push(action);
            }
        }
        if (autoResults.length > 0) {
            const resultsEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('⚙️ نتائج الإجراءات التلقائية')
                .setColor(failedAuto > 0 ? embeds_1.Colors.warning : embeds_1.Colors.success)
                .setDescription(autoResults.map(r => `> ${r}`).join('\n').slice(0, 4000))
                .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant` })
                .setTimestamp();
            await channel.send({ embeds: [resultsEmbed] }).catch(() => { });
        }
        // 4️⃣ طلبات الموافقة
        if (approvalActions.length > 0) {
            await this.requestAdminApproval(channel, ticket, approvalActions, analysis, aiConfig);
        }
        // 5️⃣ منشن الإدارة عند الحاجة
        const shouldNotify = Boolean(aiConfig.notifyAdminsOnFailure) &&
            (lowConfidence || failedAuto > 0 || (analysis.requiredActions.length === 0 && analysis.needsAdminAction));
        if (shouldNotify) {
            await this.notifyAdmins(channel, ticket, analysis);
        }
        await this.logAITicketEvent(channel, {
            title: '🤖 تحليل تذكرة',
            color: embeds_1.Colors.info,
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
    async requestAdminApproval(channel, ticket, actions, analysis, aiConfig) {
        const settings = await (0, models_1.getGuildSettings)(channel.guild.id);
        const adminRoles = settings.tickets?.adminRoleIds?.length
            ? settings.tickets.adminRoleIds
            : settings.tickets?.supportRoleIds || [];
        const mention = adminRoles.map(r => `<@&${r}>`).join(' ');
        for (const action of actions) {
            const approvalId = (0, crypto_1.randomUUID)();
            const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
            try {
                await models_1.AITicketApproval.create({
                    approvalId,
                    guildId: channel.guild.id,
                    ticketId: String(ticket._id),
                    ticketUserId: (0, aiTicketActions_1.normalizeId)(ticket.userId) || undefined,
                    channelId: channel.id,
                    action,
                    status: 'pending',
                    requestedBy: 'ai',
                    requestedAt: new Date(),
                    expiresAt,
                });
            }
            catch (error) {
                logger.error(`Could not persist AI approval: ${error.message}`);
                continue;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🤖 AI Ticket Assistant — يطلب موافقة إدارية')
                .setColor(embeds_1.Colors.warning)
                .addFields({ name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true }, { name: '🤖 مطلوب من', value: 'AI Assistant', inline: true }, {
                name: '⏰ تنتهي',
                value: `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`,
                inline: true,
            }, { name: '⚡ الإجراء', value: action.description || action.type, inline: false }, { name: '📝 السبب', value: analysis.suggestedSolution || '—', inline: false }, {
                name: '🔒 يحتاج موافقة',
                value: 'نعم — هذا الإجراء يعطي صلاحيات/رول/حظر',
                inline: true,
            })
                .setFooter({ text: `Approval ID: ${approvalId}` })
                .setTimestamp();
            const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_ai:approve:${approvalId}`)
                .setLabel('✅ موافقة')
                .setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_ai:deny:${approvalId}`)
                .setLabel('❌ رفض')
                .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_ai:details:${approvalId}`)
                .setLabel('📋 تفاصيل')
                .setStyle(discord_js_1.ButtonStyle.Secondary));
            await channel
                .send({
                content: mention ? `${mention} — الذكاء الاصطناعي يطلب موافقتك على إجراء حساس` : undefined,
                embeds: [embed],
                components: [row],
            })
                .catch(() => { });
            // انتهاء الصلاحية — تحديث الحالة فقط (السجل يبقى للتدقيق)
            const timer = setTimeout(() => {
                void models_1.AITicketApproval.updateOne({ approvalId, status: 'pending' }, { $set: { status: 'expired' } }).catch(() => { });
            }, APPROVAL_TTL_MS);
            timer.unref?.();
        }
    }
    // --------------------------------------------
    // معالجة موافقة/رفض الأدمن — يُستدعى من زر ticket_ai
    // --------------------------------------------
    async handleAdminResponse(approvalId, adminId, approve, expectedGuildId) {
        const approval = await models_1.AITicketApproval.findOne({ approvalId }).catch(() => null);
        if (!approval) {
            return { ok: false, message: '❌ لم أجد طلب الموافقة — ربما حُذف.' };
        }
        if (expectedGuildId && approval.guildId !== expectedGuildId) {
            return { ok: false, message: '❌ طلب الموافقة لا يخص هذا السيرفر.' };
        }
        if (approval.status !== 'pending') {
            const labels = {
                approved: 'تمت الموافقة مسبقاً',
                denied: 'تم رفضه مسبقاً',
                expired: 'انتهت صلاحيته',
            };
            return { ok: false, message: `⚠️ هذا الطلب ${labels[approval.status] || approval.status}.` };
        }
        if (new Date(approval.expiresAt).getTime() <= Date.now()) {
            await models_1.AITicketApproval.updateOne({ approvalId }, { $set: { status: 'expired' } }).catch(() => { });
            return { ok: false, message: '⏰ انتهت صلاحية طلب الموافقة.' };
        }
        const channel = (await this.client.channels
            .fetch(approval.channelId)
            .catch(() => null));
        if (!approve) {
            await models_1.AITicketApproval.updateOne({ approvalId, status: 'pending' }, { $set: { status: 'denied', approvedBy: adminId, approvedAt: new Date() } }).catch(() => { });
            if (channel) {
                await channel
                    .send({
                    content: `❌ **تم الرفض** بواسطة <@${adminId}> — الإجراء: ${approval.action?.description || approval.action?.type}`,
                })
                    .catch(() => { });
            }
            logger.info(`AI Ticket: Admin ${adminId} denied ${approvalId}`);
            return { ok: true, message: '❌ تم رفض الإجراء.' };
        }
        // Claim atomically even though only one interaction can arrive at a time
        const claimed = await models_1.AITicketApproval.findOneAndUpdate({ approvalId, status: 'pending' }, { $set: { status: 'approved', approvedBy: adminId, approvedAt: new Date() } }, { new: true }).catch(() => null);
        if (!claimed) {
            return { ok: false, message: '⚠️ تمت معالجة هذا الطلب بالفعل.' };
        }
        if (!channel) {
            return { ok: false, message: '❌ قناة التذكرة لم تعد موجودة — لم يُنفَّذ الإجراء.' };
        }
        const result = await (0, aiTicketActions_1.executeTicketAction)(this.client, channel.guild, claimed.action, {
            ticketUserId: (0, aiTicketActions_1.normalizeId)(claimed.ticketUserId) || undefined,
            ticketChannelId: channel.id,
        });
        await channel
            .send({
            content: `${result.ok ? '✅ **تمت الموافقة**' : '⚠️ **تمت الموافقة لكن فشل التنفيذ**'} بواسطة <@${adminId}> — ${claimed.action?.description || claimed.action?.type}\n> ${result.message}`,
        })
            .catch(() => { });
        await models_1.AITicketApproval.updateOne({ approvalId }, { $set: { resultMessage: result.message } }).catch(() => { });
        logger.info(`AI Ticket: Admin ${adminId} approved ${approvalId} — ${result.ok ? 'ok' : 'failed'}`);
        return result;
    }
    // --------------------------------------------
    // منشن الإدارة العليا (لو AI مش قادر يحل)
    // --------------------------------------------
    async notifyAdmins(channel, ticket, analysis) {
        const settings = await (0, models_1.getGuildSettings)(channel.guild.id);
        const adminRoles = settings.tickets?.adminRoleIds?.length
            ? settings.tickets.adminRoleIds
            : settings.tickets?.supportRoleIds || [];
        const mention = adminRoles.map(r => `<@&${r}>`).join(' ');
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🤖 AI Ticket Assistant — يحتاج تدخل إداري')
            .setColor(embeds_1.Colors.warning)
            .addFields({ name: '🎫 التذكرة', value: `#${ticket.ticketNumber || ticket._id}`, inline: true }, { name: '📂 التصنيف', value: this.getCategoryLabel(analysis.category), inline: true }, { name: '⚡ الخطورة', value: analysis.severity, inline: true }, { name: '📋 الملخص', value: analysis.summary || '—', inline: false }, {
            name: '💡 محاولة الحل',
            value: analysis.suggestedSolution || 'لم يتم اقتراح حل آلي',
            inline: false,
        }, { name: '🎯 ثقة الـ AI', value: `${analysis.confidence}%`, inline: true })
            .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant — يتطلب مراجعة بشرية` })
            .setTimestamp();
        await channel
            .send({
            content: mention
                ? `${mention} — الذكاء الاصطناعي لم يستطع حل المشكلة آلياً، يرجى المراجعة`
                : 'الذكاء الاصطناعي لم يستطع حل المشكلة آلياً، يرجى المراجعة',
            embeds: [embed],
        })
            .catch(() => { });
    }
    // --------------------------------------------
    // سجل أحداث AI Ticket
    // --------------------------------------------
    async logAITicketEvent(channel, data) {
        try {
            const aiConfig = await this.getConfig(channel.guild.id);
            const logId = aiConfig?.logChannel;
            if (!logId || logId === channel.id)
                return;
            const logChannel = channel.guild.channels.cache.get(logId);
            if (!logChannel || !logChannel.isTextBased())
                return;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(data.title)
                .setColor(data.color)
                .addFields(data.fields)
                .setFooter({ text: `${channel.guild.name} • AI Ticket Assistant` })
                .setTimestamp();
            await logChannel.send({ embeds: [embed] }).catch(() => { });
        }
        catch {
            /* السجل اختياري */
        }
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
    // عرض تفاصيل طلب موافقة (زر 📋)
    // --------------------------------------------
    async getApprovalDetails(approvalId) {
        const approval = await models_1.AITicketApproval.findOne({ approvalId }).catch(() => null);
        if (!approval)
            return null;
        return {
            approvalId: approval.approvalId,
            guildId: approval.guildId,
            ticketId: approval.ticketId,
            channelId: approval.channelId,
            action: approval.action,
            status: approval.status,
            requestedAt: approval.requestedAt,
            expiresAt: approval.expiresAt,
            approvedBy: approval.approvedBy,
            approvedAt: approval.approvedAt,
            resultMessage: approval.resultMessage,
        };
    }
    // --------------------------------------------
    // تعلم من التذاكر المغلقة (المستقبل)
    // --------------------------------------------
    async learnFromClosedTicket(ticket, resolution) {
        // يمكن ربطه لاحقاً بقاعدة المعرفة (KnowledgeEntry) تلقائياً
        logger.info(`AI Ticket learning from closed ticket ${ticket._id}: ${resolution.substring(0, 100)}`);
    }
}
exports.AITicketAssistant = AITicketAssistant;
exports.default = AITicketAssistant;
//# sourceMappingURL=AITicketAssistant.js.map