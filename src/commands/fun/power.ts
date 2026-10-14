// ============================================
// Liberty City Bot - Power (تدريب القوة)
// ضربة واحدة تقيس قوتك — ويمكنك مواجهة صديق
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { sleep, ratingLine, pick } from '../../utils/gameUtil';

const MESSAGES: Record<string, string[]> = {
  weak: ['الكيس ما تحرك أصلاً...', 'واضح إنك جعت!', 'ضربة خفيفة 😴'],
  mid: ['الكيس ارجف!', 'قوة مقبولة 💪', 'تحتاج تدريب أكثر'],
  strong: ['الكيس طار! 🔥', 'ضربة قوية جداً!', 'الحائط اهتز'],
  god: ['💥 الكيس انفجر!', 'أسطورة! القاعة كلها اهتزت', 'هذا مستوى احترافي!'],
};

function tier(score: number): keyof typeof MESSAGES {
  if (score >= 90) return 'god';
  if (score >= 70) return 'strong';
  if (score >= 40) return 'mid';
  return 'weak';
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('power')
    .setDescription('🏋️ تدريب القوة — اضرب الكيس وشوف قوتك!')
    .addUserOption(opt =>
      opt.setName('user').setDescription('واجه صديقاً وقارن قوتكم').setRequired(false)
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const opponent = interaction.options.getUser('user') as User | null;

    await interaction.editReply({ content: '🏋️ تستعد للضربة...' }).catch(() => {});
    await sleep(750);

    const mine = Math.floor(Math.random() * 101);
    const myLine = `💥 <@${interaction.user.id}> ضرب لـ **${mine}** — ${pick(MESSAGES[tier(mine)])}`;

    if (!opponent || opponent.bot || opponent.id === interaction.user.id) {
      await interaction.editReply({
        content: `${myLine} • ${ratingLine(mine)}`,
      });
      return;
    }

    await interaction.editReply({ content: `${myLine} • الآن دور الخصم...` }).catch(() => {});
    await sleep(850);

    const theirs = Math.floor(Math.random() * 101);
    const winner = mine === theirs ? null : mine > theirs ? interaction.user : opponent;
    const verdict =
      winner === null ? '🤝 تعادل مثير!' :
      `🏆 الفائز: <@${winner.id}> (فرق ${Math.abs(mine - theirs)} نقطة)`;

    await interaction.editReply({
      content: `${myLine} | 💥 <@${opponent.id}> ضرب لـ **${theirs}** — ${pick(MESSAGES[tier(theirs)])} • ${verdict}`,
    });
  },
};

export default command;
