import { TextChannel } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
import { TicketAction } from '../utils/aiTicketActions';
export interface TicketAnalysis {
    category: 'technical' | 'billing' | 'complaint' | 'inquiry' | 'protection' | 'roles' | 'channels' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    summary: string;
    suggestedSolution: string;
    needsAdminAction: boolean;
    requiredActions: RequiredAction[];
    confidence: number;
}
export type RequiredAction = TicketAction;
export interface AdminApprovalRequest {
    ticketId: string;
    channelId: string;
    action: RequiredAction;
    requestedBy: 'ai';
    status: 'pending' | 'approved' | 'denied' | 'expired';
    requestedAt: Date;
    approvedBy?: string;
    approvedAt?: Date;
}
export interface AdminResponseResult {
    ok: boolean;
    message: string;
}
export declare class AITicketAssistant {
    private client;
    constructor(client: LibertyClient);
    private getConfig;
    onTicketCreated(ticket: any, channel: TextChannel): Promise<void>;
    private claimTicket;
    private sendAutoResponse;
    private analyzeTicket;
    private getDefaultAnalysis;
    private executeSolution;
    private requestAdminApproval;
    handleAdminResponse(approvalId: string, adminId: string, approve: boolean, expectedGuildId?: string): Promise<AdminResponseResult>;
    private notifyAdmins;
    private logAITicketEvent;
    private getCategoryLabel;
    getApprovalDetails(approvalId: string): Promise<AITicketApprovalDetails | null>;
    learnFromClosedTicket(ticket: any, resolution: string): Promise<void>;
}
export interface AITicketApprovalDetails {
    approvalId: string;
    guildId: string;
    ticketId: string;
    channelId: string;
    action: RequiredAction;
    status: 'pending' | 'approved' | 'denied' | 'expired';
    requestedAt: Date;
    expiresAt: Date;
    approvedBy?: string;
    approvedAt?: Date;
    resultMessage?: string;
}
export default AITicketAssistant;
//# sourceMappingURL=AITicketAssistant.d.ts.map