import { Request, Response, NextFunction } from 'express';
export declare const SESSION_COOKIE = "omni_dash";
export declare const CSRF_HEADER = "x-omni-csrf";
export interface WebSession {
    id: string;
    mode: 'owner';
    userId?: string;
    username?: string;
    createdAt: number;
    lastSeen: number;
}
export declare function safeEqual(a: string, b: string): boolean;
export declare function parseCookies(header: string | undefined): Record<string, string>;
export declare function getSession(req: Request): WebSession | null;
export declare function createSession(init?: Partial<WebSession>): {
    token: string;
    session: WebSession;
};
export declare function destroySession(req: Request): void;
export declare function setSessionCookie(res: Response, token: string): void;
export declare function clearSessionCookie(res: Response): void;
export declare function rateLimit(key: string, max: number, windowMs: number): boolean;
export declare function clientIp(req: Request): string;
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
export declare function logAuth(event: string, detail?: string): void;
export {};
//# sourceMappingURL=webAuth.d.ts.map