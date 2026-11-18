import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import { IStore, IStoreProject, StoreItemType, IStoreDeliveryFile } from '../models';
export declare const STORE_KEY = "main";
export declare const DEFAULT_TAX_PERCENT = 5;
export declare const DEFAULT_PROBOT_PREFIX = "!";
export declare const DEFAULT_STORE_NAME = "\u0645\u062A\u062C\u0631 Omni";
/** المستلم الافتراضي لتحويلات ProBot (مالك المتجر) — يقدر يتغير من /project config payee */
export declare const DEFAULT_PAYEE_ID: string;
/** عدد العناصر في كل صفحة داخل المتجر */
export declare const STORE_PAGE_SIZE = 20;
export type StoreFilter = StoreItemType | 'all';
export interface StoreTypeMeta {
    key: StoreItemType;
    /** الاسم المفرد */
    label: string;
    /** الاسم الجمع (يُستخدم كعنوان قسم) */
    plural: string;
    emoji: string;
    color: number;
    aliases: string[];
}
export declare const STORE_TYPES: StoreTypeMeta[];
/** كل الأنواع كخيارات جاهزة لأوامر السلاش */
export declare const STORE_TYPE_CHOICES: {
    name: string;
    value: StoreItemType;
}[];
/** الأقسام الظاهرة في واجهة المتجر — بترتيب الأزرار: بروجيكتات ← بوتات ← أدوات ← رتب ← إعلانات */
export declare const VISIBLE_STORE_TYPES: Array<{
    key: StoreItemType;
    shortPlural: string;
}>;
/** خيارات /store — الأقسام الأربعة فقط (بلا خدمة/أخرى) */
export declare const VISIBLE_STORE_TYPE_CHOICES: {
    name: string;
    value: StoreItemType;
}[];
/** تحويل أي نص/قيمة إلى نوع عنصر صالح (الافتراضي project للعناصر القديمة) */
export declare function normalizeStoreType(value: unknown, fallback?: StoreItemType): StoreItemType;
/** تحويل فلتر المتجر (all أو نوع محدد) */
export declare function normalizeStoreFilter(value: unknown): StoreFilter;
/** ميتاداتا نوع العنصر */
export declare function storeTypeMeta(type: unknown): StoreTypeMeta;
/** نص نوع العنصر مع الإيموجي: 🛠️ بروجيكت */
export declare function storeTypeLabel(type: unknown): string;
/** تنقية إيموجي العنصر — يقبل unicode أو <:name:id> */
export declare function normalizeItemEmoji(input: unknown): string | undefined;
/** إيموجي العنصر المعروض (المخصص أو إيموجي النوع) */
export declare function storeItemEmoji(item: Pick<IStoreProject, 'emoji' | 'type'>): string;
/** ملخص الملفات المرفقة للعرض في الرسائل — الاسم + الحجم */
export declare function deliveryFilesSummary(files: IStoreDeliveryFile[] | undefined): string;
/** هل يوجد ملفات مرفقة بالعنصر؟ */
export declare function hasDeliveryFiles(item: Pick<IStoreProject, 'deliveryFiles'> | undefined): boolean;
/** تنقية رابط الصورة — undefined = فارغ • null = رابط غير صالح */
export declare function normalizeImageUrl(input: unknown): string | null | undefined;
/** تنقية الكمية: غير محدد = غير محدود */
export declare function normalizeStock(value: unknown): number | undefined;
/** سطر الكمية (فراغ لو غير محدودة) */
export declare function stockSuffix(item: Pick<IStoreProject, 'stock'>): string;
/** هل العنصر متوفر للبيع؟ */
export declare function isItemInStock(item: Pick<IStoreProject, 'stock'>): boolean;
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
/** السعر الصافي الفعلي للعنصر بعد خصم العرض (إن وجد) */
export declare function getEffectivePrice(project: Pick<IStoreProject, 'price' | 'discountPercent'>): number;
/** سطر عرض السعر مع الخصم إن وجد */
export declare function projectPriceLine(project: Pick<IStoreProject, 'price' | 'discountPercent'>): string;
/** تحليل نسبة خصم من نص مثل "25" أو "%25" أو "25%" — يرجع 0 لإزالة الخصم، null إذا غير مفهوم */
export declare function parseDiscountPercent(input: string): number | null;
/** بناء أمر تحويل الكريديت (ProBot/Credit) — الصيغة المطلوبة */
export declare function buildTransferCommand(payeeId: string, amount: number): string;
/** يحوّل نص سعر إلى رقم: 10m / 500k / 10 مليون / 10,000,000 */
export declare function parsePrice(input: string): number | null;
/** معرّف قصير للطلب/العنصر (مرتبط بروابط الأزرار) */
export declare function shortId(len?: number): string;
/** يتحقق إن النص يشبه أمر تحويل كريديت */
export declare function isProbotCommandLike(text: string, _prefix: string): boolean;
export interface StoreViewOptions {
    /** all أو نوع محدد */
    type?: unknown;
    /** رقم الصفحة (يبدأ من 0) */
    page?: unknown;
}
export interface StoreView {
    filter: StoreFilter;
    /** كل العناصر المفعّلة */
    all: IStoreProject[];
    /** العناصر بعد التصفية */
    filtered: IStoreProject[];
    /** عناصر الصفحة الحالية */
    items: IStoreProject[];
    page: number;
    totalPages: number;
    pageSize: number;
}
/** حساب حالة العرض (تصفية + تقسيم صفحات) — الوضع الافتراضي: بروجيكتات */
export declare function computeStoreView(store: IStore, opts?: StoreViewOptions): StoreView;
/** اسم المتجر المعروض */
export declare function getStoreName(store: IStore): string;
/** بناء إمبد المتجر (العرض الرئيسي) */
export declare function buildStoreEmbed(store: IStore, opts?: StoreViewOptions): EmbedBuilder;
/** بناء قائمة الاختيار (select) لعناصر الصفحة الحالية */
export declare function buildStoreSelect(store: IStore, opts?: StoreViewOptions): ActionRowBuilder<StringSelectMenuBuilder>[] | null;
/**
 * كل مكونات واجهة المتجر:
 * قائمة الاختيار + أزرار الأقسام (بوت/أداة/رتبة...) + أزرار التنقل بين الصفحات
 */
export declare function buildStoreComponents(store: IStore, opts?: StoreViewOptions): ActionRowBuilder<any>[];
/** إيجاد العنصر بالمعرّف */
export declare function findProject(store: IStore, projectId: string): IStoreProject | undefined;
/** إيجاد العنصر بالاسم (غير حساس لحالة الأحرف) */
export declare function findProjectByName(store: IStore, name: string): IStoreProject | undefined;
/** عدد العناصر المضافة (فعّالة + معطلة) */
export declare function projectCount(store: IStore): number;
/** إحصائيات حسب النوع */
export declare function storeTypeStats(store: IStore): Array<{
    meta: StoreTypeMeta;
    total: number;
    enabled: number;
    sales: number;
}>;
//# sourceMappingURL=store.d.ts.map