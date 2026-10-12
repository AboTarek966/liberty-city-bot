import { Client } from 'discord.js';
export declare const LOG_EVENTS: readonly ["messageDelete", "messageEdit", "memberJoin", "memberLeave", "memberBan", "memberUnban", "memberUpdate", "memberTimeout", "roleCreate", "roleDelete", "roleUpdate", "channelCreate", "channelDelete", "channelUpdate", "voiceStateUpdate", "inviteCreate", "inviteDelete", "webhookUpdate", "threadCreate", "threadDelete", "threadUpdate", "emojiCreate", "emojiDelete", "stickerCreate", "stickerDelete", "ticketCreate", "ticketClose", "ticketReopen", "ticketDelete", "ticketClaim", "ticketTransfer", "ticketAddUser", "ticketRemoveUser"];
export type LogEventType = typeof LOG_EVENTS[number];
export declare class LoggingHandler {
    private client;
    private enabledCache;
    private readonly CACHE_TTL;
    constructor(client: Client);
    private getLogConfig;
    invalidateCache(guildId: string): void;
    private sendLog;
    /** Truncate text for embed fields (max ~500 chars, "..." suffix) */
    private truncate;
    /** Format a user with tag + mention (handles unknown users) */
    private formatUser;
    /** Account age in full days, or null if unknown */
    private getAccountAgeDays;
    /** Account creation date + age fields (only when known) */
    private accountFields;
    /** Fetch the audit-log entry (executor + reason) for a recent action on a target */
    private fetchAuditInfo;
    /** Human-readable executor field value (moderator) */
    private executorValue;
    handleMemberJoin(member: any): Promise<void>;
    handleMemberLeave(member: any): Promise<void>;
    handleMessageDelete(message: any): Promise<void>;
    handleMessageEdit(oldMessage: any, newMessage: any): Promise<void>;
    handleGuildBanAdd(ban: any): Promise<void>;
    handleGuildBanRemove(ban: any): Promise<void>;
    handleGuildMemberUpdate(oldMember: any, newMember: any): Promise<void>;
    handleRoleCreate(role: any): Promise<void>;
    handleRoleDelete(role: any): Promise<void>;
    handleRoleUpdate(oldRole: any, newRole: any): Promise<void>;
    handleChannelCreate(channel: any): Promise<void>;
    handleChannelDelete(channel: any): Promise<void>;
    handleChannelUpdate(oldChannel: any, newChannel: any): Promise<void>;
    handleVoiceStateUpdate(oldState: any, newState: any): Promise<void>;
    handleInviteCreate(invite: any): Promise<void>;
    handleInviteDelete(invite: any): Promise<void>;
    handleWebhookUpdate(channel: any): Promise<void>;
    handleThreadCreate(thread: any): Promise<void>;
    handleThreadDelete(thread: any): Promise<void>;
    handleThreadUpdate(oldThread: any, newThread: any): Promise<void>;
    handleEmojiCreate(emoji: any): Promise<void>;
    handleEmojiDelete(emoji: any): Promise<void>;
    handleStickerCreate(sticker: any): Promise<void>;
    handleStickerDelete(sticker: any): Promise<void>;
    private getChannelTypeName;
    handleTicketCreate(data: {
        guild: any;
        channel: any;
        creator: any;
        panelName?: string;
    }): Promise<void>;
    handleTicketClose(data: {
        guild: any;
        channel: any;
        closer: any;
        reason?: string;
        transcriptUrl?: string;
    }): Promise<void>;
    handleTicketReopen(data: {
        guild: any;
        channel: any;
        reopener: any;
    }): Promise<void>;
    handleTicketDelete(data: {
        guild: any;
        channelId: string;
        deleter: any;
    }): Promise<void>;
    handleTicketClaim(data: {
        guild: any;
        channel: any;
        claimer: any;
    }): Promise<void>;
    handleTicketTransfer(data: {
        guild: any;
        channel: any;
        from: any;
        to: any;
    }): Promise<void>;
    handleTicketAddUser(data: {
        guild: any;
        channel: any;
        adder: any;
        added: any;
    }): Promise<void>;
    handleTicketRemoveUser(data: {
        guild: any;
        channel: any;
        remover: any;
        removed: any;
    }): Promise<void>;
    cleanup(): void;
}
export default LoggingHandler;
//# sourceMappingURL=LoggingHandler.d.ts.map