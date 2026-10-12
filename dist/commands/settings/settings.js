"use strict";
// ============================================
// Liberty City Bot - Settings Command (UI Panel)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const settingsPanel_1 = require("../../utils/settingsPanel");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('settings')
        .setDescription('🎛️ لوحة إعدادات السيرفر — واجهة سهلة وجميلة لكل الإعدادات')
        .setDMPermission(false),
    cooldown: 3,
    async execute(interaction) {
        const member = interaction.member;
        const perms = member?.permissions;
        const hasAdminPerms = !!perms && (perms.has(discord_js_1.PermissionFlagsBits.ManageGuild) ||
            perms.has(discord_js_1.PermissionFlagsBits.Administrator));
        // المالك دائماً مسموح له (حتى لو لم تظهر له الصلاحية صراحةً)
        const isOwner = interaction.user.id === interaction.guild?.ownerId;
        // إذا لم يكن لديه صلاحيات إدارية ولا هو المالك → ارفض
        if (!hasAdminPerms && !isOwner) {
            await interaction.reply({
                content: '❌ تحتاج صلاحية **إدارة السيرفر** لفتح الإعدادات',
                ephemeral: true,
            });
            return;
        }
        // فتح اللوحة مباشرة — كلمة المرور تُطلب تلقائياً عند الضغط على أي زر للتعديل
        // (الأزرار تعرض نافذة كلمة المرور، وهذا يعمل حتى لو فُتحت اللوحة من الاختصار)
        const panel = await (0, settingsPanel_1.buildPanel)('home', interaction.guild, interaction.user.id);
        await interaction.reply({
            embeds: panel.embeds,
            components: panel.components,
            ephemeral: true,
        });
    },
};
exports.default = command;
//# sourceMappingURL=settings.js.map