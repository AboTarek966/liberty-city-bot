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
];
async function organizePreset(guild, presetId) {
    const preset = exports.ORGANIZE_PRESETS.find((p) => p.id === presetId) || exports.ORGANIZE_PRESETS[0];
    const me = guild.members.me;
    if (!me)
        throw new Error('تعذّر تحديد صلاحيات البوت');
    const canManageRoles = me.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles);
    const canManageChannels = me.permissions.has(discord_js_1.PermissionFlagsBits.ManageChannels);
    if (!canManageRoles || !canManageChannels) {
        throw new Error('البوت يحتاج صلاحيتي «إدارة الرولات» و«إدارة القنوات»');
    }
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
            roleNameSet.set(role.name, role);
            createdRoles.push({ name: def.name, id: role.id, created: true });
            rolesNew++;
        }
        catch (e) {
            createdRoles.push({ name: def.name, id: '', created: false });
            rolesExisting++;
        }
    }
    // —— القنوات ——
    const chanByName = new Map([...(guild.channels.cache.values())].map((c) => [c.name, c]));
    let channelsNew = 0;
    let channelsExisting = 0;
    const channelResults = [];
    const categories = [];
    const createChan = async (def, parentId) => {
        const existing = chanByName.get(def.name);
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
                topic: def.topic,
                parent: parentId,
                reason: 'أمى الهيكل الجاهز — Omni Organizer',
            });
            chanByName.set(ch.name, ch);
            (def.type === 'category' ? categories : channelResults).push({ name: def.name, id: ch.id, created: true });
            channelsNew++;
            return ch;
        }
        catch (e) {
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
    // —— ملاحظة توزيع الرولات على الأعضاء ——
    const assignmentNote = 'ملاحظة: الرولات أُنشئت بدون أعضاء — وزّعها بنفسك من إعدادات السيرفر ← الأعضاء (السحب والإفلات)، أو أخبرني بمن يأخذ كل رول وأعطيه أنا.';
    return {
        success: true,
        presetId: preset.id,
        created: { roles: createdRoles, channels: channelResults, categories },
        counts: { rolesNew, rolesExisting, channelsNew, channelsExisting },
        note: assignmentNote,
    };
}
//# sourceMappingURL=serverOrganizer.js.map