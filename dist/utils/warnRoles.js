"use strict";
// ============================================
// Liberty City Bot - رولات التحذير
// عند التحذير: يُعطي رولاً واحداً مباشرة، أو يعرض لوحة اختيار
// (بنظام roleadd) تحتوي على رولات التحذير المُعدّة في الإعدادات فقط
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdminTarget = isAdminTarget;
exports.getWarnRolePool = getWarnRolePool;
exports.getWarningCount = getWarningCount;
exports.applySequentialAdminWarnRoles = applySequentialAdminWarnRoles;
exports.offerWarnRoles = offerWarnRoles;
const discord_js_1 = require("discord.js");
const rolePicker_1 = require("./rolePicker");
const helpers_1 = require("./helpers");
const models_1 = require("../models");
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
 * الحصول على عدد تحذيرات عضو في هذا السيرفر
 */
async function getWarningCount(guildId, userId) {
    return await models_1.Warning.countDocuments({ guildId, userId });
}
/**
 * تطبيق نظام التحذيرات التسلسلي للإداريين:
 * - تحذير 1 → role1Id
 * - تحذير 2 → role2Id
 * - تحذير 3 → role3Id
 * يعيد ملاحظة نصية بما تم، أو null لو ما فيش إعداد
 */
async function applySequentialAdminWarnRoles(opts) {
    const { settings, guild, executor, target, reason, forceFreshSettings } = opts;
    // فقط للإداريين
    if (!isAdminTarget(target))
        return null;
    // إذا طُلب بيانات طازجة، أبطل الكاش وجيب إعدادات جديدة
    let effectiveSettings = settings;
    if (forceFreshSettings) {
        const { invalidateGuildSettings, getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../models')));
        invalidateGuildSettings(guild.id);
        effectiveSettings = await getGuildSettings(guild.id);
    }
    const sequential = effectiveSettings?.warnRoles?.adminSequential;
    if (!sequential)
        return null;
    // حساب عدد التحذيرات الحالي (بما فيها التحذير الجديد)
    const currentCount = await getWarningCount(guild.id, target.id);
    // تحديد الرول المناسب
    let roleId;
    let roleNumber;
    if (currentCount === 1) {
        roleId = sequential.role1Id;
        roleNumber = 1;
    }
    else if (currentCount === 2) {
        roleId = sequential.role2Id;
        roleNumber = 2;
    }
    else if (currentCount >= 3) {
        roleId = sequential.role3Id;
        roleNumber = 3;
    }
    else {
        return null; // لا يوجد رول لهذا العدد
    }
    if (!roleId)
        return null;
    try {
        const botTop = guild.members.me?.roles.highest.position ?? 0;
        const role = guild.roles.cache.get(roleId);
        if (!role || role.id === guild.id || role.managed || role.position >= botTop) {
            logger.warn(`Sequential warn role ${roleId} not usable (hierarchy/managed)`);
            return null;
        }
        // إذا كان العضو يملك الرول بالفعل، لا نعيد إعطاؤه
        if (target.roles.cache.has(roleId)) {
            return `🎭 العضو يملك بالفعل رول التحذير رقم ${roleNumber}: <@&${roleId}>`;
        }
        await target.roles.add(role, `تحذير إداري تسلسلي #${currentCount}: ${reason}`);
        logger.info(`Sequential admin warn role applied: ${role.name} (warning #${currentCount}) → ${target.id} (by ${executor.id})`);
        return `🎭 تم إعطاء رول التحذير رقم ${roleNumber}: <@&${roleId}>`;
    }
    catch (error) {
        logger.warn(`applySequentialAdminWarnRoles failed: ${error.message}`);
        return null;
    }
}
/**
 * يُطبّق رولات التحذير بعد التحذير:
 * - للإداريين: نظام تسلسلي تلقائي (1→role1, 2→role2, 3→role3)
 * - للأعضاء: رول واحد فقط → يُعطى مباشرة، أو لوحة اختيار
 * - لا توجد رولات قابلة → يُرجع null
 */
async function offerWarnRoles(opts) {
    const { settings, guild, executor, target, reason, reply } = opts;
    try {
        // أولاً: جرب النظام التسلسلي للإداريين (تلقائي، بدون لوحة)
        const sequentialNote = await applySequentialAdminWarnRoles({ settings, guild, executor, target, reason, forceFreshSettings: true });
        if (sequentialNote)
            return sequentialNote;
        // ثانياً: النظام القديم (pool من رولات التحذير)
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