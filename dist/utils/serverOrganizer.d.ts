export interface OrganizeRoleDef {
    name: string;
    color?: number;
    hoist?: boolean;
    /** رولات الإدارة/الإشراف — تُمنح للرومات المقفلة */
    staff?: boolean;
}
export interface OrganizeChannelDef {
    name: string;
    type: 'text' | 'voice' | 'category';
    topic?: string;
    position?: number;
    /**
     * public   = كل الأعضاء يقرأون ويكتبون
     * readonly = الجميع يقرأ فقط (للإعلانات والمنتجات) + الإدارة تكتب
     * staff    = الإدارة فقط (غير مرئية للجميع) + الإدارة تكتب
     * lock     = كما staff لكن للإدارات ذات الحساسية العليا
     */
    perms?: 'public' | 'readonly' | 'staff';
}
export interface OrganizePreset {
    id: string;
    name: string;
    roles: OrganizeRoleDef[];
    categories: OrganizeChannelDef[];
}
export declare const ORGANIZE_PRESETS: OrganizePreset[];
export interface OrganizeResult {
    success: boolean;
    presetId: string;
    created: {
        roles: {
            name: string;
            id: string;
            created: boolean;
        }[];
        channels: {
            name: string;
            id: string;
            created: boolean;
        }[];
        categories: {
            name: string;
            id: string;
            created: boolean;
        }[];
    };
    counts: {
        rolesNew: number;
        rolesExisting: number;
        channelsNew: number;
        channelsExisting: number;
    };
    deleted: {
        roles: number;
        channels: number;
    };
    permErrors: string[];
    creationErrors?: string[];
    note: string;
}
export declare function organizePreset(guild: any, presetId: string, opts?: {
    deleteOlds?: boolean;
    cleanRoles?: boolean;
}): Promise<OrganizeResult>;
//# sourceMappingURL=serverOrganizer.d.ts.map