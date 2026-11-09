export declare function putTranslation(messageId: string, data: {
    text: string;
    sourceLang: string;
    targetLang: string;
    translatedText: string;
}): void;
export declare function getTranslation(messageId: string): {
    text: string;
    sourceLang: string;
    targetLang: string;
    translatedText: string;
} | null;
//# sourceMappingURL=translateStore.d.ts.map