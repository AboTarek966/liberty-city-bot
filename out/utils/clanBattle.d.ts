export interface BattleWinnerInfo {
    id: string;
    name: string;
    memberIds: string[];
    messages: number;
    voiceMinutes: number;
    score: number;
}
/** يجمع إحصائيات العشيرة خلال فترة المسابقة من وثائق day stats */
export declare function sumClanWindowActivity(guildId: string, memberIds: string[], from: Date, to: Date): Promise<{
    messages: number;
    voiceMinutes: number;
    voiceJoins: number;
}>;
/** ينشئ صورة إعلان فائز مسابقة عشائرية — PNG */
export declare function renderClanBattleWinner(guildName: string, winner: BattleWinnerInfo, runnersUp: BattleWinnerInfo[]): Promise<Buffer>;
/** معالجة المسابقات المنتهية — تُستدعى دورياً من Ready */
export declare function processEndedClanBattles(client: any): Promise<void>;
//# sourceMappingURL=clanBattle.d.ts.map