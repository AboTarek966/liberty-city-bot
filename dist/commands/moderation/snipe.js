"use strict";
// ============================================
// Liberty City Bot - Snipe Command (سنايب)
// استرجاع آخر رسالة محذوفة في القناة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const snipeCache_1 = require("../../utils/snipeCache");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('snipe')
        .setDescription('استرجاع آخر رسالة محذوفة في هذه القناة')
        .addIntegerOption(option => option
        .setName('index')
        .setDescription('رقم الرسالة (1 = الأحدث، حتى 5)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.ManageMessages],
    async execute(interaction) {
        if (!interaction.guildId || !interaction.channelId) {
            await interaction.reply({ content: '❌ هذا الأمر يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        // فحص تفعيل الميزة في هذا السيرفر
        const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
        if (!settings.snipe?.enabled) {
            await interaction.reply({
                content: '🕵️ **السنايب معطّل** في هذا السيرفر — يمكن تفعيله من `/settings` ← 📋 السجلات ← زر السنايب',
                ephemeral: true,
            });
            return;
        }
        const index = (interaction.options.getInteger('index') || 1) - 1;
        const entry = (0, snipeCache_1.getSnipedMessage)(interaction.guildId, interaction.channelId, index);
        if (!entry) {
            const count = (0, snipeCache_1.getSnipeCount)(interaction.guildId, interaction.channelId);
            await interaction.reply({
                content: count === 0
                    ? '🕵️ **لا توجد رسائل محذوفة محفوظة هنا** — تُحفظ آخر 5 رسائل لمدة 15 دقيقة بعد حذفها'
                    : `🕵️ لا توجد رسالة بهذا الرقم — المحفوظ: ${count} رسالة (جرّب \`1\` حتى \`${count}\`)`,
                ephemeral: true,
            });
            return;
        }
        const minutesAgo = Math.max(1, Math.round((Date.now() - entry.deletedAt) / 60000));
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(index === 0 ? '🕵️ آخر رسالة محذوفة' : `🕵️ رسالة محذوفة #${index + 1}`)
            .setColor(embeds_1.Colors.error || 0xed4245)
            .setAuthor({
            name: entry.authorTag,
            ...(entry.authorAvatar ? { iconURL: entry.authorAvatar } : {}),
        })
            .setDescription((entry.content || '*(بدون نص — انظر المرفقات أدناه)*').substring(0, 1900))
            .addFields({
            name: '📅 نُشرت',
            value: `<t:${Math.floor(entry.postedAt / 1000)}:R>`,
            inline: true,
        }, {
            name: '🗑️ حُذفت',
            value: `منذ ${minutesAgo} دقيقة`,
            inline: true,
        })
            .setFooter({
            text: `Liberty City Snipe • ${entry.channelId} • ${(0, snipeCache_1.getSnipeCount)(interaction.guildId, interaction.channelId)} محفوظة`,
        })
            .setTimestamp();
        if (entry.attachments.length > 0) {
            embed.addFields({
                name: `📎 المرفقات (${entry.attachments.length})`,
                value: entry.attachments.map((a, i) => `[${a.name}](${a.url})`).join('\n').substring(0, 1000),
            });
        }
        if (entry.pinned) {
            embed.addFields({ name: '📌', value: 'كانت رسالة مثبتة', inline: true });
        }
        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
exports.default = command;
//# sourceMappingURL=snipe.js.map