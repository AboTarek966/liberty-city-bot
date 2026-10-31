// ============================================
// Liberty City Bot - Investigator Snapshot Collector
// ============================================
// يجمع صورة شاملة عن السيرفر: الأعضاء، الرتب، القنوات،
// الصلاحيات، الرسائل، سجلات التدقيق، الدعوات، الويب هوكات،
// الحالات الصوتية، سجل الإشراف، إعدادات الحماية... إلخ.
// كل ما يُرسل للذكاء الاصطناعي يمرّ عبر تنقية للبيانات الحساسة.

import {
  AuditLogEvent,
  ChannelType,
  Guild,
  GuildMember,
  Message,
  OverwriteType,
} from 'discord.js';
import { getGuildSettings, ModerationCase, Warning } from '../models';
import {
  BufferedMessage,
  EventSignal,
  GuildSnapshot,
  InvestigationCoverage,
  InvestigationSeverity,
  MessageSnapshot,
  SecuritySnapshot,
  SnapshotOptions,
} from '../types/investigator';
import {
  detectMessageRisk,
  redactSensitiveText,
  severityRank,
} from './investigatorHeuristics';
import { extractUrls } from './helpers';

const TRUSTED_BOT_IDS = ['854233015475109888', '293036868578279425'];

const DANGEROUS_PERMISSION_NAMES = new Set([
  'Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels',
  'ManageWebhooks', 'ManageThreads', 'ManageMessages', 'ManageNicknames',
  'KickMembers', 'BanMembers', 'ModerateMembers', 'MentionEveryone',
  'ManageEmojisAndStickers', 'ManageEvents', 'CreatePublicThreads',
  'CreatePrivateThreads', 'SendTTSMessages', 'ViewAuditLog',
]);

const OVERWRITE_INTEREST = new Set([
  ...DANGEROUS_PERMISSION_NAMES,
  'ViewChannel', 'SendMessages', 'SendMessagesInThreads', 'ReadMessageHistory',
  'AddReactions', 'Connect', 'Speak', 'Stream', 'UseApplicationCommands',
]);

const VERIFICATION_LEVELS = ['None', 'Low', 'Medium', 'High', 'VeryHigh'];
const CONTENT_FILTERS = ['Disabled', 'MembersWithoutRoles', 'AllMembers'];
const MFA_LEVELS = ['None', 'Elevated'];

function iso(date: Date | number | null | undefined): string | undefined {
  if (!date) return undefined;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
}

function daysBetween(now: number, timestamp: number): number {
  return Math.max(0, (now - timestamp) / 86_400_000);
}

function snowflakeDate(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  try {
    const ms = Number((BigInt(id) >> 22n) + 1420070400000n);
    return new Date(ms).toISOString();
  } catch {
    return undefined;
  }
}

function shortValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value.slice(0, 140);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const obj = value as any;
    if (obj.tag) return String(obj.tag).slice(0, 140);
    if (obj.name) return String(obj.name).slice(0, 140);
    if (obj.id) return String(obj.id);
    try {
      return JSON.stringify(obj).slice(0, 180);
    } catch {
      return '[object]';
    }
  }
  return String(value).slice(0, 180);
}

function extractHosts(content: string): string[] {
  const hosts = new Set<string>();
  for (const raw of extractUrls(content || '')) {
    try {
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (url.hostname) hosts.add(url.hostname.toLowerCase());
    } catch {
      // تجاهل الروابط غير الصالحة
    }
  }
  return [...hosts].slice(0, 10);
}

function isStaffMember(member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  try {
    return (
      member.permissions.has('Administrator') ||
      member.permissions.has('ManageGuild') ||
      member.permissions.has('ManageChannels') ||
      member.permissions.has('ManageRoles') ||
      member.permissions.has('ManageWebhooks') ||
      member.permissions.has('KickMembers') ||
      member.permissions.has('BanMembers')
    );
  } catch {
    return false;
  }
}

function section(
  coverage: InvestigationCoverage,
  name: string,
  status: 'ok' | 'partial' | 'failed' | 'skipped',
  count?: number,
  note?: string
): void {
  coverage.sections[name] = { status, count, note };
}

// --------------------------------------------
// Security snapshot (reusable by investigator + focused scans)
// --------------------------------------------
export function buildSecuritySnapshot(guild: Guild, settings: any): SecuritySnapshot {
  const prot = settings?.protection || {};
  const me = guild.members.me;
  return {
    antiNuke: {
      enabled: !!prot.antiNuke?.enabled,
      mode: prot.antiNuke?.mode,
      action: prot.antiNuke?.action,
      threshold: prot.antiNuke?.threshold,
      timeWindow: prot.antiNuke?.timeWindow,
    },
    antiBot: {
      enabled: !!prot.antiBot?.enabled,
      whitelist: Array.isArray(prot.antiBot?.whitelist) ? prot.antiBot.whitelist.map(String) : [],
    },
    antiRaid: {
      enabled: !!prot.antiRaid?.enabled,
      threshold: prot.antiRaid?.threshold,
      action: prot.antiRaid?.action,
      timeWindow: prot.antiRaid?.timeWindow,
    },
    antiSpam: { enabled: !!prot.antiSpam?.enabled },
    antiLink: { enabled: !!prot.antiLink?.enabled },
    antiInvite: { enabled: !!prot.antiInvite?.enabled },
    antiMention: { enabled: !!prot.antiMention?.enabled },
    antiAlt: { enabled: !!prot.antiAlt?.enabled, action: prot.antiAlt?.action },
    antiAdmin: { enabled: !!prot.antiAdmin?.enabled, action: prot.antiAdmin?.action },
    scamFilter: { enabled: !!prot.scamFilter?.enabled },
    autoBackup: { enabled: !!prot.autoBackup?.enabled, interval: prot.autoBackup?.interval },
    autoScan: { enabled: !!prot.autoScan?.enabled, interval: prot.autoScan?.interval },
    lockdown: !!prot.lockdown,
    ownerApproval: !!prot.ownerApproval,
    mainWhitelist: {
      enabled: !!prot.whitelist?.enabled,
      userIds: Array.isArray(prot.whitelist?.userIds) ? prot.whitelist.userIds.map(String) : [],
    },
    trustedBotIds: TRUSTED_BOT_IDS,
    ownerId: guild.ownerId,
    botId: guild.client.user?.id || '',
    botTag: guild.client.user?.tag || '',
    botPermissions: me?.permissions.toArray() || [],
    verificationLevel: VERIFICATION_LEVELS[guild.verificationLevel] || String(guild.verificationLevel),
    explicitContentFilter: CONTENT_FILTERS[guild.explicitContentFilter] || String(guild.explicitContentFilter),
    mfaLevel: MFA_LEVELS[guild.mfaLevel] || String(guild.mfaLevel),
  };
}

// --------------------------------------------
// Message conversion
// --------------------------------------------
export function messageToSnapshot(
  message: Message,
  channelName: string,
  protectedIds: Set<string>
): MessageSnapshot {
  const content = message.content || '';
  const risk = detectMessageRisk(content, {
    mentions: message.mentions?.users?.size || 0,
    mentionEveryone: message.mentions?.everyone || false,
    mentionHere: /<@here>/i.test(content) || (message.mentions as any)?.here === true,
    authorIsStaff: isStaffMember(message.member),
    authorBot: message.author?.bot || false,
    authorWebhook: !!message.webhookId,
    embedTitles: message.embeds?.map((e) => e.title || '').filter(Boolean) || [],
    linkHosts: extractHosts(content),
  });

  return {
    id: message.id,
    channelId: message.channelId,
    channelName,
    authorId: message.author?.id || 'unknown',
    authorName: message.member?.displayName || message.author?.username || 'unknown',
    authorBot: !!message.author?.bot,
    authorWebhook: !!message.webhookId,
    authorProtected: !!message.author && protectedIds.has(message.author.id),
    authorStaff: isStaffMember(message.member),
    createdAt: new Date(message.createdTimestamp).toISOString(),
    content: redactSensitiveText(content).slice(0, 500),
    attachments: [...message.attachments.values()].slice(0, 6).map((a) => ({
      name: String(a.name || '').slice(0, 120),
      contentType: a.contentType || undefined,
      size: a.size || undefined,
    })),
    embeds: message.embeds?.length || 0,
    embedTitles: (message.embeds || [])
      .map((e) => String(e.title || '').slice(0, 140))
      .filter(Boolean)
      .slice(0, 5),
    stickerNames: [...(message.stickers?.values?.() || [])].slice(0, 5).map((s) => String(s.name || '')),
    mentions: message.mentions?.users?.size || 0,
    mentionEveryone: !!message.mentions?.everyone,
    mentionHere: /<@here>/i.test(content) || (message.mentions as any)?.here === true,
    linkHosts: extractHosts(content),
    flags: risk.flags,
    riskSeverity: risk.severity,
    riskReasons: risk.reasons,
  };
}

function bufferedToSnapshot(
  message: BufferedMessage,
  protectedIds: Set<string>
): MessageSnapshot {
  const risk = detectMessageRisk(message.content, {
    mentions: message.mentions,
    mentionEveryone: message.mentionEveryone,
    mentionHere: message.mentionHere,
    authorBot: message.authorBot,
    authorWebhook: message.authorWebhook,
    embedTitles: message.embedTitles,
    linkHosts: message.linkHosts,
  });
  return {
    ...message,
    authorProtected: protectedIds.has(message.authorId),
    authorStaff: false,
    createdAt: new Date(message.createdAt).toISOString(),
    content: redactSensitiveText(message.content).slice(0, 500),
    riskSeverity: risk.severity,
    riskReasons: risk.reasons,
    flags: [...new Set([...(message.flags || []), ...risk.flags])].slice(0, 10),
  };
}

// --------------------------------------------
// Main collector
// --------------------------------------------
export async function collectGuildSnapshot(
  guild: Guild,
  options: SnapshotOptions,
  extra: {
    settings?: any;
    signals?: EventSignal[];
    bufferedMessages?: BufferedMessage[];
    protectedIds?: Set<string>;
  } = {}
): Promise<GuildSnapshot> {
  // أعِد تثبيت توكن REST قبل أي طلب شبكي — المكتبة تمسحه عند 401 عابر.
  if (guild.client.token) guild.client.rest.setToken(guild.client.token);

  const startedAt = Date.now();
  const now = Date.now();
  const settings = extra.settings || (await getGuildSettings(guild.id));
  const coverage: InvestigationCoverage = {
    generatedAt: new Date(now).toISOString(),
    durationMs: 0,
    sections: {},
    truncated: false,
  };

  const protectedIds = extra.protectedIds || new Set<string>();
  protectedIds.add(guild.ownerId);
  if (guild.client.user?.id) protectedIds.add(guild.client.user.id);
  if (process.env.DEVELOPER_USER_ID) protectedIds.add(process.env.DEVELOPER_USER_ID);
  for (const id of TRUSTED_BOT_IDS) protectedIds.add(id);

  // ---------- Members ----------
  let memberCollection = guild.members.cache;
  let membersStatus: 'ok' | 'partial' | 'failed' = 'ok';
  let membersNote: string | undefined;
  if (memberCollection.size < guild.memberCount) {
    try {
      memberCollection = await guild.members.fetch();
    } catch (error: any) {
      membersStatus = 'partial';
      membersNote = `تعذر جلب كل الأعضاء: ${String(error?.message || error).slice(0, 160)}`;
    }
  }
  const allMembers = [...memberCollection.values()];
  if (!allMembers.length) membersStatus = 'failed';

  const messageStatsByAuthor = new Map<string, { count: number; lastAt: number }>();
  const allProtectedIds = new Set(protectedIds);

  const priority = (member: GuildMember): number => {
    let score = 0;
    if (member.id === guild.ownerId) score += 500;
    if (member.user.bot) score += 250;
    try {
      if (member.permissions.has('Administrator')) score += 180;
      if (member.permissions.has('ManageGuild')) score += 100;
      if (member.permissions.has('ManageRoles') || member.permissions.has('ManageChannels')) score += 60;
      if (member.permissions.has('BanMembers') || member.permissions.has('KickMembers')) score += 40;
    } catch {
      // تجاهل
    }
    const age = daysBetween(now, member.user.createdTimestamp);
    if (age <= 7) score += 70;
    else if (age <= 30) score += 30;
    if (member.joinedTimestamp && daysBetween(now, member.joinedTimestamp) <= 1) score += 40;
    if (!member.user.avatar) score += 10;
    return score;
  };

  const selectedMembers = [...allMembers]
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, Math.max(50, options.maxMembers));

  // التحقيق الفردي: نضمن وجود العضو المستهدف حتى لو لم يدخل ضمن الأولويات
  if (options.focusMemberId) {
    const focused = allMembers.find((m) => m.id === options.focusMemberId);
    if (focused && !selectedMembers.some((m) => m.id === focused.id)) {
      if (selectedMembers.length >= Math.max(50, options.maxMembers)) selectedMembers.pop();
      selectedMembers.unshift(focused);
    }
  }

  const members = selectedMembers.map((member) => {
    const perms = member.permissions.toArray();
    const dangerous = perms.filter((p) => DANGEROUS_PERMISSION_NAMES.has(p));
    const roles = member.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, position: r.position }));
    const activity = messageStatsByAuthor.get(member.id);
    return {
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      bot: member.user.bot,
      createdAt: new Date(member.user.createdTimestamp).toISOString(),
      joinedAt: iso(member.joinedTimestamp),
      accountAgeDays: daysBetween(now, member.user.createdTimestamp),
      roles,
      highestRole: roles[0]?.name,
      dangerousPermissions: dangerous,
      administrator: perms.includes('Administrator'),
      manageGuild: perms.includes('ManageGuild'),
      timedOutUntil: iso(member.communicationDisabledUntilTimestamp),
      presence: member.presence?.status || undefined,
      hasCustomAvatar: !!member.user.avatar,
      messageCount: activity?.count || 0,
      lastMessageAt: activity?.lastAt ? new Date(activity.lastAt).toISOString() : undefined,
      invitedBy: undefined,
    };
  });

  const adminCount = allMembers.filter((m) => {
    try { return m.permissions.has('Administrator'); } catch { return false; }
  }).length;
  const managerCount = allMembers.filter((m) => {
    try { return m.permissions.has('ManageGuild'); } catch { return false; }
  }).length;

  // ---------- Roles ----------
  const roles = guild.roles.cache
    .sort((a, b) => b.position - a.position)
    .map((role) => {
      const allPerms = role.permissions.toArray();
      const dangerous = allPerms.filter((p) => DANGEROUS_PERMISSION_NAMES.has(p));
      const membersCount = role.id === guild.id
        ? allMembers.length
        : allMembers.filter((m) => m.roles.cache.has(role.id)).length;
      return {
        id: role.id,
        name: role.name,
        isEveryone: role.id === guild.id,
        managed: role.managed,
        hoist: role.hoist,
        mentionable: role.mentionable,
        position: role.position,
        color: role.color,
        members: membersCount,
        permissionsCount: allPerms.length,
        dangerousPermissions: dangerous,
        createdAt: new Date(role.createdTimestamp).toISOString(),
      };
    });
  section(coverage, 'roles', 'ok', roles.length);

  // ---------- Channels ----------
  const ignored = new Set(options.ignoredChannelIds || []);
  const channelSnapshots = guild.channels.cache
    .filter((channel) => !ignored.has(channel.id))
    .map((channel) => {
      const overwrites = ((channel as any).permissionOverwrites?.cache || []).map((ow: any) => {
        const targetType: 'role' | 'member' = ow.type === OverwriteType.Role ? 'role' : 'member';
        const targetName = targetType === 'role'
          ? (guild.roles.cache.get(ow.id)?.name || 'رول غير معروف')
          : (guild.members.cache.get(ow.id)?.displayName || guild.client.users.cache.get(ow.id)?.username || 'عضو غير معروف');
        const allow = ow.allow.toArray().filter((p: string) => OVERWRITE_INTEREST.has(p));
        const deny = ow.deny.toArray().filter((p: string) => OVERWRITE_INTEREST.has(p));
        return {
          targetId: ow.id,
          targetType,
          targetName,
          allow,
          deny,
          allowCount: ow.allow.toArray().length,
          denyCount: ow.deny.toArray().length,
        };
      });

      const lastMessageId = (channel as any).lastMessageId as string | null | undefined;
      return {
        id: channel.id,
        name: channel.name,
        type: String(ChannelType[channel.type] ?? channel.type),
        parentId: channel.parentId || undefined,
        parentName: channel.parent?.name || undefined,
        position: 'position' in channel ? Number((channel as any).position) : 0,
        nsfw: 'nsfw' in channel ? Boolean((channel as any).nsfw) : false,
        rateLimitPerUser: 'rateLimitPerUser' in channel ? Number((channel as any).rateLimitPerUser) : undefined,
        topic: 'topic' in channel ? String((channel as any).topic || '').slice(0, 300) || undefined : undefined,
        lastMessageAt: snowflakeDate(lastMessageId),
        overwrites,
      };
    });
  section(coverage, 'channels', 'ok', channelSnapshots.length);

  // ---------- Messages ----------
  const messages: MessageSnapshot[] = [];
  let messagesScanned = 0;
  let channelsScanned = 0;
  const textChannels = guild.channels.cache
    .filter((channel) => {
      if (ignored.has(channel.id)) return false;
      if (!channel.isTextBased()) return false;
      const type = channel.type;
      return (
        type === ChannelType.GuildText ||
        type === ChannelType.GuildAnnouncement ||
        type === ChannelType.PublicThread ||
        type === ChannelType.PrivateThread ||
        type === ChannelType.AnnouncementThread
      );
    })
    .sort((a, b) => {
      const ta = snowflakeDate((a as any).lastMessageId);
      const tb = snowflakeDate((b as any).lastMessageId);
      return (tb ? Date.parse(tb) : 0) - (ta ? Date.parse(ta) : 0);
    })
    .first(Math.max(1, options.maxTextChannels));

  const cutoff = now - Math.max(1, options.lookbackHours) * 60 * 60 * 1000;

  if (options.includeMessages && textChannels.length) {
    for (const channel of textChannels) {
      try {
        const collection = await (channel as any).messages.fetch({
          limit: Math.max(5, Math.min(100, options.maxMessagesPerChannel)),
        });
        channelsScanned++;
        for (const message of collection.values()) {
          if (message.createdTimestamp < cutoff) continue;
          messagesScanned++;
          const snapshot = messageToSnapshot(message, channel.name, allProtectedIds);
          messages.push(snapshot);
          const activity = messageStatsByAuthor.get(snapshot.authorId) || { count: 0, lastAt: 0 };
          activity.count++;
          activity.lastAt = Math.max(activity.lastAt, message.createdTimestamp);
          messageStatsByAuthor.set(snapshot.authorId, activity);
        }
      } catch (error: any) {
        section(coverage, `messages:${channel.id}`, 'failed', undefined, String(error?.message || error).slice(0, 120));
      }
      // لطف مع Discord API
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  if (options.includeMessages && extra.bufferedMessages?.length) {
    const seen = new Set(messages.map((m) => m.id));
    for (const buffered of extra.bufferedMessages) {
      if (buffered.createdAt < cutoff || seen.has(buffered.id)) continue;
      if (ignored.has(buffered.channelId)) continue;
      const snapshot = bufferedToSnapshot(buffered, allProtectedIds);
      messages.push(snapshot);
      seen.add(buffered.id);
      const activity = messageStatsByAuthor.get(snapshot.authorId) || { count: 0, lastAt: 0 };
      activity.count++;
      activity.lastAt = Math.max(activity.lastAt, buffered.createdAt);
      messageStatsByAuthor.set(snapshot.authorId, activity);
    }
  }

  // أولوية الرسائل المشبوهة ثم الأحدث
  const flagged = messages
    .filter((m) => severityRank(m.riskSeverity || 'info') >= severityRank('medium'))
    .sort((a, b) => {
      const diff = severityRank(b.riskSeverity || 'info') - severityRank(a.riskSeverity || 'info');
      if (diff) return diff;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  const recent = messages
    .filter((m) => !flagged.includes(m))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const maxTotalMessages = 900;
  let includedMessages = [...flagged.slice(0, 450), ...recent.slice(0, Math.max(0, maxTotalMessages - Math.min(450, flagged.length)))];
  if (includedMessages.length > maxTotalMessages) includedMessages = includedMessages.slice(0, maxTotalMessages);
  if (includedMessages.length < messages.length) {
    coverage.truncated = true;
    section(coverage, 'messages', 'partial', includedMessages.length,
      `تم فحص ${messages.length} رسالة واختيار ${includedMessages.length} (المشبوهة أولاً ثم الأحدث).`);
  } else {
    section(coverage, 'messages', options.includeMessages ? 'ok' : 'skipped', includedMessages.length);
  }

  // حدّث عدّادات الرسائل في لقطات الأعضاء
  for (const member of members) {
    const activity = messageStatsByAuthor.get(member.id);
    if (activity) {
      member.messageCount = activity.count;
      member.lastMessageAt = new Date(activity.lastAt).toISOString();
    }
  }

  // ---------- Audit logs ----------
  const auditLogs: GuildSnapshot['auditLogs'] = [];
  try {
    const logs = await guild.fetchAuditLogs({ limit: 100 });
    for (const entry of logs.entries.values()) {
      const target: any = entry.target;
      auditLogs.push({
        id: entry.id,
        action: String(AuditLogEvent[entry.action] ?? entry.action),
        actionType: Number(entry.action),
        executorId: entry.executor?.id,
        executorName: entry.executor ? String((entry.executor as any).tag || entry.executor.username || '') : undefined,
        executorBot: entry.executor?.bot,
        targetId: target?.id,
        targetName: target?.tag || target?.name || target?.username || target?.id,
        targetType: entry.targetType ? String(entry.targetType) : undefined,
        reason: entry.reason ? String(entry.reason).slice(0, 300) : undefined,
        createdAt: entry.createdAt.toISOString(),
        changes: (entry.changes || []).slice(0, 6).map((change: any) => {
          return `${String(change.key)}: ${shortValue(change.old)} -> ${shortValue(change.new)}`.slice(0, 400);
        }),
      });
    }
    section(coverage, 'auditLogs', 'ok', auditLogs.length);
  } catch (error: any) {
    section(coverage, 'auditLogs', 'failed', undefined, String(error?.message || error).slice(0, 160));
  }

  // ---------- Invites ----------
  const invites: GuildSnapshot['invites'] = [];
  try {
    const fetched = await guild.invites.fetch();
    for (const invite of fetched.values()) {
      invites.push({
        code: invite.code,
        channelId: invite.channelId || undefined,
        channelName: (invite.channel as any)?.name || undefined,
        inviterId: invite.inviter?.id,
        inviterName: invite.inviter ? (invite.inviter.tag || invite.inviter.username) : undefined,
        uses: invite.uses || 0,
        maxUses: invite.maxUses || 0,
        maxAge: invite.maxAge || 0,
        temporary: !!invite.temporary,
        createdAt: iso(invite.createdAt),
        expiresAt: iso(invite.expiresAt),
      });
    }
    section(coverage, 'invites', 'ok', invites.length);
  } catch (error: any) {
    section(coverage, 'invites', 'failed', undefined, String(error?.message || error).slice(0, 160));
  }

  // ---------- Webhooks ----------
  const webhooks: GuildSnapshot['webhooks'] = [];
  try {
    const fetched = await guild.fetchWebhooks();
    for (const hook of fetched.values()) {
      webhooks.push({
        id: hook.id,
        name: hook.name || 'بدون اسم',
        channelId: hook.channelId || undefined,
        channelName: (hook.channel as any)?.name || undefined,
        ownerId: hook.owner?.id,
        ownerName: hook.owner ? String((hook.owner as any).tag || hook.owner.username || '') : undefined,
        ownerBot: hook.owner?.bot,
        sourceGuild: hook.sourceGuild?.name || undefined,
        sourceChannel: hook.sourceChannel?.name || undefined,
        type: hook.type ? String(hook.type) : undefined,
        createdAt: hook.createdAt ? hook.createdAt.toISOString() : new Date(now).toISOString(),
      });
    }
    section(coverage, 'webhooks', 'ok', webhooks.length);
  } catch (error: any) {
    section(coverage, 'webhooks', 'failed', undefined, String(error?.message || error).slice(0, 160));
  }

  // ---------- Voice states ----------
  const voiceStates: GuildSnapshot['voiceStates'] = guild.voiceStates.cache.map((vs) => ({
    memberId: vs.id,
    memberName: vs.member?.displayName || guild.members.cache.get(vs.id)?.displayName || vs.id,
    channelId: vs.channelId || undefined,
    channelName: vs.channel?.name || undefined,
    selfMute: !!vs.selfMute,
    selfDeaf: !!vs.selfDeaf,
    serverMute: !!vs.serverMute,
    serverDeaf: !!vs.serverDeaf,
    streaming: !!vs.streaming,
    video: !!vs.selfVideo,
  }));
  section(coverage, 'voiceStates', 'ok', voiceStates.length);

  // ---------- Moderation history ----------
  let cases: any[] = [];
  let warnings: any[] = [];
  try {
    cases = await ModerationCase.find({ guildId: guild.id })
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();
    warnings = await Warning.find({ guildId: guild.id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    section(coverage, 'moderation', 'ok', cases.length + warnings.length);
  } catch (error: any) {
    section(coverage, 'moderation', 'failed', undefined, String(error?.message || error).slice(0, 160));
  }

  // ---------- Bans ----------
  const bans: GuildSnapshot['bans'] = [];
  try {
    const fetched = await guild.bans.fetch({ limit: 100 });
    for (const ban of fetched.values()) {
      bans.push({
        userId: ban.user.id,
        userName: ban.user.tag || ban.user.username,
        reason: ban.reason || undefined,
      });
    }
    section(coverage, 'bans', 'ok', bans.length);
  } catch (error: any) {
    section(coverage, 'bans', 'failed', undefined, String(error?.message || error).slice(0, 160));
  }

  // ---------- Discord AutoMod ----------
  const automodRules: GuildSnapshot['automodRules'] = [];
  try {
    const fetched = await guild.autoModerationRules.fetch();
    for (const rule of fetched.values()) {
      automodRules.push({
        id: rule.id,
        name: rule.name,
        enabled: !!rule.enabled,
        triggerType: String(rule.triggerType),
        actions: (rule.actions || []).map((a: any) => String(a.type)),
      });
    }
    section(coverage, 'automod', 'ok', automodRules.length);
  } catch (error: any) {
    section(coverage, 'automod', 'failed', undefined, String(error?.message || error).slice(0, 160));
  }

  // ---------- Community extras ----------
  const emojis = guild.emojis.cache.map((e) => ({ name: e.name || '', animated: !!e.animated })).slice(0, 100);
  const stickers = guild.stickers.cache.map((s) => ({
    name: s.name,
    description: s.description || undefined,
  })).slice(0, 100);
  const scheduledEvents = guild.scheduledEvents.cache.map((e) => ({
    name: e.name,
    status: String(e.status),
    startAt: iso(e.scheduledStartAt),
  })).slice(0, 50);

  const activeThreads: GuildSnapshot['community']['activeThreads'] = [];
  try {
    const fetched = await guild.channels.fetchActiveThreads();
    for (const thread of fetched.threads.values()) {
      activeThreads.push({
        id: thread.id,
        name: thread.name,
        parentId: thread.parentId || undefined,
        parentName: thread.parent?.name || undefined,
        ownerId: thread.ownerId || undefined,
        archived: !!thread.archived,
        locked: !!thread.locked,
        memberCount: thread.memberCount || 0,
        messageCount: Number((thread as any).messageCount || 0),
      });
    }
    section(coverage, 'threads', 'ok', activeThreads.length);
  } catch (error: any) {
    section(coverage, 'threads', 'failed', undefined, String(error?.message || error).slice(0, 160));
  }

  // ---------- Security settings ----------
  const security: GuildSnapshot['security'] = buildSecuritySnapshot(guild, settings);
  section(coverage, 'security', 'ok');

  coverage.durationMs = Date.now() - startedAt;
  coverage.truncated = coverage.truncated || selectedMembers.length < allMembers.length;

  const guildInfo: GuildSnapshot['guild'] = {
    id: guild.id,
    name: guild.name,
    ownerId: guild.ownerId,
    createdAt: guild.createdAt.toISOString(),
    joinedAt: guild.members.me?.joinedAt?.toISOString(),
    memberCount: guild.memberCount,
    humanCount: allMembers.filter((m) => !m.user.bot).length,
    botCount: allMembers.filter((m) => m.user.bot).length,
    onlineCount: allMembers.filter((m) => m.presence && m.presence.status !== 'offline').length,
    verificationLevel: security.verificationLevel,
    explicitContentFilter: security.explicitContentFilter,
    mfaLevel: security.mfaLevel,
    premiumTier: guild.premiumTier,
    preferredLocale: guild.preferredLocale,
    features: [...guild.features].slice(0, 20),
    description: guild.description || undefined,
    icon: guild.icon || undefined,
    banner: guild.banner || undefined,
  };

  const snapshot: GuildSnapshot = {
    guild: guildInfo,
    roles,
    channels: channelSnapshots,
    members,
    memberAggregates: {
      total: guild.memberCount,
      humans: allMembers.filter((m) => !m.user.bot).length,
      bots: allMembers.filter((m) => m.user.bot).length,
      admins: adminCount,
      managers: managerCount,
      newAccounts7d: allMembers.filter((m) => daysBetween(now, m.user.createdTimestamp) <= 7).length,
      newAccounts30d: allMembers.filter((m) => daysBetween(now, m.user.createdTimestamp) <= 30).length,
      joined24h: allMembers.filter((m) => m.joinedTimestamp && daysBetween(now, m.joinedTimestamp) <= 1).length,
      joined7d: allMembers.filter((m) => m.joinedTimestamp && daysBetween(now, m.joinedTimestamp) <= 7).length,
      noRole: allMembers.filter((m) => m.roles.cache.size <= 1).length,
      timedOut: allMembers.filter((m) => !!m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > now).length,
      online: allMembers.filter((m) => m.presence && m.presence.status !== 'offline').length,
      detailedMembers: selectedMembers.length,
      omittedMembers: Math.max(0, allMembers.length - selectedMembers.length),
    },
    messages: includedMessages,
    messageStats: {
      channelsTotal: textChannels.length,
      channelsScanned,
      messagesScanned,
      messagesIncluded: includedMessages.length,
      lookbackHours: options.lookbackHours,
      sampled: channelsScanned < textChannels.length || messagesScanned > includedMessages.length,
      flagged: includedMessages.filter((m) => severityRank(m.riskSeverity || 'info') >= severityRank('medium')).length,
      activeAuthors: new Set(includedMessages.map((m) => m.authorId)).size,
    },
    auditLogs,
    invites,
    webhooks,
    voiceStates,
    moderation: {
      cases: cases.map((c: any) => ({
        caseId: Number(c.caseId) || 0,
        type: String(c.type || ''),
        moderatorId: String(c.moderatorId || ''),
        targetId: String(c.targetId || ''),
        reason: String(c.reason || '').slice(0, 300),
        active: c.active !== false,
        createdAt: iso(c.createdAt) || new Date(now).toISOString(),
      })),
      warnings: warnings.map((w: any) => ({
        userId: String(w.userId || ''),
        moderatorId: String(w.moderatorId || ''),
        reason: String(w.reason || '').slice(0, 300),
        createdAt: iso(w.createdAt) || new Date(now).toISOString(),
      })),
    },
    bans,
    automodRules,
    community: { emojis, stickers, scheduledEvents, activeThreads },
    security,
    signals: extra.signals || [],
    coverage,
  };

  section(coverage, 'members', membersStatus, selectedMembers.length, membersNote);
  coverage.durationMs = Date.now() - startedAt;
  coverage.truncated = coverage.truncated || selectedMembers.length < allMembers.length;
  snapshot.coverage = coverage;

  return snapshot;
}

export { TRUSTED_BOT_IDS };
