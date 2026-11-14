import { Request, Response, NextFunction } from 'express';
export declare const SESSION_COOKIE = "omni_dash";
export declare const CSRF_HEADER = "x-omni-csrf";
export interface WebSession {
    id: string;
    /** owner = دخول مالك البوت (كلمة مرور/كود) · user = دخول عام بديسكورد */
    mode: 'owner' | 'user';
    userId?: string;
    username?: string;
    avatar?: string;
    /** هل صاحب الجلسة مالك البوت نفسه؟ (وصول كامل للسيرفرات) */
    isBotOwner?: boolean;
    authMethod: 'password' | 'code' | 'oauth' | 'password+oauth' | 'code+oauth';
    oauthVerified: boolean;
    createdAt: number;
    lastSeen: number;
    lastActivityPersistedAt?: number;
    lastPath?: string;
    requestCount?: number;
}
export type GuildAccessLevel = 'owner' | 'admin' | 'staff' | 'member';
export interface GuildAccess {
    level: GuildAccessLevel;
    isOwner: boolean;
    isAdmin: boolean;
    isStaff: boolean;
    roleNames: string[];
    /** وصول إداري كامل لأن المستخدم مالك البوت (حتى لو مش عضو) */
    viaBotOwner?: boolean;
}
export declare function safeEqual(a: string, b: string): boolean;
export declare function tokenHash(sessionId: string): string;
export declare function clientIp(req: Request): string;
export declare function parseDevice(ua?: string): {
    deviceName: string;
    deviceType: string;
    browserName: string;
    osName: string;
};
export declare function getAllActiveSessions(): {
    sessionId: string;
    userId: string | undefined;
    username: string | undefined;
    authMethod: "password" | "code" | "oauth" | "password+oauth" | "code+oauth";
    oauthVerified: boolean;
    requestCount: number;
    lastPath: string | null;
    lastSeenAt: number;
    createdAt: number;
}[];
export declare function listPersistedSessions(): Promise<any[]>;
export declare function markOAuthVerified(sessionId: string, userId: string, username: string, extra?: {
    avatar?: string;
    isBotOwner?: boolean;
}): WebSession | null;
export declare function oauthRequired(): boolean;
/** سر عميل Discord — يدعم الاسم القديم المستخدم في الاستضافة */
export declare function discordClientSecret(): string;
export declare function oauthConfigured(): boolean;
export declare function oauthRedirect(req: Request): string;
/**
 * 🔍 مستوى وصول عضو ديسكورد في سيرفر:
 *  - owner: صاحب السيرفر (التاج)
 *  - admin: Administrator / ManageGuild / رولات إدارة التذاكر
 *  - staff: رولات الدعم / صلاحيات إشراف (ManageMessages, Kick, Ban, Timeout)
 *  - member: عضو عادي
 * null = ليس عضواً في السيرفر
 */
export declare function resolveGuildAccess(client: any, userId: string, guildId: string): Promise<GuildAccess | null>;
export declare const oauthFlows: Map<string, {
    sessionId?: string;
    expiresAt: number;
}>;
export declare function createOAuthState(sessionId?: string): string;
export declare function consumeOAuthState(state: string): {
    sessionId?: string;
    expiresAt: number;
} | null;
export declare function parseCookies(header: string | undefined): Record<string, string>;
export declare function getSession(req: Request): WebSession | null;
export declare function createSession(init?: Partial<WebSession> & {
    authMethod?: WebSession['authMethod'];
    req?: Request;
}): {
    token: string;
    session: WebSession;
};
export declare function destroySession(req: Request): void;
export declare function revokeActiveSession(sessionId: string): boolean;
export declare function setSessionCookie(res: Response, token: string): void;
export declare function clearSessionCookie(res: Response): void;
export declare function rateLimit(key: string, max: number, windowMs: number): boolean;
interface PendingCode {
    code: string;
    expiresAt: number;
}
export declare function issueLoginCode(): PendingCode;
export declare function consumeLoginCode(input: string): boolean;
export declare function passwordLoginEnabled(): boolean;
export declare function passwordMatches(input: string): boolean;
export interface WebAuthContext {
    kind: 'key' | 'session';
    mode: 'owner' | 'user';
    sessionId?: string;
    userId?: string;
    username?: string;
    isBotOwner?: boolean;
    guildAccess?: GuildAccess;
}
/**
 * Guard يُركّب على /api قبل الراوتر:
 *  1) مفتاح خدمة عبر X-Dashboard-Key (للوحة الخارجية/الأتمتة)
 *  2) جلسة داشبورد صالحة + ترويسة CSRF للطلبات المُعدِّلة
 * كذلك يتحقق أن البوت عضو فعلاً في السيرفر المطلوب، وأن المستخدم
 * عضو/ستاف/أدمن فيه قبل السماح بأي وصول لإعداداته.
 */
export declare function apiGuard(client: any): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware لمسارات /dashboard/api — يتطلب جلسة (المفتاح لا يكفي هنا).
 */
export declare function requireSession(req: Request, res: Response, next: NextFunction): void;
export declare function requireVerifiedSession(req: Request, res: Response, next: NextFunction): void;
/** جلسات إدارة الأجهزة/الجلسات — لمالك البوت فقط */
export declare function requireOwnerSession(req: Request, res: Response, next: NextFunction): void;
export declare function logAuth(event: string, detail?: string): void;
export {};
//# sourceMappingURL=webAuth.d.ts.map