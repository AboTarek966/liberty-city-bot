"use strict";
// ============================================
// Omni Bot - Giveaway Engine
// ============================================
// سحب كامل: إنشاء، مشاركة، سحب الفائز، إعادة السحب، واستعادة بعد
// إعادة تشغيل البوت. كل الحالة محفوظة في MongoDB.
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateShortId = generateShortId;
exports.formatRemaining = formatRemaining;
exports.uniqueEntryCount = uniqueEntryCount;
exports.dedupeGiveawayEntries = dedupeGiveawayEntries;
exports.requirementLines = requirementLines;
exports.invalidateInviteCache = invalidateInviteCache;
exports.checkGiveawayRequirements = checkGiveawayRequirements;
exports.buildGiveawayPayload = buildGiveawayPayload;
exports.refreshGiveawayMessage = refreshGiveawayMessage;
exports.createGiveaway = createGiveaway;
exports.findGiveaway = findGiveaway;
exports.toggleGiveawayEntry = toggleGiveawayEntry;
exports.endGiveaway = endGiveaway;
exports.findDefaultGiveawayForWinner = findDefaultGiveawayForWinner;
exports.addGiveawayWinners = addGiveawayWinners;
exports.parseUserMentions = parseUserMentions;
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
// 🧹 عدد المشاركين الفريد: دائماً فريد (حتى لا يتذبذب العداد بسبب بيانات قديمة مكررة)
function uniqueEntryCount(giveaway) {
    return new Set((giveaway.entries || []).map(String)).size;
}
// 🧹 إزالة أي تكرارات قديمة في المشاركات (من قبل إصلاح العداد) — تُستدعى قبل أي قراءة/عرض
function dedupeGiveawayEntries(giveaway) {
    const unique = Array.from(new Set(giveaway.entries || []));
    if (unique.length !== (giveaway.entries || []).length) {
        giveaway.entries = unique;
        return true;
    }
    return false;
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
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(ended ? `🏁 انتهى السحب — ${giveaway.prize}` : `🎉 ${giveaway.prize}`)
        .setColor(ended ? embeds_1.Colors.Grey : embeds_1.Colors.primary)
        .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guildName || 'Omni'}` })
        .setTimestamp();
    const participantCount = uniqueEntryCount(giveaway);
    const lines = [];
    if (giveaway.description)
        lines.push(giveaway.description, '');
    lines.push(ended
        ? `> 🏁 **انتهى السحب** ${giveaway.endedAt ? `<t:${Math.floor(new Date(giveaway.endedAt).getTime() / 1000)}:R>` : ''}`
        : `> ⏳ **ينتهي:** <t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)`, `> 👥 **المشاركون:** \`${participantCount}\``, `> 🏆 **عدد الفائزين:** \`${giveaway.winnersCount}\``, `> 🎩 **صاحب السحب:** <@${giveaway.hostId}>`);
    const reqLines = requirementLines(giveaway.requirements);
    if (reqLines.length) {
        lines.push('', '**📋 شروط المشاركة:**', ...reqLines);
    }
    if (ended) {
        lines.push('', winners.length
            ? `**🏆 الفائزون:** ${winners.map(id => `<@${id}>`).join('، ')}`
            : state.awaitingWinner
                ? '**🏆 الفائزون:** ⏳ بانتظار الإدارة تعلن الفائز (`الفائز @العضو`)'
                : '**🏆 الفائزون:** لا يوجد — لم يشارك أحد');
    }
    // ملاحظة: لا نكتب "الوقت المتبقي" كنص ثابت — الرقم كان بيقف عند قراءته.
    // ديسكورد يعرض <t:…:R> (ينتهي بعد …) بشكل حي بدون أي تحديث من البوت.
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
        // 🧹 تنظيف التكرارات في الذاكرة فقط — لا نحفظ الوثيقة هنا حتى لا نمسخ
        // مشاركات ذرّية جرت بين القراءة والحفظ (الضغطات المتزامنة كانت هي سبب تذبذب العداد).
        dedupeGiveawayEntries(giveaway);
        const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
        if (!channel || !channel.isTextBased())
            return;
        const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (!message)
            return;
        const options = await getGiveawayOptions(giveaway.guildId);
        const awaitingWinner = !!giveaway.ended && !giveaway.winnerIds?.length && options.manualWinners;
        const payload = buildGiveawayPayload(giveaway, { awaitingWinner }, client.guilds.cache.get(giveaway.guildId)?.name);
        await message.edit({ embeds: payload.embeds, components: payload.components }).catch(() => { });
    }
    catch (error) {
        logger.debug(`Could not refresh giveaway ${giveaway.shortId}: ${error.message}`);
    }
}
async function getGiveawayOptions(guildId) {
    const settings = await (0, models_1.getGuildSettings)(guildId).catch(() => null);
    const cfg = settings?.giveaways;
    return {
        dmWinners: cfg?.dmWinners !== false,
        pingWinners: cfg?.pingWinners !== false,
        manualWinners: cfg?.manualWinners !== false,
        logChannelId: cfg?.logChannelId,
    };
}
async function sendGiveawayLog(client, giveaway, logChannelId, embed) {
    if (!logChannelId)
        return;
    try {
        const channel = await client.channels.fetch(logChannelId).catch(() => null);
        if (!channel || !channel.isTextBased())
            return;
        await channel.send({ embeds: [embed] }).catch(() => { });
    }
    catch (error) {
        logger.debug(`Could not send giveaway log: ${error.message}`);
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
    // ⚙️ لا نحفظ الوثيقة كما هي — نعدل فقط بشكل ذري ($pull/$addToSet) حتى لا نرجع العداد للخلف
    const armed = giveaway.entries.includes(member.id);
    if (armed) {
        // المغادرة ذرية
        const pull = await models_1.Giveaway.updateOne({ _id: giveaway._id, entries: member.id }, { $pull: { entries: member.id } });
        const fresh = await models_1.Giveaway.findById(giveaway._id);
        if (fresh) {
            dedupeGiveawayEntries(fresh);
            await refreshGiveawayMessage(client, fresh);
            return { ok: true, left: true, giveaway: fresh };
        }
        return { ok: true, left: true, giveaway };
    }
    const inviteCounts = (giveaway.requirements?.minInvites || 0) > 0
        ? await countInvitesByUser(member.guild)
        : undefined;
    const missing = await checkGiveawayRequirements(member.guild, member, giveaway.requirements, inviteCounts);
    if (missing.length) {
        return { ok: false, reason: `لا تستوفي الشروط:\n> • ${missing.join('\n> • ')}` };
    }
    // الإضافة ذرية — تُتجاهل بصمت إن كان العضو انضم للتو في ضغطة متزامنة
    await models_1.Giveaway.updateOne({ _id: giveaway._id, entries: { $ne: member.id } }, { $addToSet: { entries: member.id } });
    const fresh = await models_1.Giveaway.findById(giveaway._id);
    if (fresh) {
        dedupeGiveawayEntries(fresh);
        await refreshGiveawayMessage(client, fresh);
        return { ok: true, left: false, giveaway: fresh };
    }
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
    let winners = pickRandom(eligible, giveaway.winnersCount).map(m => m.id);
    const optionsEarly = await getGiveawayOptions(giveaway.guildId);
    // ✋ الوضع اليدوي: لا يسحب البوت فائزاً — الإدارة تعلن الفائز بنفسها
    if (optionsEarly.manualWinners) {
        winners = [];
    }
    giveaway.ended = true;
    giveaway.endedAt = new Date();
    giveaway.winnerIds = winners;
    await giveaway.save();
    clearGiveawayTimer(giveaway._id.toString());
    await refreshGiveawayMessage(client, giveaway);
    const options = await getGiveawayOptions(giveaway.guildId);
    const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
    if (channel && channel.isTextBased()) {
        const announcement = new discord_js_1.EmbedBuilder()
            .setTitle('🎉 نتيجة السحب')
            .setColor(winners.length ? embeds_1.Colors.success : embeds_1.Colors.warning)
            .setDescription(`**الجائزة:** ${giveaway.prize}\n` +
            `**المشاركون:** \`${uniqueEntryCount(giveaway)}\`\n\n` +
            (winners.length
                ? `🏆 **الفائزون:** ${winners.map(id => `<@${id}>`).join('، ')}\n\n` +
                    `> 📩 سيتم التواصل معكم لاستلام الجائزة. مبروك!`
                : optionsEarly.manualWinners
                    ? `✋ **انتهى وقت السحب** — بانتظار الإدارة تعلن الفائز يدوياً (\`الفائز @العضو\`)`
                    : `😔 **لا يوجد فائز** — لم يستوفِ أحد الشروط أو لم يشارك أحد.`))
            .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guild.name}` })
            .setTimestamp();
        await channel.send({
            content: options.pingWinners && winners.length
                ? winners.map(id => `<@${id}>`).join(' ')
                : undefined,
            embeds: [announcement],
        }).catch(() => { });
    }
    if (options.dmWinners) {
        for (const winnerId of winners) {
            const member = guild.members.cache.get(winnerId);
            if (member) {
                await member.send(`🎉 مبروك! لقد فزت في سحب **${giveaway.prize}** في سيرفر **${guild.name}**.\n` +
                    `تواصل مع الإدارة لاستلام جائزتك.`).catch(() => { });
            }
        }
    }
    await sendGiveawayLog(client, giveaway, options.logChannelId, new discord_js_1.EmbedBuilder()
        .setTitle('🏁 سجل سحب — انتهى')
        .setColor(winners.length ? embeds_1.Colors.success : embeds_1.Colors.warning)
        .setDescription(`> 🎁 **الجائزة:** ${giveaway.prize}\n` +
        `> 🆔 **المعرّف:** \`${giveaway.shortId}\`\n` +
        `> 👥 **المشاركون:** \`${uniqueEntryCount(giveaway)}\`\n` +
        `> 🎩 **صاحب السحب:** <@${giveaway.hostId}>\n` +
        `> 🏆 **الفائزون:** ${winners.length ? winners.map(id => `<@${id}>`).join('، ') : 'لا يوجد'}`)
        .setFooter({ text: guild.name })
        .setTimestamp());
    logger.info(`Giveaway ${giveaway.shortId} ended — winners: ${winners.join(', ') || 'none'}`);
    return { ok: true, winners, giveaway };
}
// --------------------------------------------
// ✋ الإعلان اليدوي عن الفائزين — الإدارة تحدد الفائز بدل السحب العشوائي
// --------------------------------------------
async function findDefaultGiveawayForWinner(guildId) {
    // 1) آخر سحب منتهٍ بدون فائز معلن
    const pending = await models_1.Giveaway.findOne({ guildId, ended: true, winnerIds: { $size: 0 } })
        .sort({ endedAt: -1, createdAt: -1 })
        .catch(() => null);
    if (pending)
        return pending;
    // 2) آخر سحب أُنشئ (حتى لو شغال — يحذّر لاحقاً)
    const latest = await models_1.Giveaway.findOne({ guildId })
        .sort({ createdAt: -1 })
        .catch(() => null);
    return latest;
}
/**
 * يعلن الفائزين يدوياً لسحب معيّن (أو الافتراضي).
 * - ينهي السحب إن لم ينتهِ بعد.
 * - يدمج الفائزين مع القائمة الحالية (بدون تكرار).
 */
async function addGiveawayWinners(client, guildId, ref, winnerIds) {
    const ids = Array.from(new Set(winnerIds.filter(id => /^\d{17,20}$/.test(String(id))))).slice(0, 20);
    if (!ids.length)
        return { ok: false, reason: '❌ منشن عضو واحد على الأقل (مثال: `الفائز @العضو`)' };
    let giveaway = null;
    if (ref && ref.trim()) {
        giveaway = await findGiveaway(guildId, ref);
        if (!giveaway)
            return { ok: false, reason: '❌ لم أجد هذا السحب' };
    }
    else {
        giveaway = await findDefaultGiveawayForWinner(guildId);
        if (!giveaway)
            return { ok: false, reason: '❌ لا يوجد أي سحب في هذا السيرفر — أنشئ سحباً أولاً' };
    }
    const wasEnded = !!giveaway.ended;
    if (!giveaway.ended) {
        giveaway.ended = true;
        giveaway.endedAt = new Date();
        clearGiveawayTimer(giveaway._id.toString());
    }
    dedupeGiveawayEntries(giveaway);
    giveaway.winnerIds = Array.from(new Set([...(giveaway.winnerIds || []), ...ids]));
    await giveaway.save();
    await refreshGiveawayMessage(client, giveaway);
    const guild = client.guilds.cache.get(guildId);
    const options = await getGiveawayOptions(guildId);
    const channel = guild ? await client.channels.fetch(giveaway.channelId).catch(() => null) : null;
    if (channel && channel.isTextBased()) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🏆 نتيجة السحب')
            .setColor(embeds_1.Colors.success)
            .setDescription(`**الجائزة:** ${giveaway.prize}\n` +
            `**المشاركون:** \`${uniqueEntryCount(giveaway)}\`\n\n` +
            `🎉 **الفائزون:** ${giveaway.winnerIds.map(id => `<@${id}>`).join('، ')}\n\n` +
            `> 📩 سيتم التواصل معكم لاستلام الجائزة. مبروك!`)
            .setFooter({ text: `Giveaway ID: ${giveaway.shortId} • ${guild?.name || 'Omni'}` })
            .setTimestamp();
        await channel.send({
            content: options.pingWinners ? giveaway.winnerIds.map(id => `<@${id}>`).join(' ') : undefined,
            embeds: [embed],
        }).catch(() => { });
    }
    // الرسائل الخاصة للفائزين الجدد فقط
    if (options.dmWinners && guild) {
        for (const winnerId of ids) {
            const member = guild.members.cache.get(winnerId);
            if (member) {
                await member.send(`🎉 مبروك! لقد فزت في سحب **${giveaway.prize}** في سيرفر **${guild.name}**.\n` +
                    `تواصل مع الإدارة لاستلام جائزتك.`).catch(() => { });
            }
        }
    }
    await sendGiveawayLog(client, giveaway, options.logChannelId, new discord_js_1.EmbedBuilder()
        .setTitle('🏆 سجل سحب — الفائز أُعلن يدوياً')
        .setColor(embeds_1.Colors.success)
        .setDescription(`> 🎁 **الجائزة:** ${giveaway.prize}\n` +
        `> 🆔 **المعرّف:** \`${giveaway.shortId}\`\n` +
        `> 👥 **المشاركون:** \`${uniqueEntryCount(giveaway)}\`\n` +
        `> 🎩 **صاحب السحب:** <@${giveaway.hostId}>\n` +
        `> 🏆 **الفائزون:** ${giveaway.winnerIds.map(id => `<@${id}>`).join('، ')}${wasEnded ? '' : ' — أُنهي السحب الآن'}`)
        .setFooter({ text: guild?.name || 'Omni' })
        .setTimestamp());
    logger.info(`Giveaway ${giveaway.shortId} manual winners set: ${giveaway.winnerIds.join(', ')}`);
    return { ok: true, winners: giveaway.winnerIds, giveaway, finishedNow: !wasEnded };
}
/** استخراج معرّفات المنشن من نص رسالة — <@!id> أو <@id> أو آيدي خام */
function parseUserMentions(text) {
    const ids = new Set();
    for (const m of String(text || '').matchAll(/<@!?(\d{17,20})>/g))
        ids.add(m[1]);
    for (const m of String(text || '').matchAll(/\b(\d{17,20})\b/g))
        ids.add(m[1]);
    return [...ids];
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
    const options = await getGiveawayOptions(giveaway.guildId);
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
            content: options.pingWinners ? winners.map(id => `<@${id}>`).join(' ') : undefined,
            embeds: [embed],
        }).catch(() => { });
    }
    if (options.dmWinners) {
        for (const winnerId of winners) {
            const member = guild.members.cache.get(winnerId);
            if (member) {
                await member.send(`🎉 مبروك! لقد فزت في إعادة سحب **${giveaway.prize}** في سيرفر **${guild.name}**.\n` +
                    `تواصل مع الإدارة لاستلام جائزتك.`).catch(() => { });
            }
        }
    }
    await sendGiveawayLog(client, giveaway, options.logChannelId, new discord_js_1.EmbedBuilder()
        .setTitle('🔄 سجل سحب — إعادة سحب')
        .setColor(embeds_1.Colors.success)
        .setDescription(`> 🎁 **الجائزة:** ${giveaway.prize}\n` +
        `> 🆔 **المعرّف:** \`${giveaway.shortId}\`\n` +
        `> 🏆 **الفائزون الجدد:** ${winners.map(id => `<@${id}>`).join('، ')}`)
        .setFooter({ text: guild.name })
        .setTimestamp());
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
        // 🧹 تنظيف التكرارات القديمة في المشاركات مرة واحدة عند الإقلاع
        for (const giveaway of active) {
            if (dedupeGiveawayEntries(giveaway))
                await giveaway.save().catch(() => { });
            scheduleGiveaway(client, giveaway);
        }
    }
    catch (error) {
        logger.error(`Could not restore giveaways: ${error.message}`);
    }
}
//# sourceMappingURL=giveaway.js.map