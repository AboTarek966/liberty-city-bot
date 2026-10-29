"use strict";
// ============================================
// Liberty City Bot - Embed Builder Select Menus (eb|)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embedBuilderState_1 = require("../../utils/embedBuilderState");
const EXPIRED_MESSAGE = '⌛ انتهت صلاحية المعاينة، أعد تشغيل الأمر `/embed`';
function textRow(input) {
    return new discord_js_1.ActionRowBuilder().addComponents(input);
}
const handler = {
    id: embedBuilderState_1.EB_BUTTON_PREFIX,
    async execute(interaction) {
        if (!interaction.isStringSelectMenu()) {
            await interaction.reply({ content: '❌ هذه القائمة غير مدعومة', ephemeral: true });
            return;
        }
        const action = interaction.customId.split('|')[1] || '';
        // 🔢 لون مخصص HEX — فتح النموذج كأول استجابة (بدون defer قبله)
        if (action === 'color-select' && interaction.values[0] === 'custom') {
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`${embedBuilderState_1.EB_MODAL_PREFIX}color`)
                .setTitle('🔢 لون مخصص (HEX)')
                .addComponents(textRow(new discord_js_1.TextInputBuilder()
                .setCustomId('hex')
                .setLabel('اللون بصيغة HEX (مثال #5865F2)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('#5865F2')
                .setMaxLength(7)
                .setRequired(true)));
            await interaction.showModal(modal);
            return;
        }
        await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل
        const session = (0, embedBuilderState_1.getSession)(interaction.user.id);
        if (!session) {
            await interaction.editReply({ content: EXPIRED_MESSAGE, embeds: [], components: [] });
            return;
        }
        const data = session.data;
        switch (action) {
            // 🎨 تطبيق لون جاهز
            case 'color-select': {
                const color = (0, embedBuilderState_1.parseHexColor)(interaction.values[0] ?? '');
                if (color === null) {
                    await interaction.editReply((0, embedBuilderState_1.renderMain)(data, '❌ لون غير صالح'));
                    return;
                }
                data.color = color;
                (0, embedBuilderState_1.touchSession)(interaction.user.id);
                await interaction.editReply((0, embedBuilderState_1.renderMain)(data, '✅ تم تغيير اللون'));
                return;
            }
            // 🗑️ حذف حقل محدد
            case 'field-select': {
                const index = Number.parseInt(interaction.values[0] ?? '', 10);
                if (!Number.isInteger(index) || index < 0 || index >= data.fields.length) {
                    await interaction.editReply((0, embedBuilderState_1.renderMain)(data, '❌ حقل غير صالح'));
                    return;
                }
                const [removed] = data.fields.splice(index, 1);
                (0, embedBuilderState_1.touchSession)(interaction.user.id);
                await interaction.editReply((0, embedBuilderState_1.renderMain)(data, `✅ تم حذف الحقل «${removed.name}»`));
                return;
            }
            default:
                await interaction.editReply((0, embedBuilderState_1.renderMain)(data, '❌ خيار غير معروف'));
                return;
        }
    },
};
exports.default = handler;
//# sourceMappingURL=embedBuilderSel.js.map