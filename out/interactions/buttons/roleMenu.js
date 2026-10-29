"use strict";
// ============================================
// Role Menu - Button (الحصول على الرتبة / إزالتها)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const handler = {
    id: 'rolemenu',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true }); // ✅ منع انتهاء الصلاحية
        const roleId = interaction.customId.split('|')[1];
        if (!roleId) {
            await interaction.editReply({ content: '❌ زر غير صالح' });
            return;
        }
        const settings = await (0, models_1.getGuildSettings)(interaction.guild.id);
        const menu = (settings.roleMenus || []).find((m) => m.messageId === interaction.message.id);
        // التحقق أن هذا الرول جزء من قائمة مسجلة (أمان)
        if (!menu || !menu.roleIds.includes(roleId)) {
            await interaction.editReply({ content: '❌ هذه القائمة لم تعد مفعّلة' });
            return;
        }
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            await interaction.editReply({ content: '❌ هذه الرتبة لم تعد موجودة' });
            return;
        }
        const member = interaction.guild.members.cache.get(interaction.user.id);
        if (!member) {
            await interaction.editReply({ content: '❌ لم يتم العثور على عضوك' });
            return;
        }
        // فحص الرتبة الأعلى
        const botMember = interaction.guild.members.cache.get(interaction.client.user.id);
        if (botMember && role.position >= botMember.roles.highest.position) {
            await interaction.editReply({ content: '❌ الرتبة أعلى من رتبة البوت' });
            return;
        }
        if (member.roles.highest.position <= role.position && !member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator)) {
            await interaction.editReply({ content: '❌ لا يمكنك الحصول على رتبة أعلى من رتبتك' });
            return;
        }
        const hasRole = member.roles.cache.has(roleId);
        try {
            if (hasRole) {
                await member.roles.remove(role, 'Liberty City Role Menu');
                await interaction.editReply({ content: `➖ تم إزالة رتبة **${role.name}**` });
            }
            else {
                await member.roles.add(role, 'Liberty City Role Menu');
                await interaction.editReply({ content: `✅ تم إعطاؤك رتبة **${role.name}**` });
            }
        }
        catch (error) {
            await interaction.editReply({ content: `❌ حدث خطأ: ${error.message}` });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=roleMenu.js.map