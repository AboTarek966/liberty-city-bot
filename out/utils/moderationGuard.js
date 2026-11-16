"use strict";
// ============================================
// Omni Bot - Moderation Guard
// فحص دقيق لأسباب منع الكتم — رسالة واضحة بدل "تأكد أن رتبتي أعلى"
// ============================================
// السبب الحقيقي غالباً ليس الترتيب: قد يكون العضو لديه Administrator،
// أو البوت لا يملك صلاحية Moderate Members، أو العضو هو مالك السيرفر.
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTimeoutability = checkTimeoutability;
exports.describeTimeoutApiError = describeTimeoutApiError;
const discord_js_1 = require("discord.js");
function checkTimeoutability(member) {
    const guild = member.guild;
    const me = guild.members.me;
    if (!me) {
        return { canAttempt: false, reason: 'بيانات البوت غير محمّلة في السيرفر — أعد المحاولة بعد لحظات' };
    }
    if (member.id === guild.ownerId) {
        return { canAttempt: false, reason: 'العضو هو مالك السيرفر — لا يمكن كتمه' };
    }
    if (member.id === me.id) {
        return { canAttempt: false, reason: 'هذا هو البوت نفسه' };
    }
    if (!me.permissions.has(discord_js_1.PermissionFlagsBits.ModerateMembers)) {
        return {
            canAttempt: false,
            reason: 'صلاحية «Moderate Members / كتم الأعضاء» غير ممنوحة للبوت — فعّلها من إعدادات الرول',
        };
    }
    const botRole = me.roles.highest;
    const targetRole = member.roles.highest;
    if (targetRole.position >= botRole.position) {
        return {
            canAttempt: false,
            reason: `رول العضو «${targetRole.name}» (#${targetRole.position}) أعلى أو مساوي لرول البوت «${botRole.name}» (#${botRole.position})`,
        };
    }
    if (member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
        return {
            canAttempt: true,
            administrator: true,
            reason: `العضو لديه Administrator عبر رول «${targetRole.name}» — Discord غالباً يرفض كتمه`,
        };
    }
    return { canAttempt: true };
}
/** رسالة فشل واضحة عند رفض Discord للكتم */
function describeTimeoutApiError(member, error) {
    const message = String(error?.message || 'خطأ غير معروف');
    if (error?.code === 50013 || /missing permissions/i.test(message)) {
        const check = checkTimeoutability(member);
        const extra = check.administrator
            ? ` — العضو لديه Administrator (رول «${member.roles.highest.name}») وDiscord يمنع كتمه`
            : ' — تأكد أن البوت يملك صلاحية كتم الأعضاء وأن روله أعلى من رول العضو';
        return `Discord رفض الكتم (Missing Permissions)${extra}`;
    }
    return message;
}
//# sourceMappingURL=moderationGuard.js.map