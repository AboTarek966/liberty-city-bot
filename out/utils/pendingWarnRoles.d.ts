export interface PendingWarnRoles {
    /** رولات تحذير الأعضاء */
    members?: string[];
    /** رولات تحذير الإداريين (قائمة) */
    admins?: string[];
    /** النظام التسلسلي: [role1, role2, role3] */
    sequential?: string[];
    userId: string;
    at: number;
}
/** يجمع التغييرات الجديدة مع أي تغييرات مُعلّقة سابقاً بنفس السيرفر */
export declare function setPendingWarnRoles(guildId: string, patch: Partial<Pick<PendingWarnRoles, 'members' | 'admins' | 'sequential'>>, userId: string): PendingWarnRoles;
export declare function getPendingWarnRoles(guildId: string): PendingWarnRoles | undefined;
export declare function clearPendingWarnRoles(guildId: string): void;
/** هل يوجد أي تغيير مُعلّق فعلاً؟ */
export declare function hasPendingWarnRoles(p: PendingWarnRoles | undefined): boolean;
/** هل التغيير المُعلّق فارغ بالكامل (أي: مسح كل شيء)؟ — نعتبره تغييراً أيضاً */
export declare function pendingDiffers(p: PendingWarnRoles | undefined, current: {
    memberIds?: string[];
    adminIds?: string[];
    sequential?: string[];
}): boolean;
//# sourceMappingURL=pendingWarnRoles.d.ts.map