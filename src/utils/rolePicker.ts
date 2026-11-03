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

// هل يستطيع هذا المنفذ إعطاء هذا الرول؟
// القاعدة: الرول أقل من رتبة البوت، وأقل من رتبة المنفذ (المالك مستثنى من قيد رتبته)
export function isRoleGrantable(guild: Guild, executor: GuildMember, role: Role): boolean {
  if (!role) return false;
  if (role.id === guild.id) return false; // بدون @everyone
  if (role.managed) return false; // بدون رولات مُدارة (بوتات/تكاملات)

  const bot = guild.members.me;
  if (!bot) return false;
  if (role.position >= bot.roles.highest.position) return false; // أعلى من رتبة البوت

  // المالك يستطيع إعطاء أي رول أقل من رتبة البوت، وغيره فقط ما هو أقل من رتبته
  if (executor.id !== guild.ownerId && role.position >= executor.roles.highest.position) return false;

  return true;
}

// هل يستطيع المنفذ تعديل رولات هذا العضو؟ (العضو يجب أن يكون أقل رتبة)
export function canManageTarget(guild: Guild, executor: GuildMember, target: GuildMember): boolean {
  if (executor.id === target.id) return false;
  if (executor.id === guild.ownerId) return true; // المالك يستثنى
  if (target.id === guild.ownerId) return false; // لا أحد يعدّل المالك
  return executor.roles.highest.position > target.roles.highest.position;
}

// الرولات التي يستطيع المنفذ إعطاؤها (مفلترة حسب الهرمية)
export function getGrantableRoles(
  guild: Guild,
  executor: GuildMember,
  target?: GuildMember | null,
): Role[] {
  return [
    ...guild.roles.cache
      .filter(
        r =>
          isRoleGrantable(guild, executor, r) &&
          (!target || !target.roles.cache.has(r.id)), // بدون الرولات التي يملكها العضو أصلاً
      )
      .sort((a, b) => b.position - a.position) // الأعلى أولاً
      .values(),
  ];
}

// الرولات المعروضة في اللوحة (قائمة محددة أو كل الرولات القابلة للإعطاء)
export function getPickerRoles(state: RolePickerState, guild: Guild, executor: GuildMember): Role[] {
  const target = guild.members.cache.get(state.targetId) ?? null;

  if (state.roleIds && state.roleIds.length) {
    const botTop = guild.members.me?.roles.highest.position ?? 0;
    return state.roleIds
      .map(id => guild.roles.cache.get(id))
      .filter(
        (r): r is Role =>
          !!r &&
          r.id !== guild.id &&
          !r.managed &&
          r.position < botTop &&
          (!target || !target.roles.cache.has(r.id)),
      )
      .sort((a, b) => b.position - a.position);
  }
  return getGrantableRoles(guild, executor, target);
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
    : `✅ <@${state.targetId}> اختر رتبة أو أكثر لإضافتها\n🛡️ تظهر هنا فقط الرولات الأقل من رتبتك\nالمحدد حاليا: ${total}`;

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
