// ============================================
// Liberty City Bot - AI Investigator Storage
// ============================================
// تخزين تقارير التحقيق والنتائج بشكل دائم، مع منع التكرار
// عبر بصمة ثابتة (fingerprint) لكل سيرفر.

import mongoose, { Document, Schema } from 'mongoose';

export interface IInvestigationRun extends Document {
  guildId: string;
  runId: string;
  trigger: string;
  focus?: string;
  status: 'running' | 'completed' | 'failed';
  deep: boolean;
  requestedBy?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  riskScore: number;
  riskLevel: string;
  summary: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  aiModel: string;
  tokensUsed: number;
  aiUsed: boolean;
  coverage: Record<string, unknown>;
  observations: string[];
  positiveSignals: string[];
  recommendedActions: string[];
  error?: string;
}

export interface IInvestigationFinding extends Document {
  guildId: string;
  fingerprint: string;
  runId: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  subjectType: string;
  subjectId?: string;
  subjectName?: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
  source: string;
  status: 'open' | 'acknowledged' | 'dismissed' | 'resolved';
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastAlertedAt?: Date;
  dismissedBy?: string;
  dismissedAt?: Date;
  resolvedAt?: Date;
  metadata?: Record<string, unknown>;
}

const InvestigationRunSchema = new Schema<IInvestigationRun>({
  guildId: { type: String, required: true, index: true },
  runId: { type: String, required: true, index: true },
  trigger: { type: String, default: 'manual' },
  focus: { type: String },
  status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
  deep: { type: Boolean, default: false },
  requestedBy: { type: String },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  durationMs: { type: Number },
  riskScore: { type: Number, default: 0 },
  riskLevel: { type: String, default: 'info' },
  summary: { type: String, default: '' },
  findingsCount: { type: Number, default: 0 },
  criticalCount: { type: Number, default: 0 },
  highCount: { type: Number, default: 0 },
  aiModel: { type: String, default: '' },
  tokensUsed: { type: Number, default: 0 },
  aiUsed: { type: Boolean, default: false },
  coverage: { type: Schema.Types.Mixed, default: {} },
  observations: [{ type: String }],
  positiveSignals: [{ type: String }],
  recommendedActions: [{ type: String }],
  error: { type: String },
}, { timestamps: true });

InvestigationRunSchema.index({ guildId: 1, startedAt: -1 });
InvestigationRunSchema.index({ guildId: 1, runId: 1 }, { unique: true });

const InvestigationFindingSchema = new Schema<IInvestigationFinding>({
  guildId: { type: String, required: true, index: true },
  fingerprint: { type: String, required: true },
  runId: { type: String, required: true },
  severity: { type: String, default: 'info' },
  category: { type: String, default: 'other' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  subjectType: { type: String, default: 'system' },
  subjectId: { type: String },
  subjectName: { type: String },
  evidence: [{ type: String }],
  recommendation: { type: String, default: '' },
  confidence: { type: Number, default: 60 },
  source: { type: String, default: 'heuristic' },
  status: { type: String, enum: ['open', 'acknowledged', 'dismissed', 'resolved'], default: 'open' },
  occurrences: { type: Number, default: 1 },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  lastAlertedAt: { type: Date },
  dismissedBy: { type: String },
  dismissedAt: { type: Date },
  resolvedAt: { type: Date },
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

InvestigationFindingSchema.index({ guildId: 1, fingerprint: 1 }, { unique: true });
InvestigationFindingSchema.index({ guildId: 1, status: 1, severity: 1, lastSeenAt: -1 });
InvestigationFindingSchema.index({ guildId: 1, lastSeenAt: -1 });

export const InvestigationRun = mongoose.model<IInvestigationRun>('InvestigationRun', InvestigationRunSchema);
export const InvestigationFinding = mongoose.model<IInvestigationFinding>('InvestigationFinding', InvestigationFindingSchema);

export default InvestigationRun;
