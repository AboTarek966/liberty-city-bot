import { Client } from 'discord.js';
export declare const LOG_EVENTS: readonly ["messageDelete", "messageEdit", "memberJoin", "memberLeave", "memberBan", "memberUnban", "memberUpdate", "memberTimeout", "roleCreate", "roleDelete", "roleUpdate", "channelCreate", "channelDelete", "channelUpdate", "voiceStateUpdate", "inviteCreate", "inviteDelete", "webhookUpdate", "threadCreate", "threadDelete", "threadUpdate", "emojiCreate", "emojiDelete", "stickerCreate", "stickerDelete", "ticketCreate", "ticketClose", "ticketReopen", "ticketDelete", "ticketClaim", "ticketTransfer", "ticketAddUser", "ticketRemoveUser"];
export type LogEventType = typeof LOG_EVENTS[number];
export declare class LoggingHandler {
    private client;
    private enabledCache;
    private readonly CACHE_TTL;
    /**
     * ⚡ طابور إرسال لكل سيرفر — يحلّ مشاكل السجلات الثلاث:
     *   1) الترتيب: السجلات تُرسل كما وقعت فعلاً (لا سجلات مقلوبة أو مبعثرة)
     *   2) السرعة: الإرسال مستقل عن مسار الحدث → لا يعطّل الترحيب/الحماية/الأوامر
     *   3) عدم الضياع: تأخير واحد لا يُسقط بقية السجلات المكدّسة
     */
    private queues;
    /** ذاكرة محتوى الرسائل الأخيرة — لعرض "النص قبل التعديل" حتى لو الرسالة غير مخزّنة */
    private recentContent;
    private contentCounter;
    private readonly CONTENT_TTL;
    private readonly CONTENT_MAX;
    constructor(client: Client);
    private getLogConfig;
    invalidateCache(guildId: string): void;
    /**
     * تتبّع فشل أي معالج سجل — بدون هذا الدالة كانت الأخطاء تُبتلع صامتاً
     * فلا يظهر للإدارة أي سبب لاختفاء السجل (وكأنه "ما انصلك أصلاً").
     */
    reportFailure(eventName: string, error: unknown): void;
    private sendLog;
    /** إضافة مهمة إلى طابور السيرفر (تنفيذ تسلسلي بالترتيب) */
    private enqueue;
    /** الإرسال الفعلي: جلب القناة (كاش ثم fetch) + تحقق الصلاحيات + إعادة محاولة واحدة */
    private deliverLog;
    /**
     * تصحيح الإيمبد قبل الإرسال — يمنع رفض Discord للرسالة بالكامل
     * (خطأ 50035 = سجل ضائع بالكامل، وهو سبب "أوقات ما ترسل"):
     *   • حقل فارغ أو "undefined" → يُستبدل بـ "—"
     *   • تجاوز حد 1024 حرف للحقل أو 4096 للوصف أو 250 للعنوان → يُقصّر
     */
    private sanitizeEmbed;
    /** يُستدعى من messageCreate — يخزّن نص الرسالة لاستخدامه عند التعديل أو الحذف */
    recordMessageContent(message: any): void;
    /** جلب النص المخزّن لرسالة (إن وُجد ولم تنتهِ صلاحيته) */
    private getCachedContent;
    /** Truncate text for embed fields (max ~500 chars, "..." suffix) */
    private truncate;
    /** Format a user with tag + mention (handles unknown users) */
    private formatUser;
    /** Account age in full days, or null if unknown */
    private getAccountAgeDays;
    /** Account creation date + age fields (only when known) */
    private accountFields;
    /**
     * Fetch the audit-log entry (executor + reason) for a recent action on a target.
     * ⚠️ سجل التدقيق قد يظهر بفارق ~1-2 ثانية عن الحدث نفسه،
     * لذلك نجرّب 3 مرات بفارق 600ms حتى لا يظهر "غير معروف" في السجل.
     */
    private fetchAuditInfo;
    /** Human-readable executor field value (moderator) */
    private executorValue;
    handleMemberJoin(member: any): Promise<void>;
    handleMemberLeave(member: any): Promise<void>;
    handleMessageDelete(message: any): Promise<void>;
    handleMessageDeleteBulk(messages: any, channel: any): Promise<void>;
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