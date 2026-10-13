// ============================================
// Liberty City Bot - عميل Hugging Face Spaces
// مجاني بالكامل (ZeroGPU) — يتطلب حساب Hugging Face مجاني (بلا بطاقة)
//
// كيف يعمل:
//   1) إيقاظ المساحة (قد تكون نائمة)
//   2) POST  /gradio_api/queue/join     → event_id
//   3) GET   /gradio_api/queue/data?session_hash=...   (SSE) → process_completed
// ============================================

import axios from 'axios';
import { createLogger } from './helpers';
import { config } from '../config';

const logger = createLogger('HFSpaces');

export interface HFResult {
  /** ملفات الناتج (مسارات مطلقة على خادم HF، أو base64) */
  files: string[];
  /** النص الخام للنتيجة (للاستخراج اليدوي) */
  raw: unknown;
}

const UA = 'Mozilla/5.0 (LibertyCityBot)';
const RESULT_TIMEOUT_MS = 12 * 60 * 1000; // سقف انتظار النتيجة
const WAKE_TIMEOUT_MS = 30_000;

/** يحول معرّف المساحة "Org/Name" إلى اسم المضيف "org-name" */
export function spaceHost(spaceId: string): string {
  return spaceId.replace(/\//g, '-').toLowerCase();
}

/** يوقظ المساحة النائمة — أول طلب قد يفشل بدون هذا */
export async function wakeSpace(spaceId: string): Promise<void> {
  const url = `https://${spaceHost(spaceId)}.hf.space/`;
  try {
    await axios.get(url, { timeout: WAKE_TIMEOUT_MS, headers: { 'User-Agent': UA } });
    logger.info(`Space awake: ${spaceId}`);
  } catch {
    // بعض المساحات ترجع 4xx لكنها تكون قد استيقظت — لا نهتم
  }
}

/** يجلب مخطّط واجهة المساحة (الأسماء والمعاملات) — مفيد للتشخيص */
export async function getSpaceInfo(spaceId: string): Promise<any> {
  const url = `https://${spaceHost(spaceId)}.hf.space/gradio_api/info`;
  const res = await axios.get(url, { timeout: 25_000, headers: { 'User-Agent': UA } });
  return res.data;
}

function hfHeaders(): Record<string, string> {
  return { 'User-Agent': UA, 'Content-Type': 'application/json' };
}

/**
 * يستدعي دالة في مساحة Gradio عبر الطابور ويعيد النتيجة.
 * @param fnIndex ترقيم الدالة في مساحة المساحة (من /config → dependencies[i])
 *                مثال: Stable Audio 3 → /infer هو fn_index 3
 */
export async function callSpaceFn(
  spaceId: string,
  fnIndex: number,
  data: unknown[],
  opts: { timeoutMs?: number } = {}
): Promise<HFResult> {
  const token = config.ai.hf.token;
  if (!token) throw new Error('HF_TOKEN غير مضبوط');

  const host = spaceHost(spaceId);
  const sessionHash = Math.random().toString(36).slice(2, 14);
  const timeoutMs = opts.timeoutMs ?? RESULT_TIMEOUT_MS;

  // 1) الانضمام للطابور
  //    ⚠️ هذا الإصدار من Gradio لا يقبل api_name — لازم fn_index
  const join = await axios.post(
    `https://${host}.hf.space/gradio_api/queue/join`,
    { data, fn_index: fnIndex, session_hash: sessionHash },
    { timeout: 45_000, headers: { ...hfHeaders(), Authorization: `Bearer ${token}` } }
  );

  const eventId = join.data?.event_id;
  if (!eventId) {
    logger.warn(`No event_id from ${spaceId} (fn_index=${fnIndex}): ${JSON.stringify(join.data).slice(0, 200)}`);
    throw new Error('لم يتم قبول الطلب في الطابور');
  }

  // 2) انتظار النتيجة عبر SSE
  const streamUrl = `https://${host}.hf.space/gradio_api/queue/data?session_hash=${sessionHash}`;
  const res = await axios.get(streamUrl, {
    timeout: timeoutMs,
    responseType: 'stream',
    headers: { 'User-Agent': UA, Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
  });

  const result = await new Promise<HFResult>((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      res.data.destroy();
      reject(new Error('انتهت مهلة انتظار النتيجة'));
    }, timeoutMs);

    res.data.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        let ev: any;
        try {
          ev = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (ev.msg === 'process_completed') {
          clearTimeout(timer);
          res.data.destroy();
          const out = ev.output || {};
          if (out.error) return reject(new Error(String(out.error).slice(0, 200)));
          return resolve(collectFiles(out));
        }
        if (ev.msg === 'close_stream') {
          clearTimeout(timer);
          res.data.destroy();
          return reject(new Error('انتهى البث بدون نتيجة'));
        }
      }
    });

    res.data.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
    res.data.on('end', () => {
      clearTimeout(timer);
      reject(new Error('انتهى البث مبكراً'));
    });
  });

  return result;
}

/** يجمع كل ملفات/روابط الناتج من مخرجات Gradio (قالب عميق) */
function collectFiles(output: any): HFResult {
  const files = new Set<string>();
  const visit = (node: any): void => {
    if (!node) return;
    if (typeof node === 'string') {
      if (/^https?:\/\//.test(node)) files.add(node);
      return;
    }
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === 'object') {
      if (typeof node.url === 'string') files.add(node.url);
      if (typeof node.path === 'string' && /^https?:\/\//.test(node.path)) files.add(node.path);
      if (typeof node.value === 'string' && /^https?:\/\//.test(node.value)) files.add(node.value);
      Object.values(node).forEach(visit);
    }
  };
  visit(output);
  return { files: [...files], raw: output };
}

/** يحمّل ملف الناتج إلى Buffer (مع سقف حجم) */
export async function downloadResult(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<Buffer> {
  const maxBytes = opts.maxBytes ?? 100 * 1024 * 1024; // 100MB افتراضياً (الفيديو قد يكون كبيراً)
  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: opts.timeoutMs ?? 120_000,
    headers: { 'User-Agent': UA },
    maxContentLength: maxBytes,
  });
  return Buffer.from(res.data as any);
}
