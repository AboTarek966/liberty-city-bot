"use strict";
// ============================================
// Omni Bot - Document Text Extraction
// استخراج نص المستندات المرفقة: PDF · DOCX · PPTX · XLSX · ODT · RTF
// بدون مكتبات خارجية — zlib المدمجة فقط.
// الاستخراج "أفضل جهد" ويُستخدم كسياق للذكاء الاصطناعي.
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPdfText = extractPdfText;
exports.extractDocumentText = extractDocumentText;
const zlib_1 = __importDefault(require("zlib"));
const MAX_TEXT_CHARS = 8000;
// ---------- أدوات عامة ----------
function inflateAny(buf) {
    try {
        return zlib_1.default.inflateSync(buf);
    }
    catch {
        /* ليس zlib */
    }
    try {
        return zlib_1.default.inflateRawSync(buf);
    }
    catch {
        /* ليس raw deflate */
    }
    return null;
}
function decodeXmlEntities(s) {
    return s
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) % 0x110000))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16) % 0x110000))
        .replace(/&amp;/g, '&');
}
/** يحوّل XML إلى نص مقروء (فواصل أسطر عند نهاية الفقرات) */
function xmlToText(xml) {
    const withBreaks = xml
        .replace(/<\/w:p>|<\/a:p>|<w:br\s*\/>|<a:br\s*\/>|<\/w:tr>|<\/text:p>/g, '\n')
        .replace(/<[^>]+>/g, ' ');
    return decodeXmlEntities(withBreaks)
        .replace(/[ \t\u00a0]+/g, ' ')
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
/** نسبة المحارف "المعقولة" — لرفض المخرجات المشوّشة */
function printableRatio(s) {
    const chars = Array.from(s);
    if (!chars.length)
        return 0;
    let ok = 0;
    for (const ch of chars) {
        const c = ch.codePointAt(0);
        if ((c >= 0x20 && c <= 0x7e) || // لاتيني/أرقام/رموز
            (c >= 0x0600 && c <= 0x06ff) || // عربي
            (c >= 0x0750 && c <= 0x077f) ||
            (c >= 0x08a0 && c <= 0x08ff) ||
            c === 0x0a ||
            c === 0x09 ||
            (c >= 0x2000 && c <= 0x206f) // ترقيم عام
        ) {
            ok++;
        }
    }
    return ok / chars.length;
}
function finalize(kind, raw) {
    const text = raw
        .replace(/[ \t\u00a0]+/g, ' ')
        .replace(/[ \t]*\n[ \t]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, MAX_TEXT_CHARS);
    const usable = text.length >= 160 && printableRatio(text) >= 0.5;
    return { kind, text, usable };
}
// ---------- PDF ----------
function decodePdfString(s) {
    const map = {
        n: '\n',
        r: '\r',
        t: '\t',
        b: '\b',
        f: '\f',
        '(': '(',
        ')': ')',
        '\\': '\\',
    };
    return s
        .replace(/\\([nrtbf()\\])/g, (_, c) => map[c] ?? c)
        .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
}
/** استخراج النصوص من مشغّلات محتوى PDF (Tj / TJ) بالترتيب */
function pdfStreamToText(content) {
    const out = [];
    const re = /(\[(?:[^\[\]\\]|\\.)*\]\s*TJ)|(\((?:\\.|[^\\()])*\)\s*(?:Tj|TJ|'|"))|(T\*)/g;
    let m;
    while ((m = re.exec(content)) !== null) {
        if (m[1]) {
            // صفائف TJ: [ (نص) -120 (نص) ] TJ
            const strings = m[1].match(/\((?:\\.|[^\\()])*\)/g) || [];
            if (strings.length) {
                out.push(strings.map(s => decodePdfString(s.slice(1, -1))).join(''));
            }
        }
        else if (m[2]) {
            const sm = /\(((?:\\.|[^\\()])*)\)/.exec(m[2]);
            if (sm)
                out.push(decodePdfString(sm[1]));
            if (/['"]\s*$/.test(m[2]))
                out.push('\n');
        }
        else if (m[3]) {
            out.push('\n'); // T* = سطر جديد
        }
    }
    return out.join(' ');
}
/** استخراج نص PDF عبر فك ضغط Streams وقراءة مشغّلات النص */
function extractPdfText(buffer) {
    const latin = buffer.toString('latin1');
    const chunks = [];
    let idx = 0;
    while (idx < latin.length) {
        const s = latin.indexOf('stream', idx);
        if (s < 0)
            break;
        // كلمة stream يجب أن تسبقها مسافة/سطر — نتجاهل "stream" داخل النصوص
        const prev = s > 0 ? latin[s - 1] : '\n';
        if (!/[\s>]/.test(prev)) {
            idx = s + 6;
            continue;
        }
        let dataStart = s + 6;
        if (latin[dataStart] === '\r')
            dataStart++;
        if (latin[dataStart] === '\n')
            dataStart++;
        const e = latin.indexOf('endstream', dataStart);
        if (e < 0)
            break;
        const raw = buffer.subarray(dataStart, e);
        idx = e + 9;
        if (raw.length < 8)
            continue;
        let content = null;
        const inf = inflateAny(raw);
        if (inf) {
            content = inf.toString('latin1');
        }
        else {
            const head = raw.toString('latin1').slice(0, 60);
            // نصوص غير مضغوطة فقط — نتجنب البيانات الثنائية (خطوط/صور)
            if (!/[\x00-\x08\x0e-\x1f]/.test(head) || /BT|Tj|TJ/.test(head)) {
                content = raw.toString('latin1');
            }
        }
        if (content && /(Tj|TJ)/.test(content)) {
            const t = pdfStreamToText(content);
            if (t.trim())
                chunks.push(t.trim());
        }
    }
    return chunks.join('\n').slice(0, MAX_TEXT_CHARS);
}
function readZip(buffer) {
    const entries = [];
    if (buffer.length < 22)
        return entries;
    // البحث عن توقيع نهاية الفهرس المركزي (EOCD) من نهاية الملف
    const eocdSig = 0x06054b50;
    let eocd = -1;
    const minPos = Math.max(0, buffer.length - 22 - 65535);
    for (let i = buffer.length - 22; i >= minPos; i--) {
        if (buffer.readUInt32LE(i) === eocdSig) {
            eocd = i;
            break;
        }
    }
    if (eocd < 0)
        return entries;
    const count = buffer.readUInt16LE(eocd + 10);
    let off = buffer.readUInt32LE(eocd + 16);
    for (let n = 0; n < count && off + 46 <= buffer.length; n++) {
        if (buffer.readUInt32LE(off) !== 0x02014b50)
            break;
        const method = buffer.readUInt16LE(off + 10);
        const compSize = buffer.readUInt32LE(off + 20);
        const nameLen = buffer.readUInt16LE(off + 28);
        const extraLen = buffer.readUInt16LE(off + 30);
        const commentLen = buffer.readUInt16LE(off + 32);
        const localOff = buffer.readUInt32LE(off + 42);
        const name = buffer.toString('utf8', off + 46, off + 46 + nameLen);
        if (localOff + 30 <= buffer.length && buffer.readUInt32LE(localOff) === 0x04034b50) {
            const lNameLen = buffer.readUInt16LE(localOff + 26);
            const lExtraLen = buffer.readUInt16LE(localOff + 28);
            const dataStart = localOff + 30 + lNameLen + lExtraLen;
            const comp = buffer.subarray(dataStart, Math.min(dataStart + compSize, buffer.length));
            let data = Buffer.alloc(0);
            if (method === 0)
                data = Buffer.from(comp);
            else if (method === 8)
                data = inflateAny(comp) || Buffer.alloc(0);
            entries.push({ name, data });
        }
        off += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
}
function extractZipDocText(buffer, wanted) {
    const entries = readZip(buffer);
    const parts = [];
    let total = 0;
    for (const entry of entries) {
        if (!entry.data.length || !wanted(entry.name))
            continue;
        const text = xmlToText(entry.data.toString('utf8'));
        if (!text)
            continue;
        parts.push(text);
        total += text.length;
        if (total > MAX_TEXT_CHARS * 1.5)
            break;
    }
    return parts.join('\n\n');
}
// ---------- RTF ----------
function extractRtfText(raw) {
    let s = raw.replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    s = s.replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(((Number(n) % 65536) + 65536) % 65536));
    s = s.replace(/\\par[d]?\b/g, '\n').replace(/\\line\b/g, '\n').replace(/\\tab\b/g, '\t');
    // إزالة المجموعات الوجهة ({\*\...}) — أفضل جهد بدون تتبع تداخل عميق
    s = s.replace(/\{\\\*[\s\S]*?\}/g, '');
    s = s.replace(/\\[a-z]+-?\d* ?/gi, ' ');
    s = s.replace(/[{}]/g, '');
    return s;
}
// ---------- المدخل الرئيسي ----------
function extractDocumentText(buffer, name, contentType = '') {
    const lower = (name || '').toLowerCase();
    const ct = (contentType || '').toLowerCase();
    const magicPdf = buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
    try {
        if (lower.endsWith('.pdf') || ct.includes('pdf') || magicPdf) {
            return finalize('pdf', extractPdfText(buffer));
        }
        if (lower.endsWith('.docx')) {
            return finalize('docx', extractZipDocText(buffer, n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n)));
        }
        if (lower.endsWith('.pptx')) {
            return finalize('pptx', extractZipDocText(buffer, n => /^ppt\/slides\/slide\d+\.xml$/.test(n)));
        }
        if (lower.endsWith('.xlsx')) {
            const shared = extractZipDocText(buffer, n => n === 'xl/sharedStrings.xml');
            const sheets = shared
                ? ''
                : extractZipDocText(buffer, n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
            return finalize('xlsx', [shared, sheets].filter(Boolean).join('\n\n'));
        }
        if (/\.(odt|odp|ods)$/.test(lower)) {
            return finalize('odt', extractZipDocText(buffer, n => n === 'content.xml'));
        }
        if (lower.endsWith('.rtf') || ct.includes('rtf')) {
            return finalize('rtf', extractRtfText(buffer.toString('latin1')));
        }
    }
    catch {
        /* استخراج بأفضل جهد — لا نرمي أخطاء للخارج */
    }
    return { kind: 'unknown', text: '', usable: false };
}
//# sourceMappingURL=documentText.js.map