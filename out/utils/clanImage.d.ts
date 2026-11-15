export interface ClanLeaderboardEntry {
    name: string;
    ownerId: string;
    memberCount: number;
    messages: number;
    voiceMinutes: number;
    color: number;
}
export declare function renderClanLeaderboard(guildName: string, entries: ClanLeaderboardEntry[]): Promise<Buffer>;
//# sourceMappingURL=clanImage.d.ts.map