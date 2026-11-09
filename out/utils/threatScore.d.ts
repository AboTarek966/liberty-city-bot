export type ThreatLevel = 'calm' | 'elevated' | 'high' | 'critical';
export interface ThreatSnapshot {
    score: number;
    level: ThreatLevel;
    reasons: string[];
    lastEventAt: number;
}
export declare const THREAT_THRESHOLDS: {
    readonly elevated: 6;
    readonly high: 14;
    readonly critical: 24;
};
export declare class ThreatTracker {
    private events;
    add(guildId: string, points: number, reason: string, now?: number): ThreatSnapshot;
    get(guildId: string, now?: number): ThreatSnapshot;
    clear(guildId: string): void;
    cleanup(now?: number): void;
}
/** مثيل عالمي مُشارَك بين جميع المعالجات */
export declare const globalThreat: ThreatTracker;
//# sourceMappingURL=threatScore.d.ts.map