/**
 * موديلات Gemini — مُختبرة فعلياً بهذا المفتاح ومرتّبة حسب السرعة.
 * ملاحظة: `gemini-2.5-flash` و`gemini-2.0-flash` لم تعد متاحة لمستخدمين جدد (HTTP 404).
 */
export declare const GEMINI_TEXT_MODELS: string[];
/** موديلات Gemini للرؤية — نفس الموديلات تدعم الصور */
export declare const GEMINI_VISION_MODELS: string[];
export interface GeminiImage {
    data: string;
    mimeType: string;
}
export interface GeminiResult {
    content: string;
    model: string;
    tokens: number;
}
export declare function geminiGenerate(opts: {
    apiKey: string;
    systemPrompt: string;
    history: Array<{
        role: string;
        content: string;
    }>;
    message: string;
    images?: GeminiImage[];
    temperature: number;
    maxTokens: number;
    preferredModel?: string;
}): Promise<GeminiResult>;
export declare function geminiStream(opts: {
    apiKey: string;
    systemPrompt: string;
    history: Array<{
        role: string;
        content: string;
    }>;
    message: string;
    images?: GeminiImage[];
    temperature: number;
    maxTokens: number;
    preferredModel?: string;
    onFirstChunk?: (text: string) => void | Promise<void>;
    onUpdate?: (fullText: string) => void | Promise<void>;
}): Promise<GeminiResult>;
//# sourceMappingURL=geminiClient.d.ts.map