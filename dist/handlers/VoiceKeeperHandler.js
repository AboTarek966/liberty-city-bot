"use strict";
// Omni Bot - Voice Keeper Handler
// ============================================
// يدخل البوت إلى قناة صوتية ويبقى فيها لمدة محددة (افتراضياً 24 ساعة)
// حتى يطلب المالك إيقافه. مخصص لمالكي البوت فقط.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceKeeperHandler = void 0;
const discord_js_1 = require("discord.js");
const voice_1 = require("@discordjs/voice");
const helpers_1 = require("../utils/helpers");
const botOwner_1 = require("../utils/botOwner");
const logger = (0, helpers_1.createLogger)('VoiceKeeper');
class VoiceKeeperHandler {
    client;
    entries = new Map();
    constructor(client) {
        this.client = client;
    }
    key(guildId, channelId) {
        return `${guildId}:${channelId}`;
    }
    async join(guildId, channelId, durationMs = 24 * 60 * 60 * 1000) {
        const guild = this.client.guilds.cache.get(guildId) || (await this.client.guilds.fetch(guildId).catch(() => null));
        if (!guild)
            return { ok: false, message: '❌ لم أجد السيرفر (تأكد من أن البوت في السيرفر)' };
        const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
        if (!channel || !channel.isVoiceBased())
            return { ok: false, message: '❌ القناة ليست صوتية' };
        const me = guild.members.me;
        if (!me)
            return { ok: false, message: '❌ البوت غير جاهز في هذا السيرفر' };
        const perms = channel.permissionsFor(me);
        if (!perms?.has(discord_js_1.PermissionFlagsBits.Connect) || !perms?.has(discord_js_1.PermissionFlagsBits.ViewChannel)) {
            return { ok: false, message: '❌ لا أملك صلاحية **Connect/ViewChannel** في هذه القناة' };
        }
        // إيقاف أي اتصال سابق في نفس القناة
        await this.leave(guildId, channelId).catch(() => { });
        try {
            const connection = (0, voice_1.joinVoiceChannel)({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: true,
            });
            await (0, voice_1.entersState)(connection, voice_1.VoiceConnectionStatus.Ready, 20_000);
            const expiresAt = Date.now() + durationMs;
            const timer = setTimeout(() => {
                void this.leave(guildId, channelId).then(() => {
                    logger.info(`VoiceKeeper auto-left ${channelId} after duration`);
                });
            }, durationMs);
            timer.unref?.();
            const entry = { guildId, channelId, connection, timer, expiresAt };
            this.entries.set(this.key(guildId, channelId), entry);
            connection.on('stateChange', (_oldState, newState) => {
                if (newState.status === voice_1.VoiceConnectionStatus.Destroyed) {
                    this.entries.delete(this.key(guildId, channelId));
                }
            });
            logger.info(`VoiceKeeper joined ${guild.name} / ${channel.name}`);
            return { ok: true, message: `✅ دخلت ${channel} — سأبقى فيها حتى <t:${Math.floor(expiresAt / 1000)}:R> (أو حتى تطلب إيقاف)` };
        }
        catch (error) {
            const existing = (0, voice_1.getVoiceConnection)(guild.id);
            existing?.destroy();
            return { ok: false, message: `❌ فشل الانضمام: ${error.message}` };
        }
    }
    async leave(guildId, channelId) {
        let removed = 0;
        for (const [key, entry] of this.entries) {
            if (entry.guildId !== guildId)
                continue;
            if (channelId && entry.channelId !== channelId)
                continue;
            clearTimeout(entry.timer);
            try {
                entry.connection.destroy();
            }
            catch { }
            this.entries.delete(key);
            removed += 1;
        }
        // fallback: destroy any lingering connection
        if (channelId) {
            const conn = (0, voice_1.getVoiceConnection)(guildId);
            if (conn && !this.entries.size)
                conn.destroy();
        }
        if (removed === 0)
            return { ok: false, message: '⚠️ لا يوجد اتصال نشط في هذا السيرفر/القناة' };
        return { ok: true, message: `✅ تم إيقاف ${removed} اتصال صوتي` };
    }
    leaveAll() {
        let n = 0;
        for (const entry of this.entries.values()) {
            clearTimeout(entry.timer);
            try {
                entry.connection.destroy();
            }
            catch { }
            n += 1;
        }
        this.entries.clear();
        return n;
    }
    status() {
        if (this.entries.size === 0)
            return '📭 لا توجد اتصالات صوتية نشطة';
        return [...this.entries.values()]
            .map(e => `> 🔊 \`${e.guildId}\` / \`${e.channelId}\` — حتى <t:${Math.floor(e.expiresAt / 1000)}:R>`)
            .join('\n');
    }
    async ensureOwner(userId) {
        return (0, botOwner_1.isBotOwner)(this.client, userId);
    }
}
exports.VoiceKeeperHandler = VoiceKeeperHandler;
//# sourceMappingURL=VoiceKeeperHandler.js.map