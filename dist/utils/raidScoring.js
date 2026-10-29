"use strict";
// ============================================
// Liberty City Bot - Raid Join Scoring (Beast Mode)
// تقييم كل منضم: عمر الحساب، أفاتار، اسم، بوت → نقاط "اشتباه".
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreJoin = scoreJoin;
const RAID_NAME_PATTERN = /(raid|nuke|hacked|pwned|destroy|cracked|on.?top|free.?nitro|bot\d{3,})/i;
function scoreJoin(signals) {
    const reasons = [];
    let points = 0;
    const ageDays = signals.accountAgeMs / (24 * 60 * 60 * 1000);
    if (ageDays < 1 / 24) { // < 1 hour
        points += 4;
        reasons.push('حساب جديد (< 1 ساعة)');
    }
    else if (ageDays < 1) {
        points += 3;
        reasons.push('حساب جديد (< 1 يوم)');
    }
    else if (ageDays < 7) {
        points += 2;
        reasons.push('حساب جديد (< 7 أيام)');
    }
    else if (ageDays < signals.minAccountAgeDays) {
        points += 1;
        reasons.push(`حساب younger than ${signals.minAccountAgeDays} days`);
    }
    if (signals.requireAvatar && !signals.hasAvatar) {
        points += 1;
        reasons.push('بدون أفاتار');
    }
    if (RAID_NAME_PATTERN.test(signals.username || '')) {
        points += 1;
        reasons.push('اسم مشبوه');
    }
    if (signals.isBot) {
        points += 3;
        reasons.push('بوت');
    }
    const suspicious = points >= 2 || ageDays < 1;
    return { points, reasons, suspicious };
}
//# sourceMappingURL=raidScoring.js.map