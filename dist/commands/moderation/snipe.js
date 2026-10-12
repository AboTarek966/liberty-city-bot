"use strict";
// ============================================
// Liberty City Bot - Snipe Command (سنايب)
// استرجاع آخر رسالة محذوفة في القناة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const snipeCache_1 = require("../../utils/snipeCache");
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
        const raw = (entry.content || '*(بدون نص)*').replace(/\s+/g, ' ').trim();
        const short = raw.length > 150 ? `${raw.substring(0, 150)}…` : raw;
        let content = `${index === 0 ? '🕵️ آخر رسالة محذوفة' : `🕵️ رسالة محذوفة #${index + 1}`} — ${entry.authorTag} (قبل ${minutesAgo} دقيقة): ${short}`;
        if (entry.attachments.length > 0)
            content += ` 📎 ${entry.attachments.length} مرفق`;
        if (entry.pinned)
            content += ' 📌 كانت مثبتة';
        await interaction.reply({ content, ephemeral: true });
    },
};
exports.default = command;
//# sourceMappingURL=snipe.js.map