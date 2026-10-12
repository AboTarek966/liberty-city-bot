import { ActionRowBuilder, EmbedBuilder, Guild, ChatInputCommandInteraction } from 'discord.js';
export type SettingsCategory = 'home' | 'general' | 'protection' | 'tickets' | 'ai' | 'welcome' | 'leave' | 'logging' | 'levels' | 'automod' | 'verification' | 'commands';
type PanelComponent = ActionRowBuilder<any>;
export interface BuiltPanel {
    embeds: EmbedBuilder[];
    components: PanelComponent[];
}
/**
 * التحقق مما إذا كان المستخدم محقق بكلمة المرور
 */
export declare function isPasswordVerified(userId: string): boolean;
/**
 * تعيين المستخدم كمحقق بكلمة المرور (تنتهي صلاحيته بعد 30 دقيقة)
 */
export declare function setPasswordVerified(userId: string): void;
/**
 * إزالة تحقق كلمة المرور
 */
export declare function clearPasswordVerified(userId: string): void;
/**
 * الحصول على كلمة مرور الإعدادات من قاعدة البيانات (أو الافتراضية)
 */
export declare function getSettingsPassword(guildId: string): Promise<string>;
export declare function canManageSettings(interaction: ChatInputCommandInteraction | {
    member: any;
    user: any;
    guildId: string;
}): boolean;
export declare const ICONS: Record<SettingsCategory, string>;
export declare const TITLES: Record<SettingsCategory, string>;
export declare const CATEGORY_COLORS: Record<SettingsCategory, number>;
export declare function buildPanel(category: SettingsCategory, guild: Guild, userId: string): Promise<BuiltPanel>;
export declare function buildVerificationPanel(guild: Guild, s: any): BuiltPanel;
export declare function buildWarnRolesPanel(guild: Guild, s: any): BuiltPanel;
export declare function getActivePanel(settings: any): any;
export declare function buildCommands(guild: Guild, s: any): BuiltPanel;
export declare function buildShop(guild: Guild, s: any): BuiltPanel;
export declare function buildTicketMovePanel(guild: Guild, s: any): BuiltPanel;
export declare function buildTicketAdvancedPanel(guild: Guild, s: any): BuiltPanel;
export declare const CARD_ELEMENTS: {
    readonly background: {
        readonly emoji: "🖼️";
        readonly label: "الخلفية";
    };
    readonly avatar: {
        readonly emoji: "👤";
        readonly label: "الصورة الشخصية";
    };
    readonly name: {
        readonly emoji: "📝";
        readonly label: "الاسم";
    };
    readonly count: {
        readonly emoji: "#️⃣";
        readonly label: "الرقم";
    };
    readonly customTexts: {
        readonly emoji: "➕";
        readonly label: "نصوص مخصصة";
    };
};
export type CardElement = keyof typeof CARD_ELEMENTS;
interface CardEditorState {
    element: CardElement;
    step: number;
    customTextIndex: number;
}
/** الحصول على حالة المحرر للمستخدم */
export declare function getCardEditor(userId: string): CardEditorState;
/** قيم عنصر البطاقة الحالي */
export declare function getCardElementValues(c: any, element: CardElement): {
    x: number;
    y: number;
    size: number;
    rotation: number;
};
/** دورة الخطوة: 5 ← 10 ← 25 ← 50 */
export declare function nextCardStep(step: number): number;
/** دورة العناصر */
export declare function nextCardElement(element: CardElement): CardElement;
export declare function buildWelcomeCardPanel(guild: Guild, s: any, userId?: string): BuiltPanel;
/**
 * إرسال المحرر مع صورة معاينة حية (تُحدَّث مع كل ضغطة زر)
 * — الصورة المعروضة = الصورة نفسها التي يراها العضو عند الترحيب
 */
export declare function sendWelcomeCardPanel(interaction: any, settings: any): Promise<void>;
export declare const LOG_SPLIT_GROUPS: Array<{
    id: string;
    emoji: string;
    label: string;
    types: string[];
}>;
export declare function buildLoggingSplitPanel(guild: Guild, s: any): BuiltPanel;
export declare function buildLevelIgnorePanel(guild: Guild, s: any): BuiltPanel;
export declare function buildLevelRewardsPanel(guild: Guild, s: any): BuiltPanel;
export {};
//# sourceMappingURL=settingsPanel.d.ts.map