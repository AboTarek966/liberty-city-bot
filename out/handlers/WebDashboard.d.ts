import { Express, Request, Response } from 'express';
import express from 'express';
import type { OmniClient } from '../OmniClient';
export declare class WebDashboard {
    private client;
    private assetsDir;
    constructor(client: OmniClient);
    /** Guard يُركّب على /api قبل الراوتر في OmniClient */
    apiGuard(): (req: Request, res: Response, next: express.NextFunction) => void;
    /** يُركّب مسارات اللوحة (صفحة + أصول + مصادقة + واجهات جلسة) */
    attach(app: Express): void;
}
//# sourceMappingURL=WebDashboard.d.ts.map