import { Guild, ChannelType } from 'discord.js';
import { createLogger } from './helpers';

const logger = createLogger('Lockdown');

export interface LockdownResult {
  textChannels: number;
  voiceChannels: number;
}

export async function setLockdown(guild: Guild, enabled: boolean): Promise<LockdownResult> {
  const result: LockdownResult = { textChannels: 0, voiceChannels: 0 };

  const channels = [...guild.channels.cache.values()].filter((c: any) =>
    c.type === ChannelType.GuildText ||
    c.type === ChannelType.GuildAnnouncement ||
    c.type === ChannelType.GuildForum ||
    c.type === ChannelType.GuildVoice ||
    c.type === ChannelType.GuildStageVoice
  );

  // ⚡ توازي: 6 قنوات في كل مرة (بدلاً من تتابعية)
  const queue = channels;
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const channel = queue[cursor++];
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
  };
  const workers = Array.from({ length: Math.min(6, queue.length || 1) }, worker);
  await Promise.all(workers);

  logger.info(
    `${enabled ? '🔒 Lockdown ENABLED' : '🔓 Lockdown DISABLED'} in ${guild.name} ` +
      `(${result.textChannels} text, ${result.voiceChannels} voice)`
  );

  return result;
}
