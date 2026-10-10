// ============================================
// Liberty City Bot - Voice State (Logging + Leveling XP)
// ============================================

import { Event } from '../handlers/EventHandler';
import { LibertyClient } from '../LibertyClient';

const event: Event = {
  name: 'voiceStateUpdate',
  async execute(oldState: any, newState: any) {
    const client = (oldState.client || newState.client) as LibertyClient;

    // سجلات الصوت
    await client.loggingHandler.handleVoiceStateUpdate(oldState, newState);

    // ===== نظام المستويات: XP الصوت =====
    try {
      const guild = newState.guild || oldState.guild;
      if (!guild) return;
      const member = newState.member || oldState.member;
      if (!member || member.user?.bot) return;

      // دخول قناة صوتية (من لا شيء إلى شيء)
      if (!oldState.channelId && newState.channelId) {
        await client.levelingHandler.trackVoiceJoin(guild.id, member.id);
        return;
      }

      // مغادرة كل القنوات الصوتية
      if (oldState.channelId && !newState.channelId) {
        await client.levelingHandler.addVoiceXp(guild.id, member.id).catch(() => {});
        return;
      }
    } catch (err) {
      // لا ندع خطأ XP الصوت يعطّل السجلات
    }
  },
};

export default event;
