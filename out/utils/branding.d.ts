export declare const BOT_NAME = "Omni";
type GuildLike = {
    name?: string | null;
} | null | undefined;
/** اسم السيرفر إن وُجد، وإلا اسم البوت العام */
export declare function serverName(guild?: GuildLike): string;
/** علامة موحّدة: اسم السيرفر • القسم، مع Omni كبديل خارج السيرفرات */
export declare function brand(guild?: GuildLike, suffix?: string): string;
export {};
//# sourceMappingURL=branding.d.ts.map