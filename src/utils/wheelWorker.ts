// ============================================
// Omni Bot - Worker للرندر (عجلة الحظ / روليت)
// ينفّذ رسم الصورة داخل Worker Thread حتى لا يتجمّد
// الـ Event Loop الرئيسي للبوت على الاستضافات الضعيفة.
//
// تصميم: Worker واحد مشترك (singleton) يُعاد استخدامه،
// مع مهلة لكل طلب — لو تجاوزها نغلق الـ Worker ونكمل بدون صورة.
// ============================================

import { Worker, isMainThread, parentPort } from 'worker_threads';
import path from 'path';
import { createLogger } from './helpers';
import { renderWheelOfFortuneGif, WheelOfFortuneOptions } from './wheelOfFortune';

const logger = createLogger('WheelWorker');

// --------------------------------------------
// تعريف الرسائل بين العملية الرئيسية والـ Worker
// --------------------------------------------
export interface WheelRenderRequest {
  id: string;
  opts: WheelOfFortuneOptions;
}

interface WheelRenderOk {
  ok: true;
  id: string;
  buffer: Buffer;
}

interface WheelRenderErr {
  ok: false;
  id: string;
  error: string;
}

export type WheelRenderResponse = WheelRenderOk | WheelRenderErr;

// --------------------------------------------
// دخول الـ Worker (إن لم نكن في العملية الرئيسية)
// --------------------------------------------
if (!isMainThread && parentPort) {
  const port = parentPort;
  port.on('message', async (msg: WheelRenderRequest) => {
    try {
      if (!msg?.opts || !msg?.id) return;
      // التنسيق يأتي من opts (png للروليت، gif لأمر /wheel) — وكل ذلك بعيداً عن الـ Event Loop
      const out = await renderWheelOfFortuneGif({ ...msg.opts });
      const res: WheelRenderOk = { ok: true, id: msg.id, buffer: out };
      port.postMessage(res);
    } catch (error: any) {
      const res: WheelRenderErr = {
        ok: false,
        id: msg?.id || 'unknown',
        error: String(error?.message || error),
      };
      port.postMessage(res);
    }
  });
}

// --------------------------------------------
// مسار العميل: تشغيل الرندر داخل Worker مع مهلة
// --------------------------------------------
export function canUseWheelWorker(): boolean {
  if ((process.env.ROULETTE_WORKER || 'true').toLowerCase() === 'false') return false;
  try {
    const workerPath = require.resolve('./wheelWorker');
    return !!workerPath;
  } catch {
    return false;
  }
}

let sharedWorker: Worker | null = null;
let sharedWorkerFailed = false;

const pending = new Map<
  string,
  { resolve: (buffer: Buffer | null) => void; timer: NodeJS.Timeout }
>();

function ensureWorker(): Worker | null {
  if (sharedWorkerFailed) return null;
  if (sharedWorker) return sharedWorker;
  try {
    const workerPath = path.join(__dirname, 'wheelWorker.js');
    sharedWorker = new Worker(workerPath, { eval: false });
    sharedWorker.on('message', (msg: WheelRenderResponse) => {
      if (!msg?.id) return;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.ok && msg.buffer) {
        try {
          entry.resolve(Buffer.from(msg.buffer));
        } catch {
          entry.resolve(null);
        }
      } else {
        logger.warn(`wheel worker error: ${(msg as WheelRenderErr).error}`);
        entry.resolve(null);
      }
    });
    const onWorkerDead = (reason: string) => {
      logger.warn(`wheel worker dead (${reason}) — closing`);
      killSharedWorker();
      const entries = [...pending.values()];
      pending.clear();
      for (const entry of entries) {
        clearTimeout(entry.timer);
        entry.resolve(null);
      }
    };
    sharedWorker.on('error', (err) => onWorkerDead(String(err?.message || err)));
    sharedWorker.on('exit', (code) => {
      if (code !== 0) onWorkerDead(`exit code ${code}`);
    });
    return sharedWorker;
  } catch (err: any) {
    logger.warn(`wheel worker spawn failed: ${err?.message || err}`);
    sharedWorkerFailed = true;
    return null;
  }
}

function killSharedWorker(): void {
  const worker = sharedWorker;
  sharedWorker = null;
  if (worker) {
    try {
      void worker.terminate();
    } catch {
      /* تجاهل */
    }
  }
}

/** تنظيف عند إيقاف البوت */
export function terminateWheelWorker(): void {
  killSharedWorker();
}

/**
 * يحاول الرندر داخل Worker.
 * يعيد null لو الـ Worker غير متاح أو حدث خطأ/مهلة — المستدعي يرسل الرسالة بدون صورة (لا تجميد للبوت).
 */
export async function renderWheelInWorker(
  opts: WheelOfFortuneOptions,
  timeoutMs = 15000
): Promise<Buffer | null> {
  if (!canUseWheelWorker()) return null;

  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const worker = ensureWorker();
  if (!worker) return null;

  return new Promise<Buffer | null>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      logger.warn(`wheel worker timeout (>${timeoutMs}ms) — sending without image`);
      // Worker قد يكون عالقاً — أغلقه ليُعاد إنشاؤه للطلبات القادمة
      killSharedWorker();
      resolve(null);
    }, timeoutMs);

    pending.set(id, { resolve, timer });

    try {
      worker.postMessage({ id, opts: { ...opts } } as WheelRenderRequest);
    } catch (err: any) {
      pending.delete(id);
      clearTimeout(timer);
      logger.warn(`wheel worker postMessage failed: ${String(err?.message || err)}`);
      resolve(null);
    }
  });
}
