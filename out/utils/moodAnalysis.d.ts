export type MoodLabel = 'positive' | 'negative' | 'neutral' | 'mixed';
export interface MoodMessageInput {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: Date;
}
export interface MoodLocalAnalysis {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    score: number;
    label: MoodLabel;
    emojis: Array<{
        emoji: string;
        count: number;
    }>;
    topAuthors: Array<{
        id: string;
        count: number;
    }>;
    perMinute: number;
    spanMinutes: number;
    avgLength: number;
}
export interface MoodAIResult {
    mood: MoodLabel;
    score: number;
    summary: string;
    emotions: string[];
    topics: string[];
    advice: string;
}
export declare function normalizeArabicText(input: string): string;
export declare function analyzeMoodLocally(messages: MoodMessageInput[]): MoodLocalAnalysis;
/**
 * يحوّل الرسائل إلى نص مجهول الهوية (عضو 1، عضو 2...) قبل إرساله للنموذج.
 * لا نكشف الأسماء أو المعرفات الحقيقية للذكاء الاصطناعي.
 */
export declare function buildMoodTranscript(messages: MoodMessageInput[], maxChars?: number): string;
export declare function parseMoodAI(raw: string): MoodAIResult | null;
export declare function moodLabelArabic(label: MoodLabel): string;
export declare function moodColor(label: MoodLabel): number;
//# sourceMappingURL=moodAnalysis.d.ts.map