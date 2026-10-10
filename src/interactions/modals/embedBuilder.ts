// ============================================
// Liberty City Bot - Embed Builder Modals (ebm|)
// ============================================

import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import {
  EB_MAX_FIELDS,
  EB_MODAL_PREFIX,
  getSession,
  parseHexColor,
  renderMain,
  touchSession,
} from '../../utils/embedBuilderState';

const EXPIRED_MESSAGE = '⌛ انتهت صلاحية المعاينة، أعد تشغيل الأمر `/embed`';

const HEX_COLOR_REGEX = /^#?[0-9a-fA-F]{6}$/;
const URL_REGEX = /^https?:\/\/\S+$/i;
const INLINE_TRUE_VALUES = ['yes', 'y', 'true', '1', 'on', 'نعم'];

const handler: ModalHandler = {
  id: EB_MODAL_PREFIX,
  async execute(interaction: ModalSubmitInteraction) {
    await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل

    const session = getSession(interaction.user.id);
    if (!session) {
      await interaction.editReply({ content: EXPIRED_MESSAGE, embeds: [], components: [] });
      return;
    }

    const data = session.data;
    const action = interaction.customId.split('|')[1] || '';

    switch (action) {
      // 📝 العنوان
      case 'title': {
        const title = interaction.fields.getTextInputValue('title').trim().slice(0, 256);
        if (!title) {
          await interaction.editReply(renderMain(data, '❌ العنوان لا يمكن أن يكون فارغاً'));
          return;
        }
        data.title = title;
        touchSession(interaction.user.id);
        await interaction.editReply(renderMain(data, '✅ تم تحديث العنوان'));
        return;
      }

      // 📄 الوصف (فارغاً = مسح الوصف)
      case 'description': {
        const description = interaction.fields.getTextInputValue('description').trim().slice(0, 4000);
        data.description = description || undefined;
        touchSession(interaction.user.id);
        await interaction.editReply(
          renderMain(data, description ? '✅ تم تحديث الوصف' : '🗑️ تم مسح الوصف'),
        );
        return;
      }

      // 🖼️ الصورة الرئيسية
      case 'image': {
        const url = interaction.fields.getTextInputValue('image').trim();
        if (!URL_REGEX.test(url)) {
          await interaction.editReply(renderMain(data, '❌ رابط الصورة غير صالح — يجب أن يبدأ بـ http'));
          return;
        }
        data.image = url;
        touchSession(interaction.user.id);
        await interaction.editReply(renderMain(data, '✅ تم تحديث الصورة'));
        return;
      }

      // 🔍 الصورة المصغّرة
      case 'thumbnail': {
        const url = interaction.fields.getTextInputValue('thumbnail').trim();
        if (!URL_REGEX.test(url)) {
          await interaction.editReply(renderMain(data, '❌ رابط الصورة المصغّرة غير صالح — يجب أن يبدأ بـ http'));
          return;
        }
        data.thumbnail = url;
        touchSession(interaction.user.id);
        await interaction.editReply(renderMain(data, '✅ تم تحديث الصورة المصغّرة'));
        return;
      }

      // 🔢 لون مخصص HEX
      case 'color': {
        const raw = interaction.fields.getTextInputValue('hex').trim();
        if (!HEX_COLOR_REGEX.test(raw)) {
          await interaction.editReply(renderMain(data, '❌ لون غير صالح — استخدم صيغة مثل #5865F2'));
          return;
        }
        data.color = parseHexColor(raw) ?? data.color;
        touchSession(interaction.user.id);
        await interaction.editReply(renderMain(data, '✅ تم تغيير اللون'));
        return;
      }

      // ➕ إضافة حقل جديد (حد أقصى 25)
      case 'field': {
        if (data.fields.length >= EB_MAX_FIELDS) {
          await interaction.editReply(renderMain(data, `❌ الحد الأقصى ${EB_MAX_FIELDS} حقل`));
          return;
        }

        const name = interaction.fields.getTextInputValue('name').trim().slice(0, 256);
        const value = interaction.fields.getTextInputValue('value').trim().slice(0, 1024);
        if (!name || !value) {
          await interaction.editReply(renderMain(data, '❌ اسم الحقل وقيمته مطلوبان'));
          return;
        }

        const inlineRaw = interaction.fields.getTextInputValue('inline').trim().toLowerCase();
        const inline = INLINE_TRUE_VALUES.includes(inlineRaw);

        data.fields.push({ name, value, inline });
        touchSession(interaction.user.id);
        await interaction.editReply(
          renderMain(data, `✅ تم إضافة الحقل (${data.fields.length}/${EB_MAX_FIELDS})`),
        );
        return;
      }

      default:
        await interaction.editReply(renderMain(data, '❌ نوع نموذج غير معروف'));
        return;
    }
  },
};

export default handler;
