"use strict";
// ============================================
// Settings Panel - Category Navigation Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const settingsPanel_1 = require("../../utils/settingsPanel");
const models_1 = require("../../models");
const handler = {
    id: 'settings_cat',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ هذا الزر يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        // التحقق من صلاحيات الإدارة أولاً
        const member = interaction.member;
        const perms = member?.permissions;
        const hasAdminPerms = !!perms && (perms.has(discord_js_1.PermissionFlagsBits.ManageGuild) ||
            perms.has(discord_js_1.PermissionFlagsBits.Administrator));
        if (!hasAdminPerms) {
            await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
            return;
        }
        // التحقق من كلمة المرور
        const userId = interaction.user.id;
        if (!(0, settingsPanel_1.isPasswordVerified)(userId)) {
            // عرض مودال إدخال كلمة المرور
            const settings = await (0, models_1.getGuildSettings)(interaction.guild.id);
            const password = settings.settingsPassword || '7421';
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId('settings_modal:password')
                .setTitle('🔐 التحقق من كلمة المرور')
                .addComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.TextInputBuilder()
                .setCustomId('value')
                .setLabel('أدخل كلمة مرور لوحة الإعدادات')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('••••••••')
                .setRequired(true)
                .setMaxLength(20)));
            await interaction.showModal(modal);
            return;
        }
        await interaction.deferUpdate();
        const category = (interaction.customId.split(':')[1] || 'home');
        const panel = await (0, settingsPanel_1.buildPanel)(category, interaction.guild, interaction.user.id);
        await interaction.editReply({
            embeds: panel.embeds,
            components: panel.components,
        });
    },
};
exports.default = handler;
//# sourceMappingURL=settingsCat.js.map