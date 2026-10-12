import { Role, Guild, GuildMember } from 'discord.js';
export interface RolePickerState {
    sid: string;
    userId: string;
    targetId: string;
    page: number;
    reason: string;
    selections: Map<number, string[]>;
    createdAt: number;
}
export declare function createRolePickerState(userId: string, targetId: string, reason: string): RolePickerState;
export declare function getRolePickerState(sid: string): RolePickerState | undefined;
export declare function deleteRolePickerState(sid: string): void;
export declare function getSelectedRoleIds(state: RolePickerState): string[];
export declare function getGrantableRoles(guild: Guild, executor: GuildMember): Role[];
export declare function buildRolePicker(state: RolePickerState, guild: Guild, executor: GuildMember): {
    content: string;
    components: any[];
};
//# sourceMappingURL=rolePicker.d.ts.map