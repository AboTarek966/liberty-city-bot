"use strict";
// ============================================
// Omni Bot - Worker للرندر (عجلة الحظ / روليت)
// ينفّذ رسم الصورة داخل Worker Thread حتى لا يتجمّد
// الـ Event Loop الرئيسي للبوت على الاستضافات الضعيفة.
//
// تصميم: Worker واحد مشترك (singleton) يُعاد استخدامه،
// مع مهلة لكل طلب — لو تجاوزها نغلق الـ Worker ونكمل بدون صورة.
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUseWheelWorker = canUseWheelWorker;
exports.terminateWheelWorker = terminateWheelWorker;
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
            // التنسيق يأتي من opts (png للروليت، gif لأمر /wheel) — وكل ذلك بعيداً عن الـ Event Loop
            const out = await (0, wheelOfFortune_1.renderWheelOfFortuneGif)({ ...msg.opts });
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
let sharedWorker = null;
let sharedWorkerFailed = false;
const pending = new Map();
function ensureWorker() {
    if (sharedWorkerFailed)
        return null;
    if (sharedWorker)
        return sharedWorker;
    try {
        const workerPath = path_1.default.join(__dirname, 'wheelWorker.js');
        sharedWorker = new worker_threads_1.Worker(workerPath, { eval: false });
        sharedWorker.on('message', (msg) => {
            if (!msg?.id)
                return;
            const entry = pending.get(msg.id);
            if (!entry)
                return;
            pending.delete(msg.id);
            clearTimeout(entry.timer);
            if (msg.ok && msg.buffer) {
                try {
                    entry.resolve(Buffer.from(msg.buffer));
                }
                catch {
                    entry.resolve(null);
                }
            }
            else {
                logger.warn(`wheel worker error: ${msg.error}`);
                entry.resolve(null);
            }
        });
        const onWorkerDead = (reason) => {
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
            if (code !== 0)
                onWorkerDead(`exit code ${code}`);
        });
        return sharedWorker;
    }
    catch (err) {
        logger.warn(`wheel worker spawn failed: ${err?.message || err}`);
        sharedWorkerFailed = true;
        return null;
    }
}
function killSharedWorker() {
    const worker = sharedWorker;
    sharedWorker = null;
    if (worker) {
        try {
            void worker.terminate();
        }
        catch {
            /* تجاهل */
        }
    }
}
/** تنظيف عند إيقاف البوت */
function terminateWheelWorker() {
    killSharedWorker();
}
/**
 * يحاول الرندر داخل Worker.
 * يعيد null لو الـ Worker غير متاح أو حدث خطأ/مهلة — المستدعي يرسل الرسالة بدون صورة (لا تجميد للبوت).
 */
async function renderWheelInWorker(opts, timeoutMs = 15000) {
    if (!canUseWheelWorker())
        return null;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const worker = ensureWorker();
    if (!worker)
        return null;
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            pending.delete(id);
            logger.warn(`wheel worker timeout (>${timeoutMs}ms) — sending without image`);
            // Worker قد يكون عالقاً — أغلقه ليُعاد إنشاؤه للطلبات القادمة
            killSharedWorker();
            resolve(null);
        }, timeoutMs);
        pending.set(id, { resolve, timer });
        try {
            worker.postMessage({ id, opts: { ...opts } });
        }
        catch (err) {
            pending.delete(id);
            clearTimeout(timer);
            logger.warn(`wheel worker postMessage failed: ${String(err?.message || err)}`);
            resolve(null);
        }
    });
}
//# sourceMappingURL=wheelWorker.js.map