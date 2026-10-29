"use strict";
// ============================================
// Liberty City Bot - Embed Builder Buttons (eb|)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embedBuilderState_1 = require("../../utils/embedBuilderState");
const EXPIRED_MESSAGE = '⌛ انتهت صلاحية المعاينة، أعد تشغيل الأمر `/embed`';
const MODAL_ACTIONS = ['title', 'description', 'image', 'thumbnail', 'addfield'];
function textRow(input) {
    return new discord_js_1.ActionRowBuilder().addComponents(input);
}
// --------------------------------------------
// Modal Builders (الحقول تظهر قبل الحفظ)
// --------------------------------------------
function buildActionModal(action, data) {
    const modal = new discord_js_1.ModalBuilder();
    switch (action) {
        case 'title': {
            const input = new discord_js_1.TextInputBuilder()
                .setCustomId('title')
                .setLabel('عنوان الإمبد (حتى 256 حرف)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('مثال: رسالة ترحيبية...')
                .setMaxLength(256)
                .setRequired(true);
            if (data.title)
                input.setValue(data.title);
            return modal
                .setCustomId(`${embedBuilderState_1.EB_MODAL_PREFIX}title`)
                .setTitle('📝 عنوان الإمبد')
                .addComponents(textRow(input));
        }
        case 'description': {
            // ⚠️ اختياري: تركه فارغاً يمسح الوصف الحالي
            const input = new discord_js_1.TextInputBuilder()
                .setCustomId('description')
                .setLabel('محتوى الرسالة (يدعم تنسيق ديسكورد)')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder('اتركه فارغاً لمسح الوصف...')
                .setMaxLength(4000)
                .setRequired(false);
            if (data.description)
                input.setValue(data.description);
            return modal
                .setCustomId(`${embedBuilderState_1.EB_MODAL_PREFIX}description`)
                .setTitle('📄 وصف الإمبد')
                .addComponents(textRow(input));
        }
        case 'image': {
            const input = new discord_js_1.TextInputBuilder()
                .setCustomId('image')
                .setLabel('رابط الصورة (URL)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('https://example.com/image.png')
                .setMaxLength(512)
                .setRequired(true);
            if (data.image)
                input.setValue(data.image);
            return modal
                .setCustomId(`${embedBuilderState_1.EB_MODAL_PREFIX}image`)
                .setTitle('🖼️ رابط الصورة')
                .addComponents(textRow(input));
        }
        case 'thumbnail': {
            const input = new discord_js_1.TextInputBuilder()
                .setCustomId('thumbnail')
                .setLabel('رابط الصورة المصغّرة (URL)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('https://example.com/thumb.png')
                .setMaxLength(512)
                .setRequired(true);
            if (data.thumbnail)
                input.setValue(data.thumbnail);
            return modal
                .setCustomId(`${embedBuilderState_1.EB_MODAL_PREFIX}thumbnail`)
                .setTitle('🔍 الصورة المصغّرة')
                .addComponents(textRow(input));
        }
        case 'addfield': {
            const nameInput = new discord_js_1.TextInputBuilder()
                .setCustomId('name')
                .setLabel('اسم الحقل (حتى 256 حرف)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('مثال: 📅 تاريخ الإنشاء')
                .setMaxLength(256)
                .setRequired(true);
            const valueInput = new discord_js_1.TextInputBuilder()
                .setCustomId('value')
                .setLabel('قيمة الحقل (حتى 1024 حرف)')
                .setStyle(discord_js_1.TextInputStyle.Paragraph)
                .setPlaceholder('مثال: 2026/10/08')
                .setMaxLength(1024)
                .setRequired(true);
            const inlineInput = new discord_js_1.TextInputBuilder()
                .setCustomId('inline')
                .setLabel('inline؟ اكتب yes أو no')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setPlaceholder('yes / no (الافتراضي: no)')
                .setMaxLength(7)
                .setRequired(false);
            return modal
                .setCustomId(`${embedBuilderState_1.EB_MODAL_PREFIX}field`)
                .setTitle('➕ إضافة حقل جديد')
                .addComponents(textRow(nameInput), textRow(valueInput), textRow(inlineInput));
        }
        default:
            throw new Error(`Unknown embed builder modal action: ${action}`);
    }
}
// --------------------------------------------
// Handler
// --------------------------------------------
const handler = {
    id: embedBuilderState_1.EB_BUTTON_PREFIX,
    async execute(interaction) {
        const action = interaction.customId.slice(embedBuilderState_1.EB_BUTTON_PREFIX.length);
        // 📋 فتح النماذج — showModal يجب أن يكون أول استجابة (خلال 3 ثوانٍ)
        if (MODAL_ACTIONS.includes(action)) {
            const session = (0, embedBuilderState_1.getSession)(interaction.user.id);
            if (!session) {
                await interaction.reply({ content: EXPIRED_MESSAGE, ephemeral: true });
                return;
            }
            await interaction.showModal(buildActionModal(action, session.data));
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
            // 🎨 عرض قائمة الألوان
            case 'color':
                await interaction.editReply((0, embedBuilderState_1.renderColorView)(data));
                return;
            // 🗑️ عرض قائمة الحقول للحذف
            case 'delfield':
                if (data.fields.length === 0) {
                    await interaction.editReply((0, embedBuilderState_1.renderMain)(data, 'ℹ️ لا توجد حقول بعد — أضف حقلًا أولاً'));
                    return;
                }
                await interaction.editReply((0, embedBuilderState_1.renderFieldDeleteView)(data));
                return;
            // 👁️ إعادة بناء المعاينة من الحالة
            case 'refresh':
                await interaction.editReply((0, embedBuilderState_1.renderMain)(data, '👁️ تم تحديث المعاينة'));
                return;
            // ↩️ العودة للوحة الأزرار الرئيسية
            case 'back':
                await interaction.editReply((0, embedBuilderState_1.renderMain)(data));
                return;
            // 📤 إرسال الإمبد النهائي للقناة
            case 'send': {
                const embed = (0, embedBuilderState_1.buildPreviewEmbed)(data);
                const targetId = session.channelId && session.channelId !== interaction.channelId
                    ? session.channelId
                    : undefined;
                try {
                    if (targetId) {
                        const target = interaction.guild?.channels.cache.get(targetId);
                        if (!target || !target.isTextBased()) {
                            await interaction.editReply((0, embedBuilderState_1.renderMain)(data, '❌ القناة المحددة غير صالحة للإرسال'));
                            return;
                        }
                        await target.send({ embeds: [embed] });
                    }
                    else {
                        const channel = interaction.channel;
                        if (!channel || !channel.isTextBased()) {
                            await interaction.editReply((0, embedBuilderState_1.renderMain)(data, '❌ لا يمكن الإرسال في هذه القناة'));
                            return;
                        }
                        await channel.send({ embeds: [embed] });
                    }
                }
                catch (error) {
                    const reason = error instanceof Error ? error.message : 'خطأ غير معروف';
                    await interaction.editReply((0, embedBuilderState_1.renderMain)(data, `❌ فشل الإرسال: ${reason}`));
                    return;
                }
                (0, embedBuilderState_1.deleteSession)(interaction.user.id);
                await interaction.editReply({ content: '✅ تم الإرسال', components: [] });
                return;
            }
            // 🗑️ إلغاء البناء ومسح الحالة
            case 'cancel':
                (0, embedBuilderState_1.deleteSession)(interaction.user.id);
                await interaction.editReply({ content: '🗑️ تم الإلغاء', embeds: [], components: [] });
                return;
            default:
                await interaction.editReply((0, embedBuilderState_1.renderMain)(data, '❌ زر غير معروف'));
                return;
        }
    },
};
exports.default = handler;
//# sourceMappingURL=embedBuilderBtn.js.map