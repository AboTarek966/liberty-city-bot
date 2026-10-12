"use strict";
// ============================================
// Liberty City Bot - Balance Command (الرصيد)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('balance')
        .setDescription('💰 عرض رصيدك — المحفظة والبنك')
        .addUserOption(option => option.setName('user').setDescription('العضو (افتراضياً: أنت)').setRequired(false))
        .setDMPermission(false),
    cooldown: 5,
    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        const profile = await models_1.UserProfile.findOne({
            userId: target.id,
            guildId: interaction.guildId,
        }).catch(() => null);
        const wallet = profile?.balance || 0;
        const bank = profile?.bank || 0;
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embeds_1.Colors.primary)
            .setTitle(`💰 رصيد ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .addFields({ name: '👛 المحفظة', value: `\`${(0, helpers_1.formatNumber)(wallet)}\``, inline: true }, { name: '🏦 البنك', value: `\`${(0, helpers_1.formatNumber)(bank)}\``, inline: true }, { name: '📊 الإجمالي', value: `\`${(0, helpers_1.formatNumber)(wallet + bank)}\``, inline: true })
            .setFooter({ text: 'اجمع الرصيد بالنشر و/daily ثم اصرفه من /shop' })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=balance.js.map