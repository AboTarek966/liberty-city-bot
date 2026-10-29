"use strict";
// ============================================
// Liberty City Bot - Threat Score (Beast Mode core)
// درجة تهديد عالمية (in-memory) لكل سيرفر. يجمع إشارات من حماية النيوك/الرويد/البوتات.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalThreat = exports.ThreatTracker = exports.THREAT_THRESHOLDS = void 0;
exports.THREAT_THRESHOLDS = { elevated: 6, high: 14, critical: 24 };
const DECAY_MS = 15 * 60 * 1000;
const MAX_EVENTS_PER_GUILD = 300;
class ThreatTracker {
    events = new Map();
    add(guildId, points, reason, now = Date.now()) {
        if (!guildId || points <= 0)
            return this.get(guildId, now);
        const list = this.events.get(guildId) || [];
        list.push({ points, at: now, reason });
        while (list.length > MAX_EVENTS_PER_GUILD)
            list.shift();
        this.events.set(guildId, list);
        return this.get(guildId, now);
    }
    get(guildId, now = Date.now()) {
        const list = this.events.get(guildId) || [];
        let score = 0;
        const reasonSet = new Set();
        let lastEventAt = 0;
        for (const e of list) {
            const age = now - e.at;
            if (age < 0 || age > DECAY_MS)
                continue;
            const factor = 1 - age / DECAY_MS;
            score += e.points * factor;
            reasonSet.add(e.reason);
            if (e.at > lastEventAt)
                lastEventAt = e.at;
        }
        score = Math.round(score * 10) / 10;
        let level = 'calm';
        if (score >= exports.THREAT_THRESHOLDS.critical)
            level = 'critical';
        else if (score >= exports.THREAT_THRESHOLDS.high)
            level = 'high';
        else if (score >= exports.THREAT_THRESHOLDS.elevated)
            level = 'elevated';
        return { score, level, reasons: Array.from(reasonSet).slice(-8), lastEventAt };
    }
    clear(guildId) {
        this.events.delete(guildId);
    }
    cleanup(now = Date.now()) {
        for (const [g, list] of this.events.entries()) {
            const alive = list.filter(e => now - e.at <= DECAY_MS);
            if (alive.length === 0)
                this.events.delete(g);
            else
                this.events.set(g, alive);
        }
    }
}
exports.ThreatTracker = ThreatTracker;
/** مثيل عالمي مُشارَك بين جميع المعالجات */
exports.globalThreat = new ThreatTracker();
//# sourceMappingURL=threatScore.js.map