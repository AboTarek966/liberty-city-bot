interface PendingUpload {
    guildId: string;
    channelId: string;
    userId: string;
    expiresAt: number;
    /** وجهة الصورة: لوحة التذاكر أو خلفية بطاقة الترحيب */
    kind: 'ticket' | 'welcomeCard';
}
export declare function setPendingImageUpload(userId: string, guildId: string, channelId: string, kind?: 'ticket' | 'welcomeCard'): void;
export declare function consumePendingImageUpload(userId: string): PendingUpload | null;
export declare function hasPendingImageUpload(userId: string): boolean;
export {};
//# sourceMappingURL=pendingUploads.d.ts.map