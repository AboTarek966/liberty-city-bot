// --------------------------------------------
// DashboardCommandWorker — ينفّذ أوامر لوحة التحكم عن بعد
// لوحة التحكم (المستضافة على سحابة أو محلياً) تكتب أمراً في مجموعة
// dashboard_commands، وهذا العامل يقرأ الأوامر المعلقة كل ثوانٍ ليتنفيذها.
// --------------------------------------------
import {
  DashboardCommand,
  ModerationCase,
  Ticket,
  UserProfile,
  getNextCaseId,
} from '../models';

export class DashboardCommandWorker {
  private client: any;
  private intervalRef: NodeJS.Timeout | null = null;
  private running = false;

  constructor(client: any) {
    this.client = client;
  }

  start() {
    if (this.intervalRef) return;
    // أول تنفيذ بعد 8 ثوانٍ ثم كل 4 ثوانٍ
    setTimeout(() => this.poll().catch(() => {}), 8000);
    this.intervalRef = setInterval(() => this.poll().catch(() => {}), 4000);
    this.intervalRef.unref?.();
    // تنظيف الأوامر القديمة المنفذة كل عشر دقائق
    setInterval(() => {
      DashboardCommand.deleteMany({
        status: { $in: ['done', 'failed'] },
        createdAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) },
      }).catch(() => {});
    }, 10 * 60 * 1000).unref?.();
  }

  stop() {
    if (this.intervalRef) clearInterval(this.intervalRef);
    this.intervalRef = null;
  }

  private async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const commands = await DashboardCommand.find({ status: 'pending' })
        .sort({ createdAt: 1 })
        .limit(8)
        .lean<IDashboardDoc[]>();
      for (const cmd of commands) {
        if (Date.now() - new Date(cmd.createdAt).getTime() > 3 * 60 * 1000) {
          await DashboardCommand.updateOne({ _id: cmd._id }, { status: 'failed', error: 'Expired' });
          continue;
        }
        await DashboardCommand.updateOne({ _id: cmd._id }, { status: 'running' });
        try {
          const result = await this.execute(cmd.command, cmd.guildId, cmd.payload || {});
          await DashboardCommand.updateOne(
            { _id: cmd._id },
            { status: 'done', result: result ?? null, error: null, updatedAt: new Date() }
          );
          this.client.logger?.info?.(`📄 Dashboard command executed: ${cmd.command}`);
        } catch (e: any) {
          await DashboardCommand.updateOne(
            { _id: cmd._id },
            { status: 'failed', error: e?.message || 'Execution error', updatedAt: new Date() }
          );
        }
      }
    } catch {
      // جدولة صامتة — لا ازدحام في اللوج
    } finally {
      this.running = false;
    }
  }

  private async execute(command: string, guildId: string, payload: any): Promise<any> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) throw new Error('البوت غير موجود في هذا السيرفر');

    switch (command) {
      // ------------- الأعضاء -------------
      case 'members_list': {
        const members = await guild.members.fetch();
        const list = members.map((m: any) => ({
          id: m.id,
          username: m.user?.username || 'unknown',
          discriminator: m.user?.discriminator || '0',
          avatar: m.user?.avatar || null,
          nickname: m.nickname || null,
          roles: m.roles.cache
            .filter((r: any) => r.id !== guild.id)
            .map((r: any) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position })),
          joinedAt: m.joinedAt?.toISOString() || null,
          presence: m.presence?.status || 'offline',
          bot: m.user?.bot || false,
        }));
        return { total: list.length, members: list };
      }

      case 'roles_list': {
        const roles = guild.roles.cache
          .filter((r: any) => r.id !== guild.id)
          .sort((a: any, b: any) => b.position - a.position)
          .map((r: any) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }));
        return { roles };
      }

      case 'member_get': {
        const member = await guild.members.fetch(payload.userId).catch(() => null);
        if (!member) throw new Error('العضو غير موجود');
        const warnings = await ModerationCase.find({ guildId, targetId: payload.userId })
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
            .filter((r: any) => r.id !== guild.id)
            .map((r: any) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position })),
          warnings,
        };
      }

      case 'member_warn': {
        const caseIdValue = await getNextCaseId(guildId);
        await ModerationCase.create({
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
            .catch(() => {});
        }
        return { success: true };
      }

      case 'member_kick': {
        const member = await guild.members.fetch(payload.userId).catch(() => null);
        if (!member) throw new Error('العضو غير موجود');
        if (!guild.members.me?.permissions.has('KickMembers')) throw new Error('البوت لا يملك صلاحية الطرد');
        await member.kick(payload.reason || 'طرد من لوحة التحكم');
        const caseIdValue = await getNextCaseId(guildId);
        await ModerationCase.create({
          guildId, caseId: caseIdValue, type: 'kick',
          moderatorId: payload.actor || 'dashboard',
          targetId: payload.userId, reason: payload.reason, active: true,
        });
        return { success: true };
      }

      case 'member_ban': {
        if (!guild.members.me?.permissions.has('BanMembers')) throw new Error('البوت لا يملك صلاحية الحظر');
        await guild.members.ban(payload.userId, { reason: payload.reason || 'حظر من لوحة التحكم' });
        const caseIdValue = await getNextCaseId(guildId);
        await ModerationCase.create({
          guildId, caseId: caseIdValue, type: 'ban',
          moderatorId: payload.actor || 'dashboard',
          targetId: payload.userId, reason: payload.reason, active: true,
        });
        return { success: true };
      }

      case 'member_timeout': {
        const member = await guild.members.fetch(payload.userId).catch(() => null);
        if (!member) throw new Error('العضو غير موجود');
        const duration = Number(payload.duration || 0);
        if (duration > 0) {
          if (!guild.members.me?.permissions.has('ModerateMembers')) throw new Error('البوت لا يملك صلاحية التوقيت');
          await member.timeout(duration, payload.reason || 'توقيت من لوحة التحكم');
        } else {
          await member.timeout(null, 'إلغاء التوقيت من لوحة التحكم');
        }
        return { success: true };
      }

      case 'member_addrole':
      case 'member_removerole': {
        const member = await guild.members.fetch(payload.userId).catch(() => null);
        if (!member) throw new Error('العضو غير موجود');
        const add = command === 'member_addrole';
        if (add) await member.roles.add(payload.roleId);
        else await member.roles.remove(payload.roleId);
        return { success: true };
      }

      // ------------- التذاكر -------------
      case 'ticket_claim': {
        const ticket = await this.findTicket(guildId, payload);
        if (!ticket) throw new Error('التذكرة غير موجودة');
        await Ticket.updateOne(
          { _id: ticket._id },
          {
            status: 'claimed',
            claimedBy: payload.actor || 'لوحة التحكم',
            $addToSet: { claimHistory: payload.actor || 'لوحة التحكم' },
          }
        );
        const channel = guild.channels.cache.get(ticket.channelId);
        if (channel?.isTextBased()) {
          channel.send({ content: `✅ تم استلام التذكرة بواسطة **${payload.actor || 'لوحة التحكم'}**` }).catch(() => {});
        }
        return { success: true };
      }

      case 'ticket_unclaim': {
        const ticket = await this.findTicket(guildId, payload);
        if (!ticket) throw new Error('التذكرة غير موجودة');
        await Ticket.updateOne({ _id: ticket._id }, { status: 'open', claimedBy: null });
        return { success: true };
      }

      case 'ticket_close': {
        const ticket = await this.findTicket(guildId, payload);
        if (!ticket) throw new Error('التذكرة غير موجودة');
        await Ticket.updateOne(
          { _id: ticket._id },
          { status: 'closed', closedBy: payload.actor || 'لوحة التحكم', closeReason: payload.reason || null, closedAt: new Date() }
        );
        const channel = guild.channels.cache.get(ticket.channelId);
        if (channel) channel.delete(payload.reason || `إغلاق بواسطة ${payload.actor || 'لوحة التحكم'}`).catch(() => {});
        return { success: true };
      }

      case 'ticket_delete': {
        const ticket = await this.findTicket(guildId, payload);
        if (!ticket) throw new Error('التذكرة غير موجودة');
        await Ticket.deleteOne({ _id: ticket._id });
        const channel = guild.channels.cache.get(ticket.channelId);
        if (channel) channel.delete('حذف التذكرة من لوحة التحكم').catch(() => {});
        return { success: true };
      }

      case 'ticket_reply': {
        const ticket = await this.findTicket(guildId, payload);
        if (!ticket) throw new Error('التذكرة غير موجودة');
        const channel = guild.channels.cache.get(ticket.channelId);
        if (!channel?.isTextBased()) throw new Error('روم التذكرة غير موجود');
        await channel.send({ content: `✉️ **${payload.actor || 'لوحة التحكم'}**: ${payload.content || ''}` });
        return { success: true };
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

  private async findTicket(guildId: string, payload: any) {
    if (String(payload.ticketId).match(/^[0-9a-fA-F]{24}$/)) {
      const byId = await Ticket.findById(payload.ticketId).lean();
      if (byId && String((byId as any).guildId) === guildId) return byId;
    }
    return await Ticket.findOne({ guildId, channelId: String(payload.ticketId) }).lean();
  }
}

interface IDashboardDoc {
  _id: string;
  command: string;
  guildId: string;
  payload: Record<string, any>;
  createdAt: Date;
}
