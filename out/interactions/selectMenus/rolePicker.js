"use strict";
// ============================================
// Liberty City Bot - Role Picker Select (قائمة اختيار الرولات)
// تحديث العدد المحدد عند تغيير الاختيارات
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const rolePicker_1 = require("../../utils/rolePicker");
const handler = {
    id: 'rolepick',
    async execute(interaction) {
        const sel = interaction;
        if (!sel.guild)
            return;
        const parts = sel.customId.split(':');
        const sid = parts[1];
        const page = Number(parts[2] ?? '0');
        const state = (0, rolePicker_1.getRolePickerState)(sid);
        if (!state) {
            await sel.reply({
                content: '❌ انتهت صلاحية اللوحة — استخدم الأمر من جديد',
                ephemeral: true,
            });
            return;
        }
        if (state.userId !== sel.user.id) {
            await sel.reply({
                content: '❌ هذه اللوحة مخصصة لمن أنشأها فقط',
                ephemeral: true,
            });
            return;
        }
        await sel.deferUpdate();
        if (!Number.isNaN(page)) {
            state.selections.set(page, [...sel.values]);
        }
        const executor = (await sel.guild.members.fetch(sel.user.id).catch(() => null));
        if (!executor) {
            await sel.editReply({ content: '❌ حدث خطأ في جلب بياناتك' }).catch(() => { });
            return;
        }
        const { content, components } = (0, rolePicker_1.buildRolePicker)(state, sel.guild, executor);
        await sel.editReply({ content, components }).catch(() => { });
    },
};
exports.default = handler;
//# sourceMappingURL=rolePicker.js.map