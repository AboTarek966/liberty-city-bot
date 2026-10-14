// ============================================
// Liberty City Bot - Riddle (لغز)
// سؤال + أربعة أزرار إجابات — أول من يجيب يفوز
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';
import { pick } from '../../utils/gameUtil';
import { newGameId, setFunState, getFunState, delFunState } from '../../utils/funGameState';

interface Riddle {
  q: string;
  options: string[];
  answer: number;
}

const RIDDLES: Riddle[] = [
  { q: 'ما الشيء الذي يمشي بلا رجلين، ويسمع بلا أذنين، ويطير بلا جناحين؟', options: ['سحاب', 'حجر', 'سمكة', 'كتاب'], answer: 0 },
  { q: 'ما هو الشيء الذي كلما أخذت منه كبر؟', options: ['الحفرة', 'الظل', 'الماء', 'الورق'], answer: 0 },
  { q: 'شيء إذا لمسته صرخ — ما هو؟', options: ['الجرس', 'الزجاج', 'المفتاح', 'الساعة'], answer: 0 },
  { q: 'ما الشيء الذي له رقبة طويلة ولا رأس؟', options: ['القنينة', 'الإنسان', 'القميص', 'الباب'], answer: 0 },
  { q: 'ما الشيء الذي يكتب ولا يقرأ أبداً؟', options: ['القلم', 'الورق', 'الطباشير', 'الكتاب'], answer: 0 },
  { q: 'له أسنان ولا يعضّ أبداً — ما هو؟', options: ['المشط', 'الثعبان', 'الكلب', 'التمساح'], answer: 0 },
  { q: 'ما الشيء الذي تكسره دون أن تلمسه؟', options: ['الوعد', 'الزجاج', 'البيضة', 'الصمت'], answer: 0 },
  { q: 'بيت بلا باب ولا نافذة — ما هو؟', options: ['البيضة', 'الكوخ', 'الخيمة', 'القبر'], answer: 0 },
  { q: 'أخضر في الأرض، أسود في السوق، أحمر في البيت — ما هو؟', options: ['الشاي', 'الفلفل', 'التبغ', 'القهوة'], answer: 0 },
  { q: 'له أوراق وليس نباتاً — ما هو؟', options: ['الكتاب', 'الشجرة', 'الدفتر', 'المذبل'], answer: 0 },
  { q: 'ماذا تضع في الثلاجة ولا يبرد أبداً؟', options: ['الفلفل الحار', 'الماء', 'اللبن', 'الزبدة'], answer: 0 },
  { q: 'ما الشيء الذي يزيد كلما شاركه الناس؟', options: ['المعرفة', 'الذهب', 'الوقت', 'الطعام'], answer: 0 },
  { q: 'يدخل الماء ولا يبتلّ — ما هو؟', options: ['الظل', 'الحديد', 'الرمل', 'الخشب'], answer: 0 },
  { q: 'ما الشيء الذي يوجد في وسط باريس؟', options: ['حرف الراء', 'البرج', 'النهر', 'الساعة'], answer: 0 },
  { q: 'كلما زاد عمره قصُر — ما هو؟', options: ['الشمعة', 'الظل', 'الجسر', 'الشجرة'], answer: 0 },
];

const TIMEOUT_MS = 25_000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('riddle')
    .setDescription('🧩 لغز — أربعة خيارات، 25 ثانية، أول إجابة صحيحة يفوز!')
    .setDMPermission(false),

  cooldown: 8,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const r = pick(RIDDLES);
    const id = newGameId();
    setFunState(id, 'riddle', { q: r.q, options: r.options, answer: r.answer, done: false });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      r.options.map((opt, i) =>
        new ButtonBuilder()
          .setCustomId(`fun:riddle:${id}:${i}`)
          .setLabel(opt.slice(0, 80))
          .setStyle(i % 2 === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      )
    );

    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle('🧩 لغز — أول إجابة صحيحة يفوز')
      .setDescription(`**${r.q}**\n\n⏱️ أمامك ${TIMEOUT_MS / 1000} ثانية — اضغط زر الإجابة`);

    await interaction.editReply({ embeds: [embed], components: [row] });

    // إقفال الجولة بعد انتهاء الوقت إن لم يُجب أحد
    setTimeout(async () => {
      const s = getFunState(id);
      if (!s || s.data.done) return; // أُجابت بالفعل — لا نُمس الرد النهائي
      delFunState(id);
      await interaction
        .editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.warning)
              .setTitle('⌛ انتهى الوقت!')
              .setDescription(`**${r.q}**\n\nالجواب الصحيح: **${r.options[r.answer]}**`),
          ],
          components: [],
        })
        .catch(() => {});
    }, TIMEOUT_MS);
  },
};

export default command;
