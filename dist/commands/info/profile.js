"use strict";
// ============================================
// Liberty City Bot - Profile Command (بطاقة العضو)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const helpers_1 = require("../../utils/helpers");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('profile')
        .setDescription('👤 عرض بطاقة العضو — المستوى، الرصيد، الإنجازات')
        .addUserOption(option => option.setName('user').setDescription('العضو (افتراضياً: أنت)').setRequired(false))
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        const client = interaction.client;
        const target = interaction.options.getUser('user') || interaction.user;
        await interaction.deferReply();
        const member = interaction.guild.members.cache.get(target.id) ||
            (await interaction.guild.members.fetch(target.id).catch(() => null));
        if (!member) {
            await interaction.editReply({ content: '❌ لم يتم العثور على العضو في السيرفر' });
            return;
        }
        // بيانات المستخدم
        const [profile, warnCount, rank] = await Promise.all([
            models_1.UserProfile.findOne({ userId: target.id, guildId: interaction.guildId }),
            models_1.Warning.countDocuments({ userId: target.id, guildId: interaction.guildId }).catch(() => 0),
            client.levelingHandler.getRank(target.id, interaction.guildId),
        ]);
        const xp = profile?.xp || 0;
        const level = (0, helpers_1.calculateLevel)(xp);
        const progress = (0, helpers_1.getXpProgress)(xp);
        // شريط التقدم
        const filled = Math.round(progress.progress / 10);
        const bar = '█'.repeat(filled) + '▒'.repeat(10 - filled);
        // إنشاء ملف شخصي جديد في العرض إن لم يوجد (بدون كتابة في القاعدة)
        const balance = profile?.balance ?? 0;
        const bank = profile?.bank ?? 0;
        const messagesSent = profile?.messagesSent ?? 0;
        const voiceTime = profile?.voiceTime ?? 0; // بالدقائق
        const reputation = profile?.reputation ?? 0;
        const joinedAt = member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
            : 'غير معروف';
        const createdAt = `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`;
        // أعلى رتبة
        const topRole = member.roles.cache
            .filter(r => r.id !== interaction.guildId)
            .sort((a, b) => b.position - a.position)
            .first()?.toString() || 'بدون رتب';
        const color = member.displayHexColor !== '#000000' ? member.displayHexColor : '#00D4FF';
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`👤 بطاقة ${member.displayName}`)
            .setColor(color)
            .setThumbnail(member.displayAvatarURL({ size: 256 }))
            .setDescription(`> ${topRole}\n` +
            `> ${target.bot ? '🤖 بوت' : '✅ عضو'} • \`#${rank > 0 ? rank : '—'}\` في الترتيب`)
            .addFields({
            name: '🏆 المستوى',
            value: `**${level}**\n\`${bar}\` ${progress.current}/${progress.next} XP`,
            inline: true,
        }, {
            name: '💰 الرصيد',
            value: `💵 المحفظة: **${(0, helpers_1.formatNumber)(balance)}**\n🏦 البنك: **${(0, helpers_1.formatNumber)(bank)}**`,
            inline: true,
        }, {
            name: '📊 النشاط',
            value: `💬 الرسائل: **${(0, helpers_1.formatNumber)(messagesSent)}**\n⏱️ الصوت: **${(0, helpers_1.formatDuration)(voiceTime * 60000, { compact: true })}**`,
            inline: true,
        }, {
            name: '⭐ السمعة',
            value: `**${(0, helpers_1.formatNumber)(reputation)}**`,
            inline: true,
        }, {
            name: '⚠️ التحذيرات',
            value: `**${warnCount}**`,
            inline: true,
        }, {
            name: '📅 التاريخ',
            value: `📥 انضم: ${joinedAt}\n🎂 الحساب: ${createdAt}`,
            inline: false,
        })
            .setFooter({ text: `ID: ${target.id}` })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=profile.js.map