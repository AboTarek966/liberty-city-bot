"use strict";
// ============================================
// Omni Bot - 👑 إنشاء رتب الإدارة + الفواصل (مرة واحدة / idempotent)
// /createstaffroles — يبني الـ3 قطاعات بالترتيب + الفواصل + الصلاحيات
// إعادة التشغيل: يحدّث الألوان/الصلاحيات/المواقع بدون إنشاء مكرر
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('StaffRoles');
const HIGH_PERMS = [
    discord_js_1.PermissionFlagsBits.ManageMessages, // حذف الرسائل
    discord_js_1.PermissionFlagsBits.BanMembers, // حظر الأعضاء
    discord_js_1.PermissionFlagsBits.ModerateMembers, // تايم اوت
    discord_js_1.PermissionFlagsBits.KickMembers, // فصل الإداريين (القطاعات الأدنى)
];
const MIDDLE_PERMS = [
    discord_js_1.PermissionFlagsBits.BanMembers,
    discord_js_1.PermissionFlagsBits.ModerateMembers,
    discord_js_1.PermissionFlagsBits.ManageMessages,
];
const JUNIOR_PERMS = [discord_js_1.PermissionFlagsBits.ModerateMembers]; // + /warn + تايم اوت
const SEPARATOR_PERMS = [];
const STAFF_ROLES = [
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
const TIER_LABEL = {
    high: '👑 العليا',
    middle: '🛡️ الوسطى',
    junior: '🔰 الصغرى',
    separator: '▓▓ فاصل',
};
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('createstaffroles')
        .setDescription('👑 إنشاء رتب الإدارة + الفواصل بالترتيب (مرة واحدة — قابل للتكرار بأمان)')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild),
    cooldown: 5,
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.guild) {
            await interaction.editReply({ content: '❌ يعمل في السيرفر فقط.' });
            return;
        }
        // الحد: مالك السيرفر أو من عنده Administrator
        const member = interaction.guild.members.cache.get(interaction.user.id);
        const isOwner = interaction.guild.ownerId === interaction.user.id;
        const isAdmin = member?.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) ?? false;
        if (!isOwner && !isAdmin) {
            await interaction.editReply({ content: '⛔ هذا الأمر لمالك السيرفر أو من يملك Administrator فقط.' });
            return;
        }
        const me = interaction.guild.members.me;
        const myHighest = me?.roles?.highest?.position ?? 0;
        // حقوق منشئي الرتب: ممنوع أي رتبة تتخطى رتبة البوت العليا
        const basePos = Math.max(myHighest - 1, 1);
        const created = [];
        const reused = [];
        const failed = [];
        const defs = [...STAFF_ROLES];
        // أنشئ بالأعلى موضعاً نزولاً (OWNER فوق الكل) — ثم ثبّت المواقع مرة واحدة في النهاية
        let cursor = basePos;
        const withPositions = [];
        for (const def of defs) {
            const position = cursor--;
            let role = interaction.guild.roles.cache.find((r) => r.name === def.name);
            let isNew = false;
            try {
                if (role) {
                    // ✨ إعادة ضبط: لون/صلاحيات/حالة — لكن بدون مسح أي منح موجود
                    await role.edit({
                        color: def.color,
                        permissions: def.perms,
                        hoist: def.hoist,
                        mentionable: def.mentionable,
                        reason: 'Omni — تحديث رتب الإدارة',
                    });
                    reused.push(def.name);
                }
                else {
                    role = await interaction.guild.roles.create({
                        name: def.name,
                        color: def.color,
                        permissions: def.perms,
                        hoist: def.hoist,
                        mentionable: def.mentionable,
                        reason: 'Omni — إنشاء رتب الإدارة',
                    });
                    isNew = true;
                    created.push(def.name);
                }
                withPositions.push({ id: role.id, position, name: def.name });
            }
            catch (error) {
                failed.push(`${def.name} — ${error?.message || 'خطأ غير معروف'}`);
                logger.warn(`createstaffroles failed "${def.name}": ${error?.message}`);
                // مكانها في الترتيب محجوز حتى لو فشلت — نكمل الباقي
            }
        }
        // ثبّت المواقع دفعة واحدة (أفضل من 18 طلب منفصل)
        try {
            await interaction.guild.roles.setPositions(withPositions.map(({ id, position }) => ({ role: id, position })));
        }
        catch (error) {
            failed.push(`تثبيت المواقع: ${error?.message || 'خطأ'}`);
            logger.warn(`setPositions failed: ${error?.message}`);
        }
        // لو البوت أعلى من كل الرولات — خبر المالك عمّا يرى من الرتب العليا
        const warnings = [];
        const botHighestName = me?.roles?.highest?.name || '—';
        // ترتيب النهائي من الأعلى للأسفل للتقرير
        const finalOrder = withPositions
            .sort((a, b) => b.position - a.position)
            .map((r, i) => `${String(i + 1).padStart(2, ' ')}. <@&${r.id}> \`${r.name}\``)
            .join('\n');
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(0x57f287)
            .setTitle('👑 تم تجهيز رتب الإدارة')
            .addFields({ name: '🆕 تم إنشاؤها', value: created.length ? created.map((n) => `• ${n}`).join('\n').slice(0, 1024) : 'لا شيء (كانت موجودة)', inline: false }, { name: '♻️ محدّثة', value: reused.length ? String(reused.length) : '0', inline: true }, { name: '❌ فشلت', value: failed.length ? failed.join('\n').slice(0, 1024) : 'لا شيء ✅', inline: false }, { name: '📈 أعلى رتبة للبوت', value: `\`${botHighestName}\` (#${myHighest})`, inline: true }, { name: '📋 الترتيب النهائي (من الأعلى)', value: finalOrder.slice(0, 1024) || 'فارغ', inline: false })
            .setDescription('الرتب الجديدة تحت رتبة البوت العليا مباشرة.\nلو عايز الرتب فوق بعضها في قائمة الأعضاء — ارفع رول البوت أعلى (من إعدادات Server ← Roles).')
            .setFooter({ text: 'Made by Omni' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=createstaffroles.js.map