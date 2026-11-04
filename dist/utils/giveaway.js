"use strict";
// ============================================
// Omni Bot - Giveaway Engine
// ============================================
// سحب كامل: إنشاء، مشاركة، سحب الفائز، إعادة السحب، واستعادة بعد
// إعادة تشغيل البوت. كل الحالة محفوظة في MongoDB.
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShortId = generateShortId;
exports.formatRemaining = formatRemaining;
exports.requirementLines = requirementLines;
exports.invalidateInviteCache = invalidateInviteCache;
exports.checkGiveawayRequirements = checkGiveawayRequirements;
exports.buildGiveawayPayload = buildGiveawayPayload;
exports.refreshGiveawayMessage = refreshGiveawayMessage;
exports.createGiveaway = createGiveaway;
exports.findGiveaway = findGiveaway;
exports.toggleGiveawayEntry = toggleGiveawayEntry;
exports.endGiveaway = endGiveaway;
exports.rerollGiveaway = rerollGiveaway;
exports.clearGiveawayTimer = clearGiveawayTimer;
exports.scheduleGiveaway = scheduleGiveaway;
exports.restoreGiveaways = restoreGiveaways;
const discord_js_1 = require("discord.js");
const crypto_1 = require("crypto");
const models_1 = require("../models");
const helpers_1 = require("./helpers");
const embeds_1 = require("./embeds");
const logger = (0, helpers_1.createLogger)('Giveaway');
const MAX_TIMER_MS = 2_147_000_000; // حد setTimeout الآمن (~24.8 يوم)
const timers = new Map();
const SHORT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// --------------------------------------------
// Helpers
// --------------------------------------------
function generateShortId(length = 6) {
    let id = '';
    for (let i = 0; i < length; i++) {
        id += SHORT_ID_ALPHABET[(0, crypto_1.randomInt)(0, SHORT_ID_ALPHABET.length)];
    }
    return id;
}
function formatRemaining(ms) {
    if (ms <= 0)
        return 'انتهى';
    return (0, helpers_1.formatDuration)(ms, { compact: true });
}
function toRequirementObject(input) {
    return {
        roleIds: Array.from(new Set((input.roleIds || []).filter(Boolean))),
        minLevel: Math.max(0, Math.trunc(input.minLevel || 0)),
        minAccountAgeDays: Math.max(0, Math.trunc(input.minAccountAgeDays || 0)),
        minInvites: Math.max(0, Math.trunc(input.minInvites || 0)),
    };
}
function requirementLines(req) {
    if (!req)
        return [];
    const lines = [];
    if (req.roleIds?.length) {
        lines.push(`> 🎭 رول مطلوب: ${req.roleIds.map(id => `<@&${id}>`).join('، ')}`);
    }
    if ((req.minLevel || 0) > 0)
        lines.push(`> 📈 أقل مستوى: \`${req.minLevel}\``);
    if ((req.minAccountAgeDays || 0) > 0) {
        lines.push(`> 🕰️ عمر الحساب: \`${req.minAccountAgeDays}\` يوم على الأقل`);
    }
    if ((req.minInvites || 0) > 0)
        lines.push(`> 📨 دعوات مطلوبة: \`${req.minInvites}\``);
    return lines;
}
// --------------------------------------------
// Invite counting (cached — avoids hammering Discord on every join)
// --------------------------------------------
const inviteCache = new Map();
const INVITE_CACHE_TTL = 60_000;
async function countInvitesByUser(guild) {
    const cached = inviteCache.get(guild.id);
    if (cached && Date.now() - cached.ts < INVITE_CACHE_TTL)
        return cached.counts;
    const counts = new Map();
    try {
        const invites = await guild.invites.fetch();
        for (const invite of invites.values()) {
            if (!invite.inviterId)
                continue;
            counts.set(invite.inviterId, (counts.get(invite.inviterId) || 0) + (invite.uses || 0));
        }
    }
    catch (error) {
        logger.warn(`Could not fetch invites for ${guild.name}: ${error.message}`);
    }
    inviteCache.set(guild.id, { ts: Date.now(), counts });
    return counts;
}
function invalidateInviteCache(guildId) {
    inviteCache.delete(guildId);
}
// --------------------------------------------
// Requirements check
// --------------------------------------------
async function checkGiveawayRequirements(guild, member, requirements, inviteCounts) {
    const missing = [];
    const req = toRequirementObject(requirements);
    if (req.roleIds.length) {
        const absent = req.roleIds.filter(id => !member.roles.cache.has(id));
        if (absent.length) {
            missing.push(`تحتاج رول ${absent.map(id => `<@&${id}>`).join('، ')}`);
        }
    }
    if (req.minLevel > 0) {
        const profile = await models_1.UserProfile.findOne({ guildId: guild.id, userId: member.id });
        const level = profile?.level || 0;
        if (level < req.minLevel)
            missing.push(`مستواك \`${level}\` — المطلوب \`${req.minLevel}\``);
    }
    if (req.minAccountAgeDays > 0) {
        const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
        if (ageDays < req.minAccountAgeDays) {
            missing.push(`عمر حسابك \`${Math.floor(ageDays)}\` يوم — المطلوب \`${req.minAccountAgeDays}\``);
        }
    }
    if (req.minInvites > 0) {
        const counts = inviteCounts || (await countInvitesByUser(guild));
        const invites = counts.get(member.id) || 0;
        if (invites < req.minInvites) {
            missing.push(`دعواتك \`${invites}\` — المطلوب \`${req.minInvites}\``);
        }
    }
    return missing;
}
// --------------------------------------------
// Build message
// --------------------------------------------
function buildGiveawayPayload(giveaway, state = {}, guildName) {
    const ended = state.ended ?? giveaway.ended;
    const winners = state.winners ?? giveaway.winnerIds ?? [];
    const endsAt = new Date(giveaway.endsAt).getTime();
    const remaining = ended ? 0 : endsAt - Date.now();
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(ended ? `🏁 انتهى السحب — ${giveaway.prize}` : `🎉 ${giveaway.prize}`)
        .setColor(ended ? embeds_1.Colors.Grey : embeds_1.Colors.primary)
        .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guildName || 'Omni'}` })
        .setTimestamp();
    const lines = [];
    if (giveaway.description)
        lines.push(giveaway.description, '');
    lines.push(ended
        ? `> 🏁 **انتهى السحب** ${giveaway.endedAt ? `<t:${Math.floor(new Date(giveaway.endedAt).getTime() / 1000)}:R>` : ''}`
        : `> ⏳ **ينتهي:** <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)`, `> 👥 **المشاركون:** \`${giveaway.entries.length}\``, `> 🏆 **عدد الفائزين:** \`${giveaway.winnersCount}\``, `> 🎩 **صاحب السحب:** <@${giveaway.hostId}>`);
    const reqLines = requirementLines(giveaway.requirements);
    if (reqLines.length) {
        lines.push('', '**📋 شروط المشاركة:**', ...reqLines);
    }
    if (ended) {
        lines.push('', winners.length
            ? `**🏆 الفائزون:** ${winners.map(id => `<@${id}>`).join('، ')}`
            : '**🏆 الفائزون:** لا يوجد — لم يشارك أحد');
    }
    else if (remaining > 0) {
        lines.push('', `> ⌛ **الوقت المتبقي:** \`${formatRemaining(remaining)}\``);
    }
    embed.setDescription(lines.join('\n'));
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`giveaway:entry:${giveaway.shortId}`)
        .setLabel(ended ? 'انتهى السحب' : '🎉 شارك / انسحب')
        .setStyle(ended ? discord_js_1.ButtonStyle.Secondary : discord_js_1.ButtonStyle.Success)
        .setDisabled(ended));
    return { embeds: [embed], components: [row] };
}
async function refreshGiveawayMessage(client, giveaway) {
    try {
        if (!giveaway.messageId)
            return;
        const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
        if (!channel || !channel.isTextBased())
            return;
        const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (!message)
            return;
        const payload = buildGiveawayPayload(giveaway, {}, client.guilds.cache.get(giveaway.guildId)?.name);
        await message.edit({ embeds: payload.embeds, components: payload.components }).catch(() => { });
    }
    catch (error) {
        logger.debug(`Could not refresh giveaway ${giveaway.shortId}: ${error.message}`);
    }
}
// --------------------------------------------
// Create
// --------------------------------------------
async function createGiveaway(input) {
    const requirements = toRequirementObject(input.requirements);
    let shortId = generateShortId();
    for (let attempt = 0; attempt < 8; attempt++) {
        const exists = await models_1.Giveaway.exists({ guildId: input.guildId, shortId });
        if (!exists)
            break;
        shortId = generateShortId();
    }
    return models_1.Giveaway.create({
        guildId: input.guildId,
        shortId,
        channelId: input.channelId,
        hostId: input.hostId,
        prize: input.prize.trim(),
        description: input.description?.trim() || '',
        winnersCount: Math.min(20, Math.max(1, Math.trunc(input.winnersCount))),
        endsAt: new Date(Date.now() + Math.max(10_000, input.durationMs)),
        requirements,
    });
}
// --------------------------------------------
// Resolve by short id or Mongo id
// --------------------------------------------
async function findGiveaway(guildId, ref) {
    const clean = ref.trim().replace(/^#/, '');
    if (/^[a-f\d]{24}$/i.test(clean)) {
        const byId = await models_1.Giveaway.findById(clean);
        if (byId && byId.guildId === guildId)
            return byId;
    }
    return models_1.Giveaway.findOne({ guildId, shortId: clean.toUpperCase() });
}
// --------------------------------------------
// Join / leave (toggle)
// --------------------------------------------
async function toggleGiveawayEntry(client, guildId, ref, member) {
    const giveaway = await findGiveaway(guildId, ref);
    if (!giveaway)
        return { ok: false, reason: 'لم أجد هذا السحب' };
    if (giveaway.ended)
        return { ok: false, reason: 'هذا السحب انتهى بالفعل' };
    const alreadyIn = giveaway.entries.includes(member.id);
    if (alreadyIn) {
        giveaway.entries = giveaway.entries.filter(id => id !== member.id);
        await giveaway.save();
        await refreshGiveawayMessage(client, giveaway);
        return { ok: true, left: true, giveaway };
    }
    const inviteCounts = (giveaway.requirements?.minInvites || 0) > 0
        ? await countInvitesByUser(member.guild)
        : undefined;
    const missing = await checkGiveawayRequirements(member.guild, member, giveaway.requirements, inviteCounts);
    if (missing.length) {
        return { ok: false, reason: `لا تستوفي الشروط:\n> • ${missing.join('\n> • ')}` };
    }
    giveaway.entries.push(member.id);
    await giveaway.save();
    await refreshGiveawayMessage(client, giveaway);
    return { ok: true, left: false, giveaway };
}
// --------------------------------------------
// Pick winners
// --------------------------------------------
function pickRandom(items, count) {
    const pool = [...items];
    const winners = [];
    while (pool.length && winners.length < count) {
        winners.push(pool.splice((0, crypto_1.randomInt)(0, pool.length), 1)[0]);
    }
    return winners;
}
async function eligibleEntries(guild, entries, requirements) {
    if (!entries.length)
        return [];
    const unique = Array.from(new Set(entries));
    const inviteCounts = (requirements.minInvites || 0) > 0
        ? await countInvitesByUser(guild)
        : undefined;
    // جلب الأعضاء على دفعات (حد ديسكورد 100 لكل طلب)
    const members = new Map();
    for (let i = 0; i < unique.length; i += 100) {
        const batch = unique.slice(i, i + 100);
        try {
            const fetched = await guild.members.fetch({ user: batch });
            for (const [id, member] of fetched)
                members.set(id, member);
        }
        catch {
            for (const id of batch) {
                const cached = guild.members.cache.get(id);
                if (cached)
                    members.set(id, cached);
            }
        }
    }
    const result = [];
    for (const id of unique) {
        const member = members.get(id);
        if (!member)
            continue;
        const missing = await checkGiveawayRequirements(guild, member, requirements, inviteCounts);
        if (!missing.length)
            result.push(member);
    }
    return result;
}
// --------------------------------------------
// End
// --------------------------------------------
async function endGiveaway(client, guildId, ref) {
    const giveaway = await findGiveaway(guildId, ref);
    if (!giveaway)
        return { ok: false, reason: 'لم أجد هذا السحب' };
    if (giveaway.ended)
        return { ok: false, reason: 'هذا السحب منتهٍ بالفعل' };
    return finishGiveaway(client, giveaway);
}
async function finishGiveaway(client, giveaway) {
    const guild = client.guilds.cache.get(giveaway.guildId);
    if (!guild) {
        giveaway.ended = true;
        giveaway.endedAt = new Date();
        giveaway.winnerIds = [];
        await giveaway.save();
        clearGiveawayTimer(giveaway._id.toString());
        return { ok: true, winners: [], giveaway };
    }
    const eligible = await eligibleEntries(guild, giveaway.entries, giveaway.requirements);
    const winners = pickRandom(eligible, giveaway.winnersCount).map(m => m.id);
    giveaway.ended = true;
    giveaway.endedAt = new Date();
    giveaway.winnerIds = winners;
    await giveaway.save();
    clearGiveawayTimer(giveaway._id.toString());
    await refreshGiveawayMessage(client, giveaway);
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
        const announcement = new discord_js_1.EmbedBuilder()
            .setTitle('🎉 نتيجة السحب')
            .setColor(winners.length ? embeds_1.Colors.success : embeds_1.Colors.warning)
            .setDescription(`**الجائزة:** ${giveaway.prize}\n` +
            `**المشاركون:** \`${giveaway.entries.length}\`\n\n` +
            (winners.length
                ? `🏆 **الفائزون:** ${winners.map(id => `<@${id}>`).join('، ')}\n\n` +
                    `> 📩 سيتم التواصل معكم لاستلام الجائزة. مبروك!`
                : `😔 **لا يوجد فائز** — لم يستوفِ أحد الشروط أو لم يشارك أحد.`))
            .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guild.name}` })
            .setTimestamp();
        await channel.send({
            content: winners.length ? winners.map(id => `<@${id}>`).join(' ') : undefined,
            embeds: [announcement],
        }).catch(() => { });
    }
    for (const winnerId of winners) {
        const member = guild.members.cache.get(winnerId);
        if (member) {
            await member.send(`🎉 مبروك! لقد فزت في سحب **${giveaway.prize}** في سيرفر **${guild.name}**.\n` +
                `تواصل مع الإدارة لاستلام جائزتك.`).catch(() => { });
        }
    }
    logger.info(`Giveaway ${giveaway.shortId} ended — winners: ${winners.join(', ') || 'none'}`);
    return { ok: true, winners, giveaway };
}
// --------------------------------------------
// Reroll
// --------------------------------------------
async function rerollGiveaway(client, guildId, ref, winnersCount) {
    const giveaway = await findGiveaway(guildId, ref);
    if (!giveaway)
        return { ok: false, reason: 'لم أجد هذا السحب' };
    if (!giveaway.ended)
        return { ok: false, reason: 'لم ينتهِ هذا السحب بعد — استخدم `/giveaway end` أولاً' };
    const guild = client.guilds.cache.get(guildId);
    if (!guild)
        return { ok: false, reason: 'السيرفر غير متاح' };
    const eligible = await eligibleEntries(guild, giveaway.entries, giveaway.requirements);
    const previous = new Set(giveaway.winnerIds || []);
    // نستبعد الفائزين السابقين إن كان هناك بدائل كافية
    let pool = eligible.filter(m => !previous.has(m.id));
    if (pool.length < Math.min(giveaway.winnersCount, eligible.length))
        pool = eligible;
    const count = Math.min(Math.max(1, Math.trunc(winnersCount || giveaway.winnersCount)), Math.max(1, pool.length));
    const winners = pickRandom(pool, count).map(m => m.id);
    if (!winners.length)
        return { ok: false, reason: 'لا يوجد مشاركون مؤهلون لإعادة السحب' };
    giveaway.winnerIds = winners;
    giveaway.endedAt = new Date();
    await giveaway.save();
    await refreshGiveawayMessage(client, giveaway);
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🔄 إعادة سحب')
            .setColor(embeds_1.Colors.success)
            .setDescription(`**الجائزة:** ${giveaway.prize}\n\n` +
            `🎉 **الفائزون الجدد:** ${winners.map(id => `<@${id}>`).join('، ')}`)
            .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guild.name}` })
            .setTimestamp();
        await channel.send({
            content: winners.map(id => `<@${id}>`).join(' '),
            embeds: [embed],
        }).catch(() => { });
    }
    logger.info(`Giveaway ${giveaway.shortId} rerolled — winners: ${winners.join(', ')}`);
    return { ok: true, winners, giveaway };
}
// --------------------------------------------
// Scheduler
// --------------------------------------------
function clearGiveawayTimer(giveawayId) {
    const timer = timers.get(giveawayId);
    if (timer) {
        clearTimeout(timer);
        timers.delete(giveawayId);
    }
}
function scheduleGiveaway(client, giveaway) {
    const key = giveaway._id.toString();
    clearGiveawayTimer(key);
    if (giveaway.ended)
        return;
    const delay = new Date(giveaway.endsAt).getTime() - Date.now();
    if (delay > MAX_TIMER_MS) {
        timers.set(key, setTimeout(() => {
            timers.delete(key);
            void models_1.Giveaway.findById(key)
                .then(fresh => {
                if (fresh && !fresh.ended)
                    scheduleGiveaway(client, fresh);
            })
                .catch(() => { });
        }, MAX_TIMER_MS));
        return;
    }
    timers.set(key, setTimeout(() => {
        timers.delete(key);
        void endGiveaway(client, giveaway.guildId, giveaway._id.toString())
            .then(result => {
            if (!result.ok)
                logger.warn(`Scheduled giveaway ${giveaway.shortId}: ${result.reason}`);
        })
            .catch(error => logger.error(`Scheduled giveaway failed: ${error.message}`));
    }, Math.max(0, delay)));
}
async function restoreGiveaways(client) {
    try {
        const active = await models_1.Giveaway.find({ ended: false }).limit(500);
        logger.info(`Restoring ${active.length} active giveaway(s)`);
        for (const giveaway of active)
            scheduleGiveaway(client, giveaway);
    }
    catch (error) {
        logger.error(`Could not restore giveaways: ${error.message}`);
    }
}
//# sourceMappingURL=giveaway.js.map