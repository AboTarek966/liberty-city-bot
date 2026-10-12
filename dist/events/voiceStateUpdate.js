"use strict";
// ============================================
// Liberty City Bot - Voice State (Logging + Leveling XP)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const client = (oldState.client || newState.client);
        // سجلات الصوت
        await client.loggingHandler.handleVoiceStateUpdate(oldState, newState);
        // ===== نظام المستويات: XP الصوت =====
        try {
            const guild = newState.guild || oldState.guild;
            if (!guild)
                return;
            const member = newState.member || oldState.member;
            if (!member || member.user?.bot)
                return;
            // دخول قناة صوتية (من لا شيء إلى شيء)
            if (!oldState.channelId && newState.channelId) {
                await client.levelingHandler.trackVoiceJoin(guild.id, member.id);
                return;
            }
            // مغادرة كل القنوات الصوتية
            if (oldState.channelId && !newState.channelId) {
                await client.levelingHandler.addVoiceXp(guild.id, member.id).catch(() => { });
                return;
            }
        }
        catch (err) {
            // لا ندع خطأ XP الصوت يعطّل السجلات
        }
    },
};
exports.default = event;
//# sourceMappingURL=voiceStateUpdate.js.map