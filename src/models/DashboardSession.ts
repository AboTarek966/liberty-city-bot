// ============================================
// Omni Bot - Dashboard Session Audit Model
// ============================================
// يحتفظ بالكود الوثائقي فقط، ولا يخزن التوكن نفسه.

import mongoose, { Document, Schema } from 'mongoose';

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

const DashboardSessionSchema = new Schema<IDashboardSession>({
  tokenHash: { type: String, required: true, unique: true, index: true },
  userId: { type: String, index: true },
  username: { type: String, default: 'المالك' },
  authMethod: { type: String, enum: ['password', 'code', 'oauth'], required: true, index: true },
  ip: { type: String, required: true, default: 'unknown' },
  countryCode: { type: String },
  countryName: { type: String },
  userAgent: { type: String, maxlength: 512 },
  deviceName: { type: String },
  deviceType: { type: String },
  browserName: { type: String },
  osName: { type: String },
  oauthVerified: { type: Boolean, default: false, index: true },
  lastPath: { type: String, index: true },
  requestCount: { type: Number, default: 0, min: 0 },
  revokedAt: { type: Date, index: true },
}, { timestamps: true });

DashboardSessionSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 777600 });

export const DashboardSession = mongoose.models.DashboardSession || mongoose.model<IDashboardSession>('DashboardSession', DashboardSessionSchema);
export default DashboardSession;
