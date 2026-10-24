import { Client, Guild, GuildMember, Role } from 'discord.js';
/** نتيجة فحص تسلّم البوت — أهم مؤشر أمني في السيرفر */
export interface HierarchyStatus {
    /** true = البوت يملك أعلى رتبة (يقدر يعاقب أي أحد) */
    ok: boolean;
    /** اسم أعلى رتبة للبوت */
    botRoleName: string;
    /** موقع أعلى رتبة للبوت */
    botPosition: number;
    /** الرولات الأعلى من البوت (يتعذّر معاقبة أصحابها) */
    offenders: string[];
    /** عدد الرولات فوق البوت */
    offenderCount: number;
    /** هل يوجد رول فوق البوت يحمل أي صلاحيات خطيرة */
    dangerous: boolean;
}
/**
 * 🛡️ فحص تسلّم البوت — أهم مؤشر أمني في السيرفر
 *
 * Discord يمنع المساس بأحد أعلى منك في الرتب مهما كانت صلاحياتك،
 * فلو رول المهاجم فوق رول البوت: `ban`/`kick`/سحب الرولات **تفشل كلها بصمت**.
 * هذا الفحص هو ما يميّز حماية حقيقية عن حماية ورقية.
 *
 * دالة مستقلة (لا تعتمد على `this`) لتُختبر وتُستخدم من لوحة الإعدادات.
 */
export declare function computeHierarchy(guild: Guild): HierarchyStatus;
export declare class SecurityHandler {
    private client;
    private deletionTracker;
    private messageDeletionTracker;
    private messageSnapshots;
    private renameTracker;
    private backupTimers;
    private scanTimers;
    private hierarchyState;
    private restoreTimers;
    private restoreLocks;
    private kickedQueue;
    private kickedTimers;
    private topWatchdogs;
    private lockdownCooldown;
    private nukeTracker;
    constructor(client: Client);
    clearGuild(guildId: string): void;
    cleanup(): void;
    private getAlertChannel;
    private findExecutor;
    private punish;
    private track;
    checkHierarchy(guild: Guild): HierarchyStatus;
    /**
     * يبلّغ عن مشكلة التسلّم — **عند تغيّر الحالة فقط** حتى لا نكرّر التنبيه
     * يستدعى: عند الإقلاع، عند الانضمام، وعند كل محاولة عقوبة فاشلة
     */
    ensureHierarchyAlert(guild: Guild): Promise<HierarchyStatus>;
    private isWhitelisted;
    private isTrustedExecutor;
    onChannelCreate(channel: any): Promise<void>;
    onRoleCreate(role: any): Promise<void>;
    onChannelUpdate(oldChannel: any, newChannel: any): Promise<void>;
    cleanupSuspicious(guild: Guild): Promise<number>;
    onWebhookUpdate(webhook: any): Promise<void>;
    onGuildMemberUpdate(oldMember: any, newMember: any): Promise<void>;
    onChannelPermissionUpdate(oldChannel: any, newChannel: any): Promise<void>;
    private triggerAutoLockdown;
    onGuildMemberAdd(member: any): Promise<void>;
    private trackNukeActivity;
    startStickyRoleWatchdog(guild: Guild): void;
    onGuildEmojiDelete(emoji: any): Promise<void>;
    onGuildStickerDelete(sticker: any): Promise<void>;
    onMessageDeleteBulk(messages: any): Promise<void>;
    private messageSnapshotInterval;
    startMessageSnapshotter(guild: Guild): void;
    private captureMessageSnapshots;
    private getMessageDeletionTracker;
    private getMessageSnapshot;
    private setMessageSnapshot;
    private handleMassDelete;
    onThreadCreate(thread: any): Promise<void>;
    onChannelDelete(channel: any): Promise<void>;
    onRoleDelete(role: any): Promise<void>;
    onBanAdd(ban: any): Promise<void>;
    onMemberKick(member: GuildMember): Promise<void>;
    private findKickExecutor;
    private scheduleKickedRecovery;
    private flushKickedRecovery;
    /**
     * 👢 استعادة المطرودين يدوياً — يقرأ سجلات التدقيق ويرسل لكل مطرود رابط الدعوة
     * (للاستعادة بعد هجوم وقع بالفعل — لا يمكن إلغاء الطرد في ديسكورد)
     */
    recoverKickedFromAudit(guild: Guild, limit: number): Promise<{
        total: number;
        sent: number;
        failed: number;
        invite: string | null;
    }>;
    /** يرسل رسالة خاصة برابط الدعوة — يعيد true لو وصلت */
    private dmInvite;
    /** رابط دعوة دائم — يستخدم الموجود أو ينشئ واحداً جديداً */
    getInviteLink(guild: Guild): Promise<string | null>;
    private respondMassDeletion;
    private hierarchyField;
    private runAutoRestore;
    onMemberJoin(member: GuildMember): Promise<boolean>;
    private announceBotDemotion;
    onRoleUpdate(oldRole: Role, newRole: Role): Promise<void>;
    syncAutoBackup(guild: Guild, forceNow?: boolean): Promise<void>;
    syncAutoScan(guild: Guild): Promise<void>;
    runPeriodicScan(guild: Guild): Promise<void>;
    createBackup(guild: Guild): Promise<{
        channels: number;
        roles: number;
        size: number;
    }>;
    restoreBackup(guild: Guild, backupIndex?: number): Promise<{
        channels: number;
        roles: number;
        skipped: number;
    }>;
    private performRestore;
    listBackups(guildId: string): Promise<Array<{
        index: number;
        date: Date;
        size: number;
        channels: number;
        roles: number;
    }>>;
}
//# sourceMappingURL=SecurityHandler.d.ts.map