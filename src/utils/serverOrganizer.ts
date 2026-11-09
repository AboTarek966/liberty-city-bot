// --------------------------------------------
// Server Organizer — الهيكل الجاهز لبناء رومات ورولات السيرفر
// --------------------------------------------
// أنماط جاهزة لمساعدة الإدارة على بناء هيكل السيرفر بضغطة واحدة.
// آمن: لا حذف ولا تعديل — فقط إنشاء، وتخطي ما هو موجود بالفعل (حسب الاسم).
import { ChannelType, PermissionFlagsBits } from 'discord.js';

export interface OrganizeRoleDef {
  name: string;
  color?: number;
  hoist?: boolean;
}

export interface OrganizeChannelDef {
  name: string;
  type: 'text' | 'voice' | 'category';
  topic?: string;
  position?: number;
}

export interface OrganizePreset {
  id: string;
  name: string;
  roles: OrganizeRoleDef[];
  categories: OrganizeChannelDef[];
}

const PALETTE = {
  gold: 0xf1c40f,
  blue: 0x3498db,
  teal: 0x1abc9c,
  violet: 0x9b59b6,
  green: 0x2ecc71,
  red: 0xe74c3c,
  orange: 0xe67e22,
  purple: 0x7289da,
  pink: 0xf77fd6,
  gray: 0x95a5a6,
} as const;

export const ORGANIZE_PRESETS: OrganizePreset[] = [
  {
    id: 'community',
    name: '🏰 هيكل مجتمع جاهز',
    roles: [
      { name: '👑 الإدارة', color: PALETTE.gold, hoist: true },
      { name: '🛡️ فريق الإشراف', color: PALETTE.red, hoist: true },
      { name: '📢 متعاون', color: PALETTE.teal },
      { name: '⭐ VIP', color: PALETTE.violet },
      { name: '🔇 مكتوم', color: PALETTE.gray },
      { name: '🌐 عضو', color: PALETTE.gray },
    ],
    categories: [
      { name: '📢 معلومات عامة', type: 'category', position: 0 },
      { name: '📋 القواعد', type: 'text', topic: 'اقرأ القواعد قبل المشاركة', position: 1 },
      { name: '📌 إعلانات', type: 'text', topic: 'أخبار المجتمَع', position: 2 },
      { name: 'ℹ️ شرح-السيرفر', type: 'text', topic: 'دليل سريع للمجتمع', position: 3 },
      { name: '🗳️ اقتراحات', type: 'text', topic: 'اترك اقتراحك هنا', position: 4 },
      { name: '💬 دردشة', type: 'category', position: 10 },
      { name: '💭 دردشة-عامة', type: 'text', topic: 'دردشة الأعضاء', position: 11 },
      { name: '😄 دردشة-ترفيهية', type: 'text', topic: 'الترفيه والضحك', position: 12 },
      { name: '📸 مشاركات', type: 'text', topic: 'صور وفيديوهات', position: 13 },
      { name: '🎙️ صوتيات', type: 'category', position: 20 },
      { name: '🎧 صوت-عام', type: 'voice', topic: 'تحدث واستمع', position: 21 },
      { name: '🎮 صوت-ألعاب', type: 'voice', topic: 'للعب مع الأصدقاء', position: 22 },
      { name: '🛟 دعم', type: 'category', position: 30 },
      { name: '🎫 طلب-دعم', type: 'text', topic: 'اطلب مساعدة الإدارة', position: 31 },
      { name: '🐞 بلاغ', type: 'text', topic: 'الإبلاغ عن مخالفات', position: 32 },
      { name: '👑 الإدارة', type: 'category', position: 40 },
      { name: '🔒 إدارة-داخلية', type: 'text', topic: 'لإدارة المجتمع فقط', position: 41 },
      { name: '📋 سجل-الأوامر', type: 'text', topic: 'سجل أوامر الإدارة', position: 42 },
    ],
  },
];

export interface OrganizeResult {
  success: boolean;
  presetId: string;
  created: {
    roles: { name: string; id: string; created: boolean }[];
    channels: { name: string; id: string; created: boolean }[];
    categories: { name: string; id: string; created: boolean }[];
  };
  counts: { rolesNew: number; rolesExisting: number; channelsNew: number; channelsExisting: number };
  note: string;
}

export async function organizePreset(guild: any, presetId: string): Promise<OrganizeResult> {
  const preset = ORGANIZE_PRESETS.find((p) => p.id === presetId) || ORGANIZE_PRESETS[0];
  const me = guild.members.me;
  if (!me) throw new Error('تعذّر تحديد صلاحيات البوت');
  const canManageRoles = me.permissions.has(PermissionFlagsBits.ManageRoles);
  const canManageChannels = me.permissions.has(PermissionFlagsBits.ManageChannels);
  if (!canManageRoles || !canManageChannels) {
    throw new Error('البوت يحتاج صلاحيتي «إدارة الرولات» و«إدارة القنوات»');
  }

  // —— الرولات ——
  const roleNameSet = new Map<string, any>(
    [...(guild.roles.cache.values())].map((r: any) => [r.name, r])
  );
  const createdRoles: { name: string; id: string; created: boolean }[] = [];
  let rolesNew = 0;
  let rolesExisting = 0;
  for (const def of preset.roles) {
    const existing = roleNameSet.get(def.name);
    if (existing) {
      createdRoles.push({ name: def.name, id: existing.id, created: false });
      rolesExisting++;
      continue;
    }
    try {
      const role = await guild.roles.create({
        name: def.name,
        color: def.color ?? PALETTE.purple,
        hoist: def.hoist ?? false,
        reason: 'أمى الهيكل الجاهز — Omni Organizer',
      });
      roleNameSet.set(role.name, role);
      createdRoles.push({ name: def.name, id: role.id, created: true });
      rolesNew++;
    } catch (e: any) {
      createdRoles.push({ name: def.name, id: '', created: false });
      rolesExisting++;
    }
  }

  // —— القنوات ——
  const chanByName = new Map<string, any>(
    [...(guild.channels.cache.values())].map((c: any) => [c.name, c])
  );
  let channelsNew = 0;
  let channelsExisting = 0;
  const channelResults: { name: string; id: string; created: boolean }[] = [];
  const categories: { name: string; id: string; created: boolean }[] = [];

  const createChan = async (def: OrganizeChannelDef, parentId?: string) => {
    const existing = chanByName.get(def.name);
    const expectedType = def.type === 'voice' ? ChannelType.GuildVoice : def.type === 'category' ? ChannelType.GuildCategory : ChannelType.GuildText;
    if (existing && existing.type === expectedType) {
      (def.type === 'category' ? categories : channelResults).push({ name: def.name, id: existing.id, created: false });
      channelsExisting++;
      return existing;
    }
    try {
      const ch = await guild.channels.create({
        name: def.name,
        type: expectedType,
        topic: def.topic,
        parent: parentId,
        reason: 'أمى الهيكل الجاهز — Omni Organizer',
      });
      chanByName.set(ch.name, ch);
      (def.type === 'category' ? categories : channelResults).push({ name: def.name, id: ch.id, created: true });
      channelsNew++;
      return ch;
    } catch (e: any) {
      (def.type === 'category' ? categories : channelResults).push({ name: def.name, id: '', created: false });
      channelsExisting++;
      return null;
    }
  };

  let currentParentId: string | undefined;
  const sorted = [...preset.categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const def of sorted) {
    if (def.type === 'category') {
      const cat = await createChan(def);
      currentParentId = cat?.id;
    } else {
      await createChan(def, currentParentId);
    }
  }

  // —— ملاحظة توزيع الرولات على الأعضاء ——
  const assignmentNote =
    'ملاحظة: الرولات أُنشئت بدون أعضاء — وزّعها بنفسك من إعدادات السيرفر ← الأعضاء (السحب والإفلات)، أو أخبرني بمن يأخذ كل رول وأعطيه أنا.';

  return {
    success: true,
    presetId: preset.id,
    created: { roles: createdRoles, channels: channelResults, categories },
    counts: { rolesNew, rolesExisting, channelsNew, channelsExisting },
    note: assignmentNote,
  };
}
