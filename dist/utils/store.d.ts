import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { IStore, IStoreProject } from '../models';
export declare const STORE_KEY = "main";
export declare const DEFAULT_TAX_PERCENT = 5;
export declare const DEFAULT_PROBOT_PREFIX = "!";
/** المستلم الافتراضي لتحويلات ProBot (مالك المتجر) — يقدر يتغير من /project config payee */
export declare const DEFAULT_PAYEE_ID: string;
/** قراءة وثيقة المتجر (تنشئها عند أول استخدام) مع تحديث الإعدادات الافتراضية */
export declare function getStore(createIfMissing?: boolean): Promise<IStore | null>;
/** نفس القراءة لكن كـ lean (للقوائم السريعة) — قد ترجع null */
export declare function getStoreLean(): Promise<(import("mongoose").FlattenMaps<any> & Required<{
    _id: unknown;
}> & {
    __v: number;
})[] | (import("mongoose").FlattenMaps<any> & Required<{
    _id: unknown;
}> & {
    __v: number;
}) | null>;
/** هل هذا المستخدم يدير المتجر؟ (مالك البوت أو مدير مسجل) */
export declare function canManageStore(client: any, userId: string): Promise<boolean>;
/** بيانات الأمر المطلوب من المشتري تنفيذه في (ProBot) */
export declare function computeTransferAmount(price: number, taxPercent: number): number;
/** تنسيق رقم بفواصل آلاف (10,000,000) */
export declare function formatCredits(n: number): string;
/** تنسيق مختصر للسعر (10M / 500K) — يُستخدم في القوائم */
export declare function formatShort(n: number): string;
/** سطر سعر كامل: 10,000,000 (10M) */
export declare function priceLine(n: number): string;
/** نسبة خصم صالحة (0 = بدون خصم) */
export declare function normalizeDiscountPercent(value: unknown): number;
/** السعر الصافي الفعلي للمشروع بعد خصم العرض (إن وجد) */
export declare function getEffectivePrice(project: Pick<IStoreProject, 'price' | 'discountPercent'>): number;
/** سطر عرض السعر مع الخصم إن وجد */
export declare function projectPriceLine(project: Pick<IStoreProject, 'price' | 'discountPercent'>): string;
/** تحليل نسبة خصم من نص مثل "25" أو "%25" أو "25%" — يرجع 0 لإزالة الخصم، null إذا غير مفهوم */
export declare function parseDiscountPercent(input: string): number | null;
/** بناء أمر تحويل الكريديت (ProBot/Credit) — الصيغة المطلوبة */
export declare function buildTransferCommand(payeeId: string, amount: number): string;
/** يحوّل نص سعر إلى رقم: 10m / 500k / 10 مليون / 10,000,000 */
export declare function parsePrice(input: string): number | null;
/** معرّف قصير للطلب/البروجيكت (مرتبط بروابط الأزرار) */
export declare function shortId(len?: number): string;
/** يتحقق إن النص يشبه أمر تحويل كريديت */
export declare function isProbotCommandLike(text: string, _prefix: string): boolean;
/** بناء إمبد المتجر (العرض الرئيسي) */
export declare function buildStoreEmbed(store: IStore): EmbedBuilder;
/** بناء قائمة الاختيار (select) للمشاريع المفعّلة */
export declare function buildStoreSelect(store: IStore): ActionRowBuilder<StringSelectMenuBuilder>[] | null;
/** إيجاد البروجيكت بالمعرّف (غير حساس لحالة الأحرف) */
export declare function findProject(store: IStore, projectId: string): IStoreProject | undefined;
/** عدد البروجيكتات المضافة (فعّالة + معطلة) */
export declare function projectCount(store: IStore): number;
//# sourceMappingURL=store.d.ts.map