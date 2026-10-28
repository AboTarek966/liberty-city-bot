// ============================================
// Liberty City Bot - Investigator Heuristics
// ============================================
// تحليل محلي حتمي (بدون ذكاء اصطناعي) يبني أدلة قابلة للتحقق.
// الهدف: تغطية كاملة + تقليل الاعتماد على النموذج + منع الهلوسة.

import crypto from 'crypto';
import {
  AIAnalysisPayload,
  AIFindingPayload,
  BanSnapshot,
  ChannelSnapshot,
  EventSignal,
  FindingDraft,
  GuildSnapshot,
  InvestigationCategory,
  InvestigationSeverity,
  InvestigationSource,
  InvestigationSubjectType,
  MemberSnapshot,
  MessageRiskResult,
  MessageSnapshot,
  PermissionOverwriteSnapshot,
  RoleSnapshot,
  SecuritySnapshot,
  WebhookSnapshot,
} from '../types/investigator';

export interface MessageRiskResultInternal extends MessageRiskResult {
  flags: string[];
}

// --------------------------------------------
// Severity helpers
// --------------------------------------------
const SEVERITY_ORDER: InvestigationSeverity[] = ['info', 'low', 'medium', 'high', 'critical'];

export function severityRank(severity: InvestigationSeverity): number {
  return Math.max(0, SEVERITY_ORDER.indexOf(severity));
}

export function maxSeverity(a: InvestigationSeverity, b: InvestigationSeverity): InvestigationSeverity {
  return severityRank(a) >= severityRank(b) ? a : b;
}

export function isAtLeast(severity: InvestigationSeverity, min: InvestigationSeverity): boolean {
  return severityRank(severity) >= severityRank(min);
}

export function normalizeSeverity(value: unknown): InvestigationSeverity {
  const raw = String(value ?? '').trim().toLowerCase();
  if (SEVERITY_ORDER.includes(raw as InvestigationSeverity)) return raw as InvestigationSeverity;
  if (['critical', 'crit', 'حرج', 'خطير جدا', 'خطير جدًا', 'كارثي'].includes(raw)) return 'critical';
  if (['high', 'عالي', 'مرتفع', 'خطر'].includes(raw)) return 'high';
  if (['medium', 'med', 'متوسط', 'وسط'].includes(raw)) return 'medium';
  if (['low', 'منخفض', 'ضعيف'].includes(raw)) return 'low';
  return 'info';
}

const CATEGORIES: InvestigationCategory[] = [
  'permissions', 'bot', 'member', 'account', 'raid', 'message', 'scam', 'webhook',
  'invite', 'role', 'channel', 'moderation', 'audit', 'security', 'privacy',
  'prompt_injection', 'other',
];

export function normalizeCategory(value: unknown): InvestigationCategory {
  const raw = String(value ?? '').trim().toLowerCase();
  if (CATEGORIES.includes(raw as InvestigationCategory)) return raw as InvestigationCategory;
  if (/perm|صلاحي/.test(raw)) return 'permissions';
  if (/bot|بوت/.test(raw)) return 'bot';
  if (/raid|غزو|هجوم/.test(raw)) return 'raid';
  if (/scam|phish|احتيال|نصب|تصيد/.test(raw)) return 'scam';
  if (/webhook|ويب/.test(raw)) return 'webhook';
  if (/invite|دعو/.test(raw)) return 'invite';
  if (/role|رتب|رول/.test(raw)) return 'role';
  if (/channel|قناة|روم/.test(raw)) return 'channel';
  if (/message|رسال/.test(raw)) return 'message';
  if (/mod|إشراف|اشراف/.test(raw)) return 'moderation';
  if (/audit|سجل/.test(raw)) return 'audit';
  if (/security|حماي/.test(raw)) return 'security';
  if (/prompt|تلاعب|حقن/.test(raw)) return 'prompt_injection';
  if (/account|حساب/.test(raw)) return 'account';
  if (/member|عضو/.test(raw)) return 'member';
  if (/privacy|خصوصي/.test(raw)) return 'privacy';
  return 'other';
}

const SUBJECT_TYPES: InvestigationSubjectType[] = [
  'guild', 'member', 'bot', 'role', 'channel', 'webhook', 'invite', 'message', 'system',
];

export function normalizeSubjectType(value: unknown, fallback: InvestigationSubjectType = 'system'): InvestigationSubjectType {
  const raw = String(value ?? '').trim().toLowerCase();
  if (SUBJECT_TYPES.includes(raw as InvestigationSubjectType)) return raw as InvestigationSubjectType;
  if (/bot|بوت/.test(raw)) return 'bot';
  if (/user|member|عضو/.test(raw)) return 'member';
  if (/role|رتب/.test(raw)) return 'role';
  if (/channel|قناة|روم/.test(raw)) return 'channel';
  if (/webhook/.test(raw)) return 'webhook';
  if (/invite|دعو/.test(raw)) return 'invite';
  if (/message|رسال/.test(raw)) return 'message';
  if (/guild|server|سيرفر/.test(raw)) return 'guild';
  return fallback;
}

export function riskLevelFromScore(score: number): InvestigationSeverity {
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'info';
}

export function countBySeverity(findings: FindingDraft[]): Record<InvestigationSeverity, number> {
  const counts: Record<InvestigationSeverity, number> = {
    info: 0, low: 0, medium: 0, high: 0, critical: 0,
  };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

export function riskFromFindings(findings: FindingDraft[]): number {
  if (!findings.length) return 0;
  const weights: Record<InvestigationSeverity, number> = {
    critical: 90, high: 65, medium: 40, low: 20, info: 5,
  };
  const sorted = [...findings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  let score = weights[sorted[0].severity] || 0;
  for (let i = 1; i < sorted.length; i++) {
    score += (weights[sorted[i].severity] || 0) * (i < 4 ? 0.55 : 0.22);
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

// --------------------------------------------
// Fingerprints (stable dedupe across scans)
// --------------------------------------------
function normalizeTitle(title: string): string {
  return String(title || '')
    .toLowerCase()
    .replace(/[0-9٠-٩]+/g, '#')
    .replace(/[^\p{L}\p{N}#]+/gu, ' ')
    .trim()
    .slice(0, 120);
}

export function fingerprintFinding(finding: FindingDraft): string {
  const subject = finding.subjectId || finding.subjectName || '';
  const titlePart = subject && finding.subjectType !== 'guild' ? '' : normalizeTitle(finding.title);
  const base = [
    finding.category,
    finding.subjectType,
    subject,
    titlePart,
  ].join('|');
  return crypto.createHash('sha1').update(base).digest('hex').slice(0, 24);
}

// --------------------------------------------
// Redaction — never send raw secrets to an external AI provider
// --------------------------------------------
export function redactSensitiveText(input: string, maxLength = 1200): string {
  let text = String(input ?? '');

  text = text.replace(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    '[REDACTED_PRIVATE_KEY]'
  );
  text = text.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]');
  text = text.replace(/\b(?:mfa\.[A-Za-z0-9_-]{20,}|[MN][A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,})\b/g, '[REDACTED_DISCORD_TOKEN]');
  text = text.replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|hf_[A-Za-z0-9]{20,})\b/g, '[REDACTED_API_KEY]');
  // لا تبتلع علامات الاقتباس/الأقواس/الشرطة العكسية: النص قد يكون JSON مسلسلاً،
  // وابتلاعها يفسد بنية JSON المرسلة للمزود.
  text = text.replace(
    /((?:password|passwd|pwd|كلمة\s*(?:ال)?(?:مرور|سر))\s*[:=]\s*)([^\s,;{}[\]"'\\]{4,})/gi,
    '$1[REDACTED]'
  );
  text = text.replace(
    /((?:token|api[_-]?key|secret|seed[_-]?phrase|private[_-]?key)\s*[:=]\s*)([^\s,;{}[\]"'\\]{6,})/gi,
    '$1[REDACTED]'
  );
  text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]');

  return text.slice(0, Math.max(0, maxLength));
}

// --------------------------------------------
// Message risk detection
// --------------------------------------------
const SCAM_PATTERNS: RegExp[] = [
  /(?:free\s+nitro|nitro\s+gift|gift\s+nitro|steam\s+gift|free\s+robux|robux\s+generator|free\s+followers|cheap\s+followers)/i,
  /(?:crypto\s+giveaway|airdrop|claim\s+(?:your\s+)?(?:gift|reward|prize)|connect\s+(?:your\s+)?wallet|seed\s+phrase|private\s+key)/i,
  /(?:تحويل\s+مجاني|نيترو\s+مجاني|هدية\s+نيترو|جيف\s+اواي|اربح\s+جيف|اضغط\s+للاستلام|استلم\s+هديتك|اربح\s+جواهر)/i,
  /(?:account\s+generator|nitro\s+generator|token\s+generator|gift\s+card\s+generator)/i,
  /(?:onlyfans|pornhub|xvideos|xnxx|brazzers)/i,
];

const INVITE_PATTERN = /(?:discord(?:\.gg|\.com\/invite|app\.com\/invite)\/[A-Za-z0-9-]+)/i;
const CREDENTIAL_PATTERN = /(?:token|api[_-]?key|password|passwd|private[_-]?key|seed[_-]?phrase|كلمة\s*(?:ال)?(?:مرور|سر)|توكن|مفتاح\s+api)\s*[:=]\s*[^\s,;]{6,}/i;
const DISCORD_TOKEN_PATTERN = /\b(?:mfa\.[A-Za-z0-9_-]{20,}|[MN][A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{20,})\b/;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
const THREAT_PATTERN = /(?:kill\s+yourself|\bkys\b|i(?:'| a)?m\s+going\s+to\s+kill|سأقتلك|سوف\s+أقتلك|اقتلك|dox(?:x)?|(?:سأ|سوف\s+)?(?:أنشر|أسرب|سرب)\s+(?:عنوانك|رقمك|بياناتك)|تسريب\s+(?:بيانات|معلومات)\s+(?:الأعضاء|الخاصة))/i;
const NUKE_PATTERN = /(?:nuke\s+(?:this|the)\s+(?:server|guild)|raid\s+(?:this|the)\s+(?:server|guild)|self[-\s]?bot|token\s+grabber|steal\s+(?:an?\s+)?account|sell\s+(?:my\s+)?account|hack(?:ed|ing)?\s+(?:the\s+)?(?:server|account)|تهكير\s+السيرفر|تخريب\s+السيرفر|حرق\s+السيرفر|سبام\s+السيرفر)/i;
const PROMPT_INJECTION_PATTERN = /(?:ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions|disregard\s+(?:all\s+)?(?:previous|above)\s+instructions|تجاهل\s+(?:كل\s+)?(?:التعليمات|الأوامر)\s+(?:السابقة|أعلاه)|أنت\s+الآن\s+(?:بوت|مساعد)|you\s+are\s+now\s+(?:a|an)\s+|system\s+prompt|developer\s+mode|jailbreak)/i;
const SUSPICIOUS_LINK_PATTERN = /(?:https?:\/\/)?(?:bit\.ly|tinyurl\.com|cutt\.ly|shorturl\.at|t\.co|discord\.gift|t\.me|telegram\.me|grabify\.link|iplogger\.|2no\.co|free-nitro|nitro-gift|steamcommunity\.[a-z]{2,}\/gift)/i;

export function detectMessageRisk(
  content: string,
  options: {
    mentions?: number;
    mentionEveryone?: boolean;
    mentionHere?: boolean;
    authorIsStaff?: boolean;
    authorBot?: boolean;
    authorWebhook?: boolean;
    embedTitles?: string[];
    linkHosts?: string[];
  } = {}
): MessageRiskResultInternal {
  let severity: InvestigationSeverity = 'info';
  const categories = new Set<InvestigationCategory>();
  const reasons: string[] = [];
  const flags: string[] = [];
  const raw = String(content || '');
  const allText = [raw, ...(options.embedTitles || [])].join('\n').slice(0, 4000);
  const mentions = options.mentions ?? 0;

  const add = (sev: InvestigationSeverity, cat: InvestigationCategory, reason: string, flag?: string) => {
    severity = maxSeverity(severity, sev);
    categories.add(cat);
    if (!reasons.includes(reason)) reasons.push(reason);
    if (flag && !flags.includes(flag)) flags.push(flag);
  };

  if (!allText.trim() && mentions < 8) {
    return { severity, categories: [...categories], reasons, flags };
  }

  if (DISCORD_TOKEN_PATTERN.test(allText) || JWT_PATTERN.test(allText)) {
    add('critical', 'privacy', 'تسريب محتمل لتوكن/مفتاح حساس', 'credential_leak');
  }
  if (CREDENTIAL_PATTERN.test(allText)) {
    add('critical', 'privacy', 'بيانات اعتماد مكتوبة بشكل صريح (كلمة مرور/توكن/مفتاح)', 'credential_leak');
  }
  if (SCAM_PATTERNS.some((p) => p.test(allText))) {
    add('high', 'scam', 'نمط احتيال/تصيد معروف (نيترو/جيف/عملات/حساب)', 'scam');
  }
  if (SUSPICIOUS_LINK_PATTERN.test(allText)) {
    add('medium', 'scam', 'رابط قصير أو نطاق يرتبط عادة بالتصيد', 'suspicious_link');
  }
  if (INVITE_PATTERN.test(allText)) {
    if (options.authorIsStaff) add('low', 'invite', 'دعوة ديسكورد نشرها إداري', 'invite');
    else add('high', 'invite', 'نشر دعوة ديسكورد من عضو غير إداري', 'invite');
  }
  if (NUKE_PATTERN.test(allText)) {
    add('high', 'raid', 'حديث عن تخريب/رايد/توكين جرابر/بوت ذاتي', 'nuke_talk');
  }
  if (THREAT_PATTERN.test(allText)) {
    add('high', 'message', 'تهديد أو تسريب/تخويف', 'threat');
  }
  if (PROMPT_INJECTION_PATTERN.test(allText)) {
    add('medium', 'prompt_injection', 'محاولة تلاعب بتعليمات الذكاء الاصطناعي', 'prompt_injection');
  }
  if (options.mentionEveryone) {
    add(mentions >= 15 ? 'high' : 'medium', 'message', 'منشن @everyone', 'mass_mention');
  }
  if (options.mentionHere) {
    add('low', 'message', 'منشن @here', 'mass_mention');
  }
  if (mentions >= 15) {
    add('high', 'message', `منشن جماعي (${mentions} منشن)`, 'mass_mention');
  } else if (mentions >= 8) {
    add('medium', 'message', `عدد منشنات مرتفع (${mentions})`, 'mass_mention');
  }

  if (options.authorWebhook) {
    add('medium', 'webhook', 'رسالة مرسلة عبر ويب هوك', 'webhook_message');
  }

  return { severity, categories: [...categories], reasons, flags };
}

// --------------------------------------------
// Static permission groups
// --------------------------------------------
const DESTRUCTIVE_BOT_PERMS = new Set([
  'Administrator', 'ManageGuild', 'ManageChannels', 'ManageRoles',
  'ManageWebhooks', 'BanMembers', 'KickMembers', 'ManageThreads',
]);

const EVERYONE_RISKY_PERMS = new Set([
  'Administrator', 'ManageGuild', 'ManageChannels', 'ManageRoles',
  'ManageWebhooks', 'BanMembers', 'KickMembers', 'MentionEveryone',
]);

const MEMBER_HIGH_PERMS = new Set([
  'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels',
  'ManageWebhooks', 'BanMembers', 'KickMembers',
]);

const CRITICAL_AUDIT_ACTIONS = new Set([
  'ChannelDelete', 'RoleDelete', 'MemberBanAdd', 'MemberKick', 'WebhookCreate',
  'ChannelOverwriteUpdate', 'MemberRoleUpdate', 'BotAdd', 'GuildUpdate',
]);

const DESTRUCTIVE_AUDIT_ACTIONS = new Set([
  ...CRITICAL_AUDIT_ACTIONS,
  'MessageBulkDelete', 'EmojiDelete', 'StickerDelete', 'InviteCreate', 'InviteDelete',
  'ThreadDelete', 'ChannelCreate', 'RoleCreate',
]);

// إجراءات خطيرة حتى لو صدرت من بوت مصرّح له في القائمة البيضاء.
const SEVERE_AUTHORIZED_BOT_ACTIONS = new Set([
  'ChannelDelete', 'RoleDelete', 'MemberBanAdd', 'MemberKick', 'WebhookCreate', 'GuildUpdate',
]);

const TRUSTED_BOT_IDS = ['854233015475109888', '293036868578279425'];

// --------------------------------------------
// Helpers
// --------------------------------------------
function daysAgo(iso: string | undefined, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - t) / 86_400_000);
}

function minutesAgo(iso: string | undefined, now: number): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now - t) / 60_000);
}

function roleMap(roles: RoleSnapshot[]): Map<string, RoleSnapshot> {
  return new Map(roles.map((r) => [r.id, r]));
}

function isProtectedId(id: string | undefined, protectedIds: Set<string>): boolean {
  return !!id && protectedIds.has(id);
}

function addFinding(
  list: FindingDraft[],
  input: Omit<FindingDraft, 'confidence' | 'source' | 'evidence'> & {
    evidence?: string[];
    confidence?: number;
    source?: InvestigationSource;
  }
): void {
  const finding: FindingDraft = {
    ...input,
    evidence: (input.evidence || []).filter(Boolean).slice(0, 8),
    confidence: Math.max(0, Math.min(100, Math.round(input.confidence ?? 85))),
    source: input.source || 'heuristic',
  };
  finding.fingerprint = finding.fingerprint || fingerprintFinding(finding);
  list.push(finding);
}

function canFlagActor(id: string | undefined, protectedIds: Set<string>): boolean {
  return !isProtectedId(id, protectedIds);
}

// --------------------------------------------
// Main heuristic engine
// --------------------------------------------
export function buildHeuristicFindings(
  snapshot: GuildSnapshot,
  options: {
    protectedIds?: Set<string>;
    /** بوتات مصرّح لها (قائمة بيضاء) — لا تُعتبر غير مصرح بها، لكن سلوكها يبقى خاضعاً للتحقيق */
    authorizedBotIds?: Set<string>;
    now?: number;
  } = {}
): FindingDraft[] {
  const now = options.now ?? Date.now();
  const protectedIds = options.protectedIds ?? new Set<string>();
  const authorizedBotIds = options.authorizedBotIds ?? new Set<string>();
  const findings: FindingDraft[] = [];
  const roles = roleMap(snapshot.roles);
  const membersById = new Map(snapshot.members.map((m) => [m.id, m]));
  const security = snapshot.security;

  // ---------- Security posture ----------
  if (!security.antiNuke.enabled) {
    addFinding(findings, {
      severity: 'high', category: 'security',
      title: 'الحماية من التخريب (Anti-Nuke) معطلة',
      description: 'حماية الحذف/الإنشاء الجماعي والرولات وخطف السيرفر متوقفة. أي إداري أو بوت مخترق يستطيع تخريب السيرفر دون اعتراض.',
      subjectType: 'system', subjectName: 'إعدادات الحماية',
      evidence: ['antiNuke.enabled = false'],
      recommendation: 'أعد تفعيل Anti-Nuke من إعدادات الحماية واختر وضع prevent.',
    });
  }
  if (!security.antiBot.enabled) {
    addFinding(findings, {
      severity: 'medium', category: 'security',
      title: 'حماية انضمام البوتات (Anti-Bot) معطلة',
      description: 'البوتات غير المصرح بها يمكنها الانضمام. الحماية الوقائية قد تمنع الأخطر فقط، لكن السطح الهجومي أكبر.',
      subjectType: 'system', subjectName: 'إعدادات الحماية',
      evidence: ['antiBot.enabled = false'],
      recommendation: 'فعّل Anti-Bot وأبقِ القائمة البيضاء للبوتات الموثوقة فقط.',
    });
  }
  if (!security.antiRaid.enabled) {
    addFinding(findings, {
      severity: 'medium', category: 'security',
      title: 'الحماية من الرايد (Anti-Raid) معطلة',
      description: 'لا توجد حماية تلقائية ضد موجات الانضمام الجماعي للحسابات الوهمية.',
      subjectType: 'system', subjectName: 'إعدادات الحماية',
      evidence: ['antiRaid.enabled = false'],
      recommendation: 'فعّل Anti-Raid واضبط العتبة حسب حجم السيرفر.',
    });
  }
  if (!security.scamFilter.enabled) {
    addFinding(findings, {
      severity: 'medium', category: 'security',
      title: 'فلتر الاحتيال (Scam Filter) معطل',
      description: 'روابط النيترو المزيف والتصيد والسرقة المالية لن تُعترض تلقائياً.',
      subjectType: 'system', subjectName: 'إعدادات الحماية',
      evidence: ['scamFilter.enabled = false'],
      recommendation: 'فعّل فلتر الاحتيال من إعدادات الحماية.',
    });
  }
  if (!security.antiAlt.enabled) {
    addFinding(findings, {
      severity: 'low', category: 'security',
      title: 'كشف الحسابات البديلة (Anti-Alt) معطل',
      description: 'لا يوجد تحليل تلقائي لعلاقات الحسابات الجديدة/المشبوهة.',
      subjectType: 'system', subjectName: 'إعدادات الحماية',
      evidence: ['antiAlt.enabled = false'],
      recommendation: 'فعّل Anti-Alt بوضع log أولاً لمراقبة النتائج قبل العقوبات.',
    });
  }
  if (!security.autoBackup.enabled) {
    addFinding(findings, {
      severity: 'low', category: 'security',
      title: 'النسخ الاحتياطي التلقائي معطل',
      description: 'في حال حذف كبير للقنوات/الرولات لن تكون هناك نسخة حديثة للاستعادة.',
      subjectType: 'system', subjectName: 'إعدادات الحماية',
      evidence: ['autoBackup.enabled = false'],
      recommendation: 'فعّل النسخ الاحتياطي التلقائي واحتفظ بعدة نسخ.',
    });
  }
  if (security.verificationLevel === 'None' || security.verificationLevel === 'Low') {
    addFinding(findings, {
      severity: 'medium', category: 'security',
      title: 'مستوى التحقق من الأعضاء منخفض',
      description: `مستوى التحقق الحالي: ${security.verificationLevel}. هذا يسهّل دخول الحسابات الوهمية والرايد.`,
      subjectType: 'system', subjectName: 'إعدادات السيرفر',
      evidence: [`verificationLevel = ${security.verificationLevel}`],
      recommendation: 'ارفع مستوى التحقق إلى Medium على الأقل مع تفعيل 2FA للإداريين.',
    });
  }
  if (security.mfaLevel === 'None' && snapshot.memberAggregates.managers >= 3) {
    addFinding(findings, {
      severity: 'low', category: 'security',
      title: '2FA غير مطلوب للإداريين',
      description: 'حساب إداري مخترق يمكنه تنفيذ إجراءات خطرة دون طبقة حماية إضافية.',
      subjectType: 'system', subjectName: 'إعدادات السيرفر',
      evidence: [`mfaLevel = ${security.mfaLevel}`, `managers = ${snapshot.memberAggregates.managers}`],
      recommendation: 'اطلب 2FA لإجراءات الإدارة الحساسة من إعدادات السيرفر.',
    });
  }

  // ---------- @everyone / roles ----------
  const everyone = snapshot.roles.find((r) => r.isEveryone);
  if (everyone) {
    const risky = everyone.dangerousPermissions.filter((p) => EVERYONE_RISKY_PERMS.has(p));
    if (risky.length) {
      addFinding(findings, {
        severity: 'critical', category: 'permissions',
        title: '@everyone يملك صلاحيات خطرة',
        description: 'كل عضو في السيرفر — بما في ذلك أي حساب مخترق أو بوت — يملك صلاحيات إدارية عبر @everyone.',
        subjectType: 'role', subjectId: everyone.id, subjectName: '@everyone',
        evidence: [`الصلاحيات: ${risky.join(', ')}`],
        recommendation: 'أزل كل الصلاحيات الخطرة من @everyone فوراً واحتفظ بها في رولات إدارية محددة.',
        confidence: 100,
      });
    }
  }

  const adminRoles = snapshot.roles.filter((r) => !r.isEveryone && r.dangerousPermissions.includes('Administrator'));
  if (adminRoles.length > 4) {
    addFinding(findings, {
      severity: 'medium', category: 'role',
      title: 'عدد كبير من الرولات بصلاحية Administrator',
      description: `يوجد ${adminRoles.length} رولاً بصلاحية مدير كامل. أي عضو في أحدها يستطيع تجاوز كل الحمايات.`,
      subjectType: 'guild', subjectName: snapshot.guild.name,
      evidence: adminRoles.slice(0, 10).map((r) => `${r.name} (${r.members} عضو)`),
      recommendation: 'قلّص رولات Administrator لأقل عدد ممكن واستخدم صلاحيات محددة بدلاً منها.',
      confidence: 80,
    });
  }

  for (const role of snapshot.roles) {
    if (role.isEveryone) continue;
    const dangerous = role.dangerousPermissions;
    if (!dangerous.length) continue;
    const ageDays = daysAgo(role.createdAt, now);

    if (role.managed) {
      // رولات التكاملات المُدارة شائعة (بوتات موثوقة). لا نعتبرها خطراً بحد ذاتها
      // إلا إذا كانت حديثة أو يحمل اسمها نمطاً مشبوهاً؛ البوت غير المصرح يُكشف في قسم البوتات.
      if (
        dangerous.includes('Administrator') &&
        (ageDays <= 7 || /(?:nuke|raid|gift|nitro|free|token|grabber|hack|crack)/i.test(role.name))
      ) {
        addFinding(findings, {
          severity: 'medium', category: 'role',
          title: `رول مُدار بصلاحية Administrator: ${role.name}`,
          description: 'رول مرتبط بتكامل/بوت ويملك صلاحية مدير كامل. راجع البوت المالك لهذا الرول.',
          subjectType: 'role', subjectId: role.id, subjectName: role.name,
          evidence: [`managed = true`, `العمر: ${ageDays.toFixed(1)} يوم`, `members = ${role.members}`, `الصلاحيات: ${dangerous.join(', ')}`],
          recommendation: 'تأكد أن التكامل موثوق، أو قلّص صلاحيات الرول.',
          confidence: 65,
        });
      }
      continue;
    }
    if (dangerous.includes('Administrator') && ageDays <= 7) {
      addFinding(findings, {
        severity: 'high', category: 'role',
        title: `رول إداري جديد بصلاحية Administrator: ${role.name}`,
        description: 'رول بصلاحية مدير كامل أُنشئ خلال آخر 7 أيام. هذا نمط شائع لرفع صلاحيات باب خلفي.',
        subjectType: 'role', subjectId: role.id, subjectName: role.name,
        evidence: [`العمر: ${ageDays.toFixed(1)} يوم`, `الأعضاء: ${role.members}`, `الصلاحيات: ${dangerous.join(', ')}`],
        recommendation: 'راجع من أنشأ الرول ولماذا، واحذفه إن لم يكن مبرراً.',
        confidence: 78,
      });
    }

    if (dangerous.includes('Administrator') && role.members === 0) {
      addFinding(findings, {
        severity: 'low', category: 'role',
        title: `رول Administrator غير مستخدم: ${role.name}`,
        description: 'رول بصلاحية مدير كامل بلا أي عضو. قد يكون رولاً احتياطياً منسياً أو باباً خلفياً محتملاً.',
        subjectType: 'role', subjectId: role.id, subjectName: role.name,
        evidence: ['members = 0', `الصلاحيات: ${dangerous.join(', ')}`],
        recommendation: 'احذف الرول أو أزل صلاحية Administrator عنه.',
        confidence: 70,
      });
    }

    const recentRole = ageDays <= 3;
    if (recentRole && dangerous.some((p) => ['ManageRoles', 'ManageChannels', 'ManageWebhooks', 'BanMembers'].includes(p))) {
      addFinding(findings, {
        severity: 'medium', category: 'role',
        title: `رول جديد بصلاحيات حساسة: ${role.name}`,
        description: 'رول أُنشئ حديثاً ويملك صلاحيات تسمح بتعديل الرولات/القنوات أو الحظر.',
        subjectType: 'role', subjectId: role.id, subjectName: role.name,
        evidence: [`العمر: ${ageDays.toFixed(1)} يوم`, `الصلاحيات: ${dangerous.join(', ')}`],
        recommendation: 'راجع سبب الإنشاء ومن يملكه.',
        confidence: 65,
      });
    }
  }

  // ---------- Channel overwrites ----------
  for (const channel of snapshot.channels) {
    for (const ow of channel.overwrites) {
      const riskyAllow = ow.allow.filter((p) => EVERYONE_RISKY_PERMS.has(p));
      if (!riskyAllow.length) continue;

      const targetRole = roles.get(ow.targetId);
      const isEveryone = ow.targetId === snapshot.guild.id || !!targetRole?.isEveryone;
      const targetMember = membersById.get(ow.targetId);
      const protectedTarget = isProtectedId(ow.targetId, protectedIds) || isEveryone;

      if (isEveryone) {
        addFinding(findings, {
          severity: 'critical', category: 'permissions',
          title: `صلاحيات خطرة لـ @everyone في #${channel.name}`,
          description: 'تم منح @everyone صلاحيات إدارية على مستوى القناة، ما يسمح لأي عضو بتجاوز الحماية.',
          subjectType: 'channel', subjectId: channel.id, subjectName: `#${channel.name}`,
          evidence: [`الصلاحيات الممنوحة: ${riskyAllow.join(', ')}`],
          recommendation: 'أزل هذه الصلاحيات من @everyone في هذه القناة فوراً.',
          confidence: 100,
        });
      } else if (targetRole && !targetRole.dangerousPermissions.length && !protectedTarget) {
        addFinding(findings, {
          severity: 'high', category: 'permissions',
          title: `منح صلاحيات خطرة لرول عادي في #${channel.name}`,
          description: `الرول "${targetRole.name}" لا يملك صلاحيات خطرة على مستوى السيرفر، لكنه يملكها في هذه القناة.`,
          subjectType: 'channel', subjectId: channel.id, subjectName: `#${channel.name}`,
          evidence: [`الرول: ${targetRole.name}`, `الصلاحيات: ${riskyAllow.join(', ')}`],
          recommendation: 'راجع سبب منح الرول هذه الصلاحيات في القناة.',
          confidence: 85,
        });
      } else if (targetMember && !targetMember.bot && !protectedTarget && riskyAllow.includes('Administrator')) {
        addFinding(findings, {
          severity: 'high', category: 'permissions',
          title: `منح Administrator لعضو في #${channel.name}`,
          description: `العضو ${targetMember.displayName} يملك Administrator على مستوى هذه القناة فقط.`,
          subjectType: 'channel', subjectId: channel.id, subjectName: `#${channel.name}`,
          evidence: [`العضو: ${targetMember.username} (${targetMember.id})`, `الصلاحيات: ${riskyAllow.join(', ')}`],
          recommendation: 'أزل الاستثناء إن لم يكن ضرورياً.',
          confidence: 80,
        });
      }
    }
  }

  // ---------- Bots ----------
  const trustedBotIds = new Set([...TRUSTED_BOT_IDS, ...(security.trustedBotIds || [])]);
  for (const member of snapshot.members) {
    if (!member.bot) continue;
    if (member.id === security.botId) continue;
    if (protectedIds.has(member.id) || trustedBotIds.has(member.id)) continue;
    // البوت الموجود في القائمة البيضاء يملك صلاحياته بشكل مصرّح — نراقب سلوكه عبر
    // سجلات التدقيق والرسائل، لا عبر اعتبار وجود الصلاحيات بحد ذاته خطراً.
    if (authorizedBotIds.has(member.id)) continue;

    const destructive = member.dangerousPermissions.filter((p) => DESTRUCTIVE_BOT_PERMS.has(p));
    const suspiciousName = /(?:nuke|raid|gift|nitro|free|token|grabber|hack|crack)/i.test(member.username);
    const newBot = daysAgo(member.joinedAt, now) <= 1;

    if (member.administrator || destructive.length) {
      const severity: InvestigationSeverity = member.administrator ? 'critical' : 'high';
      addFinding(findings, {
        severity, category: 'bot',
        title: `بوت غير مصرح يملك صلاحيات تخريبية: ${member.displayName}`,
        description: 'البوت غير موجود في القائمة البيضاء ويملك صلاحيات تسمح بحذف/تعديل بنية السيرفر أو حظر الأعضاء.',
        subjectType: 'bot', subjectId: member.id, subjectName: member.displayName,
        evidence: [
          `الصلاحيات: ${(member.administrator ? ['Administrator', ...destructive] : destructive).join(', ')}`,
          `الرتب: ${member.roles.map((r) => r.name).join(', ') || 'بدون'}`,
          member.joinedAt ? `انضم: ${member.joinedAt}` : 'تاريخ الانضمام غير معروف',
        ],
        recommendation: 'تحقق من هوية البوت ومالكه. إن لم يكن موثوقاً، احظره أو أزل صلاحياته فوراً ثم أضفه للقائمة البيضاء فقط بعد التأكد.',
        confidence: 95,
      });
    } else if (newBot || suspiciousName) {
      addFinding(findings, {
        severity: newBot ? 'medium' : 'high', category: 'bot',
        title: `بوت غير مصرح: ${member.displayName}`,
        description: newBot
          ? 'بوت انضم خلال آخر 24 ساعة وليس في القائمة البيضاء.'
          : 'اسم البوت يطابق أنماط بوتات التخريب/الاحتيال المعروفة.',
        subjectType: 'bot', subjectId: member.id, subjectName: member.displayName,
        evidence: [
          member.joinedAt ? `انضم: ${member.joinedAt}` : 'تاريخ الانضمام غير معروف',
          `الرتب: ${member.roles.map((r) => r.name).join(', ') || 'بدون'}`,
          suspiciousName ? 'اسم مشبوه' : 'بوت جديد',
        ],
        recommendation: 'راجع هوية البوت ومالكه، وأضفه للقائمة البيضاء فقط إذا كان موثوقاً.',
        confidence: suspiciousName ? 80 : 65,
      });
    }
  }

  // ---------- Webhooks ----------
  if (snapshot.webhooks.length > 8) {
    addFinding(findings, {
      severity: 'medium', category: 'webhook',
      title: 'عدد كبير من الويب هوكات',
      description: `يوجد ${snapshot.webhooks.length} ويب هوك. الويب هوكات وسيلة شائعة لإرسال رسائل جماعية أو سبام باسم السيرفر.`,
      subjectType: 'guild', subjectName: snapshot.guild.name,
      evidence: snapshot.webhooks.slice(0, 10).map((w) => `${w.name} → #${w.channelName || '؟'}`),
      recommendation: 'راجع الويب هوكات واحذف غير المستخدم منها.',
      confidence: 70,
    });
  }
  for (const hook of snapshot.webhooks) {
    const suspicious = /(?:nuke|raid|gift|nitro|free|token|spam|hack)/i.test(hook.name);
    const ownerProtected = isProtectedId(hook.ownerId, protectedIds) || isProtectedId(hook.ownerId, authorizedBotIds);
    const ageDays = daysAgo(hook.createdAt, now);
    if (suspicious) {
      addFinding(findings, {
        severity: 'high', category: 'webhook',
        title: `ويب هوك باسم مشبوه: ${hook.name}`,
        description: 'اسم الويب هوك يطابق أنماط الاحتيال/التخريب.',
        subjectType: 'webhook', subjectId: hook.id, subjectName: hook.name,
        evidence: [`القناة: #${hook.channelName || '؟'}`, hook.ownerName ? `المالك: ${hook.ownerName}` : 'المالك غير معروف'],
        recommendation: 'احذف الويب هوك إن لم يكن معروفاً.',
        confidence: 80,
      });
    } else if (!hook.ownerId) {
      addFinding(findings, {
        severity: 'medium', category: 'webhook',
        title: `ويب هوك بلا مالك معروف: ${hook.name}`,
        description: 'لا يمكن ربط الويب هوك بحساب معروف، ما يصعّب تتبع من ينشئ الرسائل.',
        subjectType: 'webhook', subjectId: hook.id, subjectName: hook.name,
        evidence: [`القناة: #${hook.channelName || '؟'}`],
        recommendation: 'احذف الويب هوك أو أعد إنشاءه من حساب موثوق.',
        confidence: 60,
      });
    } else if (!ownerProtected && hook.ownerBot) {
      addFinding(findings, {
        severity: 'medium', category: 'webhook',
        title: `ويب هوك يملكه بوت غير مصرح: ${hook.name}`,
        description: 'الويب هوك مرتبط ببوت غير موجود في القائمة البيضاء.',
        subjectType: 'webhook', subjectId: hook.id, subjectName: hook.name,
        evidence: [`المالك: ${hook.ownerName || hook.ownerId}`, `القناة: #${hook.channelName || '؟'}`],
        recommendation: 'راجع البوت المالك واحذف الويب هوك إن لم يكن ضرورياً.',
        confidence: 70,
      });
    } else if (!ownerProtected && ageDays <= 7 && hook.ownerName) {
      addFinding(findings, {
        severity: 'low', category: 'webhook',
        title: `ويب هوك جديد: ${hook.name}`,
        description: 'أُنشئ ويب هوك خلال آخر 7 أيام من حساب غير موثوق.',
        subjectType: 'webhook', subjectId: hook.id, subjectName: hook.name,
        evidence: [`المالك: ${hook.ownerName}`, `العمر: ${ageDays.toFixed(1)} يوم`],
        recommendation: 'تأكد أن الإنشاء كان مقصوداً.',
        confidence: 55,
      });
    }
  }

  // ---------- Invites ----------
  const memberIds = new Set(snapshot.members.map((m) => m.id));
  const invitesByInviter = new Map<string, number>();
  for (const invite of snapshot.invites) {
    if (invite.inviterId) {
      invitesByInviter.set(invite.inviterId, (invitesByInviter.get(invite.inviterId) || 0) + 1);
    }
    const inviterProtected = isProtectedId(invite.inviterId, protectedIds);
    if (!inviterProtected && invite.inviterId && !memberIds.has(invite.inviterId)) {
      addFinding(findings, {
        severity: 'medium', category: 'invite',
        title: `دعوة من عضو غادر السيرفر: ${invite.code}`,
        description: 'الدعوة ما زالت نشطة رغم مغادرة منشئها، وقد تُستخدم لدخول غير مرغوب.',
        subjectType: 'invite', subjectId: invite.code, subjectName: `discord.gg/${invite.code}`,
        evidence: [`المنشئ: ${invite.inviterName || invite.inviterId}`, `الاستخدامات: ${invite.uses}`, `القناة: #${invite.channelName || '؟'}`],
        recommendation: 'ألغِ الدعوة إن لم تكن مطلوبة.',
        confidence: 70,
      });
    }
    if (!inviterProtected && invite.maxAge === 0 && invite.maxUses === 0 && invite.uses > 20) {
      addFinding(findings, {
        severity: 'medium', category: 'invite',
        title: `دعوة دائمة كثيرة الاستخدام: ${invite.code}`,
        description: 'دعوة بلا تاريخ انتهاء وبلا حد استخدامات، استُخدمت أكثر من 20 مرة.',
        subjectType: 'invite', subjectId: invite.code, subjectName: `discord.gg/${invite.code}`,
        evidence: [`المنشئ: ${invite.inviterName || invite.inviterId || '؟'}`, `الاستخدامات: ${invite.uses}`],
        recommendation: 'اضبط تاريخ انتهاء وحد استخدامات مناسبين.',
        confidence: 65,
      });
    }
  }
  for (const [inviterId, count] of invitesByInviter) {
    if (count >= 10 && !isProtectedId(inviterId, protectedIds)) {
      const inviter = membersById.get(inviterId);
      addFinding(findings, {
        severity: 'medium', category: 'invite',
        title: `عدد كبير من الدعوات النشطة: ${inviter?.displayName || inviterId}`,
        description: `المستخدم أنشأ ${count} دعوة نشطة. قد يكون ذلك تسويقاً أو تسريباً لدعوات السيرفر.`,
        subjectType: 'member', subjectId: inviterId, subjectName: inviter?.displayName || inviterId,
        evidence: [`عدد الدعوات: ${count}`],
        recommendation: 'راجع الدعوات واحذف غير الضروري، وقيّد صلاحية إنشاء الدعوات.',
        confidence: 60,
      });
    }
  }

  // ---------- Members / admins ----------
  const warningsByUser = new Map<string, number>();
  for (const warning of snapshot.moderation.warnings) {
    warningsByUser.set(warning.userId, (warningsByUser.get(warning.userId) || 0) + 1);
  }

  for (const member of snapshot.members) {
    if (member.bot) continue;
    if (protectedIds.has(member.id)) continue;
    const highPerms = member.dangerousPermissions.filter((p) => MEMBER_HIGH_PERMS.has(p));
    const accountAge = member.accountAgeDays;
    const joinedDays = daysAgo(member.joinedAt, now);

    if ((member.administrator || member.manageGuild) && accountAge <= 7) {
      addFinding(findings, {
        severity: 'critical', category: 'account',
        title: `حساب جديد بصلاحيات إدارية: ${member.displayName}`,
        description: `حساب عمره ${accountAge.toFixed(1)} يوم فقط ويملك صلاحيات إدارية. هذا نمط شائع لحساب مخترق أو باب خلفي.`,
        subjectType: 'member', subjectId: member.id, subjectName: member.displayName,
        evidence: [
          `عمر الحساب: ${accountAge.toFixed(1)} يوم`,
          member.joinedAt ? `الانضمام: ${member.joinedAt}` : 'تاريخ الانضمام غير معروف',
          `الصلاحيات: ${highPerms.join(', ') || 'Administrator'}`,
          `الرتب: ${member.roles.map((r) => r.name).join(', ') || 'بدون'}`,
        ],
        recommendation: 'راجع الحساب فوراً. إن لم يكن موثوقاً، أوقف صلاحياته واحظره.',
        confidence: 92,
      });
    } else if ((member.administrator || member.manageGuild) && (accountAge <= 30 || joinedDays <= 3)) {
      addFinding(findings, {
        severity: 'high', category: 'account',
        title: `منح صلاحيات إدارية لحساب حديث: ${member.displayName}`,
        description: 'الحساب حصل على صلاحيات إدارية مع عمر حساب قصير أو انضمام حديث.',
        subjectType: 'member', subjectId: member.id, subjectName: member.displayName,
        evidence: [
          `عمر الحساب: ${accountAge.toFixed(1)} يوم`,
          member.joinedAt ? `الانضمام: ${member.joinedAt}` : 'تاريخ الانضمام غير معروف',
          `الصلاحيات: ${highPerms.join(', ') || 'Administrator'}`,
        ],
        recommendation: 'تأكد من هوية العضو ومنحه الصلاحيات بعد فترة كافية.',
        confidence: 82,
      });
    } else if (highPerms.length && accountAge <= 7) {
      addFinding(findings, {
        severity: 'high', category: 'account',
        title: `حساب جديد بصلاحيات حساسة: ${member.displayName}`,
        description: 'حساب عمره أقل من أسبوع ويملك صلاحيات إدارية/تخريبية.',
        subjectType: 'member', subjectId: member.id, subjectName: member.displayName,
        evidence: [`عمر الحساب: ${accountAge.toFixed(1)} يوم`, `الصلاحيات: ${highPerms.join(', ')}`],
        recommendation: 'راجع الصلاحيات وقلّصها حتى تثبت هوية العضو.',
        confidence: 85,
      });
    }

    if (accountAge <= 7 && member.roles.length === 0 && /(?:admin|moderator|owner|staff|support|liberty|discord)/i.test(member.username)) {
      addFinding(findings, {
        severity: 'medium', category: 'member',
        title: `اسم حساب يحاكي الإدارة: ${member.username}`,
        description: 'حساب جديد بلا رتب ويستخدم اسماً مشابهاً لفريق الإدارة. قد يكون انتحال هوية.',
        subjectType: 'member', subjectId: member.id, subjectName: member.username,
        evidence: [`عمر الحساب: ${accountAge.toFixed(1)} يوم`, 'بدون رتب'],
        recommendation: 'راقب الحساب أو اطلب تغيير الاسم إن كان ينتحل شخصية إدارية.',
        confidence: 60,
      });
    }

    const warningCount = warningsByUser.get(member.id) || 0;
    if (warningCount >= 3 && highPerms.length) {
      addFinding(findings, {
        severity: 'medium', category: 'moderation',
        title: `إداري لديه تحذيرات متكررة: ${member.displayName}`,
        description: `لدى العضو ${warningCount} تحذيرات نشطة مع صلاحيات إدارية.`,
        subjectType: 'member', subjectId: member.id, subjectName: member.displayName,
        evidence: [`التحذيرات: ${warningCount}`, `الصلاحيات: ${highPerms.join(', ')}`],
        recommendation: 'راجع سجل التحذيرات وصلاحيات العضو.',
        confidence: 70,
      });
    }
  }

  // ---------- Message analysis ----------
  const messageFindings: FindingDraft[] = [];
  const perAuthor = new Map<string, { count: number; first: number; last: number; contents: string[] }>();
  const contentCounts = new Map<string, number>();

  for (const message of snapshot.messages) {
    // المستثنون تماماً (المالك/المطور/Clyde/Discord Bots/بوت Liberty City)
    // لا يُنتجون أي نتائج، حتى لو احتوى نصهم على أنماط تبدو خطرة.
    if (message.authorProtected) continue;

    const risk = detectMessageRisk(message.content, {
      mentions: message.mentions,
      mentionEveryone: message.mentionEveryone,
      mentionHere: message.mentionHere,
      authorIsStaff: message.authorStaff,
      authorBot: message.authorBot,
      authorWebhook: message.authorWebhook,
      embedTitles: message.embedTitles,
      linkHosts: message.linkHosts,
    });

    const created = Date.parse(message.createdAt) || now;
    const bucket = perAuthor.get(message.authorId) || { count: 0, first: created, last: created, contents: [] };
    bucket.count++;
    bucket.last = Math.max(bucket.last, created);
    if (message.content.length >= 8) bucket.contents.push(message.content.slice(0, 120));
    perAuthor.set(message.authorId, bucket);

    const normalized = message.content.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.length >= 12) {
      contentCounts.set(normalized, (contentCounts.get(normalized) || 0) + 1);
    }

    if (severityRank(risk.severity) >= severityRank('medium') && risk.reasons.length) {
      const category = risk.categories[0] || 'message';
      const snippet = redactSensitiveText(message.content).slice(0, 300);
      const authorLabel = message.authorName || message.authorId;
      const title = category === 'prompt_injection'
        ? `محاولة تلاعب بتعليمات AI من ${authorLabel} في #${message.channelName}`
        : category === 'scam'
          ? `محتوى احتيالي من ${authorLabel} في #${message.channelName}`
          : category === 'invite'
            ? `دعوة مشبوهة من ${authorLabel} في #${message.channelName}`
            : category === 'privacy'
              ? `تسريب بيانات حساسة من ${authorLabel} في #${message.channelName}`
              : `رسالة مشبوهة من ${authorLabel} في #${message.channelName}`;

      const evidence = [
        `الكاتب: ${message.authorName}${message.authorBot ? ' (بوت)' : ''}${message.authorWebhook ? ' (ويب هوك)' : ''}`,
        `المحتوى: ${snippet || '[مرفق/إمبد]'}`,
        ...(message.linkHosts.length ? [`النطاقات: ${message.linkHosts.slice(0, 5).join(', ')}`] : []),
        ...(message.mentions ? [`المنشنات: ${message.mentions}`] : []),
      ];

      addFinding(messageFindings, {
        severity: risk.severity,
        category,
        title,
        description: risk.reasons.join(' • '),
        subjectType: 'message',
        subjectId: message.id,
        subjectName: `${message.authorName} في #${message.channelName}`,
        evidence,
        recommendation: category === 'privacy'
          ? 'احذف الرسالة فوراً، أبطِل المفتاح/التوكن المسرّب، وافحص سجلات الوصول.'
          : category === 'scam'
            ? 'احذف الرسالة، حظر المرسل إن كان غير موثوق، وافحص الرسائل المشابهة.'
            : category === 'invite'
              ? 'احذف الدعوة إن كانت غير مصرح بها، وراجع صلاحية إنشاء الدعوات.'
              : category === 'prompt_injection'
                ? 'تجاهل التعليمات الموجودة داخل الرسالة؛ فهي بيانات غير موثوقة وليست أوامر.'
                : 'راجع الرسالة والسياق، واتخذ إجراء إشرافياً إن لزم.',
        confidence: risk.severity === 'critical' ? 95 : risk.severity === 'high' ? 85 : 70,
      });
    }
  }

  // Spam bursts / repeated content
  for (const [authorId, bucket] of perAuthor) {
    if (bucket.count >= 12 && bucket.last - bucket.first <= 10 * 60_000) {
      const member = membersById.get(authorId);
      if (isProtectedId(authorId, protectedIds)) continue;
      addFinding(findings, {
        severity: 'medium', category: 'message',
        title: `انفجار رسائل من ${member?.displayName || authorId}`,
        description: `أرسل العضو ${bucket.count} رسالة خلال ${Math.max(1, Math.round((bucket.last - bucket.first) / 60_000))} دقيقة.`,
        subjectType: 'member', subjectId: authorId, subjectName: member?.displayName || authorId,
        evidence: [`عدد الرسائل: ${bucket.count}`, `النافذة: ${Math.round((bucket.last - bucket.first) / 60_000)} دقيقة`],
        recommendation: 'راجع الرسائل؛ قد يكون سباماً أو بوتاً ذاتياً.',
        confidence: 75,
      });
    }
  }
  for (const [content, count] of contentCounts) {
    if (count >= 5) {
      addFinding(findings, {
        severity: 'medium', category: 'message',
        title: 'رسائل مكررة عبر القنوات',
        description: 'نفس النص تكرر 5 مرات أو أكثر، وهو نمط سبام شائع.',
        subjectType: 'guild', subjectName: snapshot.guild.name,
        evidence: [`عدد التكرار: ${count}`, `النص: ${redactSensitiveText(content).slice(0, 160)}`],
        recommendation: 'حدد المرسل واحظر/اكتم إن كان سباماً متعمداً.',
        confidence: 65,
      });
    }
  }

  // Keep the highest-signal message findings, avoid flooding the report.
  messageFindings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  findings.push(...messageFindings.slice(0, 40));

  // ---------- Audit logs ----------
  const auditByExecutor = new Map<string, Array<{ action: string; at: number }>>();
  for (const entry of snapshot.auditLogs) {
    if (!entry.executorId) continue;
    const at = Date.parse(entry.createdAt) || now;
    const list = auditByExecutor.get(entry.executorId) || [];
    list.push({ action: entry.action, at });
    auditByExecutor.set(entry.executorId, list);

    const protectedExecutor = isProtectedId(entry.executorId, protectedIds);
    const action = entry.action;
    const destructive = DESTRUCTIVE_AUDIT_ACTIONS.has(action);
    if (!destructive) continue;

    if (entry.executorBot && !protectedExecutor) {
      const authorized = isProtectedId(entry.executorId, authorizedBotIds);
      const severity: InvestigationSeverity = authorized
        ? (SEVERE_AUTHORIZED_BOT_ACTIONS.has(action) ? 'high' : 'medium')
        : (CRITICAL_AUDIT_ACTIONS.has(action) ? 'critical' : 'high');

      addFinding(findings, {
        severity,
        category: 'audit',
        title: authorized
          ? `بوت مصرّح نفّذ إجراءً حساساً: ${entry.executorName || entry.executorId}`
          : `بوت غير مصرح نفّذ إجراءً تخريبياً: ${entry.executorName || entry.executorId}`,
        description: authorized
          ? `سجل التدقيق يظهر إجراء ${action} بواسطة بوت في القائمة البيضاء. الصلاحيات مصرّح بها، لكن السلوك التخريبي يبقى خاضعاً للمراجعة.`
          : `سجل التدقيق يظهر إجراء ${action} بواسطة بوت غير موجود في القائمة البيضاء.`,
        subjectType: 'bot', subjectId: entry.executorId, subjectName: entry.executorName || entry.executorId,
        evidence: [
          `الإجراء: ${action}`,
          authorized ? 'الحالة: بوت مصرّح (القائمة البيضاء)' : 'الحالة: بوت غير مصرّح',
          entry.targetName ? `الهدف: ${entry.targetName}` : '',
          entry.reason ? `السبب: ${entry.reason}` : '',
          `الوقت: ${entry.createdAt}`,
        ].filter(Boolean),
        recommendation: authorized
          ? 'راجع سلوك البوت وسجلاته؛ إن كان الإجراء غير متوقع فأوقفه يدوياً.'
          : 'أوقف البوت فوراً وراجع كل إجراءاته الأخيرة.',
        confidence: authorized ? 75 : 95,
      });
    }

    if (action === 'BotAdd' && entry.targetId && !isProtectedId(entry.targetId, protectedIds)) {
      addFinding(findings, {
        severity: 'high', category: 'audit',
        title: `إضافة بوت غير مصرح: ${entry.targetName || entry.targetId}`,
        description: 'تمت إضافة بوت إلى السيرفر خارج القائمة البيضاء.',
        subjectType: 'bot', subjectId: entry.targetId, subjectName: entry.targetName || entry.targetId,
        evidence: [`المنفذ: ${entry.executorName || entry.executorId}`, `الهدف: ${entry.targetName || entry.targetId}`],
        recommendation: 'تحقق من البوت، واحظره إن لم يكن موثوقاً.',
        confidence: 90,
      });
    }

    if (action === 'MemberRoleUpdate') {
      const grantsAdmin = entry.changes.some((c) => /administrator|manageguild|manageroles|managechannels/i.test(c));
      if (grantsAdmin && !protectedExecutor) {
        addFinding(findings, {
          severity: 'high', category: 'audit',
          title: 'منح صلاحيات إدارية عبر سجل التدقيق',
          description: 'تم تعديل رولات عضو لإضافة صلاحيات إدارية/مدير.',
          subjectType: 'member', subjectId: entry.targetId, subjectName: entry.targetName || entry.targetId || 'عضو',
          evidence: [
            `المنفذ: ${entry.executorName || entry.executorId}`,
            `الهدف: ${entry.targetName || entry.targetId}`,
            ...entry.changes.slice(0, 3),
          ],
          recommendation: 'راجع سبب منح الصلاحيات، وتأكد أن المنفذ مخوّل.',
          confidence: 82,
        });
      }
    }

    if (action === 'ChannelOverwriteUpdate' && !protectedExecutor && entry.changes.some((c) => /administrator|manageguild|managechannels/i.test(c))) {
      addFinding(findings, {
        severity: 'high', category: 'audit',
        title: 'تعديل صلاحيات قناة بصلاحيات إدارية',
        description: 'تم تغيير Overwrite قناة لمنح صلاحيات إدارية.',
        subjectType: 'channel', subjectId: entry.targetId, subjectName: entry.targetName || entry.targetId || 'قناة',
        evidence: [`المنفذ: ${entry.executorName || entry.executorId}`, ...entry.changes.slice(0, 3)],
        recommendation: 'راجع التغيير وأعده إن لم يكن مصرحاً.',
        confidence: 78,
      });
    }
  }

  for (const [executorId, actions] of auditByExecutor) {
    const destructive = actions.filter((a) => DESTRUCTIVE_AUDIT_ACTIONS.has(a.action));
    if (destructive.length < 8) continue;
    const within = Math.max(...destructive.map((a) => a.at)) - Math.min(...destructive.map((a) => a.at));
    if (within > 10 * 60_000) continue;
    const executor = membersById.get(executorId);
    if (isProtectedId(executorId, protectedIds)) continue;
    addFinding(findings, {
      severity: 'high', category: 'audit',
      title: `موجة إجراءات تخريبية من ${executor?.displayName || executorId}`,
      description: `نفّذ ${destructive.length} إجراءً حساساً خلال ${Math.max(1, Math.round(within / 60_000))} دقيقة.`,
      subjectType: 'member', subjectId: executorId, subjectName: executor?.displayName || executorId,
      evidence: destructive.slice(0, 8).map((a) => `${a.action} @ ${new Date(a.at).toISOString()}`),
      recommendation: 'راجع الإجراءات فوراً؛ أوقف المنفذ إن لم تكن الإجراءات مصرحة.',
      confidence: 88,
    });
  }

  // ---------- Raid / join anomalies ----------
  const joins10m = snapshot.members.filter((m) => daysAgo(m.joinedAt, now) * 24 * 60 <= 10).length;
  const joins1h = snapshot.members.filter((m) => daysAgo(m.joinedAt, now) * 24 * 60 <= 60).length;
  if (joins10m >= 15) {
    addFinding(findings, {
      severity: 'critical', category: 'raid',
      title: 'موجة انضمام جماعي (رايد محتمل)',
      description: `${joins10m} عضواً انضموا خلال آخر 10 دقائق. هذا حجم غير طبيعي لمعظم السيرفرات.`,
      subjectType: 'guild', subjectName: snapshot.guild.name,
      evidence: [`انضمام آخر 10 دقائق: ${joins10m}`, `آخر ساعة: ${joins1h}`],
      recommendation: 'فعّل وضع الطوارئ/التحقق، وراجع الحسابات الجديدة، وأوقف الدعوات مؤقتاً.',
      confidence: 90,
    });
  } else if (joins10m >= 8) {
    addFinding(findings, {
      severity: 'high', category: 'raid',
      title: 'انضمام جماعي مشبوه',
      description: `${joins10m} عضواً انضموا خلال آخر 10 دقائق.`,
      subjectType: 'guild', subjectName: snapshot.guild.name,
      evidence: [`انضمام آخر 10 دقائق: ${joins10m}`, `آخر ساعة: ${joins1h}`],
      recommendation: 'راقب الانضمامات، وتأكد من تفعيل Anti-Raid.',
      confidence: 80,
    });
  }
  const recentNewAccounts = snapshot.members.filter(
    (m) => daysAgo(m.joinedAt, now) * 24 * 60 <= 60 && m.accountAgeDays <= 7
  ).length;
  if (recentNewAccounts >= 5) {
    addFinding(findings, {
      severity: 'high', category: 'raid',
      title: 'حسابات جديدة تنضم بشكل متكرر',
      description: `${recentNewAccounts} حساباً عمره أقل من 7 أيام انضم خلال آخر ساعة.`,
      subjectType: 'guild', subjectName: snapshot.guild.name,
      evidence: [`عدد الحسابات الجديدة: ${recentNewAccounts}`],
      recommendation: 'ارفع مستوى التحقق وفعّل Anti-Alt، وراجع الدعوات المستخدمة.',
      confidence: 82,
    });
  }

  // ---------- Moderation abuse ----------
  const casesByModerator = new Map<string, number>();
  for (const c of snapshot.moderation.cases) {
    if (c.type === 'ban' || c.type === 'kick' || c.type === 'timeout') {
      casesByModerator.set(c.moderatorId, (casesByModerator.get(c.moderatorId) || 0) + 1);
    }
  }
  for (const [moderatorId, count] of casesByModerator) {
    if (count < 20 || isProtectedId(moderatorId, protectedIds)) continue;
    const moderator = membersById.get(moderatorId);
    addFinding(findings, {
      severity: 'medium', category: 'moderation',
      title: `نشاط عقوبات مرتفع: ${moderator?.displayName || moderatorId}`,
      description: `سجّل ${count} حالة حظر/طرد/تايم أوت. قد يكون ذلك إشرافاً مكثفاً أو إساءة استخدام.`,
      subjectType: 'member', subjectId: moderatorId, subjectName: moderator?.displayName || moderatorId,
      evidence: [`عدد الحالات: ${count}`],
      recommendation: 'راجع الحالات وتأكد من وجود أسباب موثقة.',
      confidence: 55,
    });
  }

  // ---------- Deduplicate ----------
  return dedupeFindings(findings);
}

// --------------------------------------------
// Signals and AI payload normalization
// --------------------------------------------
export function signalsToFindings(signals: EventSignal[]): FindingDraft[] {
  const findings: FindingDraft[] = [];
  for (const signal of signals) {
    if (severityRank(signal.severity) < severityRank('medium')) continue;
    const category: InvestigationCategory =
      signal.type.includes('join_burst') ? 'raid'
      : signal.type.includes('message') ? 'message'
      : signal.type.includes('member') ? 'member'
      : signal.type.includes('audit') ? 'audit'
      : signal.type.includes('webhook') ? 'webhook'
      : signal.type.includes('invite') ? 'invite'
      : signal.type.includes('role') ? 'role'
      : signal.type.includes('channel') ? 'channel'
      : 'other';

    const subjectType: InvestigationSubjectType =
      signal.type.includes('join_burst') ? 'guild'
      : signal.actorBot ? 'bot'
      : signal.type.includes('member') ? 'member'
      : signal.type.includes('role') ? 'role'
      : signal.type.includes('channel') ? 'channel'
      : signal.type.includes('webhook') ? 'webhook'
      : signal.type.includes('invite') ? 'invite'
      : 'system';

    addFinding(findings, {
      severity: signal.severity,
      category,
      title: signal.summary.slice(0, 160),
      description: signal.summary,
      subjectType,
      subjectId: signal.actorId,
      subjectName: signal.actorName || signal.actorId,
      evidence: [
        `الحدث: ${signal.type}`,
        `الوقت: ${new Date(signal.at).toISOString()}`,
        signal.targetName ? `الهدف: ${signal.targetName}` : '',
        signal.channelId ? `القناة: ${signal.channelId}` : '',
      ].filter(Boolean),
      recommendation: 'راجع الحدث فوراً وتحقق من سجلات التدقيق.',
      confidence: 75,
      source: 'heuristic',
      metadata: signal.metadata,
    });
  }
  return dedupeFindings(findings);
}

export function normalizeAIFindings(
  payload: AIAnalysisPayload | null,
  source: InvestigationSource = 'ai'
): FindingDraft[] {
  if (!payload || !Array.isArray(payload.findings)) return [];
  const findings: FindingDraft[] = [];
  for (const raw of payload.findings.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue;
    const title = String(raw.title || '').trim().slice(0, 160);
    if (!title) continue;
    const evidenceRaw = Array.isArray(raw.evidence)
      ? raw.evidence
      : typeof raw.evidence === 'string'
        ? [raw.evidence]
        : [];
    const evidence = evidenceRaw
      .map((e) => String(e).slice(0, 400))
      .filter(Boolean)
      .slice(0, 8);

    const finding: FindingDraft = {
      severity: normalizeSeverity(raw.severity),
      category: normalizeCategory(raw.category),
      title,
      description: String(raw.description || '').slice(0, 2000),
      subjectType: normalizeSubjectType(raw.subjectType),
      subjectId: raw.subjectId ? String(raw.subjectId).slice(0, 32) : undefined,
      subjectName: raw.subjectName ? String(raw.subjectName).slice(0, 160) : undefined,
      evidence,
      recommendation: String(raw.recommendation || 'راجع النتيجة وتحقق من الأدلة.').slice(0, 1000),
      confidence: Math.max(0, Math.min(100, Math.round(Number(raw.confidence) || 60))),
      source,
      metadata: { ai: true },
    };
    finding.fingerprint = fingerprintFinding(finding);
    findings.push(finding);
  }
  return dedupeFindings(findings);
}

export function dedupeFindings(findings: FindingDraft[]): FindingDraft[] {
  const map = new Map<string, FindingDraft>();
  for (const f of findings) {
    const key = f.fingerprint || fingerprintFinding(f);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...f, fingerprint: key });
      continue;
    }
    const severity = maxSeverity(existing.severity, f.severity);
    const evidence = [...new Set([...(existing.evidence || []), ...(f.evidence || [])])].slice(0, 10);
    const source: InvestigationSource =
      existing.source === f.source ? existing.source : 'merged';
    map.set(key, {
      ...existing,
      severity,
      description: f.description.length > existing.description.length ? f.description : existing.description,
      recommendation: f.recommendation.length > existing.recommendation.length ? f.recommendation : existing.recommendation,
      evidence,
      confidence: Math.max(existing.confidence, f.confidence),
      source,
      fingerprint: key,
      metadata: { ...(existing.metadata || {}), ...(f.metadata || {}) },
    });
  }
  return [...map.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

export function mergeAIAnalysis(
  base: FindingDraft[],
  payloads: Array<AIAnalysisPayload | null>,
  maxFindings: number
): { findings: FindingDraft[]; overallRisk: number; summary: string; observations: string[]; positiveSignals: string[]; recommendedActions: string[] } {
  const all = [...base];
  let overallRisk = 0;
  const summaries: string[] = [];
  const observations = new Set<string>();
  const positiveSignals = new Set<string>();
  const recommendedActions = new Set<string>();

  for (const payload of payloads) {
    if (!payload) continue;
    const aiFindings = normalizeAIFindings(payload, 'ai');
    all.push(...aiFindings);
    // لا نثق بدرجة خطر معلنة بلا نتائج مرافقة: قد تكون هلوسة ترفع تقريراً سليماً إلى "حرج".
    const risk = Number(payload.overallRisk ?? payload.riskScore ?? 0);
    if (aiFindings.length && Number.isFinite(risk)) {
      overallRisk = Math.max(overallRisk, Math.max(0, Math.min(100, risk)));
    }
    if (payload.summary) summaries.push(String(payload.summary).slice(0, 3000));
    for (const o of payload.observations || []) if (o) observations.add(String(o).slice(0, 400));
    for (const p of payload.positiveSignals || []) if (p) positiveSignals.add(String(p).slice(0, 400));
    for (const r of payload.recommendedActions || []) if (r) recommendedActions.add(String(r).slice(0, 400));
  }

  const merged = dedupeFindings(all).slice(0, Math.max(5, maxFindings));
  return {
    findings: merged,
    overallRisk,
    summary: summaries.join(' ').slice(0, 3000),
    observations: [...observations].slice(0, 20),
    positiveSignals: [...positiveSignals].slice(0, 20),
    recommendedActions: [...recommendedActions].slice(0, 20),
  };
}

// --------------------------------------------
// Compact context helpers for prompts
// --------------------------------------------
export function compactSecurity(security: SecuritySnapshot): Record<string, unknown> {
  return {
    antiNuke: security.antiNuke,
    antiBot: { enabled: security.antiBot.enabled, whitelistCount: security.antiBot.whitelist.length },
    antiRaid: security.antiRaid,
    antiSpam: security.antiSpam,
    antiLink: security.antiLink,
    antiInvite: security.antiInvite,
    antiMention: security.antiMention,
    antiAlt: security.antiAlt,
    antiAdmin: security.antiAdmin,
    scamFilter: security.scamFilter,
    autoBackup: security.autoBackup,
    autoScan: security.autoScan,
    lockdown: security.lockdown,
    ownerApproval: security.ownerApproval,
    mainWhitelist: { enabled: security.mainWhitelist.enabled, count: security.mainWhitelist.userIds.length },
    verificationLevel: security.verificationLevel,
    explicitContentFilter: security.explicitContentFilter,
    mfaLevel: security.mfaLevel,
  };
}

export function compactMember(member: MemberSnapshot): Record<string, unknown> {
  return {
    id: member.id,
    username: member.username,
    displayName: member.displayName,
    bot: member.bot,
    accountAgeDays: Number(member.accountAgeDays.toFixed(1)),
    joinedAt: member.joinedAt,
    roles: member.roles.map((r) => r.name),
    highestRole: member.highestRole,
    dangerousPermissions: member.dangerousPermissions,
    administrator: member.administrator,
    manageGuild: member.manageGuild,
    timedOutUntil: member.timedOutUntil,
    messageCount: member.messageCount,
    lastMessageAt: member.lastMessageAt,
    invitedBy: member.invitedBy,
  };
}

export function compactMessage(message: MessageSnapshot): Record<string, unknown> {
  return {
    id: message.id,
    channel: message.channelName,
    author: message.authorName,
    authorId: message.authorId,
    authorBot: message.authorBot,
    authorWebhook: message.authorWebhook,
    authorProtected: message.authorProtected,
    createdAt: message.createdAt,
    content: message.content,
    attachments: message.attachments,
    embedTitles: message.embedTitles,
    mentions: message.mentions,
    mentionEveryone: message.mentionEveryone,
    linkHosts: message.linkHosts,
  };
}

export function compactChannel(channel: ChannelSnapshot): Record<string, unknown> {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parent: channel.parentName,
    nsfw: channel.nsfw,
    rateLimitPerUser: channel.rateLimitPerUser,
    topic: channel.topic,
    overwrites: channel.overwrites.filter((o) => o.allow.length || o.deny.length),
  };
}

export function compactRole(role: RoleSnapshot): Record<string, unknown> {
  return {
    id: role.id,
    name: role.name,
    isEveryone: role.isEveryone,
    managed: role.managed,
    position: role.position,
    members: role.members,
    dangerousPermissions: role.dangerousPermissions,
    permissionsCount: role.permissionsCount,
    createdAt: role.createdAt,
  };
}

export function compactOverwrite(ow: PermissionOverwriteSnapshot): Record<string, unknown> {
  return {
    target: ow.targetName,
    type: ow.targetType,
    allow: ow.allow,
    deny: ow.deny,
  };
}

export function compactWebhook(webhook: WebhookSnapshot): Record<string, unknown> {
  return {
    id: webhook.id,
    name: webhook.name,
    channel: webhook.channelName,
    owner: webhook.ownerName || webhook.ownerId,
    ownerBot: webhook.ownerBot,
    createdAt: webhook.createdAt,
  };
}

export function compactBan(ban: BanSnapshot): Record<string, unknown> {
  return { userId: ban.userId, userName: ban.userName, reason: ban.reason };
}
