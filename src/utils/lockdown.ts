// ============================================
// Liberty City Bot - Lockdown Utility (وضع الطوارئ)
// يقفل الكتابة في القنوات النصية والدخول في الصوتية
// ============================================

import { Guild, ChannelType } from 'discord.js';
import { createLogger } from './helpers';

const logger = createLogger('Lockdown');

export interface LockdownResult {
  textChannels: number;
  voiceChannels: number;
}

/**
 * تفعيل/إلغاء وضع الطوارئ في جميع قنوات السيرفر
 * - التفعيل: منع @everyone من الكتابة في النصية + الدخول في الصوتية
 * - الإلغاء: إزالة الصلاحيات الممنوحة (تستعيد الإعدادات الأصلية للقناة)
 */
export async function setLockdown(guild: Guild, enabled: boolean): Promise<LockdownResult> {
  const result: LockdownResult = { textChannels: 0, voiceChannels: 0 };

  const channels = [...guild.channels.cache.values()];

  for (const channel of channels) {
    try {
      if (
        channel.type === ChannelType.GuildText ||
        channel.type === ChannelType.GuildAnnouncement ||
        channel.type === ChannelType.GuildForum
      ) {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: enabled ? false : null,
          SendMessagesInThreads: enabled ? false : null,
          CreatePublicThreads: enabled ? false : null,
          CreatePrivateThreads: enabled ? false : null,
          AddReactions: enabled ? false : null,
        });
        result.textChannels++;
      } else if (
        channel.type === ChannelType.GuildVoice ||
        channel.type === ChannelType.GuildStageVoice
      ) {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          Connect: enabled ? false : null,
          Speak: enabled ? false : null,
        });
        result.voiceChannels++;
      }
    } catch (error: any) {
      logger.warn(`Lockdown skip ${channel.id}: ${error.message}`);
    }
  }

  logger.info(
    `${enabled ? '🔒 Lockdown ENABLED' : '🔓 Lockdown DISABLED'} in ${guild.name} ` +
      `(${result.textChannels} text, ${result.voiceChannels} voice)`
  );

  return result;
}
