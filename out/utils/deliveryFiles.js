"use strict";
// ============================================
// Omni Bot - 📁 ملفات التسليم (حفظ/استرجاع)
// تُنزَّل الملفات المرفقة مع `/project add|edit` إلى القرص عند الرفع
// حتى تبقى متاحة دائماً عند التسليم (روابط Discord الموقّعة تنتهي صلاحيتها)
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELIVERY_DIR = void 0;
exports.saveDeliveryAttachments = saveDeliveryAttachments;
exports.deliveryFilePaths = deliveryFilePaths;
exports.deleteDeliveryFiles = deleteDeliveryFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('DeliveryFiles');
/** المجلد الأساسي لحفظ ملفات التسليم — نسبة إلى cwd (الدائم على الاستضافة) */
exports.DELIVERY_DIR = path_1.default.join(process.cwd(), 'data', 'store-files');
const sanitizeName = (raw, fallback) => {
    const name = String(raw ?? '').trim();
    if (!name)
        return fallback;
    // اسم ملف آمن: يُبقي الحروف العربية/اللاتينية والأرقام والفاصلة ونقطة الامتداد
    return name
        .replace(/[^\p{L}\p{N} ._-]+/gu, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^\.+/, '.')
        .trim()
        .slice(0, 120) || fallback;
};
function resolveInDeliveryDir(rel) {
    const raw = String(rel ?? '').trim();
    if (!raw || path_1.default.isAbsolute(raw))
        return null;
    const abs = path_1.default.resolve(process.cwd(), raw);
    const dir = path_1.default.resolve(exports.DELIVERY_DIR);
    if (abs !== dir && !abs.startsWith(dir + path_1.default.sep))
        return null;
    return abs;
}
/**
 * ينزّل مرفقات أوامر السلاش ويحفظها تحت `data/store-files/<key>/`.
 * @param key معرّف العنصر (project id) — يمنح كل عنصر مجلداً مستقلاً
 */
async function saveDeliveryAttachments(key, attachments) {
    const saved = [];
    const failed = [];
    const safeKey = String(key || 'misc').replace(/[^a-z0-9-]/gi, '') || 'misc';
    const dir = path_1.default.join(exports.DELIVERY_DIR, safeKey);
    try {
        await fs_1.default.promises.mkdir(dir, { recursive: true });
    }
    catch (err) {
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
            const dest = path_1.default.join(dir, name);
            await fs_1.default.promises.writeFile(dest, buf);
            saved.push({
                name,
                size: buf.length,
                path: path_1.default.relative(process.cwd(), dest),
            });
        }
        catch (err) {
            logger.warn(`saveDeliveryAttachment failed for ${rawName}: ${err?.message || err}`);
            failed.push(String(rawName));
        }
    }
    return { saved, failed };
}
/** مسار مطلق لكل ملف موجود على القرص — يتخطى الملفات المفقودة */
async function deliveryFilePaths(files) {
    const list = Array.isArray(files) ? files : [];
    const out = [];
    for (const f of list) {
        const abs = resolveInDeliveryDir(f?.path);
        if (!abs)
            continue;
        try {
            await fs_1.default.promises.access(abs, fs_1.default.constants.R_OK);
            out.push({ name: f?.name || path_1.default.basename(abs), absolute: abs, size: f?.size });
        }
        catch {
            /* ملف مفقود — يتخطاه المرسل */
        }
    }
    return out;
}
/** حذف ملفات عنصر من القرص (عند الاستبدال/المسح/الحذف) */
async function deleteDeliveryFiles(files) {
    let removed = 0;
    for (const f of Array.isArray(files) ? files : []) {
        const abs = resolveInDeliveryDir(f?.path);
        if (!abs)
            continue;
        try {
            await fs_1.default.promises.unlink(abs);
            removed++;
        }
        catch {
            /* تجاهل */
        }
    }
    return removed;
}
//# sourceMappingURL=deliveryFiles.js.map