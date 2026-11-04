// Omni Bot - Voice Keeper Handler
// ============================================
// يدخل البوت إلى قناة صوتية ويبقى فيها لمدة محددة (افتراضياً 24 ساعة)
// حتى يطلب المالك إيقافه. مخصص لمالكي البوت فقط.

import { Client, Guild, VoiceBasedChannel, PermissionFlagsBits } from 'discord.js';
import {
  joinVoiceChannel,
  entersState,
  VoiceConnection,
  VoiceConnectionStatus,
  getVoiceConnection,
} from '@discordjs/voice';
import { createLogger } from '../utils/helpers';
import { isBotOwner } from '../utils/botOwner';

const logger = createLogger('VoiceKeeper');

interface KeeperEntry {
  guildId: string;
  channelId: string;
  connection: VoiceConnection;
  timer: NodeJS.Timeout;
  expiresAt: number;
}

export class VoiceKeeperHandler {
  private client: Client;
  private entries = new Map<string, KeeperEntry>();

  constructor(client: Client) {
    this.client = client;
  }

  private key(guildId: string, channelId: string): string {
    return `${guildId}:${channelId}`;
  }

  async join(guildId: string, channelId: string, durationMs = 24 * 60 * 60 * 1000): Promise<{ ok: boolean; message: string }> {
    const guild = this.client.guilds.cache.get(guildId) || (await this.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) return { ok: false, message: '❌ لم أجد السيرفر (تأكد من أن البوت في السيرفر)' };

    const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isVoiceBased()) return { ok: false, message: '❌ القناة ليست صوتية' };

    const me = guild.members.me;
    if (!me) return { ok: false, message: '❌ البوت غير جاهز في هذا السيرفر' };
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.Connect) || !perms?.has(PermissionFlagsBits.ViewChannel)) {
      return { ok: false, message: '❌ لا أملك صلاحية **Connect/ViewChannel** في هذه القناة' };
    }

    // إيقاف أي اتصال سابق في نفس القناة
    await this.leave(guildId, channelId).catch(() => {});

    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true,
      });

      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

      const expiresAt = Date.now() + durationMs;
      const timer = setTimeout(() => {
        void this.leave(guildId, channelId).then(() => {
          logger.info(`VoiceKeeper auto-left ${channelId} after duration`);
        });
      }, durationMs);
      timer.unref?.();

      const entry: KeeperEntry = { guildId, channelId, connection, timer, expiresAt };
      this.entries.set(this.key(guildId, channelId), entry);

      connection.on('stateChange', (_oldState, newState) => {
        if (newState.status === VoiceConnectionStatus.Destroyed) {
          this.entries.delete(this.key(guildId, channelId));
        }
      });

      logger.info(`VoiceKeeper joined ${guild.name} / ${channel.name}`);
      return { ok: true, message: `✅ دخلت ${channel} — سأبقى فيها حتى <t:${Math.floor(expiresAt / 1000)}:R> (أو حتى تطلب إيقاف)` };
    } catch (error: any) {
      const existing = getVoiceConnection(guild.id);
      existing?.destroy();
      return { ok: false, message: `❌ فشل الانضمام: ${error.message}` };
    }
  }

  async leave(guildId: string, channelId?: string): Promise<{ ok: boolean; message: string }> {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.guildId !== guildId) continue;
      if (channelId && entry.channelId !== channelId) continue;
      clearTimeout(entry.timer);
      try { entry.connection.destroy(); } catch {}
      this.entries.delete(key);
      removed += 1;
    }
    // fallback: destroy any lingering connection
    if (channelId) {
      const conn = getVoiceConnection(guildId);
      if (conn && !this.entries.size) conn.destroy();
    }
    if (removed === 0) return { ok: false, message: '⚠️ لا يوجد اتصال نشط في هذا السيرفر/القناة' };
    return { ok: true, message: `✅ تم إيقاف ${removed} اتصال صوتي` };
  }

  leaveAll(): number {
    let n = 0;
    for (const entry of this.entries.values()) {
      clearTimeout(entry.timer);
      try { entry.connection.destroy(); } catch {}
      n += 1;
    }
    this.entries.clear();
    return n;
  }

  status(): string {
    if (this.entries.size === 0) return '📭 لا توجد اتصالات صوتية نشطة';
    return [...this.entries.values()]
      .map(e => `> 🔊 \`${e.guildId}\` / \`${e.channelId}\` — حتى <t:${Math.floor(e.expiresAt / 1000)}:R>`)
      .join('\n');
  }

  async ensureOwner(userId: string): Promise<boolean> {
    return isBotOwner(this.client, userId);
  }
}
