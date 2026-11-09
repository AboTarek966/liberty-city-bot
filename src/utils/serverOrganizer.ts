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
  /** رولات الإدارة/الإشراف — تُمنح للرومات المقفلة */
  staff?: boolean;
}

export interface OrganizeChannelDef {
  name: string;
  type: 'text' | 'voice' | 'category';
  topic?: string;
  position?: number;
  /**
   * public   = كل الأعضاء يقرأون ويكتبون
   * readonly = الجميع يقرأ فقط (للإعلانات والمنتجات) + الإدارة تكتب
   * staff    = الإدارة فقط (غير مرئية للجميع) + الإدارة تكتب
   * lock     = كما staff لكن للإدارات ذات الحساسية العليا
   */
  perms?: 'public' | 'readonly' | 'staff';
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
  {
    id: 'store',
    name: '🛒 متجر البوتات والأدوات — مزخرف بالنجوم',
    roles: [
      { name: '♛ المالك', color: PALETTE.gold, hoist: true, staff: true },
      { name: '⚜ الإدارة', color: PALETTE.red, hoist: true, staff: true },
      { name: '🛡️ فريق الإشراف', color: PALETTE.orange, hoist: true, staff: true },
      { name: '💎 المشترين', color: PALETTE.violet },
      { name: '⭐ VIP', color: PALETTE.pink },
      { name: '🎁 الزبائن', color: PALETTE.teal },
      { name: '🔇 مكتوم', color: PALETTE.gray },
      { name: '✦ عضو', color: PALETTE.blue },
    ],
    categories: [
      { name: '✦ معلومات ✦', type: 'category', position: 0, perms: 'public' },
      { name: '⌁ عن-المتجر', type: 'text', topic: 'من نحن؟', position: 1, perms: 'readonly' },
      { name: '⌁ القواعد', type: 'text', topic: 'اقرأ القواعد قبل المشاركة', position: 2, perms: 'readonly' },
      { name: '⌁ الإعلانات', type: 'text', topic: 'أخبار المتجر والعروض', position: 3, perms: 'readonly' },
      { name: '⌁ طريقة-الشراء', type: 'text', topic: 'خطوات الشراء خطوة بخطوة', position: 4, perms: 'readonly' },
      { name: '⌁ تواصلوا-معنا', type: 'text', topic: 'روابط التواصل الرسمية', position: 5, perms: 'readonly' },
      { name: '✦ الدردشة ✦', type: 'category', position: 6, perms: 'public' },
      { name: '⌁ الشات العام', type: 'text', topic: 'الشات العام — كل الكلام هنا', position: 7, perms: 'public' },
      { name: '⌁ Admin Command', type: 'text', topic: 'أوامر البوت العامة — الأوامر الإدارية داخل قسم الإدارة فقط', position: 8, perms: 'public' },
      { name: '✦ المتجر ✦', type: 'category', position: 12, perms: 'public' },
      { name: '⌁ منتجات-مدفوعة', type: 'text', topic: 'البوتات والأدوات المدفوعة', position: 13, perms: 'readonly' },
      { name: '⌁ منتجات-مجانية', type: 'text', topic: 'مجانيات للناس', position: 14, perms: 'readonly' },
      { name: '⌁ الباقات', type: 'text', topic: 'باقات وعروض خاصة', position: 15, perms: 'readonly' },
      { name: '⌁ طلب-شراء', type: 'text', topic: 'اطلب منتجك من هنا', position: 16, perms: 'public' },
      { name: '⌁ التقييمات', type: 'text', topic: 'رأيك يهمنا', position: 17, perms: 'public' },
      { name: '⌁ إثباتات-البيع', type: 'text', topic: 'إثباتات عمليات البيع', position: 18, perms: 'readonly' },
      { name: '✦ الأقسام ✦', type: 'category', position: 22, perms: 'readonly' },
      { name: '⌁ بوتات', type: 'text', topic: 'كل البوتات', position: 23, perms: 'readonly' },
      { name: '⌁ أدوات', type: 'text', topic: 'أدوات وبرامج مساعدة', position: 24, perms: 'readonly' },
      { name: '⌁ تحديثات', type: 'text', topic: 'آخر تحديثات المنتجات', position: 25, perms: 'readonly' },
      { name: '⌁ جرب-النسخة', type: 'text', topic: 'نسخ تجريبية للجميع', position: 26, perms: 'public' },
      { name: '✦ الدعم ✦', type: 'category', position: 32, perms: 'public' },
      { name: '⌁ طلب-دعم', type: 'text', topic: 'اطلب مساعدة الإدارة', position: 33, perms: 'public' },
      { name: '⌁ الأسئلة-الشائعة', type: 'text', topic: 'أجوبة على الأسئلة المتكررة', position: 34, perms: 'readonly' },
      { name: '⌁ بلاغ', type: 'text', topic: 'الإبلاغ عن مخالفات', position: 35, perms: 'public' },
      { name: '✦ الصوتيات ✦', type: 'category', position: 42, perms: 'public' },
      { name: '⌁ صوت-عام', type: 'voice', topic: 'تحدث واستمع', position: 43, perms: 'public' },
      { name: '⌁ صوت-تجربة', type: 'voice', topic: 'جرب المنتجات صوتياً', position: 44, perms: 'public' },
      { name: '⌁ اجتماع-الزبائن', type: 'voice', topic: 'للزبائن والمشترين', position: 45, perms: 'public' },
      { name: '✦ الإدارة ✦', type: 'category', position: 52, perms: 'staff' },
      { name: '⌁ إدارة-داخلية', type: 'text', topic: 'للإدارة فقط', position: 53, perms: 'staff' },
      { name: '⌁ سجل-المبيعات', type: 'text', topic: 'سجل عمليات البيع', position: 54, perms: 'staff' },
      { name: '⌁ سجل-الأوامر', type: 'text', topic: 'سجل أوامر الإدارة', position: 55, perms: 'staff' },
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
  deleted: { roles: number; channels: number };
  permErrors: string[];
  creationErrors?: string[];
  note: string;
}

export async function organizePreset(guild: any, presetId: string, opts: { deleteOlds?: boolean; cleanRoles?: boolean; pruneChat?: boolean } = {}): Promise<OrganizeResult> {
  const preset = ORGANIZE_PRESETS.find((p) => p.id === presetId) || ORGANIZE_PRESETS[0];
  const me = guild.members.me;
  if (!me) throw new Error('تعذّر تحديد صلاحيات البوت');
  const canManageRoles = me.permissions.has(PermissionFlagsBits.ManageRoles);
  const canManageChannels = me.permissions.has(PermissionFlagsBits.ManageChannels);
  if (!canManageRoles || !canManageChannels) {
    throw new Error('البوت يحتاج صلاحيتي «إدارة الرولات» و«إدارة القنوات»');
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const creationErrors: string[] = [];

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
      await sleep(400);
      roleNameSet.set(role.name, role);
      createdRoles.push({ name: def.name, id: role.id, created: true });
      rolesNew++;
    } catch (e: any) {
      creationErrors.push(`رول «${def.name}»: ${e?.message || e}`);
      createdRoles.push({ name: def.name, id: '', created: false });
      rolesExisting++;
    }
  }

  // —— القنوات ——
  // ديسكورد يحوّل المسافات إلى شرطات في أسماء قنوات النص/الصوت — نقارن بشكل مُطبَّع
  const normKey = (n: string, isCat: boolean) => (isCat ? n.trim() : n.trim().replace(/\s+/g, '-'));
  const chanByName = new Map<string, any>(
    [...(guild.channels.cache.values())].map((c: any) => [normKey(c.name, c.type === ChannelType.GuildCategory), c])
  );
  let channelsNew = 0;
  let channelsExisting = 0;
  const channelResults: { name: string; id: string; created: boolean }[] = [];
  const categories: { name: string; id: string; created: boolean }[] = [];

  const createChan = async (def: OrganizeChannelDef, parentId?: string) => {
    const isCat = def.type === 'category';
    const key = normKey(def.name, isCat);
    const existing = chanByName.get(key);
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
        ...(def.type === 'text' ? { topic: def.topic } : {}),
        parent: parentId,
        reason: 'أمى الهيكل الجاهز — Omni Organizer',
      });
      await sleep(400);
      chanByName.set(normKey(ch.name, ch.type === ChannelType.GuildCategory), ch);
      (def.type === 'category' ? categories : channelResults).push({ name: def.name, id: ch.id, created: true });
      channelsNew++;
      return ch;
    } catch (e: any) {
      creationErrors.push(`قناة «${def.name}»: ${e?.message || e}`);
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

  // —— الصلاحيات: apply overwrites per channel ——
  const permErrors: string[] = [];
  const everyoneId = guild.id;
  const staffIds = preset.roles.filter((r) => r.staff).map((r) => createdRoles.find((c) => c.name === r.name)?.id).filter(Boolean) as string[];
  const mutedId = createdRoles.find((c) => c.name.includes('مكتوم') || /muted/i.test(c.name))?.id;

  const applyOverwrite = async (ch: any, targetId: string, allow: any, deny: any) => {
    try {
      await ch.permissionOverwrites.edit(targetId, { ...(allow ? { allow } : {}), ...(deny ? { deny } : {}) }, 'تصليح الصلاحيات — Omni Organizer');
    } catch (e: any) {
      permErrors.push(`${ch.name}: ${e.message}`);
    }
  };

  const applyPerms = async (def: OrganizeChannelDef, ch: any) => {
    if (!ch) return;
    const kind = def.perms || 'public';
    if (kind === 'staff') {
      // غير مرئية للجميع
      await applyOverwrite(ch, everyoneId, null, [PermissionFlagsBits.ViewChannel]);
      for (const sid of staffIds) {
        await applyOverwrite(ch, sid, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect], null);
      }
    } else if (kind === 'readonly') {
      // الجميع يقرأ فقط، الإدارة تكتب
      await applyOverwrite(ch, everyoneId, null, [PermissionFlagsBits.SendMessages]);
      for (const sid of staffIds) {
        await applyOverwrite(ch, sid, [PermissionFlagsBits.SendMessages], null);
      }
    }
    // حجر المكتوم عن الكتابة في كل الرومات المفتوحة
    if (mutedId) {
      await applyOverwrite(ch, mutedId, null, [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Speak]);
    }
  };

  for (const def of sorted) {
    const ch = chanByName.get(def.name);
    if (ch) await applyPerms(def, ch);
  }

  // —— تنظيف اختياري: حذف رومات ورولات النمط القديم ——
  let deleted = { roles: 0, channels: 0 };
  if ((opts as any)?.deleteOlds) {
    const other = ORGANIZE_PRESETS.find((p) => p.id !== presetId);
    if (other) {
      for (const def of other.roles) {
        const r = guild.roles.cache.find((x: any) => x.name === def.name);
        if (r && r.id !== guild.id) {
          try { await r.delete('تنظيف الهيكل القديم — Omni Organizer'); deleted.roles++; } catch {}
        }
      }
      for (const def of other.categories) {
        const ch = chanByName.get(normKey(def.name, def.type === 'category'));
        if (ch) {
          try { await ch.delete('تنظيف الهيكل القديم — Omni Organizer'); deleted.channels++; } catch {}
        }
      }
      // أزل ما تبقى من القنوات القديمة الأخرى التي تحمل اسم القنوات القديمة (بالأسماء المطبّعة)
      const otherKeys = new Set(other.categories.map((c) => normKey(c.name, c.type === 'category')));
      for (const ch of [...(guild.channels.cache.values())]) {
        if (otherKeys.has(normKey(ch.name, ch.type === ChannelType.GuildCategory))) {
          try { await ch.delete('تنظيف الهيكل القديم — Omni Organizer'); deleted.channels++; } catch {}
        }
      }
    }
  }

  // —— التنظيف الكلي للرتب: كل الرتب ما عدا @everyone والرتب الجديدة + Member + رتب البوتات المدارة ——
  if ((opts as any)?.cleanRoles) {
    const keepNames = new Set([...preset.roles.map((r) => r.name), 'Member', 'member']);
    for (const r of [...(guild.roles.cache.values())]) {
      if (r.id === guild.id) continue; // @everyone
      if ((r as any).managed) continue; // رتب البوتات المُدارة
      if ((r as any).name === 'Omni' || (r as any).managed) continue;
      if (keepNames.has((r as any).name)) continue;
      // رتبة البوت Omni نفسها لا تُحذف أبداً
      if (r.id === me.id) continue;
      try { await r.delete('تنظيف الرتب — Omni Organizer'); deleted.roles++; } catch {}
    }
  }

  // —— تقليص الدردشة: شات عام واحد + قناة أوامر فقط داخل قسم الدردشة ——
  if ((opts as any)?.pruneChat) {
    // أسماء القنوات القديمة اللي ملهاش لازمة غير الشات العام وقناة الأوامر
    const oldChatNames = new Set(
      [
        '⌁ مرحباً-بك',
        '⌁ شات',
        '⌁ دردشة-عامة',
        '⌁ دردشة-ترفيهية',
        '⌁ مشاركات',
        '⌁ اقتراحات',
        '⌁ الأوامر',
        '💭 دردشة-عامة',
        '😄 دردشة-ترفيهية',
        '📸 مشاركات',
        '🗳️ اقتراحات',
      ].map((n) => normKey(n, false))
    );
    for (const ch of [...(guild.channels.cache.values())]) {
      if (ch.type === ChannelType.GuildCategory) continue;
      const key = normKey(ch.name, false);
      if (oldChatNames.has(key)) {
        try { await ch.delete('تنظيف الدردشة الزائدة — Omni Organizer'); deleted.channels++; } catch {}
      }
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
    deleted,
    permErrors,
    creationErrors,
  };
}
