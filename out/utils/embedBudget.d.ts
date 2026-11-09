import { EmbedBuilder } from 'discord.js';
export declare function embedCharCount(embed: EmbedBuilder): number;
export interface FitEmbedOptions {
    /** الحد الأقصى لعدد الأحرف (افتراضي 5600 لترك هامش أمان) */
    maxChars?: number;
    /** أسماء حقول يجب عدم حذفها (مطابقة جزئية) */
    keepFieldNames?: string[];
}
/**
 * يضمن بقاء الـ Embed تحت الحد الآمن عبر إزالة الحقول غير المحمية من النهاية
 * (الأقل خطورة) ثم قصّ الوصف كحل أخير. يرجع نفس الـ Embed للتسهيل.
 */
export declare function fitEmbed(embed: EmbedBuilder, options?: FitEmbedOptions): EmbedBuilder;
//# sourceMappingURL=embedBudget.d.ts.map