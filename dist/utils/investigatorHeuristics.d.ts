import { AIAnalysisPayload, BanSnapshot, ChannelSnapshot, EventSignal, FindingDraft, GuildSnapshot, InvestigationCategory, InvestigationSeverity, InvestigationSource, InvestigationSubjectType, MemberSnapshot, MessageRiskResult, MessageSnapshot, PermissionOverwriteSnapshot, RoleSnapshot, SecuritySnapshot, WebhookSnapshot } from '../types/investigator';
export interface MessageRiskResultInternal extends MessageRiskResult {
    flags: string[];
}
export declare function severityRank(severity: InvestigationSeverity): number;
export declare function maxSeverity(a: InvestigationSeverity, b: InvestigationSeverity): InvestigationSeverity;
export declare function isAtLeast(severity: InvestigationSeverity, min: InvestigationSeverity): boolean;
export declare function normalizeSeverity(value: unknown): InvestigationSeverity;
export declare function normalizeCategory(value: unknown): InvestigationCategory;
export declare function normalizeSubjectType(value: unknown, fallback?: InvestigationSubjectType): InvestigationSubjectType;
export declare function riskLevelFromScore(score: number): InvestigationSeverity;
export declare function countBySeverity(findings: FindingDraft[]): Record<InvestigationSeverity, number>;
export declare function riskFromFindings(findings: FindingDraft[]): number;
export declare function fingerprintFinding(finding: FindingDraft): string;
export declare function redactSensitiveText(input: string, maxLength?: number): string;
export declare function detectMessageRisk(content: string, options?: {
    mentions?: number;
    mentionEveryone?: boolean;
    mentionHere?: boolean;
    authorIsStaff?: boolean;
    authorBot?: boolean;
    authorWebhook?: boolean;
    embedTitles?: string[];
    linkHosts?: string[];
}): MessageRiskResultInternal;
export declare function buildHeuristicFindings(snapshot: GuildSnapshot, options?: {
    protectedIds?: Set<string>;
    /** بوتات مصرّح لها (قائمة بيضاء) — لا تُعتبر غير مصرح بها، لكن سلوكها يبقى خاضعاً للتحقيق */
    authorizedBotIds?: Set<string>;
    now?: number;
}): FindingDraft[];
export declare function signalsToFindings(signals: EventSignal[]): FindingDraft[];
export declare function normalizeAIFindings(payload: AIAnalysisPayload | null, source?: InvestigationSource): FindingDraft[];
export declare function dedupeFindings(findings: FindingDraft[]): FindingDraft[];
export declare function mergeAIAnalysis(base: FindingDraft[], payloads: Array<AIAnalysisPayload | null>, maxFindings: number): {
    findings: FindingDraft[];
    overallRisk: number;
    summary: string;
    observations: string[];
    positiveSignals: string[];
    recommendedActions: string[];
};
export declare function compactSecurity(security: SecuritySnapshot): Record<string, unknown>;
export declare function compactMember(member: MemberSnapshot): Record<string, unknown>;
export declare function compactMessage(message: MessageSnapshot): Record<string, unknown>;
export declare function compactChannel(channel: ChannelSnapshot): Record<string, unknown>;
export declare function compactRole(role: RoleSnapshot): Record<string, unknown>;
export declare function compactOverwrite(ow: PermissionOverwriteSnapshot): Record<string, unknown>;
export declare function compactWebhook(webhook: WebhookSnapshot): Record<string, unknown>;
export declare function compactBan(ban: BanSnapshot): Record<string, unknown>;
//# sourceMappingURL=investigatorHeuristics.d.ts.map