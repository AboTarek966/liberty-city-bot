export interface RaidSignals {
    accountAgeMs: number;
    hasAvatar: boolean;
    username: string;
    isBot: boolean;
    minAccountAgeDays: number;
    requireAvatar: boolean;
}
export interface RaidScoreResult {
    points: number;
    reasons: string[];
    suspicious: boolean;
}
export declare function scoreJoin(signals: RaidSignals): RaidScoreResult;
//# sourceMappingURL=raidScoring.d.ts.map