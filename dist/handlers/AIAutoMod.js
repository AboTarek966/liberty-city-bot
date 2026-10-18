"use strict";
// ============================================
// Liberty City Bot - AI Auto-Moderation
// ============================================
// الـ AI يقرأ كل رسالة بنفسه ويقرر: سبام/سم/إباحي/احتيال/تهديد/تسريب بيانات
// يتصرف تلقائياً: يحذف/يحذر/يكتم/يبن + لاوج كامل
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAutoModHandler = void 0;
const discord_js_1 = require("discord.js");
const models_1 = require("../models");
const helpers_1 = require("../utils/helpers");
const embeds_1 = require("../utils/embeds");
const logger = (0, helpers_1.createLogger)('AIAutoMod');
const DEFAULT_CONFIG = {
    enabled: false,
    categories: {
        spam: true,
        toxicity: true,
        nsfw: true,
        scam: true,
        threat: true,
        pii: true,
        raid: true,
        selfharm: true,
    },
    sensitivity: 7,
    actions: {
        spam: 'delete',
        toxicity: 'warn',
        nsfw: 'delete',
        scam: 'ban',
        threat: 'ban',
        pii: 'delete',
        raid: 'mute',
        selfharm: 'resources',
    },
    muteDuration: 10,
    ignoredChannels: [],
    ignoredRoles: [],
    escalation: true,
    maxWarningsBeforeEscalation: 3,
};
class AIAutoModHandler {
    client;
    aiHandler;
    warningCounts = new Map(); // guildId -> userId -> count
    recentMessages = new Map();
    constructor(client) {
        this.client = client;
        this.aiHandler = client.aiHandler;
    }
    // --------------------------------------------
    // نقطة الدخول: فحص رسالة
    // --------------------------------------------
    async scanMessage(message) {
        try {
            // تجاهل البوتات والويبهوكس
            if (message.author.bot || message.webhookId)
                return null;
            if (!message.guild)
                return null;
            const settings = await (0, models_1.getGuildSettings)(message.guild.id);
            const cfg = this.getConfig(settings);
            if (!cfg.enabled)
                return null;
            // تجاهل القنوات المستثناة
            if (cfg.ignoredChannels?.includes(message.channel.id))
                return null;
            // تجاهل الرولات المستثناة
            if (message.member && cfg.ignoredRoles?.some(r => message.member.roles.cache.has(r)))
                return null;
            // تجاهل الإدارة
            if (message.member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator))
                return null;
            // بناء السياق للـ AI
            const context = this.buildContext(message);
            // استدعاء الـ AI للتحليل
            const result = await this.analyzeWithAI(message, context, cfg);
            if (result.flagged) {
                await this.executeAction(message, result, cfg);
            }
            // تتبع الرسائل الحديثة للكشف عن السبام/الرائد
            this.trackMessage(message);
            return result;
        }
        catch (error) {
            logger.error(`AIAutoMod scanMessage error: ${error.message}`);
            return null;
        }
    }
    getConfig(settings) {
        const aiMod = settings.aiAutoMod;
        if (!aiMod)
            return DEFAULT_CONFIG;
        return {
            enabled: aiMod.enabled ?? false,
            categories: { ...DEFAULT_CONFIG.categories, ...aiMod.categories },
            sensitivity: aiMod.sensitivity ?? 7,
            actions: { ...DEFAULT_CONFIG.actions, ...aiMod.actions },
            muteDuration: aiMod.muteDuration ?? 10,
            ignoredChannels: aiMod.ignoredChannels ?? [],
            ignoredRoles: aiMod.ignoredRoles ?? [],
            logChannel: aiMod.logChannel,
            escalation: aiMod.escalation ?? true,
            maxWarningsBeforeEscalation: aiMod.maxWarningsBeforeEscalation ?? 3,
        };
    }
    buildContext(message) {
        const guild = message.guild;
        const member = message.member;
        let ctx = `الرسالة: "${message.content}"\n`;
        ctx += `المستخدم: ${message.author.tag} (${message.author.id})\n`;
        ctx += `الرول الأعلى: ${member.roles.highest.name}\n`;
        ctx += `الرومات الحديثة في القناة: ${this.getRecentContext(message.channel.id)}\n`;
        // المرفقات
        if (message.attachments.size > 0) {
            ctx += `المرفقات: ${message.attachments.map(a => `${a.name} (${a.contentType})`).join(', ')}\n`;
        }
        return ctx;
    }
    getRecentContext(channelId) {
        const recent = this.recentMessages.get(channelId) || [];
        if (recent.length === 0)
            return 'لا توجد رسائل سابقة';
        return recent.slice(-5).map(m => `${m.userId}: ${m.content.substring(0, 50)}`).join(' | ');
    }
    trackMessage(message) {
        const channelId = message.channel.id;
        const recent = this.recentMessages.get(channelId) || [];
        recent.push({
            content: message.content,
            timestamp: Date.now(),
            userId: message.author.id,
        });
        // نحتفظ بآخر 50 رسالة فقط
        if (recent.length > 50)
            recent.shift();
        this.recentMessages.set(channelId, recent);
    }
    // --------------------------------------------
    // التحليل بالـ AI
    // --------------------------------------------
    async analyzeWithAI(message, context, cfg) {
        const activeCategories = Object.entries(cfg.categories)
            .filter(([_, v]) => v)
            .map(([k]) => k)
            .join('، ');
        const prompt = `أنت نظام مراقبة محتوى متقدم (AI Auto-Moderator). حلّل الرسالة التالية وحدد إن كانت تنتهك السياسات.

**السياق:**
${context}

**التصنيفات المراقبة:** ${activeCategories}
**مستوى الحساسية:** ${cfg.sensitivity}/10

**تعليمات صارمة:**
1. حلّل بنية الرسالة، النية، والسياق — مش مجرد كلمات مفتاحية
2. اعتبر: سخرية، اقتباس، نقاش أكاديمي، مزاح بين أصدقاء = مش انتهاك
3. اعتبر: تكرار، توجيه للضحية، تصعيد، سياق عدائي = انتهاك
4. كن دقيقاً: الأفضل تفويت انتهاك طفيف من معاقبة بريء

**أجب بـ JSON فقط بالشكل التالي:**
{
  "flagged": boolean,
  "categories": ["spam", "toxicity", ...],
  "severity": "low|medium|high|critical",
  "action": "delete|warn|mute|ban|resources|none",
  "reason": "وصف مختصر للانتهاك",
  "confidence": 0-100,
  "suggestedResponse": "رد مقترح للـ AI العام (اختياري)"
}

**مهم:** لو مش متأكد (confidence < 60) → flagged: false`;
        try {
            const response = await this.aiHandler.generateResponse('system-automod', message.guild.id, message.channel.id, prompt, [], false, false, {
                fromCommand: true,
                userContext: undefined,
            });
            if (!response?.content) {
                return { flagged: false, categories: [], severity: 'low', action: 'none', reason: 'لا يوجد رد من الـ AI', confidence: 0 };
            }
            // محاولة استخراج JSON
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                logger.warn(`AI AutoMod: لم يتم العثور على JSON في الرد: ${response.content.substring(0, 100)}`);
                return { flagged: false, categories: [], severity: 'low', action: 'none', reason: 'فشل تحليل الرد', confidence: 0 };
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // تطبيق الحساسية
            if (parsed.confidence < cfg.sensitivity * 10) {
                return { flagged: false, categories: [], severity: 'low', action: 'none', reason: 'ثقة منخفضة', confidence: parsed.confidence };
            }
            // تحديد الإجراء بناءً على التصنيف
            const category = parsed.categories?.[0] || 'unknown';
            const action = cfg.actions[category] || 'none';
            return {
                flagged: parsed.flagged || false,
                categories: parsed.categories || [],
                severity: parsed.severity || 'low',
                action,
                reason: parsed.reason || 'انتهاك مكتشف',
                confidence: parsed.confidence || 0,
                suggestedResponse: parsed.suggestedResponse,
            };
        }
        catch (error) {
            logger.error(`AI AutoMod analysis error: ${error.message}`);
            return { flagged: false, categories: [], severity: 'low', action: 'none', reason: 'خطأ في التحليل', confidence: 0 };
        }
    }
    // --------------------------------------------
    // تنفيذ الإجراء
    // --------------------------------------------
    async executeAction(message, result, cfg) {
        const guild = message.guild;
        const member = message.member;
        const userId = message.author.id;
        try {
            // 1️⃣ حذف الرسالة (إذا كان الإجراء delete أو أعلى)
            if (['delete', 'warn', 'mute', 'ban'].includes(result.action)) {
                await message.delete().catch(() => { });
            }
            // 2️⃣ تنفيذ الإجراء
            switch (result.action) {
                case 'warn':
                    await this.warnUser(guild, member, result.reason);
                    break;
                case 'mute':
                    await this.muteUser(guild, member, cfg.muteDuration, result.reason);
                    break;
                case 'ban':
                    await this.banUser(guild, member, result.reason);
                    break;
                case 'resources':
                    // إرسال موارد مساعدة (للـ self-harm)
                    await this.sendHelpResources(message, result);
                    break;
            }
            // 3️⃣ تتبع التحذيرات للتصعيد
            if (cfg.escalation && ['warn', 'mute'].includes(result.action)) {
                await this.trackWarning(guild.id, userId, result, cfg);
            }
            // 4️⃣ لاوج
            await this.logAction(guild, message, member, result, cfg);
        }
        catch (error) {
            logger.error(`AIAutoMod executeAction error: ${error.message}`);
        }
    }
    async warnUser(guild, member, reason) {
        const result = await this.client.moderationHandler.warn({
            guild,
            moderator: guild.members.me,
            target: member,
            reason: `AI Auto-Mod: ${reason}`,
        });
        logger.info(`AI Auto-Mod warned ${member.user.tag}: ${reason}`);
    }
    async muteUser(guild, member, durationMinutes, reason) {
        if (!member.moderatable)
            return;
        await member.timeout(durationMinutes * 60 * 1000, `AI Auto-Mod: ${reason}`);
        logger.info(`AI Auto-Mod muted ${member.user.tag} for ${durationMinutes}m: ${reason}`);
    }
    async banUser(guild, member, reason) {
        if (!member.bannable)
            return;
        await member.ban({ reason: `AI Auto-Mod: ${reason}`, deleteMessageSeconds: 0 });
        logger.info(`AI Auto-Mod banned ${member.user.tag}: ${reason}`);
    }
    async sendHelpResources(message, result) {
        const resources = `💙 **نحن نهتم بك** — أنت لست وحدك:\n\n` +
            `🇸🇦 **السعودية:** 937 (الصحة النفسية) | 911 (الطوارئ)\n` +
            `🇪🇬 **مصر:** 08008880700 (الخط الساخن للصحة النفسية)\n` +
            `🇦🇪 **الإمارات:** 8004673 (Hope Line)\n` +
            `🌍 **دولي:** https://findahelpline.com/ — ابحث عن خط مساعدة في بلدك\n\n` +
            `**تواصل مع شخص تثق به الآن — حياتك تهمنا.**`;
        try {
            await message.author.send(resources).catch(() => {
                // لو الخاص مقفول، نرسل في القناة كرد عادي
                message.reply({ content: resources }).catch(() => { });
            });
        }
        catch { }
    }
    async trackWarning(guildId, userId, result, cfg) {
        const guildWarnings = this.warningCounts.get(guildId) || new Map();
        const userWarnings = guildWarnings.get(userId) || 0;
        const newCount = userWarnings + 1;
        guildWarnings.set(userId, newCount);
        this.warningCounts.set(guildId, guildWarnings);
        // تصعيد لو وصل للحد
        if (newCount >= cfg.maxWarningsBeforeEscalation) {
            const guild = this.client.guilds.cache.get(guildId);
            const member = guild?.members.cache.get(userId);
            if (member && member.moderatable) {
                await member.timeout(30 * 60 * 1000, `AI Auto-Mod: تصعيد تلقائي بعد ${newCount} تحذيرات`);
                logger.warn(`AI Auto-Mod escalated ${member.user.tag} to 30m mute (${newCount} warnings)`);
                // إعادة تعيين العداد
                guildWarnings.set(userId, 0);
            }
        }
    }
    async logAction(guild, message, member, result, cfg) {
        if (!cfg.logChannel)
            return;
        const logChannel = guild.channels.cache.get(cfg.logChannel);
        if (!logChannel)
            return;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🤖 AI Auto-Mod: ${result.action.toUpperCase()}`)
            .setColor(result.severity === 'critical' ? embeds_1.Colors.error : result.severity === 'high' ? embeds_1.Colors.warning : embeds_1.Colors.info)
            .addFields({ name: '👤 المستخدم', value: `${member} (\`${member.id}\`)`, inline: true }, { name: '📍 القناة', value: `${message.channel}`, inline: true }, { name: '🏷️ التصنيف', value: result.categories.join('، '), inline: true }, { name: '⚡ الإجراء', value: result.action, inline: true }, { name: '📊 الخطورة', value: result.severity, inline: true }, { name: '🎯 الثقة', value: `${result.confidence}%`, inline: true }, { name: '📝 السبب', value: result.reason, inline: false }, { name: '💬 الرسالة', value: message.content.substring(0, 500) || '(فارغة/مرفقات)', inline: false })
            .setFooter({ text: 'Liberty City AI Auto-Mod' })
            .setTimestamp();
        await logChannel.send({ embeds: [embed] }).catch(() => { });
    }
    // --------------------------------------------
    // تحديث الإعدادات
    // --------------------------------------------
    async updateConfig(guildId, updates) {
        const settings = await (0, models_1.getGuildSettings)(guildId);
        settings.aiAutoMod = { ...this.getConfig(settings), ...updates };
        await settings.save();
    }
    async getConfigForGuild(guildId) {
        const settings = await (0, models_1.getGuildSettings)(guildId);
        return this.getConfig(settings);
    }
}
exports.AIAutoModHandler = AIAutoModHandler;
exports.default = AIAutoModHandler;
//# sourceMappingURL=AIAutoMod.js.map