"use strict";
// ============================================
// Liberty City Bot - AI Investigator Storage
// ============================================
// تخزين تقارير التحقيق والنتائج بشكل دائم، مع منع التكرار
// عبر بصمة ثابتة (fingerprint) لكل سيرفر.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigationFinding = exports.InvestigationRun = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const InvestigationRunSchema = new mongoose_1.Schema({
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
    coverage: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    observations: [{ type: String }],
    positiveSignals: [{ type: String }],
    recommendedActions: [{ type: String }],
    error: { type: String },
}, { timestamps: true });
InvestigationRunSchema.index({ guildId: 1, startedAt: -1 });
InvestigationRunSchema.index({ guildId: 1, runId: 1 }, { unique: true });
const InvestigationFindingSchema = new mongoose_1.Schema({
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
    metadata: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
InvestigationFindingSchema.index({ guildId: 1, fingerprint: 1 }, { unique: true });
InvestigationFindingSchema.index({ guildId: 1, status: 1, severity: 1, lastSeenAt: -1 });
InvestigationFindingSchema.index({ guildId: 1, lastSeenAt: -1 });
exports.InvestigationRun = mongoose_1.default.model('InvestigationRun', InvestigationRunSchema);
exports.InvestigationFinding = mongoose_1.default.model('InvestigationFinding', InvestigationFindingSchema);
exports.default = exports.InvestigationRun;
//# sourceMappingURL=AIInvestigation.js.map