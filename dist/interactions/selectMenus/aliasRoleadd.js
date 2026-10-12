"use strict";
// ============================================
// Liberty City Bot - Alias Role Add (RoleSelectMenu)
// اختيار رول من قائمة عند استخدام اختصار roleadd بدون تحديد رول
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const handler = {
    id: 'alias_roleadd',
    async execute(interaction) {
        const roleSelect = interaction;
        const client = roleSelect.client;
        if (!roleSelect.guild)
            return;
        await roleSelect.deferReply({ ephemeral: true });
        try {
            const byMember = await roleSelect.guild.members.fetch(roleSelect.user.id);
            if (!byMember.permissions.has(discord_js_1.PermissionFlagsBits.ManageRoles)) {
                await roleSelect.editReply({ content: '❌ تحتاج صلاحية إدارة الرولات' });
                return;
            }
            // استخراج معرف العضو من customId (alias_roleadd:<userId>)
            const parts = roleSelect.customId.split(':');
            const targetId = parts[1];
            if (!targetId) {
                await roleSelect.editReply({ content: '❌ لم يتم تحديد العضو' });
                return;
            }
            const target = await roleSelect.guild.members.fetch(targetId).catch(() => null);
            if (!target) {
                await roleSelect.editReply({ content: '❌ العضو غير موجود في السيرفر' });
                return;
            }
            const roleId = roleSelect.values[0];
            const role = roleSelect.guild.roles.cache.get(roleId);
            if (!role) {
                await roleSelect.editReply({ content: '❌ الرول غير موجود' });
                return;
            }
            // فحص الصلاحيات
            if (role.managed) {
                await roleSelect.editReply({ content: '❌ لا يمكن إضافة رول مُدار (Managed)' });
                return;
            }
            if (role.position >= byMember.roles.highest.position) {
                await roleSelect.editReply({ content: '❌ الرول أعلى من رتبتك' });
                return;
            }
            if (role.position >= (roleSelect.guild.members.me?.roles.highest.position ?? 0)) {
                await roleSelect.editReply({ content: '❌ الرول أعلى من رتبة البوت' });
                return;
            }
            if (target.roles.cache.has(roleId)) {
                await roleSelect.editReply({ content: `❌ ${target} يملك الرول \`${role.name}\` بالفعل` });
                return;
            }
            const result = await client.moderationHandler.addRole({
                guild: roleSelect.guild,
                moderator: byMember,
                target,
                reason: 'إضافة رول عبر قائمة الاختيار',
                roleId,
            });
            await roleSelect.editReply({ embeds: [result.embed] });
        }
        catch (error) {
            await roleSelect.editReply({ content: `❌ حدث خطأ: ${error.message}` }).catch(() => { });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=aliasRoleadd.js.map