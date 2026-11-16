// ============================================
// Omni Bot - Worker للرندر (عجلة الحظ / روليت)
// ينفّذ رسم الصورة داخل Worker Thread حتى لا يتجمّد
// الـ Event Loop الرئيسي للبوت على الاستضافات الضعيفة.
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
      // دائماً PNG داخل الـ Worker — GIF يُرسم في الخيط الرئيسي عند الحاجة فقط
      const out = await renderWheelOfFortuneGif({ ...msg.opts, format: 'png' });
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

/**
 * يحاول الرندر داخل خيوط عاملة لـ Node.
 * يرجع null لو الـ Worker غير متاح أو حدث خطأ/مهلة — المكالم الاحتياطي في الدفعة الأم.
 */
export async function renderWheelInWorker(opts: WheelOfFortuneOptions, timeoutMs = 20000): Promise<Buffer | null> {
  if (!canUseWheelWorker()) return null;

  const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise<Buffer | null>((resolve) => {
    let settled = false;
    let worker: Worker;
    const done = (v: Buffer | null) => {
      if (settled) return;
      settled = true;
      try { worker?.terminate(); } catch {}
      resolve(v);
    };

    try {
      const workerPath = path.join(__dirname, 'wheelWorker.js');
      worker = new Worker(workerPath, { eval: false });
    } catch (err: any) {
      logger.warn(`wheel worker spawn failed: ${err?.message || err}`);
      resolve(null);
      return;
    }

    const timer = setTimeout(() => {
      logger.warn(`wheel worker timeout (>${timeoutMs}ms) — falling back`);
      done(null);
    }, timeoutMs);

    worker.on('message', (msg: WheelRenderResponse) => {
      clearTimeout(timer);
      if (!msg) {
        done(null);
        return;
      }
      if (msg.ok) {
        try {
          done(Buffer.from(msg.buffer));
        } catch {
          done(null);
        }
        return;
      }
      logger.warn(`wheel worker error: ${msg.error}`);
      done(null);
    });

    worker.on('error', (err) => {
      clearTimeout(timer);
      logger.warn(`wheel worker error event: ${String(err?.message || err)}`);
      done(null);
    });

    worker.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !settled) {
        logger.warn(`wheel worker exited with code ${code}`);
        done(null);
      }
    });

    // اطلب الرندر — دائماً PNG
    worker.postMessage({ id, opts: { ...opts, format: 'png' } } as WheelRenderRequest);
  });
}
