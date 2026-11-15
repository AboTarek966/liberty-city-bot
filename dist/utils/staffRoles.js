"use strict";
// ============================================
// Omni Bot - 👑 رتب الإدارة (Shared) — تُستخدم من /createstaffroles ومرة واحدة عند الإقلاع
// آمنة للتكرار: يتحقق من الترتيب المطلوب، وإن لم يكن → يعيد ترتيبه من الأعلى للنزول
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAFF_ROLES = void 0;
exports.ensureStaffRoles = ensureStaffRoles;
const discord_js_1 = require("discord.js");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('StaffRoles');
const HIGH_PERMS = [
    discord_js_1.PermissionFlagsBits.ManageMessages,
    discord_js_1.PermissionFlagsBits.BanMembers,
    discord_js_1.PermissionFlagsBits.ModerateMembers,
    discord_js_1.PermissionFlagsBits.KickMembers,
];
const MIDDLE_PERMS = [
    discord_js_1.PermissionFlagsBits.BanMembers,
    discord_js_1.PermissionFlagsBits.ModerateMembers,
    discord_js_1.PermissionFlagsBits.ManageMessages,
];
const JUNIOR_PERMS = [discord_js_1.PermissionFlagsBits.ModerateMembers];
const SEPARATOR_PERMS = [];
exports.STAFF_ROLES = [
    // ===== 👑 الإدارة العليا =====
    { name: '『👑』・𝐎𝐰𝐧𝐞𝐫', color: 0xf1c40f, perms: HIGH_PERMS, hoist: true, mentionable: true, tier: 'high' },
    { name: '『💎』・𝐂𝐨-𝐎𝐰𝐧𝐞𝐫', color: 0xe67e22, perms: HIGH_PERMS, hoist: true, mentionable: true, tier: 'high' },
    { name: '『⚜️』・𝐅𝐨𝐮𝐧𝐝𝐞𝐫', color: 0x9b59b6, perms: HIGH_PERMS, hoist: true, mentionable: true, tier: 'high' },
    { name: '『⚡』・𝐇𝐢𝐠𝐡 𝐌𝐚𝐧𝐚𝐠𝐞𝐦𝐞𝐧𝐭', color: 0xe74c3c, perms: HIGH_PERMS, hoist: true, mentionable: true, tier: 'high' },
    { name: '『💼』・𝐄𝐱𝐞𝐜𝐮𝐭𝐢𝐯𝐞 𝐃𝐢𝐫𝐞𝐜𝐭𝐨𝐫', color: 0xe91e63, perms: HIGH_PERMS, hoist: true, mentionable: true, tier: 'high' },
    { name: '══════ 👑 𝐇𝐢𝐠𝐡 𝐒𝐭𝐚𝐟𝐟 👑 ══════', color: 0x2f3136, perms: SEPARATOR_PERMS, hoist: false, mentionable: false, tier: 'separator' },
    // ===== 🛡️ الإدارة الوسطى =====
    { name: '『🔥』・𝐇𝐞𝐚𝐝 𝐀𝐝𝐦𝐢𝐧', color: 0xe74c3c, perms: MIDDLE_PERMS, hoist: true, mentionable: true, tier: 'middle' },
    { name: '『🔱』・𝐒𝐞𝐧𝐢𝐨𝐫 𝐀𝐝𝐦𝐢𝐧', color: 0xf39c12, perms: MIDDLE_PERMS, hoist: true, mentionable: true, tier: 'middle' },
    { name: '『🛡️』・𝐀𝐝𝐦𝐢𝐧', color: 0x95a5a6, perms: MIDDLE_PERMS, hoist: true, mentionable: true, tier: 'middle' },
    { name: '『⚙️』・𝐒𝐮𝐩𝐞𝐫𝐯𝐢𝐬𝐨𝐫', color: 0x2ecc71, perms: MIDDLE_PERMS, hoist: true, mentionable: true, tier: 'middle' },
    { name: '『⚔️』・𝐇𝐞𝐚𝐝 𝐌𝐨𝐝', color: 0x34495e, perms: MIDDLE_PERMS, hoist: true, mentionable: true, tier: 'middle' },
    { name: '══════ 🛡️ 𝐌𝐢𝐝𝐝𝐥𝐞 𝐒𝐭𝐚𝐟𝐟 🛡️ ══════', color: 0x2f3136, perms: SEPARATOR_PERMS, hoist: false, mentionable: false, tier: 'separator' },
    // ===== 🔰 الإدارة الصغرى =====
    { name: '『🔰』・𝐒𝐞𝐧𝐢𝐨𝐫 𝐌𝐨𝐝', color: 0x1abc9c, perms: JUNIOR_PERMS, hoist: true, mentionable: true, tier: 'junior' },
    { name: '『🔨』・𝐌𝐨𝐝𝐞𝐫𝐚𝐭𝐨𝐫', color: 0x27ae60, perms: JUNIOR_PERMS, hoist: true, mentionable: true, tier: 'junior' },
    { name: '『🎧』・𝐒𝐮𝐩𝐩𝐨𝐫𝐭 𝐓𝐞𝐚𝐦', color: 0x3498db, perms: JUNIOR_PERMS, hoist: true, mentionable: true, tier: 'junior' },
    { name: '『🌟』・𝐇𝐞𝐥𝐩𝐞𝐫', color: 0xf7dc6f, perms: JUNIOR_PERMS, hoist: true, mentionable: true, tier: 'junior' },
    { name: '『📝』・𝐓𝐫𝐢𝐚𝐥 𝐒𝐭𝐚𝐟𝐟', color: 0x7f8c8d, perms: JUNIOR_PERMS, hoist: true, mentionable: true, tier: 'junior' },
    { name: '══════ 🔰 𝐉𝐮𝐧𝐢𝐨𝐫 𝐒𝐭𝐚𝐟𝐟 🔰 ══════', color: 0x2f3136, perms: SEPARATOR_PERMS, hoist: false, mentionable: false, tier: 'separator' },
];
function orderedCacheEntries(guild) {
    return exports.STAFF_ROLES.map((def) => guild.roles.cache.find((r) => r.name === def.name)).filter(Boolean);
}
function isAlreadyCorrect(guild) {
    const cached = orderedCacheEntries(guild);
    const me = guild.members.me;
    const myHighest = me?.roles?.highest?.position ?? 1;
    if (cached.length !== exports.STAFF_ROLES.length)
        return false;
    // كل رتب إدارتنا بلاثة أقفال:
    // 1) أعلى رتبة جديدة (OWNER) لازم تكون تحت رتبة البوت العليا مباشرة (myHighest-1)
    const owner = guild.roles.cache.find((r) => r.name === exports.STAFF_ROLES[0].name);
    if (!owner || owner.position !== Math.max(1, myHighest - 1))
        return false;
    // 2) بلا تساوٍ ولا عكس ترتيب بالأسفل
    for (let i = 0; i < cached.length - 1; i++) {
        if (cached[i].position <= cached[i + 1].position)
            return false;
    }
    return true;
}
async function ensureStaffRoles(guild) {
    const me = guild.members.me;
    const myHighest = me?.roles?.highest?.position ?? 1;
    const botHighestName = me?.roles?.highest?.name ?? '—';
    // 🧊 كل الرتب موجودة والترتيب صح → لا تتغير ولا تنسخة في الإقلاع
    if (isAlreadyCorrect(guild)) {
        const finalOrder = orderedCacheEntries(guild)
            .sort((a, b) => b.position - a.position)
            .map((r) => ({ position: r.position, roleId: r.id, name: r.name }));
        return { skipped: true, created: [], reused: [], failed: [], botHighestName, botHighestPosition: myHighest, finalOrder };
    }
    const created = [];
    const failed = [];
    const reused = [];
    // 1) تأكد من إنشاء كل رتبة غير موجودة + لونها/صلاحياتها محدثة
    for (const def of exports.STAFF_ROLES) {
        let role = guild.roles.cache.find((r) => r.name === def.name);
        try {
            if (role) {
                await role.edit({
                    color: def.color,
                    permissions: def.perms,
                    hoist: def.hoist,
                    mentionable: def.mentionable,
                    reason: 'Omni — مزامنة رتب الإدارة',
                });
                reused.push(def.name);
            }
            else {
                const options = {
                    name: def.name,
                    color: def.color,
                    permissions: def.perms,
                    hoist: def.hoist,
                    mentionable: def.mentionable,
                    reason: 'Omni — إنشاء رتب الإدارة',
                };
                role = await guild.roles.create(options);
                created.push(def.name);
            }
        }
        catch (error) {
            failed.push(`${def.name} — ${error?.message || 'خطأ غير معروف'}`);
            logger.warn(`ensureStaffRoles failed "${def.name}": ${error?.message}`);
        }
    }
    // 2) أعد التوزيع من الأعلى للأسفل بمواضع مثبتة
    try {
        const cached = orderedCacheEntries(guild);
        const topPosition = Math.max(1, myHighest - 1);
        let pos = topPosition;
        const orderedForPlacement = exports.STAFF_ROLES.map((def) => guild.roles.cache.find((r) => r.name === def.name)).filter(Boolean);
        for (const role of orderedForPlacement) {
            const targetPos = pos--;
            if (role.position !== targetPos) {
                try {
                    await role.setPosition(targetPos, { reason: 'Omni — استعادة رتب الإدارة (إعادة الترتيب)' });
                }
                catch (error) {
                    failed.push(`${role.name} — تثبيت موقع ${targetPos}: ${error?.message || 'خطأ'}`);
                    logger.warn(`setPosition "${role.name}" -> ${targetPos}: ${error?.message}`);
                }
            }
        }
        // تحديث الكاش للترتيب النهائي
        await guild.roles.fetch().catch(() => null);
        logger.info('🔧 رتب الإدارة: الترتيب أُصلح من الأعلى للأسفل');
    }
    catch (error) {
        failed.push(`إعادة الترتيب: ${error?.message || 'خطأ'}`);
        logger.warn(`reposition failed: ${error?.message}`);
    }
    const finalOrder = orderedCacheEntries(guild)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ position: r.position, roleId: r.id, name: r.name }));
    return { skipped: false, created, reused, failed, botHighestName, botHighestPosition: myHighest, finalOrder };
}
//# sourceMappingURL=staffRoles.js.map