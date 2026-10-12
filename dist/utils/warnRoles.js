"use strict";
// ============================================
// Liberty City Bot - رولات التحذير
// عند التحذير: يُعطي رولاً واحداً مباشرة، أو يعرض لوحة اختيار
// (بنظام roleadd) تحتوي على رولات التحذير المُعدّة في الإعدادات فقط
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdminTarget = isAdminTarget;
exports.getWarnRolePool = getWarnRolePool;
exports.offerWarnRoles = offerWarnRoles;
const discord_js_1 = require("discord.js");
const rolePicker_1 = require("./rolePicker");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('WarnRoles');
// هل الهدف إداري؟ (مالك السيرفر أو لديه صلاحية أدمن/إدارة)
function isAdminTarget(target) {
    if (target.id === target.guild.ownerId)
        return true;
    const perms = target.permissions;
    return (perms.has(discord_js_1.PermissionFlagsBits.Administrator) ||
        perms.has(discord_js_1.PermissionFlagsBits.ManageGuild));
}
// قائمة رولات التحذير المناسبة لنوع الهدف (إداري ⇐ adminIds، عضو ⇐ memberIds)
function getWarnRolePool(settings, target) {
    const w = settings?.warnRoles || {};
    return [...(isAdminTarget(target) ? w.adminIds || [] : w.memberIds || [])];
}
/**
 * يُطبّق رولات التحذير بعد التحذير:
 * - رول واحد فقط → يُعطى مباشرة ويُرجع ملاحظة
 * - أكثر من رول → يعرض لوحة اختيار (من رولات التحذير فقط)
 * - لا توجد رولات قابلة → يُرجع null
 */
async function offerWarnRoles(opts) {
    const { settings, guild, executor, target, reason, reply } = opts;
    try {
        const pool = getWarnRolePool(settings, target);
        if (pool.length === 0)
            return null;
        const botTop = guild.members.me?.roles.highest.position ?? 0;
        const usable = pool
            .map(id => guild.roles.cache.get(id))
            .filter((r) => !!r &&
            r.id !== guild.id &&
            !r.managed &&
            r.position < botTop &&
            !target.roles.cache.has(r.id));
        if (usable.length === 0)
            return null;
        // رول واحد فقط → إعطاء مباشر بدون لوحة
        if (usable.length === 1) {
            const role = usable[0];
            await target.roles.add(role, `رول تحذير: ${reason}`);
            logger.info(`Warn role applied: ${role.name} → ${target.id} (by ${executor.id})`);
            return `🎭 تم إعطاء رول التحذير: <@&${role.id}>`;
        }
        // أكثر من رول → لوحة اختيار (نظام roleadd) بقائمة رولات التحذير فقط
        const state = (0, rolePicker_1.createRolePickerState)(executor.id, target.id, reason, usable.map(r => r.id), `⚠️ اختر رول التحذير الذي تريد إعطاؤه لـ <@${target.id}>\n(القائمة تحتوي على رولات التحذير فقط)`);
        const { content, components } = (0, rolePicker_1.buildRolePicker)(state, guild, executor);
        await reply({ content, components });
        return '🎭 اختر رول التحذير من القائمة بالأسفل';
    }
    catch (error) {
        logger.warn(`offerWarnRoles failed: ${error.message}`);
        return null;
    }
}
//# sourceMappingURL=warnRoles.js.map