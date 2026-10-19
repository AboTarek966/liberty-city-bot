// ============================================
// Liberty City Bot - Music Button Handlers
// ============================================

import { ButtonInteraction, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, Colors } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { MusicHandler } from '../../handlers/MusicHandler';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const formatDuration = (seconds: number): string => {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const getMusicEmbed = (music: MusicHandler, guildId: string, userTag: string): { embed: EmbedBuilder; components: ActionRowBuilder<any>[] } | null => {
  const queue = music.getQueueInfo(guildId);
  if (!queue?.currentTrack) return null;

  const track = queue.currentTrack!;
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle('🎵 تشغيل الآن')
    .setDescription(`**${track.title}**`)
    .setURL(track.url)
    .setThumbnail(track.thumbnail)
    .addFields(
      { name: '⏱️ المدة', value: formatDuration(track.duration), inline: true },
      { name: '👤 طلبها', value: track.requestedBy, inline: true },
      { name: '🔁 التكرار', value: queue.loop === 'track' ? '🔁 الأغنية' : queue.loop === 'queue' ? '🔂 القائمة' : '❌ معطل', inline: true },
      { name: '🔊 الصوت', value: `${queue.volume}%`, inline: true },
    )
    .setFooter({ text: `Liberty City Music • ${userTag}` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('music:pause').setLabel('⏸️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music:resume').setLabel('▶️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('music:skip').setLabel('⏭️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('music:stop').setLabel('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music:queue').setLabel('📋 قائمة').setStyle(ButtonStyle.Secondary),
  );

  return { embed, components: [row] };
};

const handler: ButtonHandler = {
  id: 'music',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const client = interaction.client as LibertyClient;
    const music = client.musicHandler;
    const guildId = interaction.guild.id;
    const action = interaction.customId.split(':')[1];

    await interaction.deferUpdate();

    try {
      switch (action) {
        case 'pause': {
          const paused = music.pause(guildId);
          if (!paused) {
            await interaction.followUp({ content: '❌ لا توجد موسيقى قيد التشغيل!', ephemeral: true });
            return;
          }
          const result = getMusicEmbed(client.musicHandler, guildId, interaction.user.tag);
          if (result) await interaction.editReply({ embeds: [result.embed], components: result.components });
          break;
        }

        case 'resume': {
          const resumed = music.resume(guildId);
          if (!resumed) {
            await interaction.followUp({ content: '❌ لا توجد موسيقى متوقفة!', ephemeral: true });
            return;
          }
          const result = getMusicEmbed(client.musicHandler, guildId, interaction.user.tag);
          if (result) await interaction.editReply({ embeds: [result.embed], components: result.components });
          break;
        }

        case 'skip': {
          const skipped = music.skip(guildId);
          if (!skipped) {
            await interaction.followUp({ content: '❌ لا توجد أغنية للتشغيل أو القائمة فارغة!', ephemeral: true });
            return;
          }
          await sleep(500);
          const result = getMusicEmbed(client.musicHandler, guildId, interaction.user.tag);
          if (result) await interaction.editReply({ embeds: [result.embed], components: result.components });
          else await interaction.editReply({ content: '⏭️ تم التخطي! لا توجد أغنية تالية.' });
          break;
        }

        case 'stop': {
          const stopped = music.stop(guildId);
          if (!stopped) {
            await interaction.followUp({ content: '❌ لا توجد موسيقى للتشغيل!', ephemeral: true });
            return;
          }
          await interaction.editReply({ content: '⏹️ تم الإيقاف ومسح القائمة!', components: [] });
          break;
        }

        case 'queue': {
          const queue = client.musicHandler.getQueueInfo(guildId);
          if (!queue || (!queue.currentTrack && queue.tracks.length === 0)) {
            await interaction.followUp({ content: '📭 قائمة الانتظار فارغة!', ephemeral: true });
            return;
          }

          const tracksPerPage = 10;
          const totalPages = Math.ceil((queue.tracks.length || 1) / tracksPerPage);
          const currentPage = 1;
          const start = 0;
          const end = tracksPerPage;
          const displayTracks = queue.currentTrack 
            ? [{ title: queue.currentTrack.title, duration: queue.currentTrack.duration, requestedBy: queue.currentTrack.requestedBy, isCurrent: true }, 
               ...queue.tracks.slice(start, end).map(t => ({ title: t.title, duration: t.duration, requestedBy: t.requestedBy, isCurrent: false }))]
            : queue.tracks.slice(start, end).map(t => ({ title: t.title, duration: t.duration, requestedBy: t.requestedBy, isCurrent: false }));

          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('📋 قائمة الانتظار')
            .setDescription(
              displayTracks.map((t, i) => 
                `${start + i + 1}. ${t.isCurrent ? '🎵 **' : ''}${t.title}${t.isCurrent ? '**' : ''} — ⏱️ ${formatDuration(t.duration)} — 👤 ${t.requestedBy}`
              ).join('\n') || 'فارغة'
            )
            .setFooter({ text: `الصفحة 1/${totalPages} • المجموع: ${queue.tracks.length + (queue.currentTrack ? 1 : 0)} أغنية` })
            .setTimestamp();

          if (totalPages > 1) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`music:queue:${currentPage + 1}`).setLabel('▶️').setStyle(ButtonStyle.Secondary),
            );
            await interaction.editReply({ embeds: [embed], components: [row] });
          } else {
            await interaction.editReply({ embeds: [embed] });
          }
          break;
        }

        case 'loop': {
          const queue = client.musicHandler.getQueueInfo(guildId);
          if (!queue) {
            await interaction.followUp({ content: '❌ لا توجد موسيقى!', ephemeral: true });
            return;
          }
          
          const modes = ['none', 'track', 'queue'];
          const currentIndex = modes.indexOf(queue.loop);
          const nextMode = modes[(currentIndex + 1) % modes.length];
          
          client.musicHandler.setLoop(guildId, nextMode as any);
          
          const labels = { none: '❌ معطل', track: '🔁 الأغنية', queue: '🔂 القائمة' };
          await interaction.followUp({ content: `🔁 تم تعيين التكرار إلى: **${labels[nextMode as keyof typeof labels]}**`, ephemeral: true });
          
          const result = getMusicEmbed(client.musicHandler, guildId, interaction.user.tag);
          if (result) await interaction.editReply({ embeds: [result.embed], components: result.components });
          break;
        }

        case 'shuffle': {
          const queue = client.musicHandler.getQueueInfo(guildId);
          if (!queue || queue.tracks.length < 2) {
            await interaction.followUp({ content: '❌ القائمة فارغة أو تحتوي أغنية واحدة فقط!', ephemeral: true });
            return;
          }

          for (let i = queue.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
          }
          
          await interaction.followUp({ content: '🔀 تم خلط القائمة!', ephemeral: true });
          break;
        }

        case 'nowplaying': {
          const result = getMusicEmbed(client.musicHandler, guildId, interaction.user.tag);
          if (result) await interaction.editReply({ embeds: [result.embed], components: result.components });
          else await interaction.followUp({ content: '❌ لا توجد أغنية قيد التشغيل!', ephemeral: true });
          break;
        }
      }
    } catch (error: any) {
      await interaction.followUp({ content: `❌ خطأ: ${error.message}`, ephemeral: true });
    }
  },
};

const queuePageHandler: ButtonHandler = {
  id: 'music:queue:',
  async execute(interaction: ButtonInteraction) {
    const client = interaction.client as LibertyClient;
    const music = client.musicHandler;
    const guildId = interaction.guild!.id;
    const page = parseInt(interaction.customId.split(':')[2]);

    const queue = music.getQueueInfo(guildId);
    if (!queue || (!queue.currentTrack && queue.tracks.length === 0)) {
      await interaction.reply({ content: '📭 قائمة الانتظار فارغة!', ephemeral: true });
      return;
    }

    const tracksPerPage = 10;
    const totalPages = Math.ceil((queue.tracks.length || 1) / tracksPerPage);
    const currentPage = Math.max(1, Math.min(page, totalPages));
    const start = (currentPage - 1) * tracksPerPage;
    const end = start + tracksPerPage;
    const displayTracks = queue.currentTrack 
      ? [{ title: queue.currentTrack.title, duration: queue.currentTrack.duration, requestedBy: queue.currentTrack.requestedBy, isCurrent: true }, 
         ...queue.tracks.slice(start, end).map(t => ({ title: t.title, duration: t.duration, requestedBy: t.requestedBy, isCurrent: false }))]
      : queue.tracks.slice(start, end).map(t => ({ title: t.title, duration: t.duration, requestedBy: t.requestedBy, isCurrent: false }));

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📋 قائمة الانتظار')
      .setDescription(
        displayTracks.map((t, i) => 
          `${start + i + 1}. ${t.isCurrent ? '🎵 **' : ''}${t.title}${t.isCurrent ? '**' : ''} — ⏱️ ${formatDuration(t.duration)} — 👤 ${t.requestedBy}`
        ).join('\n') || 'فارغة'
      )
      .setFooter({ text: `الصفحة ${currentPage}/${totalPages} • المجموع: ${queue.tracks.length + (queue.currentTrack ? 1 : 0)} أغنية` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`music:queue:${currentPage - 1}`).setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === 1),
      new ButtonBuilder().setCustomId(`music:queue:${currentPage + 1}`).setLabel('▶️').setStyle(ButtonStyle.Secondary).setDisabled(currentPage === totalPages),
    );

    await interaction.update({ embeds: [embed], components: [row] });
  },
};

export { handler as musicButtons, queuePageHandler };