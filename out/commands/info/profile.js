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
        // بيانات العرض
        const balance = profile?.balance ?? 0;
        const bank = profile?.bank ?? 0;
        const reputation = profile?.reputation ?? 0;
        const rankText = rank > 0 ? ` • الترتيب \`#${rank}\`` : '';
        const content = `👤 **${member.displayName}** — 🏆 المستوى **${level}** (${progress.current}/${progress.next} XP)` +
            ` • 💵 ${(0, helpers_1.formatNumber)(balance)} محفظة • 🏦 ${(0, helpers_1.formatNumber)(bank)} بنك` +
            ` • ⭐ ${(0, helpers_1.formatNumber)(reputation)} سمعة • ⚠️ ${warnCount} تحذير${rankText}`;
        await interaction.editReply({ content });
    },
};
exports.default = command;
//# sourceMappingURL=profile.js.map