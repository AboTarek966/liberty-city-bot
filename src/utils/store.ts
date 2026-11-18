// ============================================
// Omni Bot - 🛍️ متجر Omni (أدوات مشتركة)
// ============================================
// المتجر وثيقة (Singleton) واحدة مشتركة لكل السيرفرات (مفتاح main).
// يدعم أنواعاً متعددة: بروجيكت / بوت / أداة / رتبة / خدمة / أخرى.
// الخصم: ProBot يأخذ نسبة من كل تحويل — لذلك أمر الدفع يُعرض بمبلغ
// (السعر الصافي ÷ (1 - الضريبة)) حتى يصل البائع كامل السعر الصافي.

import crypto from 'crypto';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { Store, IStore, IStoreProject, StoreItemType } from '../models';
import { isBotOwner } from './botOwner';

export const STORE_KEY = 'main';
export const DEFAULT_TAX_PERCENT = 5;
export const DEFAULT_PROBOT_PREFIX = '!';
export const DEFAULT_STORE_NAME = 'متجر Omni';
/** المستلم الافتراضي لتحويلات ProBot (مالك المتجر) — يقدر يتغير من /project config payee */
export const DEFAULT_PAYEE_ID = process.env.STORE_PAYEE_ID || '1342238662368296980';
/** عدد العناصر في كل صفحة داخل المتجر */
export const STORE_PAGE_SIZE = 20;

// --------------------------------------------
// أنواع العناصر (الميتاداتا + الأسماء البديلة بالعربي والإنجليزي)
// --------------------------------------------
export type StoreFilter = StoreItemType | 'all';

export interface StoreTypeMeta {
  key: StoreItemType;
  /** الاسم المفرد */
  label: string;
  /** الاسم الجمع (يُستخدم كعنوان قسم) */
  plural: string;
  emoji: string;
  color: number;
  aliases: string[];
}

export const STORE_TYPES: StoreTypeMeta[] = [
  {
    key: 'project',
    label: 'بروجيكت',
    plural: 'البروجيكتات',
    emoji: '🛠️',
    color: 0x3498db,
    aliases: ['project', 'projects', 'بروجيكت', 'بروجكت', 'مشروع', 'مشاريع', 'برمجة'],
  },
  {
    key: 'bot',
    label: 'بوت',
    plural: 'البوتات',
    emoji: '🤖',
    color: 0x9b59b6,
    aliases: ['bot', 'bots', 'بوت', 'بوتات', 'روبوت', 'روبوتات'],
  },
  {
    key: 'tool',
    label: 'أداة',
    plural: 'الأدوات',
    emoji: '🧰',
    color: 0xe67e22,
    aliases: ['tool', 'tools', 'أداة', 'اداة', 'أدوات', 'ادوات', 'سكربت', 'سكربتات'],
  },
  {
    key: 'role',
    label: 'رتبة',
    plural: 'الرتب',
    emoji: '🏷️',
    color: 0xf1c40f,
    aliases: ['role', 'roles', 'رتبة', 'رتبه', 'رتب', 'رول', 'رولات'],
  },
  {
    key: 'service',
    label: 'خدمة',
    plural: 'الخدمات',
    emoji: '🧑‍🔧',
    color: 0x1abc9c,
    aliases: ['service', 'services', 'خدمة', 'خدمه', 'خدمات', 'تصميم', 'إدارة'],
  },
  {
    key: 'other',
    label: 'أخرى',
    plural: 'المتنوعات',
    emoji: '📦',
    color: 0x95a5a6,
    aliases: ['other', 'misc', 'أخرى', 'اخرى', 'متنوع', 'متنوعات', 'أخري'],
  },
];

/** كل الأنواع كخيارات جاهزة لأوامر السلاش */
export const STORE_TYPE_CHOICES = STORE_TYPES.map((t) => ({
  name: `${t.emoji} ${t.label}`,
  value: t.key,
}));

/** تحويل أي نص/قيمة إلى نوع عنصر صالح (الافتراضي project للعناصر القديمة) */
export function normalizeStoreType(value: unknown, fallback: StoreItemType = 'project'): StoreItemType {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  const direct = STORE_TYPES.find((t) => t.key === raw || t.aliases.includes(raw));
  return direct?.key ?? fallback;
}

/** تحويل فلتر المتجر (all أو نوع محدد) */
export function normalizeStoreFilter(value: unknown): StoreFilter {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === 'all' || raw === 'كل' || raw === 'الكل') return 'all';
  const found = STORE_TYPES.find((t) => t.key === raw || t.aliases.includes(raw));
  return found?.key ?? 'all';
}

/** ميتاداتا نوع العنصر */
export function storeTypeMeta(type: unknown): StoreTypeMeta {
  const key = normalizeStoreType(type);
  return STORE_TYPES.find((t) => t.key === key) ?? STORE_TYPES[0];
}

/** نص نوع العنصر مع الإيموجي: 🛠️ بروجيكت */
export function storeTypeLabel(type: unknown): string {
  const meta = storeTypeMeta(type);
  return `${meta.emoji} ${meta.label}`;
}

/** تنقية إيموجي العنصر — يقبل unicode أو <:name:id> */
export function normalizeItemEmoji(input: unknown): string | undefined {
  const raw = String(input ?? '').trim();
  if (!raw) return undefined;
  // إيموجي مخصص <:name:id> أو <a:name:id>
  if (/^<a?:[A-Za-z0-9_~]{2,32}:\d{15,22}>$/.test(raw)) return raw;
  // إيموجي عادي (يسمح بالمركّب مثل 🧑‍🔧)
  if (raw.length <= 10 && /\p{Extended_Pictographic}/u.test(raw) && !raw.includes('<')) return raw;
  return undefined;
}

/** إيموجي العنصر المعروض (المخصص أو إيموجي النوع) */
export function storeItemEmoji(item: Pick<IStoreProject, 'emoji' | 'type'>): string {
  return normalizeItemEmoji(item.emoji) || storeTypeMeta(item.type).emoji;
}

/** تنقية رابط الصورة — undefined = فارغ • null = رابط غير صالح */
export function normalizeImageUrl(input: unknown): string | null | undefined {
  const raw = String(input ?? '').trim();
  if (!raw) return undefined;
  if (!/^https?:\/\/\S+$/i.test(raw)) return null;
  return raw.slice(0, 400);
}

/** تنقية الكمية: غير محدد = غير محدود */
export function normalizeStock(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.min(999_999, n);
}

/** سطر الكمية (فراغ لو غير محدودة) */
export function stockSuffix(item: Pick<IStoreProject, 'stock'>): string {
  if (item.stock === undefined || item.stock === null) return '';
  if (item.stock <= 0) return ' • ⛔ نفدت الكمية';
  return ` • 📦 متاح ${item.stock}`;
}

/** هل العنصر متوفر للبيع؟ */
export function isItemInStock(item: Pick<IStoreProject, 'stock'>): boolean {
  return item.stock === undefined || item.stock === null || item.stock > 0;
}

/** قراءة وثيقة المتجر (تنشئها عند أول استخدام) مع تحديث الإعدادات الافتراضية */
export async function getStore(createIfMissing = true): Promise<IStore | null> {
  try {
    let doc = await Store.findOne({ key: STORE_KEY });
    if (!doc && createIfMissing) {
      doc = await Store.create({
        key: STORE_KEY,
        name: DEFAULT_STORE_NAME,
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

/** نسبة خصم صالحة (0 = بدون خصم) */
export function normalizeDiscountPercent(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(99, Math.max(0, n));
}

/** السعر الصافي الفعلي للعنصر بعد خصم العرض (إن وجد) */
export function getEffectivePrice(project: Pick<IStoreProject, 'price' | 'discountPercent'>): number {
  const base = Math.max(1, Math.floor(Number(project.price) || 0));
  const discount = normalizeDiscountPercent(project.discountPercent);
  if (!discount) return base;
  return Math.max(1, Math.ceil((base * (100 - discount)) / 100));
}

/** سطر عرض السعر مع الخصم إن وجد */
export function projectPriceLine(project: Pick<IStoreProject, 'price' | 'discountPercent'>): string {
  const base = Math.max(1, Math.floor(Number(project.price) || 0));
  const discount = normalizeDiscountPercent(project.discountPercent);
  const effective = getEffectivePrice(project);
  if (!discount) return priceLine(effective);
  return `~~${priceLine(base)}~~ → ${priceLine(effective)} (**خصم ${discount}%**)`;
}

/** تحليل نسبة خصم من نص مثل "25" أو "%25" أو "25%" — يرجع 0 لإزالة الخصم، null إذا غير مفهوم */
export function parseDiscountPercent(input: string): number | null {
  const raw = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[٪\s]/g, '');
  if (!raw) return null;
  if (raw === '0' || raw === 'none' || raw === 'لا' || raw === 'بدون' || raw === 'off' || raw === 'remove') return 0;
  const cleaned = raw.replace(/%/g, '');
  if (!/^\d{1,2}$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 99) return null;
  return n;
}

/** بناء أمر تحويل الكريديت (ProBot/Credit) — الصيغة المطلوبة */
export function buildTransferCommand(payeeId: string, amount: number): string {
  return `#credit ${payeeId} ${Math.max(0, Math.floor(amount))}`;
}

/** يحوّل نص سعر إلى رقم: 10m / 500k / 10 مليون / 10,000,000 */
export function parsePrice(input: string): number | null {
  const raw = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[,،\s_']/g, '');
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

/** معرّف قصير للطلب/العنصر (مرتبط بروابط الأزرار) */
export function shortId(len = 6): string {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

/** يتحقق إن النص يشبه أمر تحويل كريديت */
export function isProbotCommandLike(text: string, _prefix: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  return /^(?:#?credit)\s+\d+\s+\d+#?$/.test(t) || /^!pay\b/i.test(t) || /^pay\s/i.test(t);
}

// --------------------------------------------
// عرض المتجر (تصفية + صفحات)
// --------------------------------------------
export interface StoreViewOptions {
  /** all أو نوع محدد */
  type?: unknown;
  /** رقم الصفحة (يبدأ من 0) */
  page?: unknown;
}

export interface StoreView {
  filter: StoreFilter;
  /** كل العناصر المفعّلة */
  all: IStoreProject[];
  /** العناصر بعد التصفية */
  filtered: IStoreProject[];
  /** عناصر الصفحة الحالية */
  items: IStoreProject[];
  page: number;
  totalPages: number;
  pageSize: number;
}

/** حساب حالة العرض (تصفية + تقسيم صفحات) */
export function computeStoreView(store: IStore, opts: StoreViewOptions = {}): StoreView {
  const filter = normalizeStoreFilter(opts.type);
  const all = (store.projects || []).filter((p) => p.enabled);
  const typeOrder = new Map(STORE_TYPES.map((t, i) => [t.key as string, i]));
  const sortByType = (a: IStoreProject, b: IStoreProject) =>
    (typeOrder.get(normalizeStoreType(a.type)) ?? 99) - (typeOrder.get(normalizeStoreType(b.type)) ?? 99);
  const filtered =
    (filter === 'all' ? all : all.filter((p) => normalizeStoreType(p.type) === filter)).slice().sort(sortByType);
  const totalPages = Math.max(1, Math.ceil(filtered.length / STORE_PAGE_SIZE));
  const rawPage = Math.floor(Number(opts.page));
  const page = Math.min(totalPages - 1, Math.max(0, Number.isFinite(rawPage) ? rawPage : 0));
  const items = filtered.slice(page * STORE_PAGE_SIZE, page * STORE_PAGE_SIZE + STORE_PAGE_SIZE);
  return { filter, all, filtered, items, page, totalPages, pageSize: STORE_PAGE_SIZE };
}

/** اسم المتجر المعروض */
export function getStoreName(store: IStore): string {
  return (store.name || '').trim() || DEFAULT_STORE_NAME;
}

/** بناء إمبد المتجر (العرض الرئيسي) */
export function buildStoreEmbed(store: IStore, opts: StoreViewOptions = {}): EmbedBuilder {
  const view = computeStoreView(store, opts);
  const name = getStoreName(store);

  const lines: string[] = [];
  if (view.filter !== 'all') {
    const meta = storeTypeMeta(view.filter);
    lines.push(`> 🔎 **تصفية:** ${meta.emoji} ${meta.plural} — \`${view.filtered.length}\` عنصر`);
  }

  if (view.items.length) {
    for (const meta of STORE_TYPES) {
      const group = view.items.filter((p) => normalizeStoreType(p.type) === meta.key);
      if (!group.length) continue;
      lines.push(`\n**${meta.emoji} ${meta.plural}** — \`${group.length}\``);
      for (const item of group) {
        const desc = item.description?.trim();
        lines.push(
          `> ${storeItemEmoji(item)} **${item.name}** — 💰 ${projectPriceLine(item)}${stockSuffix(item)}`
        );
        if (desc) lines.push(`> ┗ ${desc.slice(0, 90)}`);
      }
    }
  } else if (view.all.length) {
    lines.push('لا توجد عناصر في هذا القسم حالياً — جرّب قسماً آخر من الأزرار بالأسفل.');
  } else {
    lines.push('المتجر فارغ حالياً — ترقّب الجديد عاجلاً.');
  }

  const tax = Number(store.taxPercent ?? DEFAULT_TAX_PERCENT);
  const payee = store.payeeId;
  const intro = (store.description || '').trim();

  const parts = [
    intro ? `${intro}\n` : null,
    '**اختر العنصر اللي تبيه من القائمة بالأسفل**، وبنرسل لك أمر الدفع بالكريديت 👇',
    lines.join('\n'),
    '',
    view.items.length
      ? `> 💸 **الأسعار صافية** — ProBot ياخذ **${tax}%** من كل تحويل، فبنعرض لك المبلغ اللازم حتى يوصل البائع السعر كامل.`
      : null,
    payee ? `> 💳 **الدفع يروح لـ <@${payee}>** عبر أمر \`credit\`.` : null,
    '> 🛒 تقدر تفلتر حسب النوع من أزرار الأقسام، وتتنقل بين الصفحات لو المتجر كبير.',
  ].filter(Boolean) as string[];

  let description = parts.join('\n');
  if (description.length > 4000) description = `${description.slice(0, 3990)}…`;

  const footerParts = [`${name} • ${view.filtered.length} عنصر`];
  if (view.totalPages > 1) footerParts.push(`صفحة ${view.page + 1}/${view.totalPages}`);

  return new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`🛍️ ${name}`)
    .setDescription(description)
    .setFooter({ text: `${footerParts.join(' • ')} • credit` })
    .setTimestamp();
}

/** بناء قائمة الاختيار (select) لعناصر الصفحة الحالية */
export function buildStoreSelect(store: IStore, opts: StoreViewOptions = {}) {
  const view = computeStoreView(store, opts);
  if (!view.items.length) return null;

  const options = view.items.slice(0, 25).map((p) => {
    const meta = storeTypeMeta(p.type);
    const discount = normalizeDiscountPercent(p.discountPercent);
    const effective = getEffectivePrice(p);
    const stock = p.stock;
    const stockText =
      stock === undefined || stock === null
        ? ''
        : stock <= 0
          ? ' • نفدت'
          : ` • ${stock} متاح`;
    return {
      label: `${p.name.slice(0, 42)} — ${formatShort(effective)}${discount ? ` (-${discount}%)` : ''}${stockText}`.slice(0, 100),
      value: p.id,
      description: (
        p.description?.trim() ||
        `${meta.label} • ${discount ? `خصم ${discount}%` : 'متاح للشراء'}`
      ).slice(0, 100),
      emoji: storeItemEmoji(p),
    };
  });

  const placeholder =
    view.filter === 'all'
      ? '🛒 اختر عنصر للشراء...'
      : `🛒 اختر ${storeTypeMeta(view.filter).label} للشراء...`;

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('store:select')
      .setPlaceholder(placeholder)
      .addOptions(options)
  );
  return [row];
}

/**
 * كل مكونات واجهة المتجر:
 * قائمة الاختيار + أزرار الأقسام (بوت/أداة/رتبة...) + أزرار التنقل بين الصفحات
 */
export function buildStoreComponents(store: IStore, opts: StoreViewOptions = {}): ActionRowBuilder<any>[] {
  const view = computeStoreView(store, opts);
  const rows: ActionRowBuilder<any>[] = [];

  const select = buildStoreSelect(store, opts);
  if (select?.length) rows.push(...select);

  // 🔎 أزرار تصفية الأنواع (تظهر الأنواع اللي فيها عناصر فقط + الكل)
  if (view.all.length) {
    const filters: Array<{ key: StoreFilter; label: string; emoji: string }> = [
      { key: 'all', label: `الكل (${view.all.length})`, emoji: '🛍️' },
      ...STORE_TYPES.map((meta) => {
        const count = view.all.filter((p) => normalizeStoreType(p.type) === meta.key).length;
        return { key: meta.key as StoreFilter, label: `${meta.label} (${count})`, emoji: meta.emoji, count };
      })
        .filter((f) => f.count > 0)
        .map(({ key, label, emoji }) => ({ key, label, emoji })),
    ];

    for (let i = 0; i < filters.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>();
      for (const f of filters.slice(i, i + 5)) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`store:nav:${f.key}:0`)
            .setLabel(f.label.slice(0, 80))
            .setEmoji(f.emoji)
            .setStyle(view.filter === f.key ? ButtonStyle.Primary : ButtonStyle.Secondary)
        );
      }
      rows.push(row);
    }
  }

  // 📄 أزرار التنقل بين الصفحات
  if (view.totalPages > 1) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`store:nav:${view.filter}:${view.page - 1}`)
          .setLabel('السابق')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(view.page <= 0),
        new ButtonBuilder()
          .setCustomId('store:pageinfo')
          .setLabel(`صفحة ${view.page + 1} / ${view.totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`store:nav:${view.filter}:${view.page + 1}`)
          .setLabel('التالي')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(view.page >= view.totalPages - 1)
      )
    );
  }

  return rows;
}

/** إيجاد العنصر بالمعرّف */
export function findProject(store: IStore, projectId: string): IStoreProject | undefined {
  return (store.projects || []).find((p) => p.id === projectId);
}

/** إيجاد العنصر بالاسم (غير حساس لحالة الأحرف) */
export function findProjectByName(store: IStore, name: string): IStoreProject | undefined {
  const q = String(name || '').trim().toLowerCase();
  return (store.projects || []).find((p) => p.name.toLowerCase() === q);
}

/** عدد العناصر المضافة (فعّالة + معطلة) */
export function projectCount(store: IStore): number {
  return (store.projects || []).length;
}

/** إحصائيات حسب النوع */
export function storeTypeStats(store: IStore): Array<{ meta: StoreTypeMeta; total: number; enabled: number; sales: number }> {
  return STORE_TYPES.map((meta) => {
    const group = (store.projects || []).filter((p) => normalizeStoreType(p.type) === meta.key);
    return {
      meta,
      total: group.length,
      enabled: group.filter((p) => p.enabled).length,
      sales: group.reduce((sum, p) => sum + (p.sales || 0), 0),
    };
  }).filter((s) => s.total > 0);
}
