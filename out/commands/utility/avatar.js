"use strict";
// ============================================
// Liberty City Bot - Avatar Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('avatar')
        .setDescription('عرض صورة الأفاتار')
        .addUserOption(option => option
        .setName('user')
        .setDescription('العضو (الافتراضي: أنت)')
        .setRequired(false)),
    cooldown: 5,
    async execute(interaction) {
        const target = interaction.options.getUser('user') || interaction.user;
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`🖼️ صورة ${target.tag}`)
            .setColor(embeds_1.Colors.primary)
            .setImage(target.displayAvatarURL({ size: 4096 }))
            .addFields({
            name: '🔗 رابط PNG',
            value: `[اضغط هنا](${target.displayAvatarURL({ size: 4096, extension: 'png' })})`,
            inline: true,
        }, {
            name: '🔗 رابط WebP',
            value: `[اضغط هنا](${target.displayAvatarURL({ size: 4096, extension: 'webp' })})`,
            inline: true,
        }, {
            name: '🔗 رابط GIF',
            value: target.avatar?.startsWith('a_')
                ? `[اضغط هنا](${target.displayAvatarURL({ size: 4096, extension: 'gif' })})`
                : 'غير متاح (ليست متحركة)',
            inline: true,
        })
            .setFooter({ text: 'Liberty City Bot' })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=avatar.js.map