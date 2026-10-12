import { GuildMember } from 'discord.js';
export declare const CARD_WIDTH = 800;
export declare const CARD_HEIGHT = 300;
/** القيم الافتراضية (تخطيط جاهز — يمكن تعديله في المحرر) */
export declare const CARD_DEFAULTS: {
    enabled: boolean;
    backgroundUrl: string | undefined;
    backgroundFit: "cover" | "contain" | "stretch";
    backgroundX: number;
    backgroundY: number;
    backgroundScale: number;
    backgroundRotation: number;
    backgroundOpacity: number;
    avatarX: number;
    avatarY: number;
    avatarSize: number;
    avatarRotation: number;
    avatarBorderWidth: number;
    avatarBorderColor: string;
    avatarShadow: boolean;
    avatarShadowColor: string;
    avatarShadowBlur: number;
    avatarShadowOffsetX: number;
    avatarShadowOffsetY: number;
    nameX: number;
    nameY: number;
    nameSize: number;
    nameColor: string;
    nameFont: string;
    nameRotation: number;
    nameShadow: boolean;
    nameShadowColor: string;
    nameShadowBlur: number;
    nameShadowOffsetX: number;
    nameShadowOffsetY: number;
    countX: number;
    countY: number;
    countSize: number;
    countColor: string;
    countFont: string;
    countRotation: number;
    countShadow: boolean;
    customTexts: CustomTextElement[];
};
/** عنصر نص مخصص — قابل للإضافة بلا حدود */
export interface CustomTextElement {
    id: string;
    text: string;
    x: number;
    y: number;
    size: number;
    color: string;
    font: string;
    rotation: number;
    shadow: boolean;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    align: 'center' | 'left' | 'right';
    maxWidth: number;
}
/** إعدادات البطاقة (مطابقة لـ settings.welcome.card) */
export interface WelcomeCardConfig {
    enabled: boolean;
    backgroundUrl?: string;
    backgroundFit: 'cover' | 'contain' | 'stretch';
    backgroundX: number;
    backgroundY: number;
    backgroundScale: number;
    backgroundRotation: number;
    backgroundOpacity: number;
    avatarX: number;
    avatarY: number;
    avatarSize: number;
    avatarRotation: number;
    avatarBorderWidth: number;
    avatarBorderColor: string;
    avatarShadow: boolean;
    avatarShadowColor: string;
    avatarShadowBlur: number;
    avatarShadowOffsetX: number;
    avatarShadowOffsetY: number;
    nameX: number;
    nameY: number;
    nameSize: number;
    nameColor: string;
    nameFont: string;
    nameRotation: number;
    nameShadow: boolean;
    nameShadowColor: string;
    nameShadowBlur: number;
    nameShadowOffsetX: number;
    nameShadowOffsetY: number;
    countX: number;
    countY: number;
    countSize: number;
    countColor: string;
    countFont: string;
    countRotation: number;
    countShadow: boolean;
    customTexts: CustomTextElement[];
}
/**
 * إزالة الرموز التي لا يدعمها خط Tajawal (تظهر مربعات □ في الرسم)
 * — رموز تعبيرية وزخرفية وأنظمة كتابة نادرة
 */
export declare function sanitizeCardText(text: string): string;
/**
 * رسم بطاقة الترحيب وإرجاعها كصورة PNG
 * (المعاينة في المحرر = الصورة نفسها تماماً التي يراها العضو)
 * يدعم: خلفيات محولة، صورة شخصية متطورة، نصوص بظلال وتدوير، نصوص مخصصة بلا حدود
 */
export declare function renderWelcomeCard(member: GuildMember, card: WelcomeCardConfig): Promise<Buffer>;
//# sourceMappingURL=welcomeCard.d.ts.map