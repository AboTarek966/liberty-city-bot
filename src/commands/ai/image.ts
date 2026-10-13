// ============================================
// Liberty City Bot - Image Generation Command
// توليد صور بالذكاء الاصطناعي — مجاني بالكامل (Pollinations.ai)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { generateImageWithRetry } from '../../utils/imageGen';

/** أنماط الرسم — تُضاف كوصف إنجليزي لأن النماذج الإنجليزية أدق */
const STYLES: Array<{ name: string; suffix: string }> = [
  { name: 'واقعي', suffix: ', photorealistic, ultra detailed, natural lighting' },
  { name: 'كرتوني', suffix: ', cartoon style, vibrant colors, clean lines' },
  { name: 'أنمي', suffix: ', anime style, manga, cel shaded' },
  { name: 'فن رقمي', suffix: ', digital art, concept art, artstation' },
  { name: 'لوحة مائية', suffix: ', watercolor painting, soft brush strokes' },
  { name: 'بدون نمط', suffix: '' },
];

const SIZES: Array<{ name: string; width: number; height: number }> = [
  { name: 'مربع 1024×1024', width: 1024, height: 1024 },
  { name: 'عريض 1280×720', width: 1280, height: 720 },
  { name: 'طولي 720×1280', width: 720, height: 1280 },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('توليد صورة بالذكاء الاصطناعي (مجاني)')
    .addStringOption((opt) =>
      opt
        .setName('prompt')
        .setDescription('وصف الصورة — بالعربي أو الإنجليزي')
        .setRequired(true)
        .setMaxLength(500)
    )
    .addStringOption((opt) =>
      opt
        .setName('style')
        .setDescription('نمط الرسم')
        .setRequired(false)
        .addChoices(...STYLES.map((s) => ({ name: s.name, value: s.name })))
    )
    .addStringOption((opt) =>
      opt
        .setName('size')
        .setDescription('حجم الصورة')
        .setRequired(false)
        .addChoices(...SIZES.map((s) => ({ name: s.name, value: s.name })))
    ),

  cooldown: 8,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const rawPrompt = interaction.options.getString('prompt', true).trim();
    if (rawPrompt.length < 3) {
      await interaction.reply({ content: '❌ اكتب وصفاً أوضح للصورة (٣ أحرف على الأقل).' });
      return;
    }

    const styleName = interaction.options.getString('style');
    const sizeName = interaction.options.getString('size');

    const style = STYLES.find((s) => s.name === styleName) || STYLES[STYLES.length - 1];
    const size = SIZES.find((s) => s.name === sizeName) || SIZES[0];

    const short = rawPrompt.length > 120 ? rawPrompt.slice(0, 120) + '…' : rawPrompt;

    await interaction.deferReply();

    const image = await generateImageWithRetry(
      `${rawPrompt}${style.suffix}`,
      { width: size.width, height: size.height, model: 'flux' }
    );

    if (!image) {
      await interaction.editReply(
        '❌ فشل توليد الصورة — الخدمة المجانية مشغولة الآن، حاول بعد دقيقة.'
      );
      return;
    }

    await interaction.editReply({
      content: `🎨 **${short}**`,
      files: [{ attachment: image.data, name: `image.${image.ext}` }],
    });
  },
};

export default command;
