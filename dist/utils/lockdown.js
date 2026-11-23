"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLockdown = setLockdown;
const discord_js_1 = require("discord.js");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('Lockdown');
async function setLockdown(guild, enabled) {
    const result = { textChannels: 0, voiceChannels: 0 };
    const channels = [...guild.channels.cache.values()].filter((c) => c.type === discord_js_1.ChannelType.GuildText ||
        c.type === discord_js_1.ChannelType.GuildAnnouncement ||
        c.type === discord_js_1.ChannelType.GuildForum ||
        c.type === discord_js_1.ChannelType.GuildVoice ||
        c.type === discord_js_1.ChannelType.GuildStageVoice);
    // ⚡ توازي: 6 قنوات في كل مرة (بدلاً من تتابعية)
    const queue = channels;
    let cursor = 0;
    const worker = async () => {
        while (cursor < queue.length) {
            const channel = queue[cursor++];
            try {
                if (channel.type === discord_js_1.ChannelType.GuildText ||
                    channel.type === discord_js_1.ChannelType.GuildAnnouncement ||
                    channel.type === discord_js_1.ChannelType.GuildForum) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: enabled ? false : null,
                        SendMessagesInThreads: enabled ? false : null,
                        CreatePublicThreads: enabled ? false : null,
                        CreatePrivateThreads: enabled ? false : null,
                        AddReactions: enabled ? false : null,
                    });
                    result.textChannels++;
                }
                else if (channel.type === discord_js_1.ChannelType.GuildVoice ||
                    channel.type === discord_js_1.ChannelType.GuildStageVoice) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        Connect: enabled ? false : null,
                        Speak: enabled ? false : null,
                    });
                    result.voiceChannels++;
                }
            }
            catch (error) {
                logger.warn(`Lockdown skip ${channel.id}: ${error.message}`);
            }
        }
    };
    const workers = Array.from({ length: Math.min(6, queue.length || 1) }, worker);
    await Promise.all(workers);
    logger.info(`${enabled ? '🔒 Lockdown ENABLED' : '🔓 Lockdown DISABLED'} in ${guild.name} ` +
        `(${result.textChannels} text, ${result.voiceChannels} voice)`);
    return result;
}
//# sourceMappingURL=lockdown.js.map