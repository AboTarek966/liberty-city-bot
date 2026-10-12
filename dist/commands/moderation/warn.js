"use strict";
// ============================================
// Liberty City Bot - Warn Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const warnRoles_1 = require("../../utils/warnRoles");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('warn')
        .setDescription('تحذير عضو')
        .addUserOption(option => option
        .setName('user')
        .setDescription('العضو المراد تحذيره')
        .setRequired(true))
        .addStringOption(option => option
        .setName('reason')
        .setDescription('سبب التحذير')
        .setRequired(true))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.ModerateMembers],
    async execute(interaction) {
        const client = interaction.client;
        const target = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);
        await interaction.deferReply({ ephemeral: true });
        const member = interaction.guild?.members.cache.get(target.id);
        // Check if target is the moderator themselves
        if (target.id === interaction.user.id) {
            await interaction.editReply({
                content: '❌ لا يمكنك تحذير نفسك',
            });
            return;
        }
        try {
            const result = await client.moderationHandler.warn({
                guild: interaction.guild,
                moderator: interaction.guild.members.cache.get(interaction.user.id),
                target,
                reason,
            });
            await interaction.editReply({
                content: `⚠️ **${target.tag}** تم تحذيره (${result.warningCount} تحذير) | ${reason}`,
            });
            // 🎭 رولات التحذير — إعطاء مباشرة أو لوحة اختيار (من الإعدادات)
            const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
            if (targetMember) {
                const executor = interaction.guild.members.cache.get(interaction.user.id) ||
                    (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
                if (executor) {
                    await (0, warnRoles_1.offerWarnRoles)({
                        settings: await (0, models_1.getGuildSettings)(interaction.guildId),
                        guild: interaction.guild,
                        executor,
                        target: targetMember,
                        reason,
                        reply: payload => interaction.followUp({
                            content: payload.content,
                            components: payload.components,
                            ephemeral: true,
                        }),
                    });
                }
            }
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ حدث خطأ: ${error.message}`,
            });
        }
    },
};
exports.default = command;
//# sourceMappingURL=warn.js.map