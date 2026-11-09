export interface AfkEntry {
    reason: string;
    since: number;
}
export declare function getAFK(guildId: string, userId: string): Promise<AfkEntry | null>;
export declare function setAFK(guildId: string, userId: string, reason: string): Promise<AfkEntry>;
export declare function removeAFK(guildId: string, userId: string): Promise<boolean>;
//# sourceMappingURL=afk.d.ts.map