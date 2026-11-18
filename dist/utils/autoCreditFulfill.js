"use strict";
// ============================================
// Omni Bot - 💳 الاكتشاف التلقائي لتحويل الكريديت عند الشراء
// ============================================
// عندما يكتب المشتري أمر الدفع بعينه (مثل: #credit 1342238662368296980 84210527)
// يكتشفه البوت فوراً ويطابقه بدقة مع طلبه المعلّق:
//   نفس المرسل (المشتري) + نفس المستلم (أمر الدفع المرسل إليه سابقاً) + نفس المبلغ
// لا يطابق أي تحويل عادي آخر (لا يكفي أن يشبه الأمر — لازم يطلب الدفع).
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCreditCommand = parseCreditCommand;
exports.handleAutoCreditTransfer = handleAutoCreditTransfer;
const helpers_1 = require("./helpers");
const models_1 = require("../models");
const store_1 = require("./store");
const storeFulfill_1 = require("./storeFulfill");
const logger = (0, helpers_1.createLogger)('AutoCredit');
/** تطبيع الأرقام العربية/الفارسية إلى أرقام لاتينية وحذف فواصل الآلاف */
function normalizeDigits(text) {
    const map = {
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
        '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
        '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
    };
    return String(text ?? '').replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}
/** محاولة استخراج أمر الدفع من نص رسالة. يعيد null إذا لم تكن رسالة دفع إطلاقاً. */
function parseCreditCommand(text) {
    try {
        const raw = normalizeDigits(String(text ?? ''));
        const t = raw.trim();
        if (t.length > 120)
            return null; // المشتري لازم يرسل الأمر وحده
        const match = /^\s*(?:#|!|\/|-|\+)?credits?\s+(\d{15,22})\s+(\d[\d\s,،_]{0,20})\s*$/i.exec(t);
        if (!match)
            return null;
        const payeeId = match[1];
        const amount = Math.floor(Number(match[2].replace(/[,،\s_]/g, '')));
        if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
            return null;
        }
        return { payeeId, amount };
    }
    catch {
        return null;
    }
}
/**
 * يُستدعى من معالج الرسائل لكل رسالة بشرية في السيرفر.
 * لا يلمس الرسالة إطلاقاً (لا رد ولا حذف) إلا عند تطابق تام مع طلب معلّق.
 */
async function handleAutoCreditTransfer(message) {
    try {
        if (!message.guild || message.author.bot || message.webhookId)
            return;
        // 🚪 فحص سريع أولاً — نص الرسالة يحمل credit و32 حرفاً على الأكثر قبل الدخول للتفاصيل
        const t = message.content;
        if (!/credit/i.test(t) || t.length > 120)
            return;
        const parsed = parseCreditCommand(t);
        if (!parsed)
            return;
        // 🔍 مطابقة دقيقة: نفس المشتري (مرسل الأمر) + نفس المستلم + نفس المبلغ + طلب معلق
        let order = await models_1.StoreOrder.findOne({
            buyerId: message.author.id,
            amount: parsed.amount,
            payeeId: parsed.payeeId,
            status: 'pending',
        })
            .sort({ createdAt: -1 })
            .lean();
        if (!order) {
            // أوامر قديمة بدون payeeId — نطابق على المستلم الحالي للمتجر فقط
            const store = await (0, store_1.getStore)(false).catch(() => null);
            if (store?.payeeId && String(store.payeeId) === parsed.payeeId) {
                order = await models_1.StoreOrder.findOne({
                    buyerId: message.author.id,
                    amount: parsed.amount,
                    status: 'pending',
                    $or: [
                        { payeeId: { $exists: false } },
                        { payeeId: null },
                        { payeeId: '' },
                    ],
                })
                    .sort({ createdAt: -1 })
                    .lean();
            }
        }
        if (!order)
            return; // تحويل عادي — لا علاقة له بالمتجر
        const result = await (0, storeFulfill_1.fulfillStoreOrder)(message.client, {
            mode: 'auto',
            orderId: order.orderId,
            guild: message.guild,
            actorLabel: 'auto',
            notifyLog: true,
        });
        if (!result.claimed)
            return;
        const channel = message.channel;
        await channel
            .send({
            content: `🤖 **تم اكتشاف دفعتك تلقائياً** — <@${message.author.id}>\n` +
                `> 🧾 الطلب **#${order.orderId}** — **${order.projectName}**\n` +
                `> ✅ تم تأكيد الدفع وإتمام التسليم — وصلك رول التسليم (لو كان مربوطاً بالعنصر) وإشعار خاص`,
        })
            .catch(() => { });
    }
    catch (error) {
        logger.warn(`auto credit detection error: ${error?.message || error}`);
    }
}
//# sourceMappingURL=autoCreditFulfill.js.map