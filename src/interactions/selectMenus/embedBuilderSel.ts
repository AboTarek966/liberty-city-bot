// ============================================
// Liberty City Bot - Embed Builder Select Menus (eb|)
// ============================================

import {
  ActionRowBuilder,
  ModalBuilder,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import {
  EB_BUTTON_PREFIX,
  EB_MODAL_PREFIX,
  getSession,
  parseHexColor,
  renderMain,
  touchSession,
} from '../../utils/embedBuilderState';

const EXPIRED_MESSAGE = '⌛ انتهت صلاحية المعاينة، أعد تشغيل الأمر `/embed`';

function textRow(input: TextInputBuilder): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

const handler: SelectMenuHandler = {
  id: EB_BUTTON_PREFIX,
  async execute(interaction) {
    if (!interaction.isStringSelectMenu()) {
      await interaction.reply({ content: '❌ هذه القائمة غير مدعومة', ephemeral: true });
      return;
    }

    const action = interaction.customId.split('|')[1] || '';

    // 🔢 لون مخصص HEX — فتح النموذج كأول استجابة (بدون defer قبله)
    if (action === 'color-select' && interaction.values[0] === 'custom') {
      const modal = new ModalBuilder()
        .setCustomId(`${EB_MODAL_PREFIX}color`)
        .setTitle('🔢 لون مخصص (HEX)')
        .addComponents(
          textRow(
            new TextInputBuilder()
              .setCustomId('hex')
              .setLabel('اللون بصيغة HEX (مثال #5865F2)')
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('#5865F2')
              .setMaxLength(7)
              .setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      return;
    }

    await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل

    const session = getSession(interaction.user.id);
    if (!session) {
      await interaction.editReply({ content: EXPIRED_MESSAGE, embeds: [], components: [] });
      return;
    }

    const data = session.data;

    switch (action) {
      // 🎨 تطبيق لون جاهز
      case 'color-select': {
        const color = parseHexColor(interaction.values[0] ?? '');
        if (color === null) {
          await interaction.editReply(renderMain(data, '❌ لون غير صالح'));
          return;
        }
        data.color = color;
        touchSession(interaction.user.id);
        await interaction.editReply(renderMain(data, '✅ تم تغيير اللون'));
        return;
      }

      // 🗑️ حذف حقل محدد
      case 'field-select': {
        const index = Number.parseInt(interaction.values[0] ?? '', 10);
        if (!Number.isInteger(index) || index < 0 || index >= data.fields.length) {
          await interaction.editReply(renderMain(data, '❌ حقل غير صالح'));
          return;
        }
        const [removed] = data.fields.splice(index, 1);
        touchSession(interaction.user.id);
        await interaction.editReply(renderMain(data, `✅ تم حذف الحقل «${removed.name}»`));
        return;
      }

      default:
        await interaction.editReply(renderMain(data, '❌ خيار غير معروف'));
        return;
    }
  },
};

export default handler;
