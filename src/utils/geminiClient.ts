// ============================================
// Liberty City Bot - Google Gemini Client (REST — بدون مكتبات إضافية)
// يدعم: نص · رؤية صور · بث مباشر (SSE) · ذاكرة محادثة
// مجاني: https://aistudio.google.com/apikey
// ============================================

import axios from 'axios';
import { createLogger } from './helpers';

const logger = createLogger('Gemini');

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * موديلات Gemini — مُختبرة فعلياً بهذا المفتاح ومرتّبة حسب السرعة.
 * ملاحظة: `gemini-2.5-flash` و`gemini-2.0-flash` لم تعد متاحة لمستخدمين جدد (HTTP 404).
 */
export const GEMINI_TEXT_MODELS = [
  'gemini-3.5-flash', // ⭐ الأسرع — اختُبرت ~3.5 ثانية مع الصور
  'gemini-3.1-flash-lite', // احتياطي سريع (~6 ثوانٍ)
  'gemini-flash-latest', // قد يرجع 503 عند الضغط
  'gemini-3.8-flash',
];

/** موديلات Gemini للرؤية — نفس الموديلات تدعم الصور */
export const GEMINI_VISION_MODELS = GEMINI_TEXT_MODELS;

export interface GeminiImage {
  data: string; // base64
  mimeType: string;
}

export interface GeminiResult {
  content: string;
  model: string;
  tokens: number;
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };
type Content = { role: 'user' | 'model'; parts: Part[] };

/** تحويل ذاكرة المحادثة + الرسالة (+صور) إلى صيغة Gemini */
function buildContents(
  history: Array<{ role: string; content: string }>,
  message: string,
  images: GeminiImage[] = []
): Content[] {
  const contents: Content[] = [];

  // ذاكرة المحادثة: assistant → model
  for (const h of history.slice(-40)) {
    if (!h?.content) continue;
    const role = h.role === 'assistant' ? 'model' : 'user';
    // Gemini لا يقبل تتابع نفس الدور — ندمج الرسائل المتتالية لاحقًا
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts.push({ text: h.content });
    } else {
      contents.push({ role, parts: [{ text: h.content }] });
    }
  }

  // رسالة المستخدم الحالية + الصور
  const parts: Part[] = [];
  const text = (message || '').trim();
  if (text) parts.push({ text });
  for (const img of images.slice(0, 6)) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }
  if (!parts.length) parts.push({ text: 'مرحباً' });

  const lastRole = contents[contents.length - 1]?.role;
  if (lastRole === 'user') contents[contents.length - 1].parts.push(...parts);
  else contents.push({ role: 'user', parts });

  return contents;
}

function buildBody(opts: {
  systemPrompt: string;
  history: Array<{ role: string; content: string }>;
  message: string;
  images?: GeminiImage[];
  temperature: number;
  maxTokens: number;
}): any {
  const body: any = {
    contents: buildContents(opts.history, opts.message, opts.images || []),
    generationConfig: {
      temperature: opts.temperature,
      maxOutputTokens: Math.max(64, opts.maxTokens),
      // ⚡ إيقاف "التفكير الممتد" — يسرق توكنز الإجابة فينتج نصاً مقطوعاً،
      //   ويضيف ثوانٍ لا يحتاجها البوت (ردود المحادثة والرؤية لا تحتاج استدلالاً عميقاً).
      //   مُختبر: الردود تكتمل وتنزل من ~25ث إلى ~4ث.
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: [
      'HARM_CATEGORY_HARASSMENT',
      'HARM_CATEGORY_HATE_SPEECH',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      'HARM_CATEGORY_DANGEROUS_CONTENT',
    ].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
  };
  if (opts.systemPrompt) {
    body.systemInstruction = { parts: [{ text: opts.systemPrompt }] };
  }
  return body;
}

function pickModels(useVision: boolean, preferred?: string): string[] {
  const list = useVision ? GEMINI_VISION_MODELS : GEMINI_TEXT_MODELS;
  const ordered = preferred && !list.includes(preferred) ? [preferred, ...list] : list;
  return [...new Set(ordered)];
}

function extractText(data: any): string {
  const cand = data?.candidates?.[0];
  if (!cand) return '';
  const parts: any[] = cand?.content?.parts || [];
  return parts.map((p) => p?.text || '').join('').trim();
}

function statusOf(e: any): number {
  return Number(e?.status ?? e?.response?.status ?? 0);
}

// --------------------------------------------
// توليد عادي
// --------------------------------------------
export async function geminiGenerate(opts: {
  apiKey: string;
  systemPrompt: string;
  history: Array<{ role: string; content: string }>;
  message: string;
  images?: GeminiImage[];
  temperature: number;
  maxTokens: number;
  preferredModel?: string;
}): Promise<GeminiResult> {
  const body = buildBody(opts);
  let lastErr: any = null;

  for (const model of pickModels(!!opts.images?.length, opts.preferredModel)) {
    // 503 "high demand" و429 حصة مؤقتة → نجرّب نفس الموديل مرة أخرى قبل الانتقال
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await axios.post(`${BASE}/models/${model}:generateContent`, body, {
          headers: { 'x-goog-api-key': opts.apiKey, 'Content-Type': 'application/json' },
          timeout: 60_000,
        });
        const content = extractText(res.data);
        if (!content) {
          const block = res.data?.promptFeedback?.blockReason;
          if (block) throw new Error(`محجوب: ${block}`);
          break; // استجابة فارغة → جرّب الموديل التالي
        }
        return {
          content,
          model,
          tokens:
            (res.data?.usageMetadata?.promptTokenCount || 0) +
            (res.data?.usageMetadata?.candidatesTokenCount || 0),
        };
      } catch (e: any) {
        lastErr = e;
        const s = statusOf(e);
        // ضغط مؤقت على الموديل → انتظر قليلاً وجرّب نفس الموديل
        if ((s === 429 || s === 503) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        // موديل غير متاح/حصة → جرّب التالي. غير ذلك توقف.
        if (s !== 400 && s !== 404 && s !== 429 && s !== 503) break;
        logger.warn(`Gemini model "${model}" failed (${s}): ${String(e?.message || e).slice(0, 140)}`);
        break;
      }
    }
  }
  throw lastErr || new Error('Gemini request failed');
}

// --------------------------------------------
// بث مباشر (SSE) — أول الكلمات تظهر فوراً
// --------------------------------------------
export async function geminiStream(opts: {
  apiKey: string;
  systemPrompt: string;
  history: Array<{ role: string; content: string }>;
  message: string;
  images?: GeminiImage[];
  temperature: number;
  maxTokens: number;
  preferredModel?: string;
  onFirstChunk?: (text: string) => void | Promise<void>;
  onUpdate?: (fullText: string) => void | Promise<void>;
}): Promise<GeminiResult> {
  const body = buildBody(opts);
  let lastErr: any = null;

  for (const model of pickModels(!!opts.images?.length, opts.preferredModel)) {
    const url = `${BASE}/models/${model}:streamGenerateContent?alt=sse`;
    try {
      // 503 "high demand" و429 مؤقتان → نجرّب الطلب مرة أخرى قبل الانتقال
      let res: any;
      for (let attempt = 1; attempt <= 2; attempt++) {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'x-goog-api-key': opts.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok || (res.status !== 429 && res.status !== 503)) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const e: any = new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
        e.status = res.status;
        throw e;
      }

      if (!res.body) throw new Error('Gemini: empty stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let full = '';
      let started = false;
      let usage: any = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            if (j.usageMetadata) usage = j.usageMetadata;
            const piece = extractText(j);
            if (!piece) continue;
            full += piece;
            if (!started) {
              started = true;
              await opts.onFirstChunk?.(piece);
            } else {
              await opts.onUpdate?.(full);
            }
          } catch { /* سطر غير مكتمل */ }
        }
      }

      if (started && full) {
        await opts.onUpdate?.(full);
        return {
          content: full,
          model,
          tokens: (usage?.promptTokenCount || 0) + (usage?.candidatesTokenCount || 0),
        };
      }
      // لا نص → جرّب الموديل التالي
      lastErr = new Error('Gemini stream produced no text');
    } catch (e: any) {
      lastErr = e;
      const s = statusOf(e);
      if (s !== 400 && s !== 404 && s !== 429 && s !== 503) break;
      logger.warn(`Gemini stream "${model}" failed (${s}): ${String(e?.message || e).slice(0, 140)}`);
    }
  }

  throw lastErr || new Error('Gemini stream failed');
}
