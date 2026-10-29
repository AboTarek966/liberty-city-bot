"use strict";
// ============================================
// Liberty City Bot - Role Picker Buttons (أزرار لوحة الرولات)
// السابق ▶ / التالي ◀ / تحديد ✅ / إلغاء ❌
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const rolePicker_1 = require("../../utils/rolePicker");
const embeds_1 = require("../../utils/embeds");
const handler = {
    id: 'rolepick_btn',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        const parts = interaction.customId.split(':');
        const sid = parts[1];
        const action = parts[2];
        const state = (0, rolePicker_1.getRolePickerState)(sid);
        if (!state) {
            await interaction.reply({
                content: '❌ انتهت صلاحية اللوحة — استخدم الأمر من جديد',
                ephemeral: true,
            });
            return;
        }
        if (state.userId !== interaction.user.id) {
            await interaction.reply({
                content: '❌ هذه اللوحة مخصصة لمن أنشأها فقط',
                ephemeral: true,
            });
            return;
        }
        const guild = interaction.guild;
        const executor = interaction.member;
        // --------------------------------------------
        // ❌ إلغاء
        // --------------------------------------------
        if (action === 'cancel') {
            await interaction.deferUpdate();
            (0, rolePicker_1.deleteRolePickerState)(sid);
            await interaction
                .editReply({
                content: `❌ تم إلغاء العملية — لم يتم إعطاء أي رول لـ <@${state.targetId}>`,
                components: [],
            })
                .catch(() => { });
            return;
        }
        // --------------------------------------------
        // ◀ السابق / ▶ التالي
        // --------------------------------------------
        if (action === 'prev' || action === 'next') {
            await interaction.deferUpdate();
            state.page += action === 'next' ? 1 : -1;
            if (state.page < 0)
                state.page = 0;
            const { content, components } = (0, rolePicker_1.buildRolePicker)(state, guild, executor);
            await interaction.editReply({ content, components }).catch(() => { });
            return;
        }
        // --------------------------------------------
        // ✅ تحديد (تأكيد إعطاء الرولات)
        // --------------------------------------------
        if (action === 'confirm') {
            await interaction.deferUpdate();
            const ids = (0, rolePicker_1.getSelectedRoleIds)(state);
            if (ids.length === 0) {
                await interaction
                    .followUp({ content: '❌ لم تختر أي رول — اختر من القائمة أولاً', ephemeral: true })
                    .catch(() => { });
                return;
            }
            const target = await guild.members.fetch(state.targetId).catch(() => null);
            if (!target) {
                await interaction
                    .followUp({ content: '❌ العضو غير موجود في السيرفر', ephemeral: true })
                    .catch(() => { });
                return;
            }
            // 🔒 للمالك فقط
            if (executor.id !== guild.ownerId) {
                await interaction.followUp({ content: '❌ هذه اللوحة للمالك فقط', ephemeral: true }).catch(() => { });
                return;
            }
            const isOwner = executor.id === guild.ownerId;
            const botTop = guild.members.me?.roles.highest.position ?? 0;
            const execTop = executor.roles.highest.position;
            const grantable = [];
            let blocked = 0;
            let already = 0;
            for (const id of ids) {
                const r = guild.roles.cache.get(id);
                if (!r || r.id === guild.id || r.managed) {
                    blocked++;
                    continue;
                }
                if (r.position >= botTop || (!isOwner && r.position >= execTop)) {
                    blocked++;
                    continue;
                }
                if (target.roles.cache.has(r.id)) {
                    already++;
                    continue;
                }
                grantable.push(r);
            }
            if (grantable.length === 0) {
                let msg = '❌ لا يمكن إعطاء هذه الرولات';
                if (blocked > 0)
                    msg = '❌ بعض الرولات أعلى من رتبتك أو رتبة البوت — لا يمكن إعطاؤها';
                else if (already > 0)
                    msg = `✅ العضو يملك هذه الرولات بالفعل (${already})`;
                await interaction.followUp({ content: msg, ephemeral: true }).catch(() => { });
                return;
            }
            try {
                const auditReason = `${state.reason} | بواسطة ${executor.user.tag}`;
                await target.roles.add(grantable.map(r => r.id), auditReason);
                (0, rolePicker_1.deleteRolePickerState)(sid);
                const roleList = grantable.slice(0, 10).map(r => `${r}`).join(' ') +
                    (grantable.length > 10 ? ` و${grantable.length - 10} أخرى` : '');
                const skipped = blocked + already;
                const content = `✅ تمت إضافة **${grantable.length}** رول لـ ${target}\n` +
                    `${roleList}\n` +
                    `🛡️ بواسطة ${executor}` +
                    (skipped > 0 ? `\n⚠️ تم تخطي ${skipped} رول (غير قابلة للإعطاء أو مملوكة بالفعل)` : '');
                await interaction.editReply({ content, components: [] }).catch(() => { });
                // سجل العملية
                try {
                    const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../../models')));
                    const settings = await getGuildSettings(guild.id);
                    if (settings.logging?.enabled && settings.logging.channelId) {
                        const logChannel = guild.channels.cache.get(settings.logging.channelId);
                        if (logChannel && logChannel.isTextBased()) {
                            const logEmbed = new discord_js_1.EmbedBuilder()
                                .setTitle('➕ إضافة رولات')
                                .setColor(embeds_1.Colors.success)
                                .addFields({ name: '👤 العضو', value: `${target} (\`${target.id}\`)`, inline: true }, {
                                name: '🎭 الرولات',
                                value: grantable.slice(0, 15).map(r => `${r}`).join(', ') || '—',
                                inline: false,
                            }, { name: '🛡️ المنفذ', value: `${executor} (\`${executor.id}\`)`, inline: true }, { name: '📝 السبب', value: state.reason, inline: false })
                                .setTimestamp()
                                .setFooter({ text: `Liberty City | ${guild.name}` });
                            await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
                        }
                    }
                }
                catch { }
            }
            catch (error) {
                await interaction
                    .followUp({
                    content: `❌ فشل إعطاء الرولات — ${error.message || 'تحقق من صلاحيات البوت'}`,
                    ephemeral: true,
                })
                    .catch(() => { });
            }
            return;
        }
        await interaction.reply({ content: '❌ إجراء غير معروف', ephemeral: true }).catch(() => { });
    },
};
exports.default = handler;
//# sourceMappingURL=rolePickerBtn.js.map