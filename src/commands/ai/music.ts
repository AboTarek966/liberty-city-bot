// ============================================
// Liberty City Bot - Music Generation Command
// توليد أغنية كاملة بالذكاء الاصطناعي — مجاني بالكامل عبر Hugging Face
// الافتراضي: كلمات + غناء + لحن (ACE-Step) — اختيارياً لحن عزف فقط
// يتطلب HF_TOKEN (حساب Hugging Face مجاني — بلا بطاقة ائتمان)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { generateMusic, generateSong, songFailText, mediaGenAvailable, Dialect } from '../../utils/mediaGen';

const DIALECT_CHOICES = [
  { name: 'مصرية', value: 'egyptian' },
  { name: 'خليجية', value: 'gulf' },
  { name: 'شامية', value: 'levant' },
  { name: 'عراقية', value: 'iraqi' },
  { name: 'فصحى', value: 'msa' },
  { name: 'إنجليزية', value: 'english' },
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('aimusic')
    .setDescription('توليد أغنية كاملة بكلمات وغناء (مجاني)')
    .addStringOption((opt) =>
      opt
        .setName('prompt')
        .setDescription('موضوع الأغنية — بالعربي أو الإنجليزي')
        .setRequired(true)
        .setMaxLength(400)
    )
    .addStringOption((opt) =>
      opt
        .setName('dialect')
        .setDescription('لهجة الكلمات (يُكتشف تلقائياً إذا تُرك فارغاً)')
        .setRequired(false)
        .addChoices(DIALECT_CHOICES)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('instrumental')
        .setDescription('لحن عزف فقط — بدون كلمات ولا غناء')
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('seconds')
        .setDescription('مدة الأغنية بالثواني (15-120)')
        .setRequired(false)
        .setMinValue(15)
        .setMaxValue(120)
    ),

  cooldown: 15,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const avail = mediaGenAvailable();
    if (!avail.music) {
      await interaction.reply({ content: `❌ توليد الموسيقى غير مفعّل — ${avail.reason}` });
      return;
    }

    const prompt = interaction.options.getString('prompt', true).trim();
    if (prompt.length < 3) {
      await interaction.reply({ content: '❌ اكتب موضوعاً أوضح للأغنية (٣ أحرف على الأقل).' });
      return;
    }

    const dialectRaw = interaction.options.getString('dialect');
    const dialect = (dialectRaw || undefined) as Dialect | undefined;
    const instrumental = interaction.options.getBoolean('instrumental') ?? false;
    const seconds = interaction.options.getInteger('seconds') ?? (instrumental ? 45 : 60);
    const short = prompt.length > 100 ? prompt.slice(0, 100) + '…' : prompt;

    await interaction.deferReply();

    let music: Awaited<ReturnType<typeof generateMusic>> = null;
    let lyrics = '';
    let label: string | null = null;
    let note = '';

    if (!instrumental) {
      const outcome = await generateSong({ topic: prompt, question: prompt, seconds, dialect });

      if (outcome.ok) {
        music = outcome.media;
        lyrics = outcome.media.lyrics;
        label = outcome.media.dialectLabel;
      } else if (outcome.lyrics) {
        // الحصة اليومية انتهت أو المعالج مشغول — نرسل الكلمات المكتوبة (مجانية بلا حدود)
        await interaction.editReply({
          content: [
            `✍️ **${short}** · اللهجة ${outcome.dialectLabel}`,
            outcome.lyrics,
            `\n_(${songFailText(outcome.reason)} — الغناء يعود خلال 24 ساعة)_`,
          ].join('\n'),
        });
        return;
      } else {
        note = `⚠️ ${songFailText(outcome.reason)} — أرسلت لك لحن موسيقي بدلها.`;
      }
    }

    if (!music) music = await generateMusic(prompt, { seconds });

    if (!music) {
      await interaction.editReply(
        '❌ فشل توليد الموسيقى — قد تكون المساحة المجانية مشغولة الآن. حاول بعد دقيقة.'
      );
      return;
    }

    await interaction.editReply({
      content: [`🎵 **${short}**${label ? ` · اللهجة ${label}` : ''}`, note, lyrics]
        .filter(Boolean)
        .join('\n'),
      files: [{ attachment: music.data, name: `song.${music.ext}` }],
    });
  },
};

export default command;
