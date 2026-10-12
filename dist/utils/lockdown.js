"use strict";
// ============================================
// Liberty City Bot - Lockdown Utility (وضع الطوارئ)
// يقفل الكتابة في القنوات النصية والدخول في الصوتية
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLockdown = setLockdown;
const discord_js_1 = require("discord.js");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('Lockdown');
/**
 * تفعيل/إلغاء وضع الطوارئ في جميع قنوات السيرفر
 * - التفعيل: منع @everyone من الكتابة في النصية + الدخول في الصوتية
 * - الإلغاء: إزالة الصلاحيات الممنوحة (تستعيد الإعدادات الأصلية للقناة)
 */
async function setLockdown(guild, enabled) {
    const result = { textChannels: 0, voiceChannels: 0 };
    const channels = [...guild.channels.cache.values()];
    for (const channel of channels) {
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
    logger.info(`${enabled ? '🔒 Lockdown ENABLED' : '🔓 Lockdown DISABLED'} in ${guild.name} ` +
        `(${result.textChannels} text, ${result.voiceChannels} voice)`);
    return result;
}
//# sourceMappingURL=lockdown.js.map