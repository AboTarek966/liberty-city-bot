export type Locale = 'ar' | 'en';
export interface TranslationStrings {
    [key: string]: string | TranslationStrings;
}
export declare const SUPPORTED_LOCALES: Locale[];
export declare const DEFAULT_LOCALE: Locale;
export declare function loadTranslations(localesDir?: string): void;
export declare function t(locale: Locale, key: string, variables?: Record<string, any>): string;
export declare function createTFunction(locale: Locale): (key: string, variables?: Record<string, any>) => string;
export declare const LOCALE_NAMES: Record<Locale, {
    native: string;
    english: string;
    flag: string;
}>;
export declare function getLocaleFromSettings(settings: {
    language?: string;
}): Locale;
export declare function createLocaleSelectEmbed(): {
    title: string;
    description: string;
    fields: Array<{
        name: string;
        value: string;
        inline: boolean;
    }>;
};
export declare const COMMON_TRANSLATIONS: Record<Locale, TranslationStrings>;
declare const _default: {
    t: typeof t;
    createTFunction: typeof createTFunction;
    loadTranslations: typeof loadTranslations;
    getLocaleFromSettings: typeof getLocaleFromSettings;
    createLocaleSelectEmbed: typeof createLocaleSelectEmbed;
    SUPPORTED_LOCALES: Locale[];
    DEFAULT_LOCALE: "ar";
    LOCALE_NAMES: Record<Locale, {
        native: string;
        english: string;
        flag: string;
    }>;
    COMMON_TRANSLATIONS: Record<Locale, TranslationStrings>;
};
export default _default;
//# sourceMappingURL=i18n.d.ts.map