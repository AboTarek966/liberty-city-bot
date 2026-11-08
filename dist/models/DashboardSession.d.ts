import mongoose, { Document } from 'mongoose';
export interface IDashboardSession extends Document {
    tokenHash: string;
    userId?: string;
    username?: string;
    authMethod: 'password' | 'code' | 'oauth';
    ip: string;
    countryCode?: string;
    countryName?: string;
    userAgent?: string;
    deviceName?: string;
    deviceType?: string;
    browserName?: string;
    osName?: string;
    oauthVerified: boolean;
    lastPath?: string;
    requestCount: number;
    revokedAt?: Date;
    createdAt: Date;
    lastSeenAt: Date;
}
export declare const DashboardSession: mongoose.Model<any, {}, {}, {}, any, any>;
export default DashboardSession;
//# sourceMappingURL=DashboardSession.d.ts.map