// ============================================
// Omni Bot - 🛍️ متجر البروجيكتات (أدوات مشتركة)
// ============================================
// المتجر وثيقة (Singleton) واحدة مشتركة لكل السيرفرات (مفتاح main).
// الخصم: ProBot يأخذ نسبة من كل تحويل — لذلك أمر الدفع يُعرض بمبلغ
// (السعر الصافي ÷ (1 - الضريبة)) حتى يصل البائع كامل السعر الصافي.

import crypto from 'crypto';
import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, User } from 'discord.js';
import { Store, IStore, IStoreProject, StoreOrder } from '../models';
import { isBotOwner } from './botOwner';

export const STORE_KEY = 'main';
export const DEFAULT_TAX_PERCENT = 5;
export const DEFAULT_PROBOT_PREFIX = '!';
/** المستلم الافتراضي لتحويلات ProBot (مالك المتجر) — يقدر يتغير من /project config payee */
export const DEFAULT_PAYEE_ID = process.env.STORE_PAYEE_ID || '1342238662368296980';

/** قراءة وثيقة المتجر (تنشئها عند أول استخدام) مع تحديث الإعدادات الافتراضية */
export async function getStore(createIfMissing = true): Promise<IStore | null> {
  try {
    let doc = await Store.findOne({ key: STORE_KEY });
    if (!doc && createIfMissing) {
      doc = await Store.create({
        key: STORE_KEY,
        payeeId: DEFAULT_PAYEE_ID,
        probotPrefix: DEFAULT_PROBOT_PREFIX,
        taxPercent: DEFAULT_TAX_PERCENT,
        projects: [],
        managerIds: [],
      });
    }
    // ترحيل: لو المستلم لسه فاضي أو كان افتراضي قديم (DEVELOPER_USER_ID) نحدّثه للمستلم المعتمد
    if (doc) {
      const legacyDefault = process.env.DEVELOPER_USER_ID;
      const needsMigration =
        !doc.payeeId || (!!legacyDefault && doc.payeeId === legacyDefault && doc.payeeId !== DEFAULT_PAYEE_ID);
      if (needsMigration) {
        doc.payeeId = DEFAULT_PAYEE_ID;
        await doc.save().catch(() => {});
      }
    }
    return doc;
  } catch (error) {
    return null;
  }
}

/** نفس القراءة لكن كـ lean (للقوائم السريعة) — قد ترجع null */
export async function getStoreLean() {
  try {
    return await Store.findOne({ key: STORE_KEY }).lean();
  } catch {
    return null;
  }
}

/** هل هذا المستخدم يدير المتجر؟ (مالك البوت أو مدير مسجل) */
export async function canManageStore(client: any, userId: string): Promise<boolean> {
  if (await isBotOwner(client, userId)) return true;
  const doc = await getStore(false);
  if (!doc) return false;
  return (doc.managerIds || []).includes(userId);
}

/** بيانات الأمر المطلوب من المشتري تنفيذه في (ProBot) */
export function computeTransferAmount(price: number, taxPercent: number): number {
  const tax = Math.max(0, Math.min(25, Number(taxPercent) || 0));
  if (tax <= 0) return Math.ceil(price);
  return Math.ceil(price / (1 - tax / 100));
}

/** تنسيق رقم بفواصل آلاف (10,000,000) */
export function formatCredits(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Math.floor(n).toLocaleString('en-US');
}

/** تنسيق مختصر للسعر (10M / 500K) — يُستخدم في القوائم */
export function formatShort(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `${n / 1_000_000}M`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return String(Math.floor(n));
}

/** سطر سعر كامل: 10,000,000 (10M) */
export function priceLine(n: number): string {
  return `\`${formatCredits(n)}\` (${formatShort(n)})`;
}

/** بناء أمر تحويل الكريديت (ProBot/Credit) — الصيغة المطلوبة */
export function buildTransferCommand(payeeId: string, amount: number): string {
  return `credit ${payeeId} ${Math.max(0, Math.floor(amount))}#`;
}

/** يحوّل نص سعر إلى رقم: 10m / 500k / 10 مليون / 10,000,000 */
export function parsePrice(input: string): number | null {
  const raw = String(input || '').trim().toLowerCase().replace(/[,،\s_']/g, '');
  if (!raw) return null;
  const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)(b|m|k|مليون|الميلون|ألف|آلاف)?$/);
  if (!match) {
    const fallback = Number(raw.replace(/[^0-9]/g, ''));
    return Number.isFinite(fallback) && fallback > 0 ? Math.floor(fallback) : null;
  }
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const unit = match[2] || '';
  let value = base;
  if (unit === 'b') value = base * 1_000_000_000;
  else if (unit === 'm' || unit === 'مليون' || unit === 'الميلون') value = base * 1_000_000;
  else if (unit === 'k' || unit === 'ألف' || unit === 'آلاف') value = base * 1_000;
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

/** معرّف قصير للطلب/البروجيكت (مرتبط بروابط الأزرار) */
export function shortId(len = 6): string {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

/** يتحقق إن النص يشبه أمر تحويل كريديت */
export function isProbotCommandLike(text: string, _prefix: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  return /^(?:#?credit)\s+\d+\s+\d+#?$/.test(t) || /^!pay\b/i.test(t) || /^pay\s/i.test(t);
}

/** بناء إمبد المتجر (العرض الرئيسي) */
export function buildStoreEmbed(store: IStore): EmbedBuilder {
  const projects = (store.projects || []).filter((p) => p.enabled);
  const lines = projects.length
    ? projects.map((p, i) => {
        const desc = p.description?.trim() ? `\n    ┗ ${p.description.trim().slice(0, 100)}` : '';
        return `**${i + 1}.** 📦 **${p.name}** — 💰 ${priceLine(p.price)} كريديت${desc}`;
      }).join('\n')
    : 'المتجر فارغ حالياً — ترقّب الجديد عاجلاً.';

  const tax = Number(store.taxPercent ?? DEFAULT_TAX_PERCENT);
  const prefix = store.probotPrefix || DEFAULT_PROBOT_PREFIX;
  const payee = store.payeeId;

  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('🛍️ متجر بروجيكتات Omni')
    .setDescription(
      '**اختر البروجيكت اللي تبيه من القائمة بالأسفل**، وبنرسل لك أمر الدفع بالكريديت 👇\n\n' +
        lines +
        '\n\n' +
        `> 💸 **الأسعار موضع طلب تحويل صافي** — ProBot يديق **${tax}%** من كل تحويل، ` +
        'ولهذا بنعرض لك أمر التحويل **بالمبلغ اللازم** حتى يوصلك البائع السعر الصافي كامل**.\n' +
        (payee ? `> 💳 **الدفع يروح لـ <@${payee}>** عبر أمر \`credit\`.\n` : '') +
        `> ⚡ بعد ما تدفع، دوس \`دفعت\` داخل شاشة التأكيد ونوصلك إيصال فور التسليم.`
    )
    .setFooter({ text: `Omni Store • credit` })
    .setTimestamp();
}

/** بناء قائمة الاختيار (select) للمشاريع المفعّلة */
export function buildStoreSelect(store: IStore) {
  const projects = (store.projects || []).filter((p) => p.enabled);
  const options = projects.slice(0, 25).map((p) => ({
    label: `${p.name.slice(0, 60)} — ${formatShort(p.price)} كريديت`.slice(0, 100),
    value: p.id,
    description: (p.description?.trim() || 'بروجيكت جاهز للتسليم').slice(0, 100),
    emoji: '📦',
  }));

  if (!options.length) return null;

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('store:select')
      .setPlaceholder('🛒 اختر بروجيكت للشراء...')
      .addOptions(options)
  );
  return [row];
}

/** إيجاد البروجيكت بالمعرّف (غير حساس لحالة الأحرف) */
export function findProject(store: IStore, projectId: string): IStoreProject | undefined {
  return (store.projects || []).find((p) => p.id === projectId);
}

/** عدد البروجيكتات المضافة (فعّالة + معطلة) */
export function projectCount(store: IStore): number {
  return (store.projects || []).length;
}
