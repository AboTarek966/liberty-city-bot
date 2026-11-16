"use strict";
// ============================================
// Omni Bot - Worker للرندر (عجلة الحظ / روليت)
// ينفّذ رسم الصورة داخل Worker Thread حتى لا يتجمّد
// الـ Event Loop الرئيسي للبوت على الاستضافات الضعيفة.
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUseWheelWorker = canUseWheelWorker;
exports.renderWheelInWorker = renderWheelInWorker;
const worker_threads_1 = require("worker_threads");
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
const wheelOfFortune_1 = require("./wheelOfFortune");
const logger = (0, helpers_1.createLogger)('WheelWorker');
// --------------------------------------------
// دخول الـ Worker (إن لم نكن في العملية الرئيسية)
// --------------------------------------------
if (!worker_threads_1.isMainThread && worker_threads_1.parentPort) {
    const port = worker_threads_1.parentPort;
    port.on('message', async (msg) => {
        try {
            if (!msg?.opts || !msg?.id)
                return;
            // دائماً PNG داخل الـ Worker — GIF يُرسم في الخيط الرئيسي عند الحاجة فقط
            const out = await (0, wheelOfFortune_1.renderWheelOfFortuneGif)({ ...msg.opts, format: 'png' });
            const res = { ok: true, id: msg.id, buffer: out };
            port.postMessage(res);
        }
        catch (error) {
            const res = {
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
function canUseWheelWorker() {
    if ((process.env.ROULETTE_WORKER || 'true').toLowerCase() === 'false')
        return false;
    try {
        const workerPath = require.resolve('./wheelWorker');
        return !!workerPath;
    }
    catch {
        return false;
    }
}
/**
 * يحاول الرندر داخل خيوط عاملة لـ Node.
 * يرجع null لو الـ Worker غير متاح أو حدث خطأ/مهلة — المكالم الاحتياطي في الدفعة الأم.
 */
async function renderWheelInWorker(opts, timeoutMs = 20000) {
    if (!canUseWheelWorker())
        return null;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve) => {
        let settled = false;
        let worker;
        const done = (v) => {
            if (settled)
                return;
            settled = true;
            try {
                worker?.terminate();
            }
            catch { }
            resolve(v);
        };
        try {
            const workerPath = path_1.default.join(__dirname, 'wheelWorker.js');
            worker = new worker_threads_1.Worker(workerPath, { eval: false });
        }
        catch (err) {
            logger.warn(`wheel worker spawn failed: ${err?.message || err}`);
            resolve(null);
            return;
        }
        const timer = setTimeout(() => {
            logger.warn(`wheel worker timeout (>${timeoutMs}ms) — falling back`);
            done(null);
        }, timeoutMs);
        worker.on('message', (msg) => {
            clearTimeout(timer);
            if (!msg) {
                done(null);
                return;
            }
            if (msg.ok) {
                try {
                    done(Buffer.from(msg.buffer));
                }
                catch {
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
        worker.postMessage({ id, opts: { ...opts, format: 'png' } });
    });
}
//# sourceMappingURL=wheelWorker.js.map