"use strict";
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
const securityAlerts_1 = require("../utils/securityAlerts");
const knowledge_1 = require("../utils/knowledge");
const embeds_1 = require("../utils/embeds");
const aiTicketActions_1 = require("../utils/aiTicketActions");
const logger = (0, helpers_1.createLogger)('AITicketAssistant');
const APPROVAL_TTL_MS = 15 * 60 * 1000;
class AITicketAssistant {
    client;
    /** 🛡️ منع ردّين متزامنين على نفس التذكرة عند وصول رسائل سريعة */
    ticketReplyInFlight = new Set();
    /** ⏳ فترة سماح بعد الرد الأولي حتى لا يردّ AI مرتين على نفس التذكرة */
    ticketAutoCooldown = new Map();
    constructor(client) {
        this.client = client;
    }
    // --------------------------------------------
    // إعدادات المساعد — تقرأ من protection أولاً ثم الجذر
    // --------------------------------------------
    async getConfig(guildId) {
        const settings = await (0, models_1.getGuildSettings)(guildId);
        // 🔓 مساعد التذاكر مستقل تماماً عن مفتاح الذكاء العام — له مفتاحه الخاص
        const config = settings.protection?.aiTicketAssistant ?? settings.aiTicketAssistant;
        return config || null;
    }
    // --------------------------------------------
    // 🎭 كتلة الشخصية المخصصة — تعليمات السيرفر لمساعد التذاكر
    // تُحقن في كل مطالبة (رد أولي، ردود المتابعة، التحليل) وتُقدَّم على أي تعليمات أسلوب أخرى
    // --------------------------------------------
    personaBlock(config) {
        const persona = String(config?.customPersonality || '').trim();
        if (!persona)
            return '';
        return (`\n\n**🎭 شخصية وتعليمات السيرفر المخصصة لمساعد التذاكر — التزم بها حرفياً ولا تخالفها مهما حدث (لها الأولوية على أي تعليمات أسلوب أخرى):**\n` +
            `${persona.slice(0, 2000)}\n`);
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
            // ⚙️ خيار "تحليل عند الإنشاء" مستقل عن الاستلام التلقائي
            //    لو معطّل: يستلم التذكرة فقط ولا يحللها ولا يرد تلقائياً
            if (aiConfig.analyzeOnCreate === false)
                return;
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
            await this.sendAutoResponse(channel, firstUserMessage, ticket, aiConfig);
            // فترة سماح: لو العضو كتب رسالة تانية بسرعة، التحليل أو الرد الأولي يغطيها
            this.ticketAutoCooldown.set(channel.id, Date.now() + 8000);
            const cooldownTimer = setTimeout(() => this.ticketAutoCooldown.delete(channel.id), 9000);
            cooldownTimer.unref?.();
            // تحليل المشكلة
            const analysis = await this.analyzeTicket(firstUserMessage, channel.guild, ticket, aiConfig);
            // تنفيذ الحل المقترح
            await this.executeSolution(ticket, channel, analysis, aiConfig);
        }
        catch (error) {
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
    isCloseIntent(content) {
        const text = content.toLowerCase().trim();
        // نفي ("لا تُقفل" / "متقفلش") → نترك للـ AI العادي
        if (/(لا\s*(ت?تقفل|ت?ت?غلق|ت?نها|ت?تنهي)|متقفلش|ماتقفلش|don'?t\s+close)/i.test(text))
            return false;
        const hasCloseWord = /(اق?فل|قف?ل|اق?فلها?|ا?غلق|ا?غلقها?|انهي|انهِ?ي|ا?نهها?|انهاء|إنهاء)/i.test(text);
        const hasTicketWord = /(تكت|تذكرة|تذكره|ticket|تذكر)/i.test(text);
        return hasCloseWord && hasTicketWord;
    }
    async onTicketMessage(ticket, channel, message) {
        try {
            if (!message.content.trim() && message.attachments.size === 0)
                return;
            if (['closed', 'deleted'].includes(String(ticket.status)))
                return;
            // 🔒 طلب قفل/إغلاق التذكرة من داخل التذكرة نفسها — فريق الدعم/الإدارة فقط
            if (this.isCloseIntent(message.content || '')) {
                const member = message.member;
                const canClose = !!member && (await this.client.ticketHandler.isStaff(member));
                if (!canClose) {
                    await message.reply({ content: '❌ إغلاق التذاكر متاح لفريق الدعم والإدارة فقط.' }).catch(() => { });
                    return;
                }
                try {
                    await message.reply({ content: '🔒 **جارٍ إغلاق التذكرة والقناة الحالية...**' }).catch(() => { });
                    await this.client.ticketHandler.closeTicket(channel.id, member, 'إغلاق عبر طلب العضو/الإدارة من داخل التذكرة');
                }
                catch (error) {
                    logger.warn(`AI close ticket failed: ${error?.message || error}`);
                    await channel.send({ content: `❌ تعذّر إغلاق التذكرة: ${error?.message || 'خطأ غير معروف'}` }).catch(() => { });
                }
                return;
            }
            // من يتحدث الآن؟ صاحب التذكرة؟ الإدارة/المدّعي؟
            const settings = await (0, models_1.getGuildSettings)(channel.guild.id).catch(() => null);
            const member = message.member;
            const isOwner = String(ticket.userId) === message.author.id;
            const isClaimer = !!ticket.claimedBy && String(ticket.claimedBy) === message.author.id;
            const isStaff = !!settings?.tickets?.supportRoleIds?.some((r) => member?.roles.cache.has(r)) ||
                !!settings?.tickets?.adminRoleIds?.some((r) => member?.roles.cache.has(r)) ||
                !!member?.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels) ||
                !!member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator);
            // الـ AI يرد على صاحب التذكرة + الإدارة/المدّعي (طرد الناس اللي مش ذات صلة)
            if (!isOwner && !isClaimer && !isStaff)
                return;
            // 🔐 الإدارة/المدّعي: البوت يسكت إلا إذا طلبه صراحة (منشن) أو ردّ عليه.
            //     فاتح التذكرة (صاحب التذكرة) يرد عليه عادي بدون حاجة لأي منشن/رد.
            const botId = this.client.user?.id ?? '';
            const mentioned = !!botId && (message.mentions?.users?.has(botId) || message.mentions?.members?.has(botId));
            let repliedToBot = false;
            if (message.reference?.messageId) {
                try {
                    const cached = message.channel.messages.cache.get(message.reference.messageId);
                    const refMessage = cached || (await message.channel.messages.fetch(message.reference.messageId));
                    repliedToBot = !!refMessage && refMessage.author?.id === botId;
                }
                catch {
                    repliedToBot = false;
                }
            }
            if (!isOwner && !mentioned && !repliedToBot)
                return;
            const aiConfig = await this.getConfig(channel.guild.id);
            if (!aiConfig?.enabled)
                return;
            if (aiConfig.replyToMessages === false)
                return;
            // لو لسه في فترة الرد الأولي/التحليل → ما نكررش الرد
            const autoUntil = this.ticketAutoCooldown.get(channel.id) || 0;
            if (Date.now() < autoUntil)
                return;
            // منع ردّين متزامنين لنفس التذكرة
            if (this.ticketReplyInFlight.has(channel.id))
                return;
            this.ticketReplyInFlight.add(channel.id);
            try {
                const recent = await channel.messages.fetch({ limit: 20 });
                const transcript = [...recent.values()]
                    .reverse()
                    .filter(m => m.content.trim())
                    .map(m => {
                    const who = m.author.id === this.client.user?.id
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
                    await channel.sendTyping().catch(() => { });
                }
                const response = await this.client.aiHandler.generateResponse(`ticket-ai:chat:${String(ticket._id)}`, channel.guild.id, channel.id, prompt, [], false, false, { fromCommand: true, ignoreGlobalToggle: true });
                const content = response?.content?.trim().slice(0, 1900);
                if (!content)
                    return;
                await message
                    .reply({ content, allowedMentions: { parse: [], repliedUser: false } })
                    .catch(async () => {
                    await channel.send({ content }).catch(() => { });
                });
                logger.info(`AI ticket follow-up reply in ${channel.guild.name}`);
            }
            finally {
                this.ticketReplyInFlight.delete(channel.id);
            }
        }
        catch (error) {
            logger.warn(`AI ticket follow-up failed: ${error.message}`);
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
            // 🔓 استلام AI مش زي استلام إداري: لازم نفتح الكتابة لصاحب التذكرة وفريق الدعم
            //    وإلا التذكرة تتقفل على البوت ومحدش يقدر يرد غيره
            try {
                const settings = await (0, models_1.getGuildSettings)(channel.guild.id);
                const permissionJobs = [];
                if (settings.tickets?.lockUntilClaim && ticket.userId) {
                    permissionJobs.push(channel.permissionOverwrites
                        .edit(String(ticket.userId), { SendMessages: true })
                        .catch(() => { }));
                }
                for (const roleId of settings.tickets?.supportRoleIds || []) {
                    permissionJobs.push(channel.permissionOverwrites
                        .edit(roleId, { SendMessages: true })
                        .catch(() => { }));
                }
                await Promise.allSettled(permissionJobs);
            }
            catch (error) {
                logger.warn(`AI claim permission update failed: ${error.message}`);
            }
            const ownerPing = ticket.userId ? `<@${ticket.userId}>` : '';
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🤖 مساعد الدعم — استلام التذكرة')
                .setDescription(`أهلاً ${ownerPing || ''}! أنا استلمت تذكرتك الآن.\nاكتب وصف المشكلة بالتفصيل وأنا على طول أبدأ أحلها.`)
                .setColor(0x5865f2)
                .setFooter({ text: `${channel.guild.name} • مساعد الدعم` })
                .setTimestamp();
            await channel.send({ embeds: [embed] }).catch(() => { });
            // 🤖 تحديث الأزرار: استلام من البوت + إلغاء استلام البوت (للمسؤول فقط)
            await this.client.ticketHandler.updateTicketButtons(channel, true, true).catch(() => { });
            logger.info(`AI auto-claimed ticket in ${channel.guild.name}`);
        }
        catch (error) {
            logger.error(`Auto-claim error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // Auto-response when ticket is created
    // --------------------------------------------
    async sendAutoResponse(channel, firstMessage, ticket, aiConfig) {
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
            const response = await this.client.aiHandler.generateResponse(`ticket-ai:reply:${String(ticket._id)}`, channel.guild.id, channel.id, prompt, [], false, false, { fromCommand: true, ignoreGlobalToggle: true });
            if (response?.content) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🤖 AI Assistant — رد أولي')
                    .setDescription(response.content.slice(0, 4000))
                    .setColor(0x5865f2)
                    .setFooter({ text: `${channel.guild.name} • AI • جاري تحليل المشكلة...` })
                    .setTimestamp();
                await channel.send({ embeds: [embed] }).catch(() => { });
                logger.info(`AI auto-response sent in ${channel.guild.name}`);
                return;
            }
            // 🆘 لو الذكاء فشل/ما ردش — نرسل رسالة ودودة ثابتة بدل ما تسيب العضو صامت
            const fallback = new discord_js_1.EmbedBuilder()
                .setTitle('🤖 مساعد الدعم')
                .setDescription(`أهلاً! أنا استلمت تذكرتك الآن.\n` +
                `اكتب وصف المشكلة بالتفصيل (مع أيصور أو ملفات لو فيه حاجة) وأنا على طول أبدأ أحلها.`)
                .setColor(0x5865f2)
                .setFooter({ text: `${channel.guild.name} • مساعد الدعم` })
                .setTimestamp();
            await channel.send({ embeds: [fallback] }).catch(() => { });
            logger.warn(`AI auto-response fallback sent in ${channel.guild.name} (AI returned empty content)`);
        }
        catch (error) {
            logger.warn(`Auto-response failed: ${error.message}`);
        }
    }
    // --------------------------------------------
    // تحليل التذكرة بالـ AI
    // --------------------------------------------
    async analyzeTicket(message, guild, ticket, aiConfig) {
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
            const response = await this.client.aiHandler.generateResponse(`ticket-ai:analysis:${String(ticket._id)}`, guild.id, message.channel.id, prompt, [], false, false, { fromCommand: true, ignoreGlobalToggle: true });
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
        const loggedAnalysis = await this.sendToTicketLog(channel, initialEmbed, aiConfig);
        // 🤫 التحليل كاملاً في اللوق فقط — لا رسائل تشويش داخل التذكرة
        await this.sendToTicketLog(channel, initialEmbed, aiConfig);
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
            const loggedResults = await this.sendToTicketLog(channel, resultsEmbed, aiConfig);
            // 🤫 نشرة الإجراءات في اللوق فقط — لا تشويش داخل التذكرة
            await this.sendToTicketLog(channel, resultsEmbed, aiConfig);
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
    // إرسال تحليل/سجلات إلى لوق التذاكر (إن وُجد) — fallback إلى التذكرة
    // --------------------------------------------
    async sendToTicketLog(channel, embed, aiConfig) {
        try {
            // أولوية أولى: قناة لوق التذاكر المخصصة لإعدادات AI Ticket
            const logId = aiConfig?.logChannel;
            if (logId && logId !== channel.id) {
                const logChannel = channel.guild.channels.cache.get(logId);
                if (logChannel && logChannel.isTextBased()) {
                    await logChannel.send({ embeds: [embed] }).catch(() => { });
                    return true;
                }
            }
            // احتياط: قناة لوق الحماية (الأمن) — فقط إن لم يوجد لوق تذاكر، وبشرط عدم كتم التنبيهات الأمنية
            const settings = await (0, models_1.getGuildSettings)(channel.guild.id).catch(() => null);
            const plogId = settings?.protection?.logChannel;
            if (plogId && plogId !== channel.id && !(0, securityAlerts_1.securityAlertsSilent)(settings || {})) {
                const logChannel = channel.guild.channels.cache.get(plogId);
                if (logChannel && logChannel.isTextBased()) {
                    await logChannel.send({ embeds: [embed] }).catch(() => { });
                    return true;
                }
            }
            logger.warn(`AI Ticket: لا توجد قناة لوق صالحة في ${channel.guild.name} — الرسالة لم تُرسل لأي قناة عامة`);
        }
        catch {
            /* ignore */
        }
        // ⛔ ممنوع إرسال التحليل في قناة التذكرة لقاعدة المستخدم: التحليل يذهب للوق فقط
        return false;
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
    // 🧠 التعلّم التلقائي من التذاكر المغلقة
    // يقرأ سؤال صاحب التذكرة + حل الفريق (أو حل الذكاء الاصطناعي)
    // ويحوّله إلى معلومة في قاعدة المعرفة تُستخدم في الردود القادمة
    // --------------------------------------------
    async learnFromClosedTicket(ticket, resolution = '') {
        try {
            if (!ticket?.guildId || !ticket?.channelId)
                return;
            // ⚙️ مفتاح التعلّم — افتراضي مفعّل، ويُعطَّل من لوحة إعدادات مساعد التذاكر
            const aiConfig = await this.getConfig(String(ticket.guildId)).catch(() => null);
            if (aiConfig && aiConfig.learnFromTickets === false) {
                logger.debug(`Learning disabled for guild ${ticket.guildId}`);
                return;
            }
            const channel = (await this.client.channels
                .fetch(String(ticket.channelId))
                .catch(() => null));
            if (!channel)
                return;
            const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
            const messages = fetched ? [...fetched.values()].reverse() : []; // الأقدم → الأحدث
            const ownerId = String(ticket.userId || '');
            const botId = this.client.user?.id;
            const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
            const isNoise = (text) => text.length < 12 ||
                /^(تم|شكرا|شكراً|مشكور|يعطيك العافيه|يعطيك العافية|جزاك الله|بارك الله|الله يعافيك|حياك الله|العفو|ok|okay|تمام|ماشي|طيب)[\s!،.…-]*$/i.test(text);
            // 📌 السؤال: أول رسالة جدية من صاحب التذكرة (أو وصف التذكرة/النموذج)
            const ownerMsgs = messages.filter(m => !m.author.bot && m.author.id === ownerId && clean(m.content).length >= 5);
            let question = clean(ownerMsgs[0]?.content || '');
            if (question.length < 5)
                question = clean(String(ticket.subject || ''));
            if (question.length < 5 && Array.isArray(ticket.fields)) {
                question = clean(ticket.fields.map((f) => `${f.question || ''}: ${f.answer || ''}`).join(' | '));
            }
            if (question.length < 8)
                return; // لا يوجد ما نتعلّم منه
            // 🧑💼 الحل: آخر رسائل الفريق (غير البوت وغير صاحب التذكرة) — أو حل الـ AI إن لم يوجد فريق
            const staffMsgs = messages.filter(m => {
                const text = clean(m.content);
                return !m.author.bot && m.author.id !== ownerId && !isNoise(text);
            });
            const botMsgs = messages.filter(m => {
                if (m.author.id !== botId)
                    return false;
                // الردود الحوارية فقط (content) — نتجاهل إيمبدات الإشعارات مثل "تم استلام التذكرة"/"تم الإغلاق"
                const text = clean(m.content);
                return text.length >= 30 && !isNoise(text);
            });
            const solutionParts = [];
            if (staffMsgs.length) {
                solutionParts.push(...staffMsgs.slice(-3).map(m => clean(m.content)));
            }
            else if (botMsgs.length) {
                const last = botMsgs[botMsgs.length - 1];
                solutionParts.push(clean(last.content));
            }
            const cleanResolution = clean(resolution);
            if (cleanResolution.length >= 5 &&
                cleanResolution !== 'غير محدد' &&
                !isNoise(cleanResolution)) {
                solutionParts.push(`سبب الإغلاق: ${cleanResolution}`);
            }
            const solution = clean(solutionParts.filter(Boolean).join('\n')).slice(0, 1500);
            if (solution.length < 15) {
                logger.debug(`Skipping knowledge learn for ticket ${ticket._id}: no usable solution`);
                return;
            }
            const guildId = String(ticket.guildId);
            const title = `تذكرة — ${question.slice(0, 80)}`;
            const content = `المشكلة (تذكرة #${ticket.ticketNumber || String(ticket._id).slice(-6)}):\n` +
                `${question.slice(0, 900)}\n\n` +
                `الحل المعتمد من الفريق:\n${solution}`;
            const tags = [
                ...new Set([
                    'تذاكر',
                    clean(String(ticket.type || '')),
                    ...(0, knowledge_1.tokenize)(`${question} ${solution}`).slice(0, 12),
                ].filter(Boolean)),
            ];
            const existing = await models_1.KnowledgeEntry.findOne({ guildId, title }).catch(() => null);
            if (existing) {
                existing.content = content;
                existing.tags = tags;
                existing.enabled = true;
                await existing.save();
            }
            else {
                await models_1.KnowledgeEntry.create({
                    guildId,
                    title,
                    content,
                    tags,
                    category: 'تذاكر (تعلّم تلقائي)',
                    createdBy: 'auto-learning',
                    enabled: true,
                });
            }
            (0, knowledge_1.invalidateKnowledgeCache)(guildId);
            await this.pruneAutoKnowledge(guildId);
            logger.info(`Learned solution from ticket ${ticket._id} (${question.slice(0, 60)}…) in guild ${guildId}`);
        }
        catch (error) {
            logger.warn(`learnFromClosedTicket failed: ${error.message}`);
        }
    }
    // 🗑️ حد أقصى لمعلومات التعلّم التلقائي لكل سيرفر — حذف الأقدم عند التجاوز
    async pruneAutoKnowledge(guildId) {
        try {
            const MAX_AUTO_ENTRIES = 500;
            const count = await models_1.KnowledgeEntry.countDocuments({
                guildId,
                createdBy: 'auto-learning',
            });
            if (count <= MAX_AUTO_ENTRIES)
                return;
            const stale = await models_1.KnowledgeEntry.find({
                guildId,
                createdBy: 'auto-learning',
            })
                .sort({ updatedAt: 1 })
                .limit(count - MAX_AUTO_ENTRIES)
                .select('_id');
            if (stale.length) {
                await models_1.KnowledgeEntry.deleteMany({ _id: { $in: stale.map(e => e._id) } });
                (0, knowledge_1.invalidateKnowledgeCache)(guildId);
            }
        }
        catch {
            /* التنظيف اختياري */
        }
    }
}
exports.AITicketAssistant = AITicketAssistant;
exports.default = AITicketAssistant;
//# sourceMappingURL=AITicketAssistant.js.map