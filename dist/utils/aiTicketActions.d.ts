import { Client, Guild } from 'discord.js';
export interface TicketAction {
    type: 'give_role' | 'remove_role' | 'create_channel' | 'modify_permissions' | 'check_settings' | 'restore_backup' | 'ban_user' | 'timeout_user' | 'custom';
    description: string;
    params: Record<string, any>;
    requiresAdminApproval: boolean;
    targetUserId?: string;
    targetRoleId?: string;
}
export interface ActionContext {
    ticketUserId?: string;
    ticketChannelId?: string;
}
export interface ActionResult {
    ok: boolean;
    message: string;
}
export declare function normalizeId(value: unknown): string | undefined;
export declare function actionNeedsApproval(action: TicketAction, config: {
    requireAdminApprovalForRoles?: boolean;
    requireAdminApprovalForPermissions?: boolean;
    requireAdminApprovalForBans?: boolean;
}): boolean;
export declare function executeTicketAction(client: Client, guild: Guild, action: TicketAction, context?: ActionContext): Promise<ActionResult>;
//# sourceMappingURL=aiTicketActions.d.ts.map