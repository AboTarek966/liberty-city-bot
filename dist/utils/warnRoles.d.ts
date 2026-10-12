import { Guild, GuildMember } from 'discord.js';
export declare function isAdminTarget(target: GuildMember): boolean;
export declare function getWarnRolePool(settings: any, target: GuildMember): string[];
/**
 * يُطبّق رولات التحذير بعد التحذير:
 * - رول واحد فقط → يُعطى مباشرة ويُرجع ملاحظة
 * - أكثر من رول → يعرض لوحة اختيار (من رولات التحذير فقط)
 * - لا توجد رولات قابلة → يُرجع null
 */
export declare function offerWarnRoles(opts: {
    settings: any;
    guild: Guild;
    executor: GuildMember;
    target: GuildMember;
    reason: string;
    reply: (payload: {
        content: string;
        components: any[];
    }) => Promise<unknown>;
}): Promise<string | null>;
//# sourceMappingURL=warnRoles.d.ts.map