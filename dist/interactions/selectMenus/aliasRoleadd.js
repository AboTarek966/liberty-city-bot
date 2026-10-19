"use strict";
// ============================================
// Liberty City Bot - Alias Role Add (RoleSelectMenu)
// اختيار رول من قائمة عند استخدام اختصار roleadd بدون تحديد رول
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const handler = {
    id: 'alias_roleadd',
    async execute(interaction) {
        const roleSelect = interaction;
        const client = roleSelect.client;
        if (!roleSelect.guild)
            return;
        await roleSelect.deferReply({ ephemeral: true });
        try {
            // 🔒 للمالك فقط
            if (roleSelect.user.id !== roleSelect.guild.ownerId) {
                await roleSelect.editReply({ content: '❌ هذا الاختيار للمالك فقط' });
                return;
            }
            // بدون فحص ManageRoles — الفحص يكون حسب التسلسل الهرمي فقط داخل addRoles
            const byMember = await roleSelect.guild.members.fetch(roleSelect.user.id);
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
            // ✅ كل الرولات المختارة (يمكن أكثر من واحدة)
            const roleIds = [...roleSelect.values];
            if (roleIds.length === 0) {
                await roleSelect.editReply({ content: '❌ لم تختر أي رول' });
                return;
            }
            const result = await client.moderationHandler.addRoles({
                guild: roleSelect.guild,
                moderator: byMember,
                target,
                reason: 'إضافة رول عبر قائمة الاختيار',
                roleIds,
            });
            await roleSelect.editReply({ content: result.simpleMsg });
        }
        catch (error) {
            await roleSelect.editReply({ content: `❌ حدث خطأ: ${error instanceof Error ? error.message : String(error)}` }).catch(() => { });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=aliasRoleadd.js.map