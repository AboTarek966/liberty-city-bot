// ============================================
// Omni Bot - 🛡️ كشف الكلمات المحظورة بـ whole-word
// يميز "تكسر بخاطري" من "كس" وغيرها من التطابقات الجزئية
// ============================================

/** يطبّع النص العربي/الإنجليزي للمقارنة */
export function normalizeBadWord(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // التتشكيل
    .replace(/\u0640/g, '') // المد (tatweel)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ک/g, 'ك') // كاف الفارسي
    .replace(/ی/g, 'ي') // ياء الفارسي
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** تطابق كلمة ضد كلمة — يدعم الكلمة المجردة + مقدمة "ال" + نهايات (ة / ية)، ويطبّع المرشحين مثل الرموز */
function tokenMatchesWord(normalizedToken: string, normalizedWord: string): boolean {
  if (!normalizedToken || !normalizedWord) return false;
  const candidates = new Set([
    normalizedWord,
    normalizeBadWord(`ال${normalizedWord}`),
    normalizeBadWord(`${normalizedWord}ة`),
    normalizeBadWord(`ال${normalizedWord}ة`),
    normalizeBadWord(`${normalizedWord}ية`),
    normalizeBadWord(`ال${normalizedWord}ية`),
  ]);
  return candidates.has(normalizedToken);
}

/**
 * يرجع أول كلمة محظورة تطابق النص، أو null لو مفيش تطابق.
 * مطابقة على مستوى الكلمة — لا تطابق مقاطع فرعية ("تكسير" ما يتربطش بـ"كس").
 */
export function findBadWord(text: string, badWords: string[]): string | null {
  const t = normalizeBadWord(text);
  if (!t) return null;
  const tokens = t.split(' ').filter(Boolean);

  for (const rawWord of badWords) {
    const word = normalizeBadWord(rawWord);
    if (!word) continue;

    // عبارة من كلمتين أو أكثر ← شرطها وجودها كعبارة متجاورة بعد التطبيع
    if (word.includes(' ')) {
      if (t.includes(word)) return rawWord;
      continue;
    }

    // كلمات إنجليزية/إنجليزية ← fullmatch مع s plural
    if (/^[a-z0-9]+$/i.test(word)) {
      const forms = [word, `${word}s`];
      if (tokens.some((tok) => forms.includes(tok))) return rawWord;
      continue;
    }

    for (const tok of tokens) {
      if (tokenMatchesWord(tok, word)) return rawWord;
    }
  }

  return null;
}

export function matchesAnyBadWord(text: string, badWords: string[]): boolean {
  return findBadWord(text, badWords) !== null;
}
