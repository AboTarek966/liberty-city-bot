export interface OrganizeRoleDef {
    name: string;
    color?: number;
    hoist?: boolean;
}
export interface OrganizeChannelDef {
    name: string;
    type: 'text' | 'voice' | 'category';
    topic?: string;
    position?: number;
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
    note: string;
}
export declare function organizePreset(guild: any, presetId: string): Promise<OrganizeResult>;
//# sourceMappingURL=serverOrganizer.d.ts.map