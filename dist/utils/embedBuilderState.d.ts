import { ActionRowBuilder, EmbedBuilder, MessageActionRowComponentBuilder } from 'discord.js';
export interface EmbedFieldData {
    name: string;
    value: string;
    inline: boolean;
}
export interface EmbedBuilderData {
    title?: string;
    description?: string;
    color: number;
    image?: string;
    thumbnail?: string;
    fields: EmbedFieldData[];
}
export interface EmbedBuilderSession {
    data: EmbedBuilderData;
    /** القناة المستهدفة من خيار /embed channel (اختياري) */
    channelId?: string;
    expiresAt: number;
}
export interface BuilderView {
    content: string;
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}
export declare const EB_BUTTON_PREFIX = "eb|";
export declare const EB_MODAL_PREFIX = "ebm|";
export declare const EB_MAX_FIELDS = 25;
export declare const EB_PLACEHOLDER_TITLE = "\u2728 \u0645\u0646\u0634\u0626 \u0627\u0644\u0625\u0645\u0628\u062F";
export declare const EB_PLACEHOLDER_DESCRIPTION = "\uD83D\uDCA1 \u0627\u0628\u062F\u0623 \u0628\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0623\u0648 \u0627\u0644\u0648\u0635\u0641";
export declare const EB_FOOTER_TEXT = "Liberty City Embed Builder";
export declare const EB_MAIN_CONTENT = "\uD83D\uDEE0\uFE0F \u0644\u0648\u062D\u0629 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0625\u0645\u0628\u062F \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0623\u0632\u0631\u0627\u0631 \u0623\u062F\u0646\u0627\u0647";
export interface ColorPreset {
    label: string;
    emoji: string;
    hex: string;
}
export declare const EB_COLOR_PRESETS: ColorPreset[];
export declare function parseHexColor(input: string): number | null;
export declare function getDefaultColor(): number;
export declare function createSession(userId: string, channelId?: string): EmbedBuilderSession;
export declare function getSession(userId: string): EmbedBuilderSession | null;
export declare function touchSession(userId: string): void;
export declare function deleteSession(userId: string): void;
export declare function buildPreviewEmbed(data: EmbedBuilderData): EmbedBuilder;
type BuilderRow = ActionRowBuilder<MessageActionRowComponentBuilder>;
export declare function buildMainComponents(): BuilderRow[];
export declare function renderMain(data: EmbedBuilderData, status?: string): BuilderView;
export declare function renderColorView(data: EmbedBuilderData): BuilderView;
export declare function renderFieldDeleteView(data: EmbedBuilderData): BuilderView;
export {};
//# sourceMappingURL=embedBuilderState.d.ts.map