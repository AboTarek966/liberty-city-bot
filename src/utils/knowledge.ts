// ============================================
// Liberty City Bot - AI Knowledge Search
// ============================================
// بحث محلي سريع (بدون تكلفة AI) في قاعدة معرفة السيرفر.
// يُستخدم في الدردشة العامة وفي مساعد التذاكر.

import { KnowledgeEntry, IKnowledgeEntry } from '../models';
import { createLogger } from './helpers';

const logger = createLogger('Knowledge');

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { ts: number; entries: IKnowledgeEntry[] }>();

const ARABIC_STOPWORDS = new Set([
  'من', 'في', 'على', 'عن', 'إلى', 'الى', 'أن', 'ان', 'إن', 'هو', 'هي', 'هم', 'كان', 'كانت',
  'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'ما', 'لا', 'هل', 'ثم', 'أو', 'او', 'و', 'يا',
  'كل', 'بعد', 'قبل', 'عند', 'حتى', 'بين', 'قد', 'لقد', 'لم', 'لن', 'له', 'لها', 'به',
  'بها', 'كما', 'أي', 'اي', 'كيف', 'متى', 'أين', 'اين', 'لماذا', 'وش', 'ايش', 'شنو',
  'لي', 'لك', 'لنا', 'علي', 'عليه', 'عليها', 'انا', 'أنا', 'نحن', 'انت', 'أنت', 'انتم',
  'the', 'and', 'for', 'with', 'that', 'this', 'what', 'how', 'why', 'when', 'where',
  'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'it', 'be', 'do', 'does', 'can',
  'could', 'should', 'would', 'i', 'you', 'we', 'they', 'he', 'she', 'my', 'your',
]);

export function normalizeArabic(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // تشكيل
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeArabic(text)
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !ARABIC_STOPWORDS.has(t));
}

function entryText(entry: IKnowledgeEntry): string {
  return normalizeArabic(`${entry.title} ${entry.content} ${(entry.tags || []).join(' ')}`);
}

function scoreEntry(entry: IKnowledgeEntry, terms: string[], rawQuery: string): number {
  if (!terms.length) return 0;
  const title = normalizeArabic(entry.title);
  const content = normalizeArabic(entry.content);
  const tags = (entry.tags || []).map(normalizeArabic);
  const full = entryText(entry);
  const query = normalizeArabic(rawQuery);

  let score = 0;

  if (query.length >= 3 && title.includes(query)) score += 12;
  if (query.length >= 3 && full.includes(query)) score += 4;

  for (const term of terms) {
    if (title.includes(term)) score += 6;
    if (tags.some(tag => tag === term || tag.includes(term))) score += 4;
    if (content.includes(term)) score += 2;

    // تطابق الكلمة كاملة داخل العنوان/المحتوى يعطي وزناً أعلى
    const wordRe = new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (wordRe.test(title)) score += 3;
    if (wordRe.test(content)) score += 1;
  }

  return score;
}

export async function loadKnowledge(guildId: string): Promise<IKnowledgeEntry[]> {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.entries;

  try {
    const entries = await KnowledgeEntry.find({ guildId, enabled: true })
      .sort({ updatedAt: -1 })
      .limit(400)
      .lean<IKnowledgeEntry[]>();
    cache.set(guildId, { ts: Date.now(), entries });
    return entries;
  } catch (error: any) {
    logger.warn(`Could not load knowledge for ${guildId}: ${error.message}`);
    return hit?.entries || [];
  }
}

export interface KnowledgeMatch {
  entry: IKnowledgeEntry;
  score: number;
}

export async function searchKnowledge(
  guildId: string,
  query: string,
  limit = 5
): Promise<KnowledgeMatch[]> {
  const terms = tokenize(query);
  if (!terms.length) return [];

  const entries = await loadKnowledge(guildId);
  const scored = entries
    .map(entry => ({ entry, score: scoreEntry(entry, terms, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit));

  return scored;
}

export async function buildKnowledgeContext(
  guildId: string,
  query: string,
  limit = 4,
  maxChars = 3000
): Promise<string> {
  try {
    const matches = await searchKnowledge(guildId, query, limit);
    if (!matches.length) return '';

    const blocks: string[] = [];
    let total = 0;
    for (const [index, match] of matches.entries()) {
      const content = match.entry.content.replace(/\s+/g, ' ').trim().slice(0, 900);
      const block =
        `[معلومة ${index + 1}] ${match.entry.title}\n` +
        (match.entry.tags?.length ? `الوسوم: ${match.entry.tags.join('، ')}\n` : '') +
        content;
      if (total + block.length > maxChars) break;
      blocks.push(block);
      total += block.length;
    }

    if (!blocks.length) return '';
    return (
      `\n\n━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📚 **قاعدة معرفة السيرفر (مصدر موثوق — قدّمها على تخمينك):**\n` +
      `استخدم هذه المعلومات عند الإجابة، وإذا تعارضت معها فاذكر التعارض بوضوح.\n\n` +
      blocks.join('\n\n---\n\n')
    );
  } catch (error: any) {
    logger.warn(`buildKnowledgeContext failed: ${error.message}`);
    return '';
  }
}

export function invalidateKnowledgeCache(guildId?: string): void {
  if (guildId) cache.delete(guildId);
  else cache.clear();
}
