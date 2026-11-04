// ============================================
// Liberty City Bot - AI Ticket Action Executor
// ============================================
// ينفّذ إجراءات مساعد التذاكر مع فحص الهرمية والصلاحيات.
// مشترك بين التنفيذ التلقائي وبين أزرار موافقة الإدارة.

import {
  Client,
  Guild,
  GuildMember,
  Role,
  ChannelType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { getGuildSettings } from '../models';
import { createLogger, parseDuration } from './helpers';

const logger = createLogger('AITicketActions');

export interface TicketAction {
  type:
    | 'give_role'
    | 'remove_role'
    | 'create_channel'
    | 'modify_permissions'
    | 'check_settings'
    | 'restore_backup'
    | 'ban_user'
    | 'timeout_user'
    | 'custom';
  description: string;
  params: Record<string, any>;
  requiresAdminApproval: boolean;
  targetUserId?: string;
  targetRoleId?: string;
}

export interface ActionContext {
  ticketUserId?: string;
  ticketChannelId?: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

const ROLE_ACTIONS = new Set(['give_role', 'remove_role']);
const PERMISSION_ACTIONS = new Set(['modify_permissions', 'create_channel']);
const PUNISH_ACTIONS = new Set(['ban_user', 'timeout_user']);

export function normalizeId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  const match = raw.match(/(\d{17,20})/);
  return match ? match[1] : undefined;
}

function resolveRole(guild: Guild, action: TicketAction): Role | null {
  const id =
    normalizeId(action.targetRoleId) ||
    normalizeId(action.params?.roleId) ||
    normalizeId(action.params?.role);
  if (id) {
    const byId = guild.roles.cache.get(id);
    if (byId) return byId;
  }

  const name = action.params?.roleName || action.params?.role_name;
  if (typeof name === 'string' && name.trim()) {
    const clean = name.replace(/^@/, '').trim().toLowerCase();
    return guild.roles.cache.find(role => role.name.toLowerCase() === clean) || null;
  }
  return null;
}

async function resolveMember(
  guild: Guild,
  action: TicketAction,
  context: ActionContext
): Promise<GuildMember | null> {
  const id =
    normalizeId(action.targetUserId) ||
    normalizeId(action.params?.userId) ||
    normalizeId(action.params?.memberId) ||
    normalizeId(action.params?.user) ||
    normalizeId(context.ticketUserId);

  if (id) {
    const member = guild.members.cache.get(id) || (await guild.members.fetch(id).catch(() => null));
    if (member) return member;
  }

  const username = action.params?.username || action.params?.userName;
  if (typeof username === 'string' && username.trim()) {
    const clean = username.replace(/^@/, '').trim().toLowerCase();
    return (
      guild.members.cache.find(
        member =>
          member.user.username.toLowerCase() === clean ||
          member.displayName.toLowerCase() === clean ||
          member.user.tag.toLowerCase() === clean
      ) || null
    );
  }

  return null;
}

function resolveChannel(guild: Guild, action: TicketAction, context: ActionContext) {
  const id =
    normalizeId(action.params?.channelId) ||
    normalizeId(action.params?.channel) ||
    normalizeId(context.ticketChannelId);
  if (id) {
    const channel = guild.channels.cache.get(id);
    if (channel) return channel;
  }

  const name = action.params?.channelName || action.params?.channel_name;
  if (typeof name === 'string' && name.trim()) {
    const clean = name.replace(/^#/, '').trim().toLowerCase();
    return guild.channels.cache.find(channel => channel.name.toLowerCase() === clean) || null;
  }
  return null;
}

function botCanManageRole(guild: Guild, role: Role): boolean {
  const me = guild.members.me;
  if (!me) return false;
  if (role.id === guild.id) return false;
  if (role.managed) return false;
  return me.roles.highest.position > role.position && me.permissions.has(PermissionFlagsBits.ManageRoles);
}

function botOutranks(guild: Guild, member: GuildMember): boolean {
  const me = guild.members.me;
  if (!me) return false;
  if (member.id === guild.ownerId) return false;
  if (member.id === me.id) return false;
  return me.roles.highest.position > member.roles.highest.position;
}

function clampTimeoutMs(value: unknown): number {
  let ms = 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    // قيم صغيرة تُفهم كدقائق (10 = 10 دقائق)، والقيم الكبيرة كمللي ثانية
    ms = value < 10_000 ? value * 60_000 : value;
  } else if (typeof value === 'string' && value.trim()) {
    const parsed = parseDuration(value.trim());
    if (parsed) ms = parsed;
  }
  if (!ms) ms = 10 * 60_000;
  return Math.min(28 * 24 * 60 * 60 * 1000, Math.max(60_000, Math.trunc(ms)));
}

// --------------------------------------------
// Approval requirements
// --------------------------------------------
export function actionNeedsApproval(
  action: TicketAction,
  config: {
    requireAdminApprovalForRoles?: boolean;
    requireAdminApprovalForPermissions?: boolean;
    requireAdminApprovalForBans?: boolean;
  }
): boolean {
  if (action.requiresAdminApproval) return true;
  if (ROLE_ACTIONS.has(action.type) && config.requireAdminApprovalForRoles !== false) return true;
  if (PERMISSION_ACTIONS.has(action.type) && config.requireAdminApprovalForPermissions !== false) return true;
  if (PUNISH_ACTIONS.has(action.type) && config.requireAdminApprovalForBans !== false) return true;
  if (action.type === 'restore_backup') return true;
  return false;
}

// --------------------------------------------
// Executor
// --------------------------------------------
export async function executeTicketAction(
  client: Client,
  guild: Guild,
  action: TicketAction,
  context: ActionContext = {}
): Promise<ActionResult> {
  try {
    const reason = `AI Ticket Assistant: ${action.description || action.type}`.slice(0, 500);

    switch (action.type) {
      case 'give_role': {
        const role = resolveRole(guild, action);
        const member = await resolveMember(guild, action, context);
        if (!role) return { ok: false, message: '❌ الرول المطلوب غير موجود' };
        if (!member) return { ok: false, message: '❌ العضو المستهدف غير موجود' };
        if (!botCanManageRole(guild, role)) {
          return { ok: false, message: `❌ لا أستطيع إدارة ${role} — تحقق من ترتيب الرتب` };
        }
        if (member.roles.cache.has(role.id)) {
          return { ok: true, message: `ℹ️ ${member} يملك ${role} بالفعل` };
        }
        await member.roles.add(role, reason);
        return { ok: true, message: `✅ تم إعطاء ${role} إلى ${member}` };
      }

      case 'remove_role': {
        const role = resolveRole(guild, action);
        const member = await resolveMember(guild, action, context);
        if (!role) return { ok: false, message: '❌ الرول المطلوب غير موجود' };
        if (!member) return { ok: false, message: '❌ العضو المستهدف غير موجود' };
        if (!botCanManageRole(guild, role)) {
          return { ok: false, message: `❌ لا أستطيع إدارة ${role} — تحقق من ترتيب الرتب` };
        }
        if (!member.roles.cache.has(role.id)) {
          return { ok: true, message: `ℹ️ ${member} لا يملك ${role} أصلاً` };
        }
        await member.roles.remove(role, reason);
        return { ok: true, message: `✅ تم إزالة ${role} من ${member}` };
      }

      case 'create_channel': {
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return { ok: false, message: '❌ لا أملك صلاحية إدارة القنوات' };
        }

        const rawType = String(action.params?.type || 'text').toUpperCase();
        const type =
          rawType.includes('VOICE') || rawType === '2'
            ? ChannelType.GuildVoice
            : rawType.includes('CATEGORY') || rawType === '4'
              ? ChannelType.GuildCategory
              : ChannelType.GuildText;

        const name = String(action.params?.name || 'ai-channel')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\-_ ]/gu, '')
          .trim()
          .slice(0, 90) || 'ai-channel';

        const parentId =
          normalizeId(action.params?.parentId) ||
          normalizeId(action.params?.categoryId) ||
          undefined;
        const parent = parentId ? guild.channels.cache.get(parentId) : null;

        const channel = await guild.channels.create({
          name,
          type,
          parent: parent && parent.type === ChannelType.GuildCategory ? parent.id : undefined,
          reason,
        });

        return { ok: true, message: `✅ تم إنشاء القناة ${channel}` };
      }

      case 'modify_permissions': {
        const channel = resolveChannel(guild, action, context);
        if (!channel || !('permissionOverwrites' in channel)) {
          return { ok: false, message: '❌ القناة المستهدفة غير موجودة' };
        }

        const targetId =
          normalizeId(action.params?.userId) ||
          normalizeId(action.params?.roleId) ||
          normalizeId(action.targetUserId) ||
          normalizeId(action.targetRoleId);
        if (!targetId) return { ok: false, message: '❌ حدد العضو أو الرول المطلوب تعديل صلاحياته' };

        const options: Record<string, boolean> = {};
        const allow = action.params?.allow;
        const deny = action.params?.deny;
        if (Array.isArray(allow)) for (const perm of allow) options[String(perm)] = true;
        if (Array.isArray(deny)) for (const perm of deny) options[String(perm)] = false;
        if (action.params?.permissions && typeof action.params.permissions === 'object') {
          for (const [perm, value] of Object.entries(action.params.permissions)) {
            if (typeof value === 'boolean') options[perm] = value;
          }
        }
        if (!Object.keys(options).length) {
          return { ok: false, message: '❌ لم يتم تحديد صلاحيات للتعديل' };
        }

        const target = guild.members.cache.get(targetId) || guild.roles.cache.get(targetId) || targetId;
        await (channel as TextChannel).permissionOverwrites.edit(target as any, options as any, {
          reason,
        });
        return { ok: true, message: `✅ تم تحديث صلاحيات ${targetId} في ${channel}` };
      }

      case 'ban_user': {
        const member = await resolveMember(guild, action, context);
        if (!member) return { ok: false, message: '❌ العضو المستهدف غير موجود' };
        if (!botOutranks(guild, member)) {
          return { ok: false, message: `❌ لا أستطيع حظر ${member} — رتبته أعلى مني أو هو مالك السيرفر` };
        }
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
          return { ok: false, message: '❌ لا أملك صلاحية الحظر' };
        }
        const deleteSeconds = Math.min(
          604_800,
          Math.max(0, Number(action.params?.deleteMessageSeconds || 0))
        );
        await member.ban({ reason, deleteMessageSeconds: deleteSeconds });
        return { ok: true, message: `✅ تم حظر ${member.user.tag}` };
      }

      case 'timeout_user': {
        const member = await resolveMember(guild, action, context);
        if (!member) return { ok: false, message: '❌ العضو المستهدف غير موجود' };
        if (!botOutranks(guild, member)) {
          return { ok: false, message: `❌ لا أستطيع كتم ${member} — رتبته أعلى مني` };
        }
        if (!guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
          return { ok: false, message: '❌ لا أملك صلاحية كتم الأعضاء' };
        }
        const ms = clampTimeoutMs(action.params?.duration || action.params?.minutes);
        await member.timeout(ms, reason);
        return { ok: true, message: `✅ تم كتم ${member} لمدة ${Math.round(ms / 60_000)} دقيقة` };
      }

      case 'check_settings': {
        const settings = await getGuildSettings(guild.id);
        const on = (v: boolean) => (v ? 'مفعّل' : 'معطّل');
        return {
          ok: true,
          message:
            `📋 حالة الإعدادات: الحماية ${on(settings.protection.antiRaid.enabled)} • ` +
            `التذاكر ${settings.tickets.panels?.length ? 'مُعدّة' : 'غير مُعدّة'} • ` +
            `الترحيب ${on(settings.welcome.enabled)} • المستويات ${on(settings.leveling.enabled)}`,
        };
      }

      case 'restore_backup': {
        const security = (client as any).securityHandler;
        if (!security?.restoreBackup) {
          return { ok: false, message: '❌ نظام النسخ الاحتياطي غير متاح' };
        }
        await security.restoreBackup(guild);
        return { ok: true, message: '✅ تمت استعادة النسخة الاحتياطية' };
      }

      case 'custom':
        return { ok: false, message: 'ℹ️ إجراء مخصص — يحتاج تنفيذاً يدوياً' };

      default:
        return { ok: false, message: `❌ نوع إجراء غير معروف: ${action.type}` };
    }
  } catch (error: any) {
    logger.error(`executeTicketAction(${action.type}) failed: ${error.message}`);
    return { ok: false, message: `❌ فشل تنفيذ الإجراء: ${error.message}` };
  }
}
