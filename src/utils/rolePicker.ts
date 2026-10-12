// ============================================
// Liberty City Bot - Role Picker (لوحة اختيار الرولات)
// برو-بوت ستايل: قائمة تعددية + أزرار (السابق/التالي/تحديد/إلغاء)
// ============================================

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  Role,
  Guild,
  GuildMember,
} from 'discord.js';

const PAGE_SIZE = 25; // حد خيارات قائمة Discord
const TTL = 30 * 60 * 1000; // مدة صلاحية اللوحة (30 دقيقة)

export interface RolePickerState {
  sid: string;
  userId: string; // من أنشأ اللوحة (وحده يستطيع استخدامها)
  targetId: string; // العضو الذي ستُعطى له الرولات
  page: number;
  reason: string;
  selections: Map<number, string[]>; // رقم الصفحة -> الرولات المختارة فيها
  createdAt: number;
  /** قائمة محددة (مثل رولات التحذير) — تُستخدم بدل كل رولات السيرفر */
  roleIds?: string[];
  /** نص مخصص لعنوان اللوحة */
  title?: string;
}

const states = new Map<string, RolePickerState>();

function cleanup() {
  const now = Date.now();
  for (const [k, v] of states) {
    if (now - v.createdAt > TTL) states.delete(k);
  }
}

export function createRolePickerState(
  userId: string,
  targetId: string,
  reason: string,
  roleIds?: string[],
  title?: string
): RolePickerState {
  cleanup();
  const sid = Math.random().toString(36).slice(2, 10);
  const state: RolePickerState = {
    sid,
    userId,
    targetId,
    page: 0,
    reason,
    selections: new Map(),
    createdAt: Date.now(),
    ...(roleIds && roleIds.length ? { roleIds } : {}),
    ...(title ? { title } : {}),
  };
  states.set(sid, state);
  return state;
}

export function getRolePickerState(sid: string): RolePickerState | undefined {
  cleanup();
  return states.get(sid);
}

export function deleteRolePickerState(sid: string): void {
  states.delete(sid);
}

// كل الرولات المختارة عبر كل الصفحات (بدون تكرار)
export function getSelectedRoleIds(state: RolePickerState): string[] {
  const set = new Set<string>();
  for (const ids of state.selections.values()) {
    for (const id of ids) set.add(id);
  }
  return [...set];
}

// الرولات التي يستطيع المنفذ إعطاؤها (مفلترة حسب الصلاحيات)
export function getGrantableRoles(guild: Guild, executor: GuildMember): Role[] {
  const isOwner = executor.id === guild.ownerId;
  const botTop = guild.members.me?.roles.highest.position ?? 0;
  const execTop = executor.roles.highest.position;

  return [
    ...guild.roles.cache
      .filter(
        r =>
          r.id !== guild.id && // بدون @everyone
          !r.managed && // بدون رولات مُدارة
          r.position < botTop && // أقل من رتبة البوت
          (isOwner || r.position < execTop), // أقل من رتبة المنفذ
      )
      .sort((a, b) => b.position - a.position) // الأعلى أولاً
      .values(),
  ];
}

// الرولات المعروضة في اللوحة (قائمة محددة أو كل الرولات القابلة للإعطاء)
export function getPickerRoles(state: RolePickerState, guild: Guild, executor: GuildMember): Role[] {
  if (state.roleIds && state.roleIds.length) {
    return state.roleIds
      .map(id => guild.roles.cache.get(id))
      .filter((r): r is Role => !!r && r.id !== guild.id && !r.managed)
      .sort((a, b) => b.position - a.position);
  }
  return getGrantableRoles(guild, executor);
}

// بناء محتوى اللوحة (الرسالة + الأزرار)
export function buildRolePicker(
  state: RolePickerState,
  guild: Guild,
  executor: GuildMember,
): { content: string; components: any[] } {
  const roles = getPickerRoles(state, guild, executor);
  const totalPages = Math.max(1, Math.ceil(roles.length / PAGE_SIZE));
  if (state.page > totalPages - 1) state.page = totalPages - 1;
  if (state.page < 0) state.page = 0;

  const pageRoles = roles.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);
  const selectedOnPage = state.selections.get(state.page) ?? [];
  const total = getSelectedRoleIds(state).length;

  const content = state.title
    ? `${state.title}\nالمحدد حاليا: ${total}`
    : `✅ <@${state.targetId}> اختر رتبة أو أكثر لإضامتها\nالمحدد حاليا: ${total}`;

  const components: any[] = [];

  // قائمة الرولات (الصفحة الحالية)
  if (pageRoles.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`rolepick:${state.sid}:${state.page}`)
      .setPlaceholder('🎭 اختر رتبة أو أكثر')
      .setMinValues(0)
      .setMaxValues(pageRoles.length)
      .setOptions(
        pageRoles.map(r => ({
          label: (r.name || 'رول بدون اسم').replace(/[\n\r]/g, ' ').substring(0, 100),
          value: r.id,
          default: selectedOnPage.includes(r.id),
        })),
      );
    components.push(new ActionRowBuilder<any>().addComponents(select));
  }

  // أزرار التحكم
  components.push(
    new ActionRowBuilder<any>().addComponents(
      new ButtonBuilder()
        .setCustomId(`rolepick_btn:${state.sid}:prev`)
        .setLabel('السابق')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('◀')
        .setDisabled(state.page <= 0),
      new ButtonBuilder()
        .setCustomId(`rolepick_btn:${state.sid}:next`)
        .setLabel('التالي')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('▶')
        .setDisabled(state.page >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`rolepick_btn:${state.sid}:confirm`)
        .setLabel('تحديد')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`rolepick_btn:${state.sid}:cancel`)
        .setLabel('إلغاء')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌'),
    ),
  );

  return { content, components };
}
