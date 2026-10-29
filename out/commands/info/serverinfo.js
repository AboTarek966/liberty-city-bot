"use strict";
// ============================================
// Liberty City Bot - Server Info Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('عرض معلومات السيرفر'),
    cooldown: 10,
    async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
            await interaction.reply({
                content: '❌ هذا الأمر يعمل في السيرفر فقط',
                ephemeral: true,
            });
            return;
        }
        await interaction.deferReply();
        const owner = await guild.fetchOwner();
        const textChannels = guild.channels.cache.filter(c => c.type === discord_js_1.ChannelType.GuildText).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === discord_js_1.ChannelType.GuildVoice).size;
        const categories = guild.channels.cache.filter(c => c.type === discord_js_1.ChannelType.GuildCategory).size;
        const members = guild.members.cache;
        const bots = members.filter(m => m.user.bot).size;
        const humans = members.size - bots;
        const onlineMembers = members.filter(m => m.presence?.status !== 'offline').size;
        const totalChannels = textChannels + voiceChannels + categories;
        const lines = [
            `👑 المالك: ${owner} • 🆔 \`${guild.id}\``,
            `📅 إنشاء: <t:${Math.floor(guild.createdTimestamp / 1000)}:R> • 🔒 ${getVerificationLevel(guild.verificationLevel)}`,
            `👥 ${guild.memberCount} عضو — 🟢 ${onlineMembers} متصل • 👤 ${humans} بشر • 🤖 ${bots} بوت`,
            `📁 ${totalChannels} قناة — 💬 ${textChannels} نصية • 🔊 ${voiceChannels} صوتية • 📂 ${categories} فئات`,
            `🎭 ${guild.roles.cache.size} رتبة • 😀 ${guild.emojis.cache.size} إيموجي • 💎 بوست المستوى ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0})`,
        ];
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`📊 ${guild.name}`)
            .setColor(embeds_1.Colors.primary)
            .setThumbnail(guild.iconURL({ size: 512 }))
            .setDescription(lines.join('\n'));
        const topRoles = guild.roles.cache.size > 0
            ? guild.roles.cache
                .filter(r => r.id !== guild.id)
                .sort((a, b) => b.position - a.position)
                .first(5)
                .map(r => r.toString())
                .join(' ') + (guild.roles.cache.size > 6 ? '...' : '')
            : 'لا يوجد';
        embed.addFields({ name: '🎭 أهم الرتب', value: topRoles, inline: true });
        // Add features
        if (guild.features.length > 0) {
            embed.addFields({
                name: '✨ المميزات',
                value: guild.features.map(f => getFeatureName(f)).join(', ').substring(0, 1000),
                inline: true,
            });
        }
        await interaction.editReply({ embeds: [embed] });
    },
};
// --------------------------------------------
// Helper Functions
// --------------------------------------------
function getVerificationLevel(level) {
    const levels = ['لا يوجد', 'منخفض', 'متوسط', 'عالي', 'الأعلى'];
    return levels[level] || 'غير معروف';
}
function getFeatureName(feature) {
    const features = {
        ANIMATED_ICON: 'أيقونة متحركة',
        BANNER: 'بانر',
        COMMUNITY: 'مجتمع',
        DISCOVERABLE: 'قابل للاكتشاف',
        FEATURABLE: 'مميز',
        INVITE_SPLASH: 'خلفية دعوة',
        MEMBER_VERIFICATION_GATE_ENABLED: 'بوابة تحقق',
        MORE_EMOJI: 'إيموجيز إضافية',
        NEWS: 'أخبار',
        PARTNERED: 'شريك',
        PREVIEW_ENABLED: 'معاينة',
        ROLE_ICONS: 'أيقونات رتب',
        TICKETED_EVENTS_ENABLED: 'فعاليات تذاكر',
        VANITY_URL: 'رابط مخصص',
        VERIFIED: 'موثق',
        VIP_REGIONS: 'مناطق VIP',
    };
    return features[feature] || feature;
}
exports.default = command;
//# sourceMappingURL=serverinfo.js.map