"use strict";
// ============================================
// Liberty City Bot - AI Ticket Assistant Admin Approval
// ============================================
// معالج أزرار موافقة/رفض الأدمن لإجراءات الـ AI في التذاكر
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("../../utils/helpers");
const models_1 = require("../../models");
const logger = (0, helpers_1.createLogger)('Button:TicketAIApproval');
const handler = {
    id: 'ticket_ai',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        const parts = interaction.customId.split(':');
        if (parts.length < 3)
            return;
        const action = parts[1]; // approve, deny, details
        const approvalId = parts.slice(2).join(':');
        const client = interaction.client;
        const approvals = client.aiTicketAssistant?.getApprovals?.() || new Map();
        const approval = approvals.get(approvalId);
        if (!approval) {
            await interaction.reply({ content: '❌ طلب الموافقة غير موجود أو منتهي الصلاحية', ephemeral: true });
            return;
        }
        if (approval.status !== 'pending') {
            await interaction.reply({ content: `❌ هذا الطلب تم ${approval.status === 'approved' ? 'الموافقة عليه' : 'رفضه'} مسبقاً`, ephemeral: true });
            return;
        }
        // التحقق من صلاحيات الأدمن
        const settings = await (0, models_1.getGuildSettings)(interaction.guild.id);
        const adminRoles = settings.tickets?.adminRoleIds || [];
        const member = interaction.member;
        let isAdmin = false;
        if (member && member.permissions && typeof member.permissions === 'object') {
            try {
                isAdmin = member.permissions.has('Administrator');
            }
            catch { }
        }
        if (!isAdmin) {
            isAdmin = adminRoles.some((r) => member && member.roles && 'cache' in member.roles && member.roles.cache.has(r));
        }
        if (!isAdmin) {
            await interaction.reply({ content: '❌ هذا الإجراء للإدارة العليا فقط', ephemeral: true });
            return;
        }
        const channel = interaction.channel;
        if (!channel || approval.channelId !== channel.id) {
            await interaction.reply({ content: '❌ هذا الطلب ليس في هذه القناة', ephemeral: true });
            return;
        }
        if (action === 'approve') {
            approval.status = 'approved';
            approval.approvedBy = interaction.user.id;
            approval.approvedAt = new Date();
            // تنفيذ الإجراء
            await executeApprovedAction(interaction.guild, approval.action);
            await interaction.update({
                content: `✅ **تمت الموافقة** بواسطة ${interaction.user} — تم تنفيذ: ${approval.action.description}`,
                embeds: [],
                components: [],
            }).catch(() => { });
            logger.info(`AI Ticket: Admin ${interaction.user.tag} approved ${approvalId}`);
        }
        else if (action === 'deny') {
            approval.status = 'denied';
            approval.approvedBy = interaction.user.id;
            approval.approvedAt = new Date();
            await interaction.update({
                content: `❌ **تم الرفض** بواسطة ${interaction.user} — الإجراء: ${approval.action.description}`,
                embeds: [],
                components: [],
            }).catch(() => { });
            logger.info(`AI Ticket: Admin ${interaction.user.tag} denied ${approvalId}`);
        }
        else if (action === 'details') {
            const action = approval.action;
            await interaction.reply({
                content: `📋 **تفاصيل الطلب:**\n` +
                    `**النوع:** ${action.type}\n` +
                    `**الوصف:** ${action.description}\n` +
                    `**المعاملات:** \`\`\`json\n${JSON.stringify(action.params, null, 2)}\n\`\`\`\n` +
                    `**يحتاج موافقة:** ${action.requiresAdminApproval ? 'نعم' : 'لا'}\n` +
                    `**المستخدم المستهدف:** ${action.targetUserId ? `<@${action.targetUserId}>` : '—'}\n` +
                    `**الرول المستهدف:** ${action.targetRoleId ? `<@&${action.targetRoleId}>` : '—'}`,
                ephemeral: true,
            });
        }
    },
};
async function executeApprovedAction(guild, action) {
    const client = guild.client;
    try {
        switch (action.type) {
            case 'give_role': {
                if (!action.targetUserId || !action.targetRoleId)
                    return;
                const member = await guild.members.fetch(action.targetUserId).catch(() => null);
                const role = guild.roles.cache.get(action.targetRoleId);
                if (member && role) {
                    await member.roles.add(role, `AI Ticket Assistant: ${action.description}`);
                }
                break;
            }
            case 'remove_role': {
                if (!action.targetUserId || !action.targetRoleId)
                    return;
                const member = await guild.members.fetch(action.targetUserId).catch(() => null);
                const role = guild.roles.cache.get(action.targetRoleId);
                if (member && role) {
                    await member.roles.remove(role, `AI Ticket Assistant: ${action.description}`);
                }
                break;
            }
            case 'create_channel': {
                const channel = await guild.channels.create({
                    name: action.params.name || 'ai-channel',
                    type: action.params.type || 'GUILD_TEXT',
                    parent: action.params.parentId,
                }, `AI Ticket Assistant: ${action.description}`);
                break;
            }
            case 'modify_permissions': {
                // تعديل صلاحيات قناة/رول
                break;
            }
            case 'check_settings': {
                // فحص إعدادات — لا يوجد إجراء تنفيذي
                break;
            }
            case 'restore_backup': {
                await client.securityHandler?.restoreBackup(guild);
                break;
            }
            case 'ban_user': {
                if (!action.targetUserId)
                    return;
                const member = await guild.members.fetch(action.targetUserId).catch(() => null);
                if (member) {
                    await member.ban({ reason: `AI Ticket Assistant: ${action.description}`, deleteMessageSeconds: 0 });
                }
                break;
            }
            case 'timeout_user': {
                if (!action.targetUserId)
                    return;
                const member = await guild.members.fetch(action.targetUserId).catch(() => null);
                if (member) {
                    await member.timeout(action.params.duration || 10 * 60 * 1000, `AI Ticket Assistant: ${action.description}`);
                }
                break;
            }
            case 'custom': {
                // إجراءات مخصصة مستقبلاً
                break;
            }
        }
    }
    catch (error) {
        logger.error(`AI Ticket executeApprovedAction error: ${error.message}`);
    }
}
exports.default = handler;
//# sourceMappingURL=ticketAIApproval.js.map