export interface SnipeEntry {
    authorId: string;
    authorTag: string;
    authorAvatar?: string | null;
    content: string;
    embedCount: number;
    attachments: Array<{
        name: string;
        url: string;
    }>;
    channelId: string;
    postedAt: number;
    deletedAt: number;
    pinned: boolean;
}
/** تسجيل رسالة محذوفة (يستدعيها حدث messageDelete) */
export declare function recordDeletedMessage(message: any): void;
/** جلب رسالة محذوفة — index=0 الأحدث (الأقدم حتى 4) */
export declare function getSnipedMessage(guildId: string, channelId: string, index?: number): SnipeEntry | null;
/** عدد الرسائل المحفوظة حالياً لهذه القناة */
export declare function getSnipeCount(guildId: string, channelId: string): number;
//# sourceMappingURL=snipeCache.d.ts.map