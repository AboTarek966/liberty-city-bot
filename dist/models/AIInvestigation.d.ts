import mongoose, { Document } from 'mongoose';
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
export declare const InvestigationRun: mongoose.Model<IInvestigationRun, {}, {}, {}, mongoose.Document<unknown, {}, IInvestigationRun, {}, {}> & IInvestigationRun & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const InvestigationFinding: mongoose.Model<IInvestigationFinding, {}, {}, {}, mongoose.Document<unknown, {}, IInvestigationFinding, {}, {}> & IInvestigationFinding & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default InvestigationRun;
//# sourceMappingURL=AIInvestigation.d.ts.map