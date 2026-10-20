// ============================================
// Liberty City Bot - Translate Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';
import { SUPPORTED_LANGUAGES } from '../../handlers/AITranslator';
import { putTranslation } from '../../utils/translateStore';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('ترجمة نص فورية')
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('النص المراد ترجمته')
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addStringOption(option =>
      option
        .setName('target_lang')
        .setDescription('اللغة الهدف')
        .setRequired(false)
        .addChoices(
          { name: '🇸🇦 العربية', value: 'ar' },
          { name: '🇺🇸 English', value: 'en' },
          { name: '🇫🇷 French', value: 'fr' },
          { name: '🇪🇸 Spanish', value: 'es' },
          { name: '🇩🇪 German', value: 'de' },
          { name: '🇮🇹 Italian', value: 'it' },
          { name: '🇵🇹 Portuguese', value: 'pt' },
          { name: '🇷🇺 Russian', value: 'ru' },
          { name: '🇨🇳 Chinese', value: 'zh' },
          { name: '🇯🇵 Japanese', value: 'ja' },
          { name: '🇰🇷 Korean', value: 'ko' },
          { name: '🇹🇷 Turkish', value: 'tr' },
          { name: '🇮🇷 Persian', value: 'fa' },
          { name: '🇮🇳 Hindi', value: 'hi' },
          { name: '🌐 Auto', value: 'auto' },
        )
    )
    .addStringOption(option =>
      option
        .setName('source_lang')
        .setDescription('لغة النص الأصلي (اختياري - كشف تلقائي)')
        .setRequired(false)
        .addChoices(
          { name: '🌐 Auto-detect', value: 'auto' },
          { name: '🇸🇦 Arabic', value: 'ar' },
          { name: '🇺🇸 English', value: 'en' },
          { name: '🇫🇷 French', value: 'fr' },
          { name: '🇪🇸 Spanish', value: 'es' },
          { name: '🇩🇪 German', value: 'de' },
        )
    )
    .setDMPermission(true),

  async execute(interaction: ChatInputCommandInteraction) {
    const text = interaction.options.getString('text', true);
    const targetLang = interaction.options.getString('target_lang') || 'ar';
    const sourceLang = interaction.options.getString('source_lang') || 'auto';

    await interaction.deferReply({ ephemeral: false });

    const client = interaction.client as any;
    const translator = client.aiTranslator;

    if (!translator) {
      await interaction.editReply({ content: '❌ مترجم الذكاء الاصطناعي غير متاح' });
      return;
    }

    const result = await translator.translate(text, targetLang, sourceLang, interaction.guild?.id);

    if (!result) {
      await interaction.editReply({ content: '❌ فشل الترجمة — جرب مرة تانية' });
      return;
    }

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const { Colors } = await import('../../utils/embeds');
    const { SUPPORTED_LANGUAGES } = await import('../../handlers/AITranslator');

    const embed = new EmbedBuilder()
      .setTitle(`${SUPPORTED_LANGUAGES[result.targetLang]?.flag || '🌐'} ترجمة إلى ${SUPPORTED_LANGUAGES[result.targetLang]?.name || result.targetLang}`)
      .setColor(0x00FF88)
      .setDescription(result.translatedText)
      .addFields(
        { name: '🌍 من', value: SUPPORTED_LANGUAGES[result.sourceLang]?.name || result.sourceLang, inline: true },
        { name: '🎯 إلى', value: SUPPORTED_LANGUAGES[result.targetLang]?.name || result.targetLang, inline: true },
        { name: '🎯 ثقة', value: `${result.confidence}%`, inline: true }
      )
      .setFooter({ text: `Liberty City Translator • ${interaction.user.tag}` })
      .setTimestamp();

    // أزرار للغات سريعة
    const row = new ActionRowBuilder<any>().addComponents(
      new ButtonBuilder().setCustomId(`translate:copy:${interaction.id}`).setLabel('📋 نسخ').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`translate:retry:${targetLang}`).setLabel('🔄 إعادة').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`translate:lang`).setLabel('🌐 تغيير اللغة').setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
    // حفظ النص الأصلي لأزرار (نسخ/إعادة/تغيير اللغة)
    const sent = await interaction.fetchReply().catch(() => null);
    if (sent) {
      putTranslation(sent.id, { text, sourceLang: result.sourceLang, targetLang: result.targetLang, translatedText: result.translatedText });
    }
  },
};

export default command;