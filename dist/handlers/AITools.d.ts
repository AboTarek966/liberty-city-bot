import { Guild, GuildMember } from 'discord.js';
import { LibertyClient } from './../LibertyClient';
export interface AIToolResult {
    success: boolean;
    message: string;
    data?: any;
}
export interface ToolContext {
    guild: Guild;
    executor: GuildMember;
    client: LibertyClient;
    reason?: string;
}
export declare function executeAITool(toolName: string, args: any, context: ToolContext): Promise<AIToolResult>;
export declare function getToolsDescription(): string;
export declare function getAllToolNames(): string[];
//# sourceMappingURL=AITools.d.ts.map