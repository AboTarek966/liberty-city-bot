// ============================================
// Liberty City Bot - AI Investigator Types
// ============================================
// أنواع مشتركة بين جامع البيانات، محرك التحليل المحلي،
// ومعالج المحقق الذكي. لا تعتمد على Discord أو Mongoose.

export type InvestigationSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type InvestigationCategory =
  | 'permissions'
  | 'bot'
  | 'member'
  | 'account'
  | 'raid'
  | 'message'
  | 'scam'
  | 'webhook'
  | 'invite'
  | 'role'
  | 'channel'
  | 'moderation'
  | 'audit'
  | 'security'
  | 'privacy'
  | 'prompt_injection'
  | 'other';

export type InvestigationSubjectType =
  | 'guild'
  | 'member'
  | 'bot'
  | 'role'
  | 'channel'
  | 'webhook'
  | 'invite'
  | 'message'
  | 'system';

export type InvestigationFindingStatus = 'open' | 'acknowledged' | 'dismissed' | 'resolved';

export type InvestigationTrigger = 'startup' | 'schedule' | 'manual' | 'event' | 'member';

export type InvestigationSource = 'heuristic' | 'ai' | 'merged';

export interface FindingDraft {
  severity: InvestigationSeverity;
  category: InvestigationCategory;
  title: string;
  description: string;
  subjectType: InvestigationSubjectType;
  subjectId?: string;
  subjectName?: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
  source: InvestigationSource;
  fingerprint?: string;
  metadata?: Record<string, unknown>;
}

export interface EventSignal {
  id: string;
  guildId: string;
  type: string;
  at: number;
  severity: InvestigationSeverity;
  summary: string;
  actorId?: string;
  actorName?: string;
  actorBot?: boolean;
  targetId?: string;
  targetName?: string;
  channelId?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageRiskResult {
  severity: InvestigationSeverity;
  categories: InvestigationCategory[];
  reasons: string[];
  flags?: string[];
}

export interface BufferedMessage {
  id: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string;
  authorBot: boolean;
  authorWebhook: boolean;
  createdAt: number;
  content: string;
  attachments: Array<{ name: string; contentType?: string; size?: number }>;
  embeds: number;
  embedTitles: string[];
  stickerNames: string[];
  mentions: number;
  mentionEveryone: boolean;
  mentionHere: boolean;
  linkHosts: string[];
  flags: string[];
}

export interface GuildInfoSnapshot {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  joinedAt?: string;
  memberCount: number;
  humanCount: number;
  botCount: number;
  onlineCount: number;
  verificationLevel: string;
  explicitContentFilter: string;
  mfaLevel: string;
  premiumTier: number;
  preferredLocale: string;
  features: string[];
  description?: string;
  icon?: string;
  banner?: string;
}

export interface RoleSnapshot {
  id: string;
  name: string;
  isEveryone: boolean;
  managed: boolean;
  hoist: boolean;
  mentionable: boolean;
  position: number;
  color: number;
  members: number;
  permissionsCount: number;
  dangerousPermissions: string[];
  createdAt: string;
}

export interface PermissionOverwriteSnapshot {
  targetId: string;
  targetType: 'role' | 'member';
  targetName: string;
  allow: string[];
  deny: string[];
  allowCount: number;
  denyCount: number;
}

export interface ChannelSnapshot {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  parentName?: string;
  position: number;
  nsfw: boolean;
  rateLimitPerUser?: number;
  topic?: string;
  lastMessageAt?: string;
  overwrites: PermissionOverwriteSnapshot[];
}

export interface MemberSnapshot {
  id: string;
  username: string;
  displayName: string;
  bot: boolean;
  createdAt: string;
  joinedAt?: string;
  accountAgeDays: number;
  roles: Array<{ id: string; name: string; position: number }>;
  highestRole?: string;
  dangerousPermissions: string[];
  administrator: boolean;
  manageGuild: boolean;
  timedOutUntil?: string;
  presence?: string;
  hasCustomAvatar: boolean;
  messageCount: number;
  lastMessageAt?: string;
  invitedBy?: string;
}

export interface MessageSnapshot {
  id: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string;
  authorBot: boolean;
  authorWebhook: boolean;
  authorProtected: boolean;
  authorStaff: boolean;
  createdAt: string;
  content: string;
  attachments: Array<{ name: string; contentType?: string; size?: number }>;
  embeds: number;
  embedTitles: string[];
  stickerNames: string[];
  mentions: number;
  mentionEveryone: boolean;
  mentionHere: boolean;
  linkHosts: string[];
  flags: string[];
  riskSeverity?: InvestigationSeverity;
  riskReasons?: string[];
}

export interface AuditLogSnapshot {
  id: string;
  action: string;
  actionType: number;
  executorId?: string;
  executorName?: string;
  executorBot?: boolean;
  targetId?: string;
  targetName?: string;
  targetType?: string;
  reason?: string;
  createdAt: string;
  changes: string[];
}

export interface InviteSnapshot {
  code: string;
  channelId?: string;
  channelName?: string;
  inviterId?: string;
  inviterName?: string;
  uses: number;
  maxUses: number;
  maxAge: number;
  temporary: boolean;
  createdAt?: string;
  expiresAt?: string;
}

export interface WebhookSnapshot {
  id: string;
  name: string;
  channelId?: string;
  channelName?: string;
  ownerId?: string;
  ownerName?: string;
  ownerBot?: boolean;
  sourceGuild?: string;
  sourceChannel?: string;
  type?: string;
  createdAt: string;
}

export interface VoiceStateSnapshot {
  memberId: string;
  memberName: string;
  channelId?: string;
  channelName?: string;
  selfMute: boolean;
  selfDeaf: boolean;
  serverMute: boolean;
  serverDeaf: boolean;
  streaming: boolean;
  video: boolean;
}

export interface ModerationCaseSnapshot {
  caseId: number;
  type: string;
  moderatorId: string;
  targetId: string;
  reason: string;
  active: boolean;
  createdAt: string;
}

export interface WarningSnapshot {
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: string;
}

export interface BanSnapshot {
  userId: string;
  userName: string;
  reason?: string;
}

export interface AutoModRuleSnapshot {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  actions: string[];
}

export interface ThreadSnapshot {
  id: string;
  name: string;
  parentId?: string;
  parentName?: string;
  ownerId?: string;
  archived: boolean;
  locked: boolean;
  memberCount: number;
  messageCount: number;
}

export interface SecuritySnapshot {
  antiNuke: {
    enabled: boolean;
    mode?: string;
    action?: string;
    threshold?: number;
    timeWindow?: number;
  };
  antiBot: { enabled: boolean; whitelist: string[] };
  antiRaid: { enabled: boolean; threshold?: number; action?: string; timeWindow?: number };
  antiSpam: { enabled: boolean };
  antiLink: { enabled: boolean };
  antiInvite: { enabled: boolean };
  antiMention: { enabled: boolean };
  antiAlt: { enabled: boolean; action?: string };
  antiAdmin: { enabled: boolean; action?: string };
  scamFilter: { enabled: boolean };
  autoBackup: { enabled: boolean; interval?: number };
  autoScan: { enabled: boolean; interval?: number };
  lockdown: boolean;
  ownerApproval: boolean;
  mainWhitelist: { enabled: boolean; userIds: string[] };
  trustedBotIds: string[];
  ownerId: string;
  botId: string;
  botTag: string;
  botPermissions: string[];
  verificationLevel: string;
  explicitContentFilter: string;
  mfaLevel: string;
}

export interface MemberAggregates {
  total: number;
  humans: number;
  bots: number;
  admins: number;
  managers: number;
  newAccounts7d: number;
  newAccounts30d: number;
  joined24h: number;
  joined7d: number;
  noRole: number;
  timedOut: number;
  online: number;
  detailedMembers: number;
  omittedMembers: number;
}

export interface MessageStats {
  channelsTotal: number;
  channelsScanned: number;
  messagesScanned: number;
  messagesIncluded: number;
  lookbackHours: number;
  sampled: boolean;
  flagged: number;
  activeAuthors: number;
}

export interface CoverageSection {
  status: 'ok' | 'partial' | 'failed' | 'skipped';
  count?: number;
  note?: string;
}

export interface InvestigationCoverage {
  generatedAt: string;
  durationMs: number;
  sections: Record<string, CoverageSection>;
  truncated: boolean;
}

export interface ModerationSnapshot {
  cases: ModerationCaseSnapshot[];
  warnings: WarningSnapshot[];
}

export interface CommunitySnapshot {
  emojis: Array<{ name: string; animated: boolean }>;
  stickers: Array<{ name: string; description?: string }>;
  scheduledEvents: Array<{ name: string; status: string; startAt?: string }>;
  activeThreads: ThreadSnapshot[];
}

export interface GuildSnapshot {
  guild: GuildInfoSnapshot;
  roles: RoleSnapshot[];
  channels: ChannelSnapshot[];
  members: MemberSnapshot[];
  memberAggregates: MemberAggregates;
  messages: MessageSnapshot[];
  messageStats: MessageStats;
  auditLogs: AuditLogSnapshot[];
  invites: InviteSnapshot[];
  webhooks: WebhookSnapshot[];
  voiceStates: VoiceStateSnapshot[];
  moderation: ModerationSnapshot;
  bans: BanSnapshot[];
  automodRules: AutoModRuleSnapshot[];
  community: CommunitySnapshot;
  security: SecuritySnapshot;
  signals: EventSignal[];
  coverage: InvestigationCoverage;
}

export interface SnapshotOptions {
  includeMessages: boolean;
  lookbackHours: number;
  maxMessagesPerChannel: number;
  maxTextChannels: number;
  maxMembers: number;
  ignoredChannelIds: string[];
  /** عضو محدد يجب ضمان تضمينه في اللقطة (تحقيق فردي) */
  focusMemberId?: string;
}

export interface InvestigationConfig {
  enabled: boolean;
  automatic: boolean;
  scanOnStartup: boolean;
  intervalHours: number;
  alertChannelId?: string;
  minSeverityToAlert: InvestigationSeverity;
  includeMessages: boolean;
  messageLookbackHours: number;
  maxMessagesPerChannel: number;
  maxTextChannels: number;
  maxMembers: number;
  maxFindings: number;
  autoResolveDays: number;
  ignoredChannelIds: string[];
}

export interface AIFindingPayload {
  severity?: string;
  category?: string;
  title?: string;
  description?: string;
  subjectType?: string;
  subjectId?: string;
  subjectName?: string;
  evidence?: unknown;
  recommendation?: string;
  confidence?: number;
}

export interface AIAnalysisPayload {
  overallRisk?: number;
  riskScore?: number;
  summary?: string;
  findings?: AIFindingPayload[];
  observations?: string[];
  positiveSignals?: string[];
  recommendedActions?: string[];
}

export interface InvestigationReport {
  runId: string;
  guildId: string;
  guildName: string;
  trigger: InvestigationTrigger;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  riskScore: number;
  riskLevel: InvestigationSeverity;
  summary: string;
  findings: FindingDraft[];
  counts: Record<InvestigationSeverity, number>;
  model: string;
  tokensUsed: number;
  aiUsed: boolean;
  coverage: InvestigationCoverage;
  deep: boolean;
  focus?: string;
  observations: string[];
  positiveSignals: string[];
  recommendedActions: string[];
  error?: string;
}
