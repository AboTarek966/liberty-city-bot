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
    /** 📍 القناة الحالية — يستخدمها أي أمر يحتاج channelId تلقائياً */
    defaultChannelId?: string;
    /** 📎 وسائط الرسالة الأصلية — يستخدمها set_server_icon لو الصورة مرفقة بالطلب */
    attachments?: Array<{
        url: string;
        contentType?: string | null;
        name?: string | null;
    }>;
}
export declare function executeAITool(toolName: string, args: any, context: ToolContext): Promise<AIToolResult>;
export declare function getToolsDescription(): string;
export declare function getAllToolNames(): string[];
//# sourceMappingURL=AITools.d.ts.map