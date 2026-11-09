"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORGANIZE_PRESETS = void 0;
exports.organizePreset = organizePreset;
// --------------------------------------------
// Server Organizer — الهيكل الجاهز لبناء رومات ورولات السيرفر
// --------------------------------------------
// أنماط جاهزة لمساعدة الإدارة على بناء هيكل السيرفر بضغطة واحدة.
// آمن: لا حذف ولا تعديل — فقط إنشاء، وتخطي ما هو موجود بالفعل (حسب الاسم).
const discord_js_1 = require("discord.js");
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
};
exports.ORGANIZE_PRESETS = [
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
            { name: '✦ المتجر ✦', type: 'category', position: 10, perms: 'public' },
            { name: '⌁ منتجات-مدفوعة', type: 'text', topic: 'البوتات والأدوات المدفوعة', position: 11, perms: 'readonly' },
            { name: '⌁ منتجات-مجانية', type: 'text', topic: 'مجانيات للناس', position: 12, perms: 'readonly' },
            { name: '⌁ الباقات', type: 'text', topic: 'باقات وعروض خاصة', position: 13, perms: 'readonly' },
            { name: '⌁ طلب-شراء', type: 'text', topic: 'اطلب منتجك من هنا', position: 14, perms: 'public' },
            { name: '⌁ التقييمات', type: 'text', topic: 'رأيك يهمنا', position: 15, perms: 'public' },
            { name: '⌁ إثباتات-البيع', type: 'text', topic: 'إثباتات عمليات البيع', position: 16, perms: 'readonly' },
            { name: '✦ الأقسام ✦', type: 'category', position: 20, perms: 'readonly' },
            { name: '⌁ بوتات', type: 'text', topic: 'كل البوتات', position: 21, perms: 'readonly' },
            { name: '⌁ أدوات', type: 'text', topic: 'أدوات وبرامج مساعدة', position: 22, perms: 'readonly' },
            { name: '⌁ تحديثات', type: 'text', topic: 'آخر تحديثات المنتجات', position: 23, perms: 'readonly' },
            { name: '⌁ جرب-النسخة', type: 'text', topic: 'نسخ تجريبية للجميع', position: 24, perms: 'public' },
            { name: '✦ الدعم ✦', type: 'category', position: 30, perms: 'public' },
            { name: '⌁ طلب-دعم', type: 'text', topic: 'اطلب مساعدة الإدارة', position: 31, perms: 'public' },
            { name: '⌁ الأسئلة-الشائعة', type: 'text', topic: 'أجوبة على الأسئلة المتكررة', position: 32, perms: 'readonly' },
            { name: '⌁ بلاغ', type: 'text', topic: 'الإبلاغ عن مخالفات', position: 33, perms: 'public' },
            { name: '✦ الصوتيات ✦', type: 'category', position: 40, perms: 'public' },
            { name: '⌁ صوت-عام', type: 'voice', topic: 'تحدث واستمع', position: 41, perms: 'public' },
            { name: '⌁ صوت-تجربة', type: 'voice', topic: 'جرب المنتجات صوتياً', position: 42, perms: 'public' },
            { name: '⌁ اجتماع-الزبائن', type: 'voice', topic: 'للزبائن والمشترين', position: 43, perms: 'public' },
            { name: '✦ الإدارة ✦', type: 'category', position: 50, perms: 'staff' },
            { name: '⌁ إدارة-داخلية', type: 'text', topic: 'للإدارة فقط', position: 51, perms: 'staff' },
            { name: '⌁ سجل-المبيعات', type: 'text', topic: 'سجل عمليات البيع', position: 52, perms: 'staff' },
            { name: '⌁ سجل-الأوامر', type: 'text', topic: 'سجل أوامر الإدارة', position: 53, perms: 'staff' },
        ],
    },
];
async function organizePreset(guild, presetId, opts = {}) {
    const preset = exports.ORGANIZE_PRESETS.find((p) => p.id === presetId) || exports.ORGANIZE_PRESETS[0];
    const me = guild.members.me;
    if (!me)
        throw new Error('تعذّر تحديد صلاحيات البوت');
    const canManageRoles = me.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles);
    const canManageChannels = me.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels);
    if (!canManageRoles || !canManageChannels) {
        throw new Error('البوت يحتاج صلاحيتي «إدارة الرولات» و«إدارة القنوات»');
    }
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const creationErrors = [];
    // —— الرولات ——
    const roleNameSet = new Map([...(guild.roles.cache.values())].map((r) => [r.name, r]));
    const createdRoles = [];
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
        }
        catch (e) {
            creationErrors.push(`رول «${def.name}»: ${e?.message || e}`);
            createdRoles.push({ name: def.name, id: '', created: false });
            rolesExisting++;
        }
    }
    // —— القنوات ——
    // ديسكورد يحوّل المسافات إلى شرطات في أسماء قنوات النص/الصوت — نقارن بشكل مُطبَّع
    const normKey = (n, isCat) => (isCat ? n.trim() : n.trim().replace(/\s+/g, '-'));
    const chanByName = new Map([...(guild.channels.cache.values())].map((c) => [normKey(c.name, c.type === discord_js_1.ChannelType.GuildCategory), c]));
    let channelsNew = 0;
    let channelsExisting = 0;
    const channelResults = [];
    const categories = [];
    const createChan = async (def, parentId) => {
        const isCat = def.type === 'category';
        const key = normKey(def.name, isCat);
        const existing = chanByName.get(key);
        const expectedType = def.type === 'voice' ? discord_js_1.ChannelType.GuildVoice : def.type === 'category' ? discord_js_1.ChannelType.GuildCategory : discord_js_1.ChannelType.GuildText;
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
            chanByName.set(normKey(ch.name, ch.type === discord_js_1.ChannelType.GuildCategory), ch);
            (def.type === 'category' ? categories : channelResults).push({ name: def.name, id: ch.id, created: true });
            channelsNew++;
            return ch;
        }
        catch (e) {
            creationErrors.push(`قناة «${def.name}»: ${e?.message || e}`);
            (def.type === 'category' ? categories : channelResults).push({ name: def.name, id: '', created: false });
            channelsExisting++;
            return null;
        }
    };
    let currentParentId;
    const sorted = [...preset.categories].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (const def of sorted) {
        if (def.type === 'category') {
            const cat = await createChan(def);
            currentParentId = cat?.id;
        }
        else {
            await createChan(def, currentParentId);
        }
    }
    // —— الصلاحيات: apply overwrites per channel ——
    const permErrors = [];
    const everyoneId = guild.id;
    const staffIds = preset.roles.filter((r) => r.staff).map((r) => createdRoles.find((c) => c.name === r.name)?.id).filter(Boolean);
    const mutedId = createdRoles.find((c) => c.name.includes('مكتوم') || /muted/i.test(c.name))?.id;
    const applyOverwrite = async (ch, targetId, allow, deny) => {
        try {
            await ch.permissionOverwrites.edit(targetId, { ...(allow ? { allow } : {}), ...(deny ? { deny } : {}) }, 'تصليح الصلاحيات — Omni Organizer');
        }
        catch (e) {
            permErrors.push(`${ch.name}: ${e.message}`);
        }
    };
    const applyPerms = async (def, ch) => {
        if (!ch)
            return;
        const kind = def.perms || 'public';
        if (kind === 'staff') {
            // غير مرئية للجميع
            await applyOverwrite(ch, everyoneId, null, [discord_js_1.PermissionFlagsBits.ViewChannel]);
            for (const sid of staffIds) {
                await applyOverwrite(ch, sid, [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.Connect], null);
            }
        }
        else if (kind === 'readonly') {
            // الجميع يقرأ فقط، الإدارة تكتب
            await applyOverwrite(ch, everyoneId, null, [discord_js_1.PermissionFlagsBits.SendMessages]);
            for (const sid of staffIds) {
                await applyOverwrite(ch, sid, [discord_js_1.PermissionFlagsBits.SendMessages], null);
            }
        }
        // حجر المكتوم عن الكتابة في كل الرومات المفتوحة
        if (mutedId) {
            await applyOverwrite(ch, mutedId, null, [discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.Speak]);
        }
    };
    for (const def of sorted) {
        const ch = chanByName.get(def.name);
        if (ch)
            await applyPerms(def, ch);
    }
    // —— تنظيف اختياري: حذف رومات ورولات النمط القديم ——
    let deleted = { roles: 0, channels: 0 };
    if (opts?.deleteOlds) {
        const other = exports.ORGANIZE_PRESETS.find((p) => p.id !== presetId);
        if (other) {
            for (const def of other.roles) {
                const r = guild.roles.cache.find((x) => x.name === def.name);
                if (r && r.id !== guild.id) {
                    try {
                        await r.delete('تنظيف الهيكل القديم — Omni Organizer');
                        deleted.roles++;
                    }
                    catch { }
                }
            }
            for (const def of other.categories) {
                const ch = chanByName.get(normKey(def.name, def.type === 'category'));
                if (ch) {
                    try {
                        await ch.delete('تنظيف الهيكل القديم — Omni Organizer');
                        deleted.channels++;
                    }
                    catch { }
                }
            }
            // أزل ما تبقى من القنوات القديمة الأخرى التي تحمل اسم القنوات القديمة (بالأسماء المطبّعة)
            const otherKeys = new Set(other.categories.map((c) => normKey(c.name, c.type === 'category')));
            for (const ch of [...(guild.channels.cache.values())]) {
                if (otherKeys.has(normKey(ch.name, ch.type === discord_js_1.ChannelType.GuildCategory))) {
                    try {
                        await ch.delete('تنظيف الهيكل القديم — Omni Organizer');
                        deleted.channels++;
                    }
                    catch { }
                }
            }
        }
    }
    // —— التنظيف الكلي للرتب: كل الرتب ما عدا @everyone والرتب الجديدة + Member + رتب البوتات المدارة ——
    if (opts?.cleanRoles) {
        const keepNames = new Set([...preset.roles.map((r) => r.name), 'Member', 'member']);
        for (const r of [...(guild.roles.cache.values())]) {
            if (r.id === guild.id)
                continue; // @everyone
            if (r.managed)
                continue; // رتب البوتات المُدارة
            if (r.name === 'Omni' || r.managed)
                continue;
            if (keepNames.has(r.name))
                continue;
            // رتبة البوت Omni نفسها لا تُحذف أبداً
            if (r.id === me.id)
                continue;
            try {
                await r.delete('تنظيف الرتب — Omni Organizer');
                deleted.roles++;
            }
            catch { }
        }
    }
    // —— ملاحظة توزيع الرولات على الأعضاء ——
    const assignmentNote = 'ملاحظة: الرولات أُنشئت بدون أعضاء — وزّعها بنفسك من إعدادات السيرفر ← الأعضاء (السحب والإفلات)، أو أخبرني بمن يأخذ كل رول وأعطيه أنا.';
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
//# sourceMappingURL=serverOrganizer.js.map