// ============================================
// Liberty City Bot - Translate Language Picker
// ============================================
// قائمة اختيار اللغة لأزرار /translate (ترجمة النص الأصلي بلغة جديدة)

import {
  StringSelectMenuInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { SUPPORTED_LANGUAGES } from '../../handlers/AITranslator';
import { getTranslation } from '../../utils/translateStore';

const handler: SelectMenuHandler = {
  id: 'translate:lang',
  async execute(interaction) {
    // هذا المُعالج مخصص لقوائم الاختيار النصية فقط
    const i = interaction as StringSelectMenuInteraction;
    const client = i.client as LibertyClient;
    const parts = i.customId.split(':'); // translate:lang:messageId
    const messageId = parts[2];

    const stored = getTranslation(messageId);
    if (!stored) {
      await i.update({
        content: '❌ انتهت صلاحية النص الأصلي — استخدم `/translate` مرة أخرى',
        embeds: [],
        components: [],
      });
      return;
    }

    const targetLang = i.values[0];
    await i.deferUpdate();

    const result = await client.aiTranslator.translate(stored.text, targetLang, stored.sourceLang, i.guild?.id);
    if (!result) {
      await i.followUp({ content: '❌ فشل الترجمة — جرب مرة تانية', ephemeral: true });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('translate:copy').setLabel('📋 نسخ').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`translate:retry:${targetLang}`).setLabel('🔄 إعادة').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('translate:lang').setLabel('🌐 تغيير اللغة').setStyle(ButtonStyle.Success),
    );

    // تحديث رسالة الترجمة الأصلية (وليس الرسالة المؤقتة)
    const original = await i.channel?.messages?.fetch(messageId).catch(() => null);
    if (original) {
      const embed = original.embeds[0]
        ? { ...original.embeds[0].data, title: `${SUPPORTED_LANGUAGES[targetLang]?.flag || '🌐'} ترجمة إلى ${SUPPORTED_LANGUAGES[targetLang]?.name || targetLang}`, description: result.translatedText }
        : null;
      await original.edit({ embeds: embed ? [embed] : [], components: [row as any] }).catch(() => {});
    }

    await i.editReply({ content: `✅ تم الترجمة إلى ${SUPPORTED_LANGUAGES[targetLang]?.flag || ''} ${SUPPORTED_LANGUAGES[targetLang]?.name || targetLang}`, components: [] });
  },
};

export default handler;
