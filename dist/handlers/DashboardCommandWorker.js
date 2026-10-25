"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardCommandWorker = void 0;
// --------------------------------------------
// DashboardCommandWorker — ينفّذ أوامر لوحة التحكم عن بعد
// لوحة التحكم (المستضافة على سحابة أو محلياً) تكتب أمراً في مجموعة
// dashboard_commands، وهذا العامل يقرأ الأوامر المعلقة كل ثوانٍ ليتنفيذها.
// --------------------------------------------
const models_1 = require("../models");
class DashboardCommandWorker {
    client;
    intervalRef = null;
    running = false;
    constructor(client) {
        this.client = client;
    }
    start() {
        if (this.intervalRef)
            return;
        // أول تنفيذ بعد 8 ثوانٍ ثم كل 4 ثوانٍ
        setTimeout(() => this.poll().catch(() => { }), 8000);
        this.intervalRef = setInterval(() => this.poll().catch(() => { }), 4000);
        this.intervalRef.unref?.();
        // تنظيف الأوامر القديمة المنفذة كل عشر دقائق
        setInterval(() => {
            models_1.DashboardCommand.deleteMany({
                status: { $in: ['done', 'failed'] },
                createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
            }).catch(() => { });
        }, 10 * 60 * 1000).unref?.();
    }
    stop() {
        if (this.intervalRef)
            clearInterval(this.intervalRef);
        this.intervalRef = null;
    }
    async poll() {
        if (this.running)
            return;
        this.running = true;
        try {
            const commands = await models_1.DashboardCommand.find({ status: 'pending' })
                .sort({ createdAt: 1 })
                .limit(8)
                .lean();
            for (const cmd of commands) {
                if (Date.now() - new Date(cmd.createdAt).getTime() > 3 * 60 * 1000) {
                    await models_1.DashboardCommand.updateOne({ _id: cmd._id }, { status: 'failed', error: 'Expired' });
                    continue;
                }
                await models_1.DashboardCommand.updateOne({ _id: cmd._id }, { status: 'running' });
                try {
                    const result = await this.execute(cmd.command, cmd.guildId, cmd.payload || {});
                    await models_1.DashboardCommand.updateOne({ _id: cmd._id }, { status: 'done', result: result ?? null, error: null, updatedAt: new Date() });
                    this.client.logger?.info?.(`📄 Dashboard command executed: ${cmd.command}`);
                }
                catch (e) {
                    await models_1.DashboardCommand.updateOne({ _id: cmd._id }, { status: 'failed', error: e?.message || 'Execution error', updatedAt: new Date() });
                }
            }
        }
        catch {
            // جدولة صامتة — لا ازدحام في اللوج
        }
        finally {
            this.running = false;
        }
    }
    async execute(command, guildId, payload) {
        // 🔄 مزامنة الإعدادات: مسح كاش الإعدادات فوراً بعد حفظ الداشبورد (لا يحتاج وجود البوت بالسيرفر)
        if (command === 'settings_sync') {
            (0, models_1.invalidateGuildSettings)(guildId);
            return { ok: true, invalidated: true, at: new Date().toISOString() };
        }
        // 🎯 قائمة سيرفرات البوت الفعلية (لا يحتاج وجود بالسيرفر — أمر عام)
        if (command === 'bot_guilds') {
            const gl = this.client.guilds.cache.map((g) => ({
                id: g.id,
                name: g.name,
                icon: typeof g.iconURL === 'function' ? g.iconURL({ size: 128 }) : null,
                memberCount: g.memberCount ?? g.approximateMemberCount ?? null,
            }));
            return { ok: true, total: gl.length, guilds: gl };
        }
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild)
            throw new Error('البوت غير موجود في هذا السيرفر');
        switch (command) {
            // ------------- الأعضاء -------------
            case 'members_list': {
                const members = await guild.members.fetch();
                const list = members.map((m) => ({
                    id: m.id,
                    username: m.user?.username || 'unknown',
                    discriminator: m.user?.discriminator || '0',
                    avatar: m.user?.avatar || null,
                    nickname: m.nickname || null,
                    roles: m.roles.cache
                        .filter((r) => r.id !== guild.id)
                        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position })),
                    joinedAt: m.joinedAt?.toISOString() || null,
                    presence: m.presence?.status || 'offline',
                    bot: m.user?.bot || false,
                }));
                return { total: list.length, members: list };
            }
            case 'roles_list': {
                const roles = guild.roles.cache
                    .filter((r) => r.id !== guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }));
                return { roles };
            }
            case 'member_get': {
                const member = await guild.members.fetch(payload.userId).catch(() => null);
                if (!member)
                    throw new Error('العضو غير موجود');
                const warnings = await models_1.ModerationCase.find({ guildId, targetId: payload.userId })
                    .sort({ createdAt: -1 })
                    .limit(20)
                    .lean();
                return {
                    id: member.id,
                    username: member.user?.username,
                    avatar: member.user?.avatar || null,
                    bot: member.user?.bot || false,
                    presence: member.presence?.status || 'offline',
                    joinedAt: member.joinedAt?.toISOString() || null,
                    createdAt: member.user?.createdAt?.toISOString() || null,
                    roles: member.roles.cache
                        .filter((r) => r.id !== guild.id)
                        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position })),
                    warnings,
                };
            }
            case 'member_warn': {
                const caseIdValue = await (0, models_1.getNextCaseId)(guildId);
                await models_1.ModerationCase.create({
                    guildId,
                    caseId: caseIdValue,
                    type: 'warn',
                    moderatorId: payload.actor || 'dashboard',
                    targetId: payload.userId,
                    reason: payload.reason || 'تحذير من لوحة التحكم',
                    active: true,
                });
                const member = await guild.members.fetch(payload.userId).catch(() => null);
                if (member) {
                    member
                        .send(`⚠️ تم تحذيرك في سيرفر **${guild.name}**\nالسبب: ${payload.reason || 'بدون سبب'}`)
                        .catch(() => { });
                }
                return { success: true };
            }
            case 'member_kick': {
                const member = await guild.members.fetch(payload.userId).catch(() => null);
                if (!member)
                    throw new Error('العضو غير موجود');
                if (!guild.members.me?.permissions.has('KickMembers'))
                    throw new Error('البوت لا يملك صلاحية الطرد');
                await member.kick(payload.reason || 'طرد من لوحة التحكم');
                const caseIdValue = await (0, models_1.getNextCaseId)(guildId);
                await models_1.ModerationCase.create({
                    guildId, caseId: caseIdValue, type: 'kick',
                    moderatorId: payload.actor || 'dashboard',
                    targetId: payload.userId, reason: payload.reason, active: true,
                });
                return { success: true };
            }
            case 'member_ban': {
                if (!guild.members.me?.permissions.has('BanMembers'))
                    throw new Error('البوت لا يملك صلاحية الحظر');
                await guild.members.ban(payload.userId, { reason: payload.reason || 'حظر من لوحة التحكم' });
                const caseIdValue = await (0, models_1.getNextCaseId)(guildId);
                await models_1.ModerationCase.create({
                    guildId, caseId: caseIdValue, type: 'ban',
                    moderatorId: payload.actor || 'dashboard',
                    targetId: payload.userId, reason: payload.reason, active: true,
                });
                return { success: true };
            }
            case 'member_timeout': {
                const member = await guild.members.fetch(payload.userId).catch(() => null);
                if (!member)
                    throw new Error('العضو غير موجود');
                const duration = Number(payload.duration || 0);
                if (duration > 0) {
                    if (!guild.members.me?.permissions.has('ModerateMembers'))
                        throw new Error('البوت لا يملك صلاحية التوقيت');
                    await member.timeout(duration, payload.reason || 'توقيت من لوحة التحكم');
                }
                else {
                    await member.timeout(null, 'إلغاء التوقيت من لوحة التحكم');
                }
                return { success: true };
            }
            case 'member_addrole':
            case 'member_removerole': {
                const member = await guild.members.fetch(payload.userId).catch(() => null);
                if (!member)
                    throw new Error('العضو غير موجود');
                const add = command === 'member_addrole';
                if (add)
                    await member.roles.add(payload.roleId);
                else
                    await member.roles.remove(payload.roleId);
                return { success: true };
            }
            // ------------- التذاكر -------------
            case 'ticket_claim': {
                const ticket = await this.findTicket(guildId, payload);
                if (!ticket)
                    throw new Error('التذكرة غير موجودة');
                await models_1.Ticket.updateOne({ _id: ticket._id }, {
                    status: 'claimed',
                    claimedBy: payload.actor || 'لوحة التحكم',
                    $addToSet: { claimHistory: payload.actor || 'لوحة التحكم' },
                });
                const channel = guild.channels.cache.get(ticket.channelId);
                if (channel?.isTextBased()) {
                    channel.send({ content: `✅ تم استلام التذكرة بواسطة **${payload.actor || 'لوحة التحكم'}**` }).catch(() => { });
                }
                return { success: true };
            }
            case 'ticket_unclaim': {
                const ticket = await this.findTicket(guildId, payload);
                if (!ticket)
                    throw new Error('التذكرة غير موجودة');
                await models_1.Ticket.updateOne({ _id: ticket._id }, { status: 'open', claimedBy: null });
                return { success: true };
            }
            case 'ticket_close': {
                const ticket = await this.findTicket(guildId, payload);
                if (!ticket)
                    throw new Error('التذكرة غير موجودة');
                await models_1.Ticket.updateOne({ _id: ticket._id }, { status: 'closed', closedBy: payload.actor || 'لوحة التحكم', closeReason: payload.reason || null, closedAt: new Date() });
                const channel = guild.channels.cache.get(ticket.channelId);
                if (channel)
                    channel.delete(payload.reason || `إغلاق بواسطة ${payload.actor || 'لوحة التحكم'}`).catch(() => { });
                return { success: true };
            }
            case 'ticket_delete': {
                const ticket = await this.findTicket(guildId, payload);
                if (!ticket)
                    throw new Error('التذكرة غير موجودة');
                await models_1.Ticket.deleteOne({ _id: ticket._id });
                const channel = guild.channels.cache.get(ticket.channelId);
                if (channel)
                    channel.delete('حذف التذكرة من لوحة التحكم').catch(() => { });
                return { success: true };
            }
            case 'ticket_reply': {
                const ticket = await this.findTicket(guildId, payload);
                if (!ticket)
                    throw new Error('التذكرة غير موجودة');
                const channel = guild.channels.cache.get(ticket.channelId);
                if (!channel?.isTextBased())
                    throw new Error('روم التذكرة غير موجود');
                await channel.send({ content: `✉️ **${payload.actor || 'لوحة التحكم'}**: ${payload.content || ''}` });
                return { success: true };
            }
            // ------------- إحصائيات وقنوات -------------
            case 'ping': {
                return { pong: true, at: new Date().toISOString() };
            }
            case 'guild_stats': {
                const members = await guild.members.fetch();
                const list = Array.from(members.values());
                const isOnline = (m) => ['online', 'idle', 'dnd'].includes(m.presence?.status || 'offline');
                return {
                    memberCount: guild.memberCount,
                    fetched: list.length,
                    onlineCount: list.filter(isOnline).length,
                    botCount: list.filter((m) => m.user?.bot).length,
                    ownerTag: (await guild.fetchOwner().catch(() => null))?.user?.tag || null,
                    roleCount: guild.roles.cache.size,
                    channelCount: guild.channels.cache.size,
                    textChannelCount: guild.channels.cache.filter((c) => c.type === 0).size,
                    voiceChannelCount: guild.channels.cache.filter((c) => c.type === 2).size,
                    categoryCount: guild.channels.cache.filter((c) => c.type === 4).size,
                    boosts: guild.premiumSubscriptionCount || 0,
                    boostLevel: guild.premiumTier ?? 0,
                    icon: guild.icon || null,
                    banner: guild.banner || null,
                    createdAt: guild.createdAt?.toISOString() || null,
                };
            }
            case 'channels_list': {
                const channels = guild.channels.cache
                    .sort((a, b) => (a.rawPosition - b.rawPosition))
                    .map((c) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type, // 0=text 2=voice 4=category 5=announcement 13=stage 15=forum
                    parentId: c.parentId || null,
                    position: c.rawPosition,
                }));
                return { channels };
            }
            case 'welcome_test': {
                const channel = guild.channels.cache.get(payload.channelId);
                if (!channel?.isTextBased())
                    throw new Error('القناة غير موجودة');
                const { GuildSettings } = require('../models');
                const doc = await GuildSettings.findOne({ guildId }).lean();
                const welcome = doc?.welcome || {};
                const template = payload.message || welcome.message || 'أهلاً بك {member} في {server} 🎉';
                const content = template
                    .replace(/\{member\}/g, `@${payload.actor || 'عضو جديد'}`)
                    .replace(/\{user\}/g, `@${payload.actor || 'عضو جديد'}`)
                    .replace(/\{server\}/g, guild.name)
                    .replace(/\{count\}/g, String(guild.memberCount));
                await channel.send({ content: `🧪 **تجربة رسالة الترحيب:**\n${content}` });
                return { success: true };
            }
            case 'broadcast': {
                // إعلان جماعي — DM للكل أو رسالة في القنوات العامة
                const { GuildSettings } = require('../models');
                const dc = await GuildSettings.findOne({ guildId }).lean();
                const type = payload.type === 'channel' ? 'channel' : 'dm';
                const content = String(payload.content || '').slice(0, 1500);
                if (!content)
                    throw new Error('لا يوجد محتوى للإعلان');
                let sent = 0, failed = 0;
                const push = async (fid, at, sentBy, ok) => {
                    await GuildSettings.updateOne({ guildId }, { $push: { 'protection.announcements.history': { type, content, at: at || new Date(), sentBy, sent: ok } } }).catch(() => { });
                };
                const at = new Date(), sentBy = payload.actor || 'لوحة التحكم';
                if (type === 'dm') {
                    const members = await guild.members.fetch();
                    const targets = Array.from(members.filter((m) => !m.user?.bot).values());
                    for (const m of targets) {
                        try {
                            await m.send({ content });
                            sent++;
                        }
                        catch {
                            failed++;
                        }
                        await new Promise((r) => setTimeout(r, 250)); // rate-limit آمن
                    }
                }
                else {
                    const chans = guild.channels.cache.filter((c) => c.type === 0 && c.permissionsFor(guild.members.me)?.has('SendMessages'));
                    for (const [, c] of chans) {
                        try {
                            await c.send({ content });
                            sent++;
                        }
                        catch {
                            failed++;
                        }
                        await new Promise((r) => setTimeout(r, 400));
                    }
                }
                await push(guildId, at, sentBy, true);
                return { success: true, sent, failed, type };
            }
            // ------------- أخرى -------------
            case 'guild_leave': {
                await guild.leave();
                return { success: true };
            }
            default:
                throw new Error(`Unknown dashboard command: ${command}`);
        }
    }
    async findTicket(guildId, payload) {
        if (String(payload.ticketId).match(/^[0-9a-fA-F]{24}$/)) {
            const byId = await models_1.Ticket.findById(payload.ticketId).lean();
            if (byId && String(byId.guildId) === guildId)
                return byId;
        }
        return await models_1.Ticket.findOne({ guildId, channelId: String(payload.ticketId) }).lean();
    }
}
exports.DashboardCommandWorker = DashboardCommandWorker;
//# sourceMappingURL=DashboardCommandWorker.js.map