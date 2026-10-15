// ============================================
// Liberty City Bot - Guild Member Remove Event
// ============================================

import { GuildMember, ChannelType, TextChannel } from 'discord.js';
import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';
import { getGuildSettings, Ticket, UserProfile, Warning, ModerationCase } from '../models';
import { leaveEmbed } from '../utils/embeds';

const logger = createLogger('Event:GuildMemberRemove');

const event: Event = {
  name: 'guildMemberRemove',
  async execute(member: GuildMember) {
    try {
      // 🛡️ Anti-Nuke: رصد الطرد الجماعي + ربط المطرودين برابط الدعوة
      //    (لا يُعطّل رحلة المغادرة — ينفّذ بمعزل عن باقي العمل)
      //    ⚠️ قبل هذه الإضافة كان الطرد الجماعي يمرّ بلا أي استجابة
      ;(member.client as LibertyClient).securityHandler
        .onMemberKick(member)
        .catch(err => logger.warn(`onMemberKick failed: ${err?.message ?? err}`));

      // Leave message
      const leaveResult = await handleLeave(member);
      if (leaveResult !== 'sent' && leaveResult !== 'disabled') {
        logger.warn(`Leave message skipped for ${member.user.tag}: ${leaveResult}`);
      }

      // Log member leave
      await logMemberLeave(member);

      // Cleanup user data (optional - keep for rejoin)
    } catch (error) {
      logger.error('Error in guildMemberRemove:', error);
    }
  },
};

// --------------------------------------------
// Leave Message
// يُستخدم أيضاً من زر "🧪 تجربة" في الإعدادات (force=true)
// --------------------------------------------
export type LeaveResult = 'sent' | 'disabled' | 'no-channel' | 'bad-channel' | 'failed';

export async function handleLeave(
  member: GuildMember,
  opts: { force?: boolean } = {}
): Promise<LeaveResult> {
  const settings = await getGuildSettings(member.guild.id);

  if (!settings.leave?.enabled && !opts.force) return 'disabled';

  const channelId = settings.leave.channelId;
  if (!channelId) return 'no-channel';

  const channel = member.guild.channels.cache.get(channelId) as TextChannel;
  if (!channel || channel.type !== ChannelType.GuildText) return 'bad-channel';

  // Format leave message
  const message = (settings.leave.message || 'وداعاً {user}! نتمنى لك التوفيق.')
    .replace(/{user}/g, member.user.tag)
    .replace(/{user\.mention}/g, `<@${member.id}>`)
    .replace(/{user\.name}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, member.guild.memberCount.toString())
    .replace(/{member\.count}/g, member.guild.memberCount.toString());

  // Send leave embed
  const embed = leaveEmbed({
    user: member.user,
    guild: member.guild,
    memberCount: member.guild.memberCount,
    message,
    embedColor: settings.leave.embedColor || '#FF3366',
  });

  const ok = await channel
    .send({ embeds: [embed] })
    .then(() => true)
    .catch((err) => {
      logger.error('Failed to send leave message:', err);
      return false;
    });
  if (!ok) return 'failed';

  logger.info(`${member.user.tag} left ${member.guild.name}`);
  return 'sent';
}

// --------------------------------------------
// Log Member Leave
// --------------------------------------------
async function logMemberLeave(member: GuildMember): Promise<void> {
  const client = member.client as LibertyClient;
  // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
  client.loggingHandler.handleMemberLeave(member).catch((err) => client.loggingHandler.reportFailure('guildMemberRemove', err));

  // Handle open tickets
  await handleMemberTickets(member);
}

// --------------------------------------------
// Handle Member's Open Tickets
// --------------------------------------------
async function handleMemberTickets(member: GuildMember): Promise<void> {
  try {
    const openTickets = await Ticket.find({
      guildId: member.guild.id,
      userId: member.id,
      status: { $in: ['open', 'claimed', 'waiting'] },
    });

    for (const ticket of openTickets) {
      const channel = member.guild.channels.cache.get(ticket.channelId);
      if (channel && channel.type === ChannelType.GuildText) {
        await channel.send({
          content: `⚠️ مقدم التذكرة ${member.user.tag} غادر السيرفر.`,
        }).catch(() => {});
      }
    }
  } catch (error) {
    logger.error('Error handling member tickets:', error);
  }
}

export default event;