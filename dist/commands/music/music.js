"use strict";
// ============================================
// Liberty City Bot - Music Commands
// أوامر الموسيقى
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const musicCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('music')
        .setDescription('🎵 نظام الموسيقى')
        .addSubcommand(sub => sub
        .setName('play')
        .setDescription('تشغيل أغنية من يوتيوب')
        .addStringOption(opt => opt.setName('query').setDescription('اسم الأغنية أو رابط يوتيوب').setRequired(true)))
        .addSubcommand(sub => sub.setName('skip').setDescription('تخطي الأغنية الحالية'))
        .addSubcommand(sub => sub.setName('stop').setDescription('إيقاف الموسيقى ومسح القائمة'))
        .addSubcommand(sub => sub.setName('pause').setDescription('إيقاف مؤقت'))
        .addSubcommand(sub => sub.setName('resume').setDescription('استئناف التشغيل'))
        .addSubcommand(sub => sub
        .setName('queue')
        .setDescription('عرض قائمة الانتظار')
        .addIntegerOption(opt => opt.setName('page').setDescription('الصفحة').setRequired(false).setMinValue(1)))
        .addSubcommand(sub => sub
        .setName('nowplaying')
        .setDescription('عرض الأغنية الحالية'))
        .addSubcommand(sub => sub
        .setName('volume')
        .setDescription('التحكم في الصوت')
        .addIntegerOption(opt => opt.setName('level').setDescription('مستوى الصوت (0-200)').setRequired(true).setMinValue(0).setMaxValue(200)))
        .addSubcommand(sub => sub
        .setName('loop')
        .setDescription('وضع التكرار')
        .addStringOption(opt => opt.setName('mode').setDescription('نوع التكرار').setRequired(true)
        .addChoices({ name: '❌ إيقاف التكرار', value: 'none' }, { name: '🔁 تكرار الأغنية', value: 'track' }, { name: '🔂 تكرار القائمة', value: 'queue' })))
        .addSubcommand(sub => sub
        .setName('seek')
        .setDescription('الانتقال لوقت محدد في الأغنية')
        .addIntegerOption(opt => opt.setName('seconds').setDescription('الثواني').setRequired(true).setMinValue(0)))
        .addSubcommand(sub => sub.setName('leave').setDescription('مغادرة القناة الصوتية'))
        .addSubcommand(sub => sub.setName('shuffle').setDescription('خلط قائمة الانتظار'))
        .addSubcommand(sub => sub.setName('remove').setDescription('إزالة أغنية من القائمة')
        .addIntegerOption(opt => opt.setName('position').setDescription('موضع الأغنية في القائمة').setRequired(true).setMinValue(1)))
        .setDMPermission(false),
    async execute(interaction) {
        const client = interaction.client;
        const music = client.musicHandler;
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        await interaction.deferReply({ ephemeral: false });
        try {
            switch (subcommand) {
                case 'play': {
                    const query = interaction.options.getString('query', true);
                    const member = interaction.member;
                    if (!member?.voice?.channel) {
                        await interaction.editReply({ content: '❌ يجب أن تكون في قناة صوتية أولاً!' });
                        return;
                    }
                    const result = await music.play(member, query, interaction.channelId);
                    if (!result.success) {
                        await interaction.editReply({ content: result.message });
                        return;
                    }
                    const track = result.track;
                    const queue = music.getQueueInfo(guildId);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(discord_js_1.Colors.Green)
                        .setTitle(queue.isPlaying && queue.tracks.length > 0 ? '✅ أضيفت للقائمة' : '🎵 تشغيل الآن')
                        .setDescription(`**${track.title}**`)
                        .setURL(track.url)
                        .setThumbnail(track.thumbnail)
                        .addFields({ name: '⏱️ المدة', value: formatDuration(track.duration), inline: true }, { name: '👤 طلبها', value: track.requestedBy, inline: true }, { name: '📍 الموضع', value: queue.isPlaying ? `#${queue.tracks.length}` : 'تشغيل الآن', inline: true })
                        .setFooter({ text: `Liberty City Music • ${interaction.user.tag}` })
                        .setTimestamp();
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('music:pause').setLabel('⏸️').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId('music:resume').setLabel('▶️').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('music:skip').setLabel('⏭️').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId('music:stop').setLabel('⏹️').setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId('music:queue').setLabel('📋 قائمة').setStyle(discord_js_1.ButtonStyle.Secondary));
                    await interaction.editReply({ embeds: [embed], components: [row] });
                    break;
                }
                case 'skip': {
                    const skipped = music.skip(guildId);
                    if (!skipped) {
                        await interaction.editReply({ content: '❌ لا توجد أغنية للتشغيل أو القائمة فارغة!' });
                        return;
                    }
                    await interaction.editReply({ content: '⏭️ تم التخطي!' });
                    break;
                }
                case 'stop': {
                    const stopped = music.stop(guildId);
                    if (!stopped) {
                        await interaction.editReply({ content: '❌ لا توجد موسيقى للتشغيل!' });
                        return;
                    }
                    await interaction.editReply({ content: '⏹️ تم الإيقاف ومسح القائمة!' });
                    break;
                }
                case 'pause': {
                    const paused = music.pause(guildId);
                    if (!paused) {
                        await interaction.editReply({ content: '❌ لا توجد موسيقى قيد التشغيل!' });
                        return;
                    }
                    await interaction.editReply({ content: '⏸️ تم الإيقاف المؤقت!' });
                    break;
                }
                case 'resume': {
                    const resumed = music.resume(guildId);
                    if (!resumed) {
                        await interaction.editReply({ content: '❌ لا توجد موسيقى متوقفة!' });
                        return;
                    }
                    await interaction.editReply({ content: '▶️ تم الاستئناف!' });
                    break;
                }
                case 'queue': {
                    const page = interaction.options.getInteger('page') || 1;
                    const queue = music.getQueueInfo(guildId);
                    if (!queue || (!queue.currentTrack && queue.tracks.length === 0)) {
                        await interaction.editReply({ content: '📭 قائمة الانتظار فارغة!' });
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
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(discord_js_1.Colors.Blurple)
                        .setTitle('📋 قائمة الانتظار')
                        .setDescription(displayTracks.map((t, i) => `${start + i + 1}. ${t.isCurrent ? '🎵 **' : ''}${t.title}${t.isCurrent ? '**' : ''} — ⏱️ ${formatDuration(t.duration)} — 👤 ${t.requestedBy}`).join('\n') || 'فارغة')
                        .setFooter({ text: `الصفحة ${currentPage}/${totalPages} • المجموع: ${queue.tracks.length + (queue.currentTrack ? 1 : 0)} أغنية` })
                        .setTimestamp();
                    if (totalPages > 1) {
                        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`music:queue:${currentPage - 1}`).setLabel('◀️').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(currentPage === 1), new discord_js_1.ButtonBuilder().setCustomId(`music:queue:${currentPage + 1}`).setLabel('▶️').setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(currentPage === totalPages));
                        await interaction.editReply({ embeds: [embed], components: [row] });
                    }
                    else {
                        await interaction.editReply({ embeds: [embed] });
                    }
                    break;
                }
                case 'nowplaying': {
                    const queue = music.getQueueInfo(guildId);
                    if (!queue?.currentTrack) {
                        await interaction.editReply({ content: '❌ لا توجد أغنية قيد التشغيل!' });
                        return;
                    }
                    const track = queue.currentTrack;
                    const embed = new discord_js_1.EmbedBuilder()
                        .setColor(discord_js_1.Colors.Green)
                        .setTitle('🎵 تشغيل الآن')
                        .setDescription(`**${track.title}**`)
                        .setURL(track.url)
                        .setThumbnail(track.thumbnail)
                        .addFields({ name: '⏱️ المدة', value: formatDuration(track.duration), inline: true }, { name: '👤 طلبها', value: track.requestedBy, inline: true }, { name: '🔁 التكرار', value: queue.loop === 'track' ? '🔁 الأغنية' : queue.loop === 'queue' ? '🔂 القائمة' : '❌ معطل', inline: true }, { name: '🔊 الصوت', value: `${queue.volume}%`, inline: true })
                        .setFooter({ text: `Liberty City Music • ${interaction.user.tag}` })
                        .setTimestamp();
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('music:pause').setLabel('⏸️').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId('music:resume').setLabel('▶️').setStyle(discord_js_1.ButtonStyle.Success), new discord_js_1.ButtonBuilder().setCustomId('music:skip').setLabel('⏭️').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId('music:stop').setLabel('⏹️').setStyle(discord_js_1.ButtonStyle.Danger));
                    await interaction.editReply({ embeds: [embed], components: [row] });
                    break;
                }
                case 'volume': {
                    const level = interaction.options.getInteger('level', true);
                    const queue = music.getQueueInfo(guildId);
                    if (!queue) {
                        await interaction.editReply({ content: '❌ لا توجد موسيقى للتشغيل!' });
                        return;
                    }
                    // تطبيق الصوت - يحتاج تعديل في MusicHandler
                    queue.volume = level;
                    await interaction.editReply({ content: `🔊 تم تعيين الصوت إلى **${level}%**` });
                    break;
                }
                case 'loop': {
                    const mode = interaction.options.getString('mode', true);
                    const queue = music.getQueueInfo(guildId);
                    if (!queue) {
                        await interaction.editReply({ content: '❌ لا توجد موسيقى للتشغيل!' });
                        return;
                    }
                    music.setLoop(guildId, mode);
                    const labels = { none: '❌ معطل', track: '🔁 الأغنية', queue: '🔂 القائمة' };
                    await interaction.editReply({ content: `🔁 تم تعيين التكرار إلى: **${labels[mode]}**` });
                    break;
                }
                case 'seek': {
                    const seconds = interaction.options.getInteger('seconds', true);
                    const queue = music.getQueueInfo(guildId);
                    if (!queue?.currentTrack) {
                        await interaction.editReply({ content: '❌ لا توجد أغنية قيد التشغيل!' });
                        return;
                    }
                    if (seconds > queue.currentTrack.duration) {
                        await interaction.editReply({ content: `❌ الوقت يتجاوز مدة الأغنية (${formatDuration(queue.currentTrack.duration)})!` });
                        return;
                    }
                    const success = await music.seek(guildId, seconds);
                    if (!success) {
                        await interaction.editReply({ content: '❌ فشل في الانتقال للوقت المحدد!' });
                        return;
                    }
                    await interaction.editReply({ content: `⏩ تم الانتقال إلى **${formatDuration(seconds)}**` });
                    break;
                }
                case 'leave': {
                    const member = interaction.member;
                    if (!member?.voice?.channel) {
                        await interaction.editReply({ content: '❌ يجب أن تكون في قناة صوتية!' });
                        return;
                    }
                    music.leave(guildId);
                    await interaction.editReply({ content: '👋 تم مغادرة القناة الصوتية!' });
                    break;
                }
                case 'shuffle': {
                    const queue = music.getQueueInfo(guildId);
                    if (!queue || queue.tracks.length < 2) {
                        await interaction.editReply({ content: '❌ القائمة فارغة أو تحتوي أغنية واحدة فقط!' });
                        return;
                    }
                    for (let i = queue.tracks.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [queue.tracks[i], queue.tracks[j]] = [queue.tracks[j], queue.tracks[i]];
                    }
                    await interaction.editReply({ content: '🔀 تم خلط القائمة!' });
                    break;
                }
                case 'remove': {
                    const position = interaction.options.getInteger('position', true);
                    const queue = music.getQueueInfo(guildId);
                    if (!queue || position < 1 || position > queue.tracks.length) {
                        await interaction.editReply({ content: '❌ موضع غير صحيح!' });
                        return;
                    }
                    const removed = queue.tracks.splice(position - 1, 1)[0];
                    await interaction.editReply({ content: `🗑️ تم إزالة: **${removed.title}**` });
                    break;
                }
                default:
                    await interaction.editReply({ content: '❌ أمر غير معروف' });
            }
        }
        catch (error) {
            await interaction.editReply({ content: `❌ خطأ: ${error.message}` });
        }
    },
};
function formatDuration(seconds) {
    if (seconds >= 3600) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
exports.default = musicCommand;
//# sourceMappingURL=music.js.map