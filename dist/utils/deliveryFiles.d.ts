import type { IStoreDeliveryFile } from '../models';
/** المجلد الأساسي لحفظ ملفات التسليم — نسبة إلى cwd (الدائم على الاستضافة) */
export declare const DELIVERY_DIR: string;
export interface SaveResult {
    saved: IStoreDeliveryFile[];
    /** أسماء الملفات التي فشل حفظها (سبب للتقرير للبائع) */
    failed: string[];
}
/**
 * ينزّل مرفقات أوامر السلاش ويحفظها تحت `data/store-files/<key>/`.
 * @param key معرّف العنصر (project id) — يمنح كل عنصر مجلداً مستقلاً
 */
export declare function saveDeliveryAttachments(key: string, attachments: Array<{
    name?: string;
    url?: string;
    size?: number;
}>): Promise<SaveResult>;
/** مسار مطلق لكل ملف موجود على القرص — يتخطى الملفات المفقودة */
export declare function deliveryFilePaths(files: IStoreDeliveryFile[] | undefined): Promise<Array<{
    name: string;
    absolute: string;
    size?: number;
}>>;
/** حذف ملفات عنصر من القرص (عند الاستبدال/المسح/الحذف) */
export declare function deleteDeliveryFiles(files: IStoreDeliveryFile[] | undefined): Promise<number>;
//# sourceMappingURL=deliveryFiles.d.ts.map