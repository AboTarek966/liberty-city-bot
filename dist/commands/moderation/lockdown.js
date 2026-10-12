"use strict";
// ============================================
// Liberty City Bot - Lockdown Command (وضع الطوارئ)
// يقفل الكتابة في القنوات النصية والدخول في الصوتية
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const lockdown_1 = require("../../utils/lockdown");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('lockdown')
        .setDescription('وضع الطوارئ — يقفل الكتابة في القنوات والدخول في الصوتية')
        .addStringOption(option => option
        .setName('state')
        .setDescription('تفعيل أو إلغاء القفل')
        .setRequired(true)
        .addChoices({ name: '🔒 تفعيل (قفل السيرفر)', value: 'on' }, { name: '🔓 إلغاء (فتح السيرفر)', value: 'off' }))
        .addStringOption(option => option
        .setName('reason')
        .setDescription('سبب التفعيل (يظهر في السجلات)')
        .setRequired(false))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator)
        .setDMPermission(false),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.Administrator],
    async execute(interaction) {
        const state = interaction.options.getString('state', true) === 'on';
        const reason = interaction.options.getString('reason') || 'لم يتم تحديد سبب';
        await interaction.deferReply();
        const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
        // منع التفعيل المزدوج
        if (state && settings.protection?.lockdown) {
            await interaction.editReply({
                content: '⚠️ وضع الطوارئ **مفعّل بالفعل** — استخدم `/lockdown state:off` لفتح السيرفر',
            });
            return;
        }
        if (!state && !settings.protection?.lockdown) {
            await interaction.editReply({
                content: 'ℹ️ وضع الطوارئ **غير مفعّل أصلاً** — لا حاجة للإلغاء',
            });
            return;
        }
        const result = await (0, lockdown_1.setLockdown)(interaction.guild, state);
        settings.protection.lockdown = state;
        await settings.save();
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(state ? '🔒 تم تفعيل وضع الطوارئ' : '🔓 تم إلغاء وضع الطوارئ')
            .setColor(state ? 0xe74c3c : 0x2ecc71)
            .addFields({
            name: '📍 القنوات النصية',
            value: `${result.textChannels} قناة ${state ? '— الكتابة ممنوعة' : '— الكتابة مفتوحة'}`,
            inline: true,
        }, {
            name: '🔊 القنوات الصوتية',
            value: `${result.voiceChannels} قناة ${state ? '— الدخول ممنوع' : '— الدخول مفتوح'}`,
            inline: true,
        }, { name: '📝 السبب', value: reason, inline: false }, {
            name: '👤 المسؤول',
            value: `${interaction.user} (${interaction.user.tag})`,
            inline: false,
        })
            .setFooter({ text: 'Liberty City Security' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        // تسجيل في قناة السجلات
        const logChannelId = settings.logging?.channelId;
        if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel && 'send' in logChannel) {
                await logChannel.send({ embeds: [embed] }).catch(() => { });
            }
        }
    },
};
exports.default = command;
//# sourceMappingURL=lockdown.js.map