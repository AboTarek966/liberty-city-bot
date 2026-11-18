// ============================================
// Omni Bot - 📁 ملفات التسليم (حفظ/استرجاع)
// تُنزَّل الملفات المرفقة مع `/project add|edit` إلى القرص عند الرفع
// حتى تبقى متاحة دائماً عند التسليم (روابط Discord الموقّعة تنتهي صلاحيتها)
// ============================================

import fs from 'fs';
import path from 'path';
import { createLogger } from './helpers';
import type { IStoreDeliveryFile } from '../models';

const logger = createLogger('DeliveryFiles');

/** المجلد الأساسي لحفظ ملفات التسليم — نسبة إلى cwd (الدائم على الاستضافة) */
export const DELIVERY_DIR = path.join(process.cwd(), 'data', 'store-files');

const sanitizeName = (raw: unknown, fallback: string): string => {
  const name = String(raw ?? '').trim();
  if (!name) return fallback;
  // اسم ملف آمن: يُبقي الحروف العربية/اللاتينية والأرقام والفاصلة ونقطة الامتداد
  return name
    .replace(/[^\p{L}\p{N} ._-]+/gu, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '.')
    .trim()
    .slice(0, 120) || fallback;
};

function resolveInDeliveryDir(rel: unknown): string | null {
  const raw = String(rel ?? '').trim();
  if (!raw || path.isAbsolute(raw)) return null;
  const abs = path.resolve(process.cwd(), raw);
  const dir = path.resolve(DELIVERY_DIR);
  if (abs !== dir && !abs.startsWith(dir + path.sep)) return null;
  return abs;
}

export interface SaveResult {
  saved: IStoreDeliveryFile[];
  /** أسماء الملفات التي فشل حفظها (سبب للتقرير للبائع) */
  failed: string[];
}

/**
 * ينزّل مرفقات أوامر السلاش ويحفظها تحت `data/store-files/<key>/`.
 * @param key معرّف العنصر (project id) — يمنح كل عنصر مجلداً مستقلاً
 */
export async function saveDeliveryAttachments(
  key: string,
  attachments: Array<{ name?: string; url?: string; size?: number }>
): Promise<SaveResult> {
  const saved: IStoreDeliveryFile[] = [];
  const failed: string[] = [];
  const safeKey = String(key || 'misc').replace(/[^a-z0-9-]/gi, '') || 'misc';
  const dir = path.join(DELIVERY_DIR, safeKey);

  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (err: any) {
    logger.error(`mkdir ${dir} failed: ${err?.message}`);
    return { saved, failed: attachments.map((a) => String(a?.name ?? 'ملف')) };
  }

  for (const att of attachments) {
    const rawName = att?.name ?? 'file';
    const name = sanitizeName(rawName, 'file');
    const url = String(att?.url ?? '').trim();
    if (!url) {
      failed.push(String(rawName));
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        failed.push(String(rawName));
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > 25 * 1024 * 1024) {
        failed.push(String(rawName));
        continue;
      }
      const dest = path.join(dir, name);
      await fs.promises.writeFile(dest, buf);
      saved.push({
        name,
        size: buf.length,
        path: path.relative(process.cwd(), dest),
      });
    } catch (err: any) {
      logger.warn(`saveDeliveryAttachment failed for ${rawName}: ${err?.message || err}`);
      failed.push(String(rawName));
    }
  }

  return { saved, failed };
}

/** مسار مطلق لكل ملف موجود على القرص — يتخطى الملفات المفقودة */
export async function deliveryFilePaths(
  files: IStoreDeliveryFile[] | undefined
): Promise<Array<{ name: string; absolute: string; size?: number }>> {
  const list = Array.isArray(files) ? files : [];
  const out: Array<{ name: string; absolute: string; size?: number }> = [];
  for (const f of list) {
    const abs = resolveInDeliveryDir(f?.path);
    if (!abs) continue;
    try {
      await fs.promises.access(abs, fs.constants.R_OK);
      out.push({ name: f?.name || path.basename(abs), absolute: abs, size: f?.size });
    } catch {
      /* ملف مفقود — يتخطاه المرسل */
    }
  }
  return out;
}

/** حذف ملفات عنصر من القرص (عند الاستبدال/المسح/الحذف) */
export async function deleteDeliveryFiles(
  files: IStoreDeliveryFile[] | undefined
): Promise<number> {
  let removed = 0;
  for (const f of Array.isArray(files) ? files : []) {
    const abs = resolveInDeliveryDir(f?.path);
    if (!abs) continue;
    try {
      await fs.promises.unlink(abs);
      removed++;
    } catch {
      /* تجاهل */
    }
  }
  return removed;
}
