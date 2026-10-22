// ============================================
// Liberty City Bot - Guild Member Add Event
// ============================================

import { GuildMember, ChannelType, TextChannel } from 'discord.js';
import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from '../utils/helpers';
import { resolveEmojiShortcodes } from '../utils/emoji';
import { getGuildSettings } from '../models';
import { welcomeEmbed, logEmbed } from '../utils/embeds';

const logger = createLogger('Event:GuildMemberAdd');

const event: Event = {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    const client = member.client as LibertyClient;

    try {
      // Anti-Raid check
      const raidResult = await client.protectionHandler.checkRaid(member);
      if (raidResult.isRaid && raidResult.action) {
        logger.warn(`Raid detected in ${member.guild.name}!`);

        // Execute raid action
        if (raidResult.action.type === 'kick' || raidResult.action.type === 'ban') {
          if (raidResult.action.type === 'ban') {
            await member.ban({ reason: raidResult.action.reason }).catch(() => {});
          } else {
            await member.kick(raidResult.action.reason).catch(() => {});
          }
        }

        // Log the raid
        await logRaid(member, raidResult.action.reason);
        return;
      }

      // 🛡️ Anti-Bot: طرد بوت غير مصرح به (يُتخطى الترحيب تلقائياً)
      const botKicked = await client.securityHandler.onMemberJoin(member);
      if (botKicked) return;

      // 🕵️ Anti-Alt Detection — كشف الحسابات البديلة
      await client.antiAltHandler.onMemberJoin(member);

      // 📨 Invite Tracker — تتبع الدعوة المستخدمة
      await client.inviteTrackerHandler.onMemberJoin(member);

      // Auto-Role
      await handleAutoRole(member);

      // Welcome message
      const welcomeResult = await handleWelcome(member);
      if (welcomeResult !== 'sent' && welcomeResult !== 'disabled') {
        logger.warn(`Welcome skipped for ${member.user.tag}: ${welcomeResult}`);
      }

      // Log member join
      await logMemberJoin(member);
    } catch (error) {
      logger.error('Error in guildMemberAdd:', error);
    }
  },
};

// --------------------------------------------
// Auto-Role
// --------------------------------------------
async function handleAutoRole(member: GuildMember): Promise<void> {
  try {
    const settings = await getGuildSettings(member.guild.id);

    if (!settings.autorole?.enabled || !settings.autorole?.roleId) return;

    const role = member.guild.roles.cache.get(settings.autorole.roleId);
    if (!role) return;

    await member.roles.add(role, 'Liberty City - Auto-Role');
    logger.info(`Auto-role ${role.name} given to ${member.user.tag}`);
  } catch (error) {
    logger.warn(`Failed to give auto-role to ${member.user.tag}:`, error);
  }
}

// --------------------------------------------
// Welcome Message
// يُستخدم أيضاً من زر "🧪 تجربة" في الإعدادات (force=true)
// --------------------------------------------
export type WelcomeResult = 'sent' | 'disabled' | 'no-channel' | 'bad-channel' | 'failed';

/** رسالة الترحيب الخاصة (مشتركة بين الإمبد والبطاقة المرسومة) */
async function sendWelcomeDm(member: GuildMember, settings: any): Promise<void> {
  if (!settings.welcome.dmEnabled) return;

  const dmMessage = (settings.welcome.dmMessage || 'مرحباً بك في {server}! نتمنى لك وقتاً ممتعاً.')
    .replace(/{user}/g, member.user.username)
    .replace(/{server}/g, member.guild.name)
    .replace(/{count}/g, member.guild.memberCount.toString());

  const guildIcon = member.guild.iconURL();
  await member
    .send({
      embeds: [
        {
          color: 0x00d4ff,
          title: `👋 مرحباً بك في ${member.guild.name}!`,
          description: dmMessage,
          ...(guildIcon ? { thumbnail: { url: guildIcon } } : {}),
          footer: { text: 'Liberty City' },
          timestamp: new Date().toISOString(),
        },
      ],
    })
    .catch(() => {}); // Ignore DM failures
}

export async function handleWelcome(
  member: GuildMember,
  opts: { force?: boolean } = {}
): Promise<WelcomeResult> {
  const settings = await getGuildSettings(member.guild.id);

  if (!settings.welcome?.enabled && !opts.force) return 'disabled';

  const channelId = settings.welcome.channelId;
  if (!channelId) return 'no-channel';

  const channel = member.guild.channels.cache.get(channelId) as TextChannel;
  if (!channel || channel.type !== ChannelType.GuildText) return 'bad-channel';

  // Format welcome message (+ 🎨 تحويل اختصارات الإيموجي إلى إيموجي حقيقي)
  const message = resolveEmojiShortcodes(
    (settings.welcome.message || '🎉 مرحباً {user}! أهلاً بك في {server}')
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{user\.tag}/g, member.user.tag)
      .replace(/{user\.name}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{count}/g, member.guild.memberCount.toString())
      .replace(/{member\.count}/g, member.guild.memberCount.toString()),
    member.guild
  );

  // 🖼️ بطاقة مخصصة (ProBot-style): صورة مرسومة بدل الإمبد
  const cardCfg = settings.welcome.card;
  if (cardCfg?.enabled) {
    try {
      const { renderWelcomeCard, CARD_DEFAULTS } = await import('../utils/welcomeCard');
      // دمج مع القيم الافتراضية لضمان وجود كل الخصائص الجديدة
      const fullConfig = { ...CARD_DEFAULTS, ...cardCfg };
      const buffer = await renderWelcomeCard(member, fullConfig);
      const cardContent = message.trim() || `<@${member.id}>`;
      await channel.send({
        content: cardContent,
        files: [{ attachment: buffer, name: 'welcome-card.png' }],
      });
      logger.info(`Welcomed ${member.user.tag} to ${member.guild.name} (card)`);
      await sendWelcomeDm(member, settings);
      return 'sent';
    } catch (error) {
      logger.error('Welcome card failed, falling back to embed:', error);
      // فشل الرسم → نتابع للإمبد العادي
    }
  }

  // Send welcome embed
  const embed = welcomeEmbed({
    user: member.user,
    guild: member.guild,
    memberCount: member.guild.memberCount,
    message,
    embedColor: settings.welcome.embedColor || '#00D4FF',
    embedTitle: settings.welcome.embedTitle || 'مرحباً بك!',
    embedThumbnail: settings.welcome.embedThumbnail,
    imageEnabled: settings.welcome.imageEnabled,
    imageBackground: settings.welcome.imageBackground,
  });

  const ok = await channel
    .send({ content: `<@${member.id}>`, embeds: [embed] })
    .then(() => true)
    .catch((err) => {
      logger.error('Failed to send welcome message:', err);
      return false;
    });
  if (!ok) return 'failed';

  // Send DM if enabled
  await sendWelcomeDm(member, settings);

  logger.info(`Welcomed ${member.user.tag} to ${member.guild.name}`);
  return 'sent';
}

// --------------------------------------------
// Log Member Join
// --------------------------------------------
async function logMemberJoin(member: GuildMember): Promise<void> {
  const client = member.client as LibertyClient;
  // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
  client.loggingHandler.handleMemberJoin(member).catch((err) => client.loggingHandler.reportFailure('guildMemberAdd', err));
}

// --------------------------------------------
// Log Raid
// --------------------------------------------
async function logRaid(member: GuildMember, reason: string): Promise<void> {
  const settings = await getGuildSettings(member.guild.id);

  if (!settings.logging?.enabled || !settings.logging.channelId) return;

  const logChannel = member.guild.channels.cache.get(settings.logging.channelId) as TextChannel;
  if (!logChannel || logChannel.type !== ChannelType.GuildText) return;

  const embed = logEmbed({
    title: '🚨 تم رصد هجوم!',
    description: reason,
    color: '#FF3366',
    user: member.user,
    fields: [
      { name: '👤 العضو', value: `${member}`, inline: true },
      { name: '🆔 المعرف', value: `\`${member.id}\``, inline: true },
    ],
  });

  await logChannel.send({ embeds: [embed] }).catch(() => {});
}

export default event;