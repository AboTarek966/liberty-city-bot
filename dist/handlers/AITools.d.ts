import { Guild, GuildMember } from 'discord.js';
import { OmniClient } from './../OmniClient';
export interface AIToolResult {
    success: boolean;
    message: string;
    data?: any;
}
export interface ToolContext {
    guild: Guild;
    executor: GuildMember;
    client: OmniClient;
    reason?: string;
    /** 🎯 العضو المستهدف افتراضياً (منشن/رد في الرسالة الحالية) */
    defaultTargetUserId?: string;
}
export declare function executeAITool(toolName: string, args: any, context: ToolContext): Promise<AIToolResult>;
export declare function getToolsDescription(): string;
export declare function getAllToolNames(): string[];
//# sourceMappingURL=AITools.d.ts.map