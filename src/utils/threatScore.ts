// ============================================
// Liberty City Bot - Threat Score (Beast Mode core)
// درجة تهديد عالمية (in-memory) لكل سيرفر. يجمع إشارات من حماية النيوك/الرويد/البوتات.
// ============================================

export type ThreatLevel = 'calm' | 'elevated' | 'high' | 'critical';

export interface ThreatSnapshot {
  score: number;
  level: ThreatLevel;
  reasons: string[];
  lastEventAt: number;
}

export const THREAT_THRESHOLDS = { elevated: 6, high: 14, critical: 24 } as const;
const DECAY_MS = 15 * 60 * 1000;
const MAX_EVENTS_PER_GUILD = 300;

interface ThreatEvent {
  points: number;
  at: number;
  reason: string;
}

export class ThreatTracker {
  private events = new Map<string, ThreatEvent[]>();

  add(guildId: string, points: number, reason: string, now = Date.now()): ThreatSnapshot {
    if (!guildId || points <= 0) return this.get(guildId, now);
    const list = this.events.get(guildId) || [];
    list.push({ points, at: now, reason });
    while (list.length > MAX_EVENTS_PER_GUILD) list.shift();
    this.events.set(guildId, list);
    return this.get(guildId, now);
  }

  get(guildId: string, now = Date.now()): ThreatSnapshot {
    const list = this.events.get(guildId) || [];
    let score = 0;
    const reasonSet = new Set<string>();
    let lastEventAt = 0;
    for (const e of list) {
      const age = now - e.at;
      if (age < 0 || age > DECAY_MS) continue;
      const factor = 1 - age / DECAY_MS;
      score += e.points * factor;
      reasonSet.add(e.reason);
      if (e.at > lastEventAt) lastEventAt = e.at;
    }
    score = Math.round(score * 10) / 10;
    let level: ThreatLevel = 'calm';
    if (score >= THREAT_THRESHOLDS.critical) level = 'critical';
    else if (score >= THREAT_THRESHOLDS.high) level = 'high';
    else if (score >= THREAT_THRESHOLDS.elevated) level = 'elevated';
    return { score, level, reasons: Array.from(reasonSet).slice(-8), lastEventAt };
  }

  clear(guildId: string): void {
    this.events.delete(guildId);
  }

  cleanup(now = Date.now()): void {
    for (const [g, list] of this.events.entries()) {
      const alive = list.filter(e => now - e.at <= DECAY_MS);
      if (alive.length === 0) this.events.delete(g);
      else this.events.set(g, alive);
    }
  }
}

/** مثيل عالمي مُشارَك بين جميع المعالجات */
export const globalThreat = new ThreatTracker();
