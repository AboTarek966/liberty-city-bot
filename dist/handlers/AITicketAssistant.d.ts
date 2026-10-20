import { TextChannel } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
export interface TicketAnalysis {
    category: 'technical' | 'billing' | 'complaint' | 'inquiry' | 'protection' | 'roles' | 'channels' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    summary: string;
    suggestedSolution: string;
    needsAdminAction: boolean;
    requiredActions: RequiredAction[];
    confidence: number;
}
export interface RequiredAction {
    type: 'give_role' | 'remove_role' | 'create_channel' | 'modify_permissions' | 'check_settings' | 'restore_backup' | 'ban_user' | 'timeout_user' | 'custom';
    description: string;
    params: Record<string, any>;
    requiresAdminApproval: boolean;
    targetUserId?: string;
    targetRoleId?: string;
}
export interface AdminApprovalRequest {
    ticketId: string;
    channelId: string;
    action: RequiredAction;
    requestedBy: 'ai';
    status: 'pending' | 'approved' | 'denied';
    requestedAt: Date;
    approvedBy?: string;
    approvedAt?: Date;
}
export declare class AITicketAssistant {
    private client;
    constructor(client: LibertyClient);
    onTicketCreated(ticket: any, channel: TextChannel): Promise<void>;
    private claimTicket;
    private sendAutoResponse;
    private analyzeTicket;
    private getDefaultAnalysis;
    private executeSolution;
    private executeAction;
    private requestAdminApproval;
    handleAdminResponse(approvalId: string, adminId: string, approve: boolean): Promise<void>;
    private notifyAdmins;
    private getCategoryLabel;
    learnFromClosedTicket(ticket: any, resolution: string): Promise<void>;
    getApprovals(): Map<string, AdminApprovalRequest>;
}
export default AITicketAssistant;
//# sourceMappingURL=AITicketAssistant.d.ts.map