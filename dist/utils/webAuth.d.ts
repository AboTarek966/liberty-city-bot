import { Request, Response, NextFunction } from 'express';
export declare const SESSION_COOKIE = "omni_dash";
export declare const CSRF_HEADER = "x-omni-csrf";
export interface WebSession {
    id: string;
    mode: 'owner';
    userId?: string;
    username?: string;
    authMethod: 'password' | 'code' | 'oauth' | 'password+oauth' | 'code+oauth';
    oauthVerified: boolean;
    createdAt: number;
    lastSeen: number;
    lastActivityPersistedAt?: number;
    lastPath?: string;
    requestCount?: number;
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
export declare function markOAuthVerified(sessionId: string, userId: string, username: string): WebSession | null;
export declare function oauthRequired(): boolean;
export declare function oauthRedirect(req: Request): string;
export declare const oauthFlows: Map<string, {
    sessionId: string;
    expiresAt: number;
}>;
export declare function createOAuthState(sessionId: string): string;
export declare function consumeOAuthState(state: string): {
    sessionId: string;
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
    mode: 'owner' | 'key';
    userId?: string;
    username?: string;
}
/**
 * Guard يُركّب على /api قبل الراوتر:
 *  1) مفتاح خدمة عبر X-Dashboard-Key (للوحة الخارجية/الأتمتة)
 *  2) جلسة داشبورد صالحة + ترويسة CSRF للطلبات المُعدِّلة
 * كذلك يتحقق أن البوت عضو فعلاً في السيرفر المطلوب (يمنع إنشاء وثائق وهمية).
 */
export declare function apiGuard(client: any): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware لمسارات /dashboard/api — يتطلب جلسة (المفتاح لا يكفي هنا).
 */
export declare function requireSession(req: Request, res: Response, next: NextFunction): void;
export declare function requireVerifiedSession(req: Request, res: Response, next: NextFunction): void;
export declare function logAuth(event: string, detail?: string): void;
export {};
//# sourceMappingURL=webAuth.d.ts.map