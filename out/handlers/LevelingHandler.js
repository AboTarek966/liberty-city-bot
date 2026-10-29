"use strict";
// ============================================
// Liberty City Bot - Leveling Handler
// نظام المستويات المركزي: XP، الترقيات، مكافآت الرولات، بطاقة الرank
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.LevelingHandler = void 0;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const models_1 = require("../models");
const embeds_1 = require("../utils/embeds");
const logger = (0, helpers_1.createLogger)('LevelingHandler');
const BAR_LENGTH = 12;
function progressBar(percent) {
    const filled = Math.max(0, Math.min(BAR_LENGTH, Math.round((percent / 100) * BAR_LENGTH)));
    return '█'.repeat(filled) + '░'.repeat(BAR_LENGTH - filled);
}
function formatMinutes(total) {
    if (total < 60)
        return `${total} دقيقة`;
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours < 24)
        return `${hours} س ${mins} د`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} ي ${remHours} س`;
}
// --------------------------------------------
// Leveling Handler
// --------------------------------------------
class LevelingHandler {
    client;
    // كولداون XP الرسائل: key = `${guildId}:${userId}` → آخر وقت
    xpCooldowns = new Map();
    // جلسات الصوت: key = `${guildId}:${userId}` → وقت الدخول
    voiceJoins = new Map();
    constructor(client) {
        this.client = client;
    }
    // ==========================================
    // الحسابات
    // ==========================================
    calculateLevel(xp) {
        return (0, helpers_1.calculateLevel)(xp);
    }
    xpForLevel(level) {
        return (0, helpers_1.calculateXpForLevel)(level);
    }
    getXpProgress(xp) {
        return (0, helpers_1.getXpProgress)(xp);
    }
    // ==========================================
    // الملف الشخصي
    // ==========================================
    async getOrCreateProfile(userId, guildId) {
        let profile = await models_1.UserProfile.findOne({ userId, guildId });
        if (!profile) {
            profile = await models_1.UserProfile.create({ userId, guildId });
        }
        return profile;
    }
    // ==========================================
    // إضافة XP رسالة
    // ==========================================
    async addMessageXp(member, channelId) {
        const guild = member.guild;
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        const lv = settings.leveling;
        if (!lv?.enabled)
            return null;
        if (member.user.bot)
            return null;
        if (lv.ignoredChannels?.includes(channelId))
            return null;
        if (lv.ignoredRoles?.some((r) => member.roles.cache.has(r)))
            return null;
        const key = `${guild.id}:${member.id}`;
        const now = Date.now();
        const last = this.xpCooldowns.get(key);
        if (last && now - last < (lv.xpCooldown || 60000))
            return null;
        this.xpCooldowns.set(key, now);
        const profile = await this.getOrCreateProfile(member.id, guild.id);
        const oldLevel = profile.level;
        const gain = Math.max(1, Math.floor((lv.xpPerMessage || 15) * (lv.xpGainMultiplier || 1)));
        profile.xp += gain;
        profile.totalXp += gain;
        profile.messagesSent += 1;
        profile.level = (0, helpers_1.calculateLevel)(profile.xp);
        await profile.save();
        const leveledUp = profile.level > oldLevel;
        if (leveledUp) {
            await this.handleLevelUp(member, oldLevel, profile.level, channelId);
        }
        return { leveledUp, oldLevel, newLevel: profile.level, profile };
    }
    // ==========================================
    // إضافة XP صوت (يُستدعى عند مغادرة قناة صوتية)
    // ==========================================
    async trackVoiceJoin(guildId, userId) {
        this.voiceJoins.set(`${guildId}:${userId}`, Date.now());
    }
    async addVoiceXp(guildId, userId) {
        const key = `${guildId}:${userId}`;
        const joinedAt = this.voiceJoins.get(key);
        if (!joinedAt)
            return null;
        this.voiceJoins.delete(key);
        const minutes = Math.max(1, Math.round((Date.now() - joinedAt) / 60000));
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild)
            return null;
        const member = guild.members.cache.get(userId) || (await guild.members.fetch(userId).catch(() => null));
        if (!member || member.user.bot)
            return null;
        const settings = await (0, models_1.getGuildSettings)(guildId);
        const lv = settings.leveling;
        if (!lv?.enabled)
            return null;
        if (lv.ignoredRoles?.some((r) => member.roles.cache.has(r)))
            return null;
        const profile = await this.getOrCreateProfile(userId, guildId);
        const oldLevel = profile.level;
        const gain = Math.max(1, Math.floor(minutes * (lv.voiceXpPerMinute || 10) * (lv.xpGainMultiplier || 1)));
        profile.xp += gain;
        profile.totalXp += gain;
        profile.voiceTime += minutes;
        profile.level = (0, helpers_1.calculateLevel)(profile.xp);
        await profile.save();
        const leveledUp = profile.level > oldLevel;
        if (leveledUp) {
            await this.handleLevelUp(member, oldLevel, profile.level);
        }
        return { leveledUp, oldLevel, newLevel: profile.level, profile };
    }
    // يمنح XP لأي جلسات صوتية ما زالت جارية (ندعوها دوريًا من ready)
    async creditActiveVoiceSessions() {
        for (const key of this.voiceJoins.keys()) {
            const [guildId, userId] = key.split(':');
            const joinedAt = this.voiceJoins.get(key);
            const minutes = Math.floor((Date.now() - joinedAt) / 60000);
            if (minutes >= 1) {
                await this.addVoiceXp(guildId, userId).catch(() => { });
                // إعادة ضبط الوقت لتفادي العد المزدوج
                this.voiceJoins.set(key, Date.now());
            }
        }
    }
    // ==========================================
    // الترقية (رسالة + مكافآت)
    // ==========================================
    async handleLevelUp(member, oldLevel, newLevel, fallbackChannelId) {
        await this.sendLevelUpMessage(member, newLevel, fallbackChannelId).catch(err => logger.warn('Failed to send level-up message:', err));
        const awarded = await this.assignLevelRewards(member, newLevel);
        logger.info(`${member.user.tag} leveled up ${oldLevel} → ${newLevel}${awarded.length ? ` (awarded: ${awarded.join(', ')})` : ''}`);
    }
    // -----------------------------------------
    // رسالة الترقية (نص أو إمبد) + استبدال المتغيرات
    // -----------------------------------------
    buildVars(member, level, profile, rank) {
        return {
            user: `<@${member.id}>`,
            username: member.user.username,
            level: level.toString(),
            xp: profile.xp.toString(),
            totalXp: profile.totalXp.toString(),
            server: member.guild.name,
            rank: rank.toString(),
        };
    }
    applyVars(text, vars) {
        return text.replace(/\{(user|username|level|xp|totalXp|server|rank)\}/g, (_, k) => vars[k] ?? '');
    }
    async sendLevelUpMessage(member, level, fallbackChannelId) {
        const guild = member.guild;
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        const lv = settings.leveling;
        const profile = await this.getOrCreateProfile(member.id, guild.id);
        const rank = await this.getRank(member.id, guild.id);
        const vars = this.buildVars(member, level, profile, rank);
        // تحديد قناة الإرسال
        let channel = null;
        if (lv.levelUpChannelId) {
            const c = guild.channels.cache.get(lv.levelUpChannelId);
            if (c && c.type === discord_js_1.ChannelType.GuildText)
                channel = c;
        }
        if (!channel && fallbackChannelId) {
            const c = guild.channels.cache.get(fallbackChannelId);
            if (c && c.type === discord_js_1.ChannelType.GuildText)
                channel = c;
        }
        if (!channel)
            return;
        if (lv.levelUpStyle === 'text') {
            const text = this.applyVars(lv.levelUpMessage || '🎉 مبروك {user}! وصلت للمستوى **{level}**', vars);
            const msg = await channel.send({ content: text }).catch(() => null);
            if (msg && !lv.levelUpChannelId) {
                setTimeout(() => msg.delete().catch(() => { }), 12000);
            }
            return;
        }
        // نمط إمبد احترافي (الافتراضي)
        const color = this.parseColor(lv.levelUpColor) || embeds_1.Colors.warning;
        const title = this.applyVars(lv.levelUpTitle || '🎉 ترقية جديدة!', vars);
        const description = this.applyVars(lv.levelUpMessage || 'تهانينا {user}! لقد وصلت للمستوى {level} 🎉', vars);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setThumbnail(member.user.displayAvatarURL({ size: 128, extension: 'png' }))
            .addFields({ name: '📈 المستوى', value: `\`${level}\``, inline: true }, { name: '✨ الخبرة', value: `\`${profile.xp}\` XP`, inline: true }, { name: '🏆 الترتيب', value: `\`#${rank}\``, inline: true })
            .setFooter({ text: `${member.guild.name} • نظام المستويات` })
            .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => { });
    }
    parseColor(hex) {
        if (!hex)
            return null;
        const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
        if (!m)
            return null;
        return parseInt(m[1], 16);
    }
    // -----------------------------------------
    // مكافآت الرولات (تراكمية — كل المستويات المُبلَغ عنها فما فوق)
    // يدعم الرسائل القديمة (levelRoles map) والجديدة (levelRewards array)
    // -----------------------------------------
    async assignLevelRewards(member, level) {
        const guild = member.guild;
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        const lv = settings.leveling;
        const awarded = [];
        // دمج المكافآت: الجديدة (array) + القديمة (map)
        const rewards = [];
        if (Array.isArray(lv.levelRewards)) {
            for (const r of lv.levelRewards) {
                if (r && typeof r.level === 'number' && r.roleId) {
                    rewards.push({ level: r.level, roleId: r.roleId });
                }
            }
        }
        if (lv.levelRoles && typeof lv.levelRoles.forEach === 'function') {
            lv.levelRoles.forEach((roleId, lvl) => {
                const n = Number(lvl);
                if (!Number.isNaN(n) && roleId)
                    rewards.push({ level: n, roleId });
            });
        }
        // المستويات التي بلغها العضو فما فوق (تراكمي)
        const eligible = rewards.filter(r => r.level <= level && r.roleId);
        // تفريد حسب roleId مع الأعلى مستوى أولًا
        const byRole = new Map();
        for (const r of eligible) {
            const cur = byRole.get(r.roleId);
            if (cur === undefined || r.level > cur)
                byRole.set(r.roleId, r.level);
        }
        for (const [roleId] of byRole) {
            const role = guild.roles.cache.get(roleId);
            if (!role)
                continue;
            if (member.roles.cache.has(roleId))
                continue;
            // لا نمنح رولًا أعلى من رتبة البوت
            if (role.position >= (guild.members.me?.roles.highest.position ?? 0))
                continue;
            const ok = await member.roles.add(role, `Level Up → ${level}`).catch(() => null);
            if (ok)
                awarded.push(role.name);
        }
        return awarded;
    }
    // ==========================================
    // الترتيب (Rank)
    // ==========================================
    async getRank(userId, guildId) {
        const profile = await models_1.UserProfile.findOne({ userId, guildId });
        if (!profile)
            return 1;
        // عدد الأعضاء בעלי XP أعلى (الترتيب يعتمد على إجمالي الخبرة)
        const higher = await models_1.UserProfile.countDocuments({
            guildId,
            xp: { $gt: profile.xp },
        });
        return higher + 1;
    }
    async getMemberCount(guildId) {
        return models_1.UserProfile.countDocuments({ guildId });
    }
    // ==========================================
    // بطاقة الرank (امبد تفاعلي جميل)
    // ==========================================
    async buildRankCard(member) {
        const profile = await this.getOrCreateProfile(member.id, member.guild.id);
        const rank = await this.getRank(member.id, member.guild.id);
        const totalMembers = await this.getMemberCount(member.guild.id);
        const progress = (0, helpers_1.getXpProgress)(profile.xp);
        const nextLevelXp = (0, helpers_1.calculateXpForLevel)(profile.level + 1);
        const medals = ['🥇', '🥈', '🥉'];
        const rankLabel = medals[rank - 1] || `#${rank}`;
        const bar = progressBar(progress.progress);
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embeds_1.Colors.primary)
            .setAuthor({
            name: `${member.user.username} • ${rankLabel}`,
            iconURL: member.user.displayAvatarURL({ size: 128, extension: 'png' }),
        })
            .setThumbnail(member.user.displayAvatarURL({ size: 256, extension: 'png' }))
            .setDescription(`> 🏆 **الترتيب:** \`${rank}\` من \`${totalMembers}\` عضو\n` +
            `> 📈 **المستوى:** \`${profile.level}\`\n\n` +
            `**الخبرة:** \`${progress.current}\` / \`${progress.next}\` XP  (الإجمالي: \`${profile.xp}\`)\n` +
            `\`${bar}\` **${Math.floor(progress.progress)}%**\n\n` +
            `> 💬 **الرسائل:** \`${profile.messagesSent.toLocaleString('en-US')}\`\n` +
            `> 🔊 **الصوت:** \`${formatMinutes(profile.voiceTime)}\``)
            .setFooter({ text: `${member.guild.name} • المستوى التالي عند ${nextLevelXp} XP` })
            .setTimestamp();
        return embed;
    }
    // ==========================================
    // توب الأعضاء (لأغراض لوحة المتصدرين بالمستويات)
    // ==========================================
    async getTopMembers(guildId, limit = 10) {
        return models_1.UserProfile.find({ guildId })
            .sort({ xp: -1 })
            .limit(limit)
            .lean();
    }
    // ==========================================
    // تفريغ كولداون (تنظيف)
    // ==========================================
    cleanup() {
        this.xpCooldowns.clear();
        this.voiceJoins.clear();
    }
}
exports.LevelingHandler = LevelingHandler;
exports.default = LevelingHandler;
//# sourceMappingURL=LevelingHandler.js.map