"use strict";
// ============================================
// Liberty City Bot - Anti-Alt Detection Handler
// ============================================
// يكشف الحسابات البديلة (Alts) عبر IP/جهاز/تاريخ الإنشاء
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntiAltHandler = void 0;
const models_1 = require("../models");
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('AntiAltHandler');
class AntiAltHandler {
    client;
    constructor(client) {
        this.client = client;
    }
    // --------------------------------------------
    // نقطة الدخول: عند انضمام عضو جديد
    // --------------------------------------------
    async onMemberJoin(member) {
        try {
            const settings = await (0, models_1.getGuildSettings)(member.guild.id);
            const cfg = settings.protection?.antiAlt;
            if (!cfg?.enabled)
                return;
            const result = await this.checkForAlts(member, cfg);
            if (result.isAlt) {
                await this.executeAction(member, result, cfg);
            }
        }
        catch (error) {
            logger.error(`AntiAlt onMemberJoin error (${member.guild.name}): ${error.message}`);
        }
    }
    // --------------------------------------------
    // كشف الـ Alts
    // --------------------------------------------
    async checkForAlts(member, cfg) {
        const guild = member.guild;
        const now = Date.now();
        const creationDays = (now - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
        // 1️⃣ فحص تاريخ الإنشاء (حسابات جديدة جداً)
        if (creationDays < cfg.checkCreationDays) {
            return {
                isAlt: true,
                reason: `حساب جديد (${Math.floor(creationDays)} يوم) — أقل من ${cfg.checkCreationDays} يوم`,
                matchedAccounts: [],
                action: cfg.action,
            };
        }
        // 2️⃣ فحص الحسابات الموجودة بنفس الـ IP/جهاز (محتاج Discord API لا يوفر IP)
        // كحل بديل: نفحص الحسابات اللي انضمت في نفس الوقت أو لها نفس النمط
        const suspiciousMembers = guild.members.cache.filter(m => {
            if (m.id === member.id)
                return false;
            if (m.user.bot)
                return false;
            // نفس تاريخ الإنشاء تقريباً (في نفس اليوم)
            const otherCreationDays = (now - m.user.createdTimestamp) / (1000 * 60 * 60 * 24);
            if (Math.abs(creationDays - otherCreationDays) < 1)
                return true;
            // نفس الصورة الرمزية (افتراضي = مش مخصص)
            if (m.user.avatar === member.user.avatar && !m.user.avatar)
                return true;
            // نفس الاسم/المميز (نمط متشابه)
            const nameSimilarity = this.calculateSimilarity(m.user.username, member.user.username);
            if (nameSimilarity > 0.8)
                return true;
            return false;
        });
        if (suspiciousMembers.size >= cfg.maxAccountsPerIP) {
            return {
                isAlt: true,
                reason: `تم العثور على ${suspiciousMembers.size} حسابات مشبوهة بنفس النمط`,
                matchedAccounts: suspiciousMembers.map(m => m.user.tag).slice(0, 5),
                action: cfg.action,
            };
        }
        // 3️⃣ فحص الأجهزة المشتركة (Discord لا يوفر device fingerprint مباشرة)
        // يمكن توسيعه مستقبلاً باستخدام خدمات خارجية
        return { isAlt: false, reason: 'نظيف', matchedAccounts: [], action: 'log' };
    }
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0)
            return 1.0;
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++)
            matrix[i] = [i];
        for (let j = 0; j <= str1.length; j++)
            matrix[0][j] = j;
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                }
                else {
                    matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
    // --------------------------------------------
    // تنفيذ الإجراء
    // --------------------------------------------
    async executeAction(member, result, cfg) {
        const guild = member.guild;
        const { action, reason, matchedAccounts } = result;
        try {
            switch (action) {
                case 'ban':
                    await member.ban({ reason: `Anti-Alt: ${reason}`, deleteMessageSeconds: 0 });
                    break;
                case 'kick':
                    await member.kick(`Anti-Alt: ${reason}`);
                    break;
                case 'quarantine':
                    if (cfg.quarantineRoleId) {
                        const quarantineRole = guild.roles.cache.get(cfg.quarantineRoleId);
                        if (quarantineRole) {
                            await member.roles.add(quarantineRole, `Anti-Alt: ${reason}`);
                            // نرسل لهم رسالة في الخاص
                            try {
                                await member.send(`🔒 **تم وضعك في الحجر الصحي** في سيرفر **${guild.name}**\n` +
                                    `السبب: ${reason}\n` +
                                    `تواصل مع الإدارة للمراجعة.`);
                            }
                            catch { }
                        }
                    }
                    break;
                case 'log':
                default:
                    // تسجيل فقط
                    break;
            }
            // إرسال لاوج
            if (cfg.logChannel) {
                const logChannel = guild.channels.cache.get(cfg.logChannel);
                if (logChannel) {
                    await logChannel.send({
                        content: `🕵️ **Anti-Alt Detection**\n` +
                            `👤 **العضو:** ${member.user.tag} (\`${member.id}\`)\n` +
                            `⚠️ **الإجراء:** ${action}\n` +
                            `📝 **السبب:** ${reason}\n` +
                            (matchedAccounts.length ? `🔗 **حسابات مشبوهة:** ${matchedAccounts.join(', ')}` : '')
                    }).catch(() => { });
                }
            }
            logger.warn(`Anti-Alt triggered in ${guild.name}: ${member.user.tag} — ${action} — ${reason}`);
        }
        catch (error) {
            logger.error(`Anti-Alt executeAction error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // أمر يدوي للفحص: /altcheck @user
    // --------------------------------------------
    async manualCheck(member) {
        const settings = await (0, models_1.getGuildSettings)(member.guild.id);
        const cfg = settings.protection?.antiAlt;
        if (!cfg?.enabled)
            return { isAlt: false, reason: 'الميزة معطلة', matchedAccounts: [], action: 'log' };
        return this.checkForAlts(member, cfg);
    }
}
exports.AntiAltHandler = AntiAltHandler;
exports.default = AntiAltHandler;
//# sourceMappingURL=AntiAltHandler.js.map