// ============================================
// Liberty City Bot - Dragon Battle (معركة التنين)
// معركة RPG ضد التنين — اضرب، انتقد، واستمر حتى النهاية
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { sleep, hpBar, pick } from '../../utils/gameUtil';

const YOU_HP = 100;
const DRAGON_HP = 160;

const HITS = ['ضربة سريعة', 'لكمة ثقيلة', 'ركلة طائرة', 'ضربة بالسيف', 'لكمة رأس'];
const CRITS = ['هجوم حاسم! 💥', 'ضربة أسطورية! ⚡', 'لكمة مدمّرة! 🌪️'];
const PAIN = ['التثنين يزأر', 'التثنين ينفخ ناراً', 'التثنين يخمش الأرض', 'التثنين يرتفع في الهواء'];
const AGONY = ['التثنين يتراجع وهو يزأر', 'جناح التثنين ينكسر', 'التثنين يسقط على ركبته'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('dragon')
    .setDescription('🐉 معركة التنين — اهزم التنين العظيم وانقذ القرية!')
    .setDMPermission(false),

  cooldown: 12,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let you = YOU_HP;
    let dragon = DRAGON_HP;
    let round = 0;

    const board = (phase: string) =>
      `${phase} • 🧑 <@${interaction.user.id}> ${hpBar(you, YOU_HP, 6)} ${you} • ` +
      `🐉 التنين ${hpBar(dragon, DRAGON_HP, 8)} ${dragon}`;

    await interaction.editReply({ content: board('التثنين يزأر أمامك!') }).catch(() => {});
    await sleep(1000);

    while (you > 0 && dragon > 0 && round < 25) {
      round++;

      // ضربتك
      const crit = Math.random() < 0.18;
      const dmg = crit ? 25 + Math.floor(Math.random() * 20) : 12 + Math.floor(Math.random() * 16);
      dragon = Math.max(0, dragon - dmg);

      if (dragon > 0) {
        await interaction.editReply({
          content: board(`الجولة ${round} — ${crit ? pick(CRITS) : pick(HITS)} (+${dmg})`),
        }).catch(() => {});
        await sleep(820);

        // ردّ التنين
        const dragonDmg = 10 + Math.floor(Math.random() * 18);
        you = Math.max(0, you - dragonDmg);
        await interaction.editReply({
          content: board(`الجولة ${round} — ${pick(PAIN)} (−${dragonDmg})`),
        }).catch(() => {});
        await sleep(820);
      } else {
        await interaction.editReply({
          content: board(`الجولة ${round} — ${crit ? pick(CRITS) : pick(HITS)} (+${dmg}) — ${pick(AGONY)}!`),
        }).catch(() => {});
        await sleep(820);
      }
    }

    const win = dragon <= 0 && you > 0;
    const perfect = win && you === YOU_HP;

    await interaction.editReply({
      content: win
        ? `🏆 هزمت التنين في ${round} جولة! • 🧑 <@${interaction.user.id}> بقي **${you}/${YOU_HP}** • ` +
          (perfect ? '💯 نظيف تماماً — أنت محارب أسطوري!' : '🎉 أنقذت القرية!')
        : `💀 التنين التهمك في ${round} جولة... • 🐉 بقي له **${dragon}/${DRAGON_HP}** — جرّب مرة أخرى!`,
    }).catch(() => {});
  },
};

export default command;
