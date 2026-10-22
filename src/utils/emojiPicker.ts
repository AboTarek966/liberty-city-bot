// ============================================
// Liberty City Bot - نافذة إضافة أمر مخصص
// مودال الإضافة المشترك (للجميع / للإداريين)
// اختيار الإيموجي صار عبر أمر /emoji (قائمة ديسكورد نفسها)
// ============================================

import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';

/** نافذة إضافة أمر مخصص — النطاق يُرسل في customId */
export function buildCommandAddModal(scope: 'public' | 'admin'): ModalBuilder {
  const isAdmin = scope === 'admin';
  const nameInput = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('اسم الأمر (الكلمة التي تُكتب في الشات)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(50)
    .setRequired(true);
  const contentInput = new TextInputBuilder()
    .setCustomId('content')
    .setLabel('رد البوت (حتى 1900 حرف) — {user} {server}')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1900)
    .setRequired(true);

  return new ModalBuilder()
    .setCustomId(`settings_modal:commands:add:${scope}`)
    .setTitle(isAdmin ? '🔒 أمر للإداريين فقط' : '🔓 أمر للجميع')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput)
    );
}
