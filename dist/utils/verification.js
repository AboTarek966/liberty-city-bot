"use strict";
// ============================================
// Liberty City Bot - Verification Helpers
// ============================================
// كابتشا رياضية قصيرة العمر + سجل تدقيق للتوثيق.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccountAgeDays = getAccountAgeDays;
exports.cleanupVerificationState = cleanupVerificationState;
exports.createVerificationChallenge = createVerificationChallenge;
exports.consumeVerificationChallenge = consumeVerificationChallenge;
exports.grantVerifiedRole = grantVerifiedRole;
exports.logVerification = logVerification;
const discord_js_1 = require("discord.js");
const crypto_1 = require("crypto");
const models_1 = require("../models");
const helpers_1 = require("./helpers");
const embeds_1 = require("./embeds");
const logger = (0, helpers_1.createLogger)('Verification');
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const BLOCK_MS = 10 * 60 * 1000;
const challenges = new Map();
const blockedUntil = new Map();
function getAccountAgeDays(user) {
    return Math.floor((Date.now() - user.createdTimestamp) / 86_400_000);
}
function cleanupVerificationState() {
    const now = Date.now();
    for (const [key, value] of challenges) {
        if (value.expiresAt <= now)
            challenges.delete(key);
    }
    for (const [key, until] of blockedUntil) {
        if (until <= now)
            blockedUntil.delete(key);
    }
}
function createVerificationChallenge(userId) {
    cleanupVerificationState();
    const until = blockedUntil.get(userId);
    if (until && until > Date.now()) {
        return {
            ok: false,
            blocked: true,
            blockedMinutes: Math.max(1, Math.ceil((until - Date.now()) / 60_000)),
        };
    }
    const a = (0, crypto_1.randomInt)(2, 20);
    const b = (0, crypto_1.randomInt)(1, 15);
    const useSubtraction = (0, crypto_1.randomInt)(0, 2) === 1 && a > b;
    const answer = useSubtraction ? a - b : a + b;
    const question = useSubtraction ? `${a} − ${b} = ؟` : `${a} + ${b} = ؟`;
    challenges.set(userId, {
        answer,
        attempts: 0,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return { ok: true, question, expiresInMinutes: CHALLENGE_TTL_MS / 60_000 };
}
function consumeVerificationChallenge(userId, rawAnswer) {
    const until = blockedUntil.get(userId);
    if (until && until > Date.now()) {
        return {
            status: 'blocked',
            blockedMinutes: Math.max(1, Math.ceil((until - Date.now()) / 60_000)),
        };
    }
    const challenge = challenges.get(userId);
    if (!challenge || challenge.expiresAt <= Date.now()) {
        challenges.delete(userId);
        return { status: 'expired' };
    }
    const normalized = rawAnswer
        .trim()
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[^\d-]/g, '');
    const answer = Number(normalized);
    if (!Number.isFinite(answer) || answer !== challenge.answer) {
        challenge.attempts += 1;
        if (challenge.attempts >= MAX_ATTEMPTS) {
            challenges.delete(userId);
            blockedUntil.set(userId, Date.now() + BLOCK_MS);
            return { status: 'blocked', blockedMinutes: BLOCK_MS / 60_000 };
        }
        return { status: 'wrong', attemptsLeft: MAX_ATTEMPTS - challenge.attempts };
    }
    challenges.delete(userId);
    return { status: 'ok' };
}
async function grantVerifiedRole(guild, member, verification, reason = 'توثيق ذاتي بالزر') {
    const roleId = verification.roleId;
    if (!roleId)
        return { ok: false, message: '❌ رول التوثيق غير محدد — أبلغ الإدارة' };
    const role = guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
    if (!role)
        return { ok: false, message: '❌ رول التوثيق لم يعد موجوداً — أبلغ الإدارة' };
    const botMember = guild.members.me;
    if (botMember && botMember.roles.highest.position <= role.position) {
        return {
            ok: false,
            message: '❌ لا أستطيع إعطاء الرول — **ارفع رتبة البوت أعلى من رول التوثيق**',
        };
    }
    try {
        if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role, reason);
        }
        if (verification.quarantineRoleId && member.roles.cache.has(verification.quarantineRoleId)) {
            const quarantine = guild.roles.cache.get(verification.quarantineRoleId);
            if (quarantine && botMember && botMember.roles.highest.position > quarantine.position) {
                await member.roles.remove(quarantine, 'إزالة رول الحجر بعد التوثيق').catch(() => { });
            }
        }
        return { ok: true, message: `🎉 **تم توثيقك بنجاح!**\nيمكنك الآن التفاعل في السيرفر — أهلاً بك ${member}` };
    }
    catch (error) {
        return { ok: false, message: `❌ فشل إعطاء الرول: \`${error.message}\` — تحقق من صلاحيات البوت` };
    }
}
async function logVerification(guild, member, action, details) {
    try {
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        const channelId = settings.verification?.logChannelId || settings.protection?.logChannel || undefined;
        if (!channelId)
            return;
        const channel = guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased())
            return;
        const palette = {
            success: embeds_1.Colors.success,
            fail: embeds_1.Colors.warning,
            blocked: embeds_1.Colors.error,
            info: embeds_1.Colors.info,
        };
        const titles = {
            success: '✅ توثيق ناجح',
            fail: '⚠️ فشل التوثيق',
            blocked: '⛔ محاولة محظورة',
            info: 'ℹ️ توثيق',
        };
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(titles[action])
            .setColor(palette[action])
            .addFields({ name: '👤 العضو', value: `${member} \`${member.id}\``, inline: true }, { name: '🕰️ عمر الحساب', value: `${getAccountAgeDays(member.user)} يوم`, inline: true }, { name: '📝 التفاصيل', value: details.slice(0, 1024), inline: false })
            .setFooter({ text: `${guild.name} • Liberty City Verification` })
            .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => { });
    }
    catch (error) {
        logger.debug(`Verification log failed: ${error.message}`);
    }
}
//# sourceMappingURL=verification.js.map