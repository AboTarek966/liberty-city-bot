// ============================================
// Liberty City Bot - Animal Race (سباق الحيوانات)
// سباق متحرك بين 2-6 مشاركين
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';

const ANIMALS = ['🐎', '🐕', '🐇', '🐆', '🐢', '🦘'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('race')
    .setDescription('🏁 سباق حيوانات — من يصل إلى الخط أولاً؟')
    .addUserOption(opt => opt.setName('user').setDescription('مشارك').setRequired(false))
    .addUserOption(opt => opt.setName('user2').setDescription('مشارك ثانٍ').setRequired(false))
    .addUserOption(opt => opt.setName('user3').setDescription('مشارك ثالث').setRequired(false))
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    // المتنافسون: المنشونون أو عشوائيون من الأعضاء
    const entrants: { id: string; animal: string; pos: number }[] = [];
    const usedAnimals = new Set<string>();

    const addUser = (id: string) => {
      const animal = ANIMALS.find(a => !usedAnimals.has(a)) || ANIMALS[0];
      usedAnimals.add(animal);
      entrants.push({ id, animal, pos: 0 });
    };

    for (const name of ['user', 'user2', 'user3']) {
      const u = interaction.options.getUser(name);
      if (u && !u.bot) addUser(u.id);
    }

    if (entrants.length < 2) {
      const members = interaction.guild!.members.cache.filter(m => !m.user.bot);
      const shuffled = shuffleIds(members.map(m => m.id));
      entrants.length = 0;
      for (const id of shuffled.slice(0, 4)) addUser(id);
    }

    if (entrants.length < 2) {
      await interaction.editReply({ content: '❌يحتاج السباق متسابقين على الأقل' });
      return;
    }

    const TRACK = 12;

    const render = (phase: string): EmbedBuilder => {
      const lanes = entrants
        .map(e => {
          const pad = '⬛'.repeat(Math.min(e.pos, TRACK));
          const done = e.pos >= TRACK ? ' 🏁' : '';
          return `${e.animal} <@${e.id}>\n${pad}${done}`;
        })
        .join('\n\n');
      return new EmbedBuilder()
        .setColor(Colors.primary)
        .setTitle('🏁 سباق الحيوانات')
        .setDescription(`${phase}\n\n${lanes}`)
        .setTimestamp();
    };

    await interaction.editReply({ embeds: [render('استعدوا...') ] });
    await new Promise(r => setTimeout(r, 1200));

    // سباق: كل جولة يتحرك كل متسابق 1-3 خطوات
    let winner: (typeof entrants)[number] | null = null;
    while (!winner) {
      for (const e of entrants) {
        e.pos += 1 + Math.floor(Math.random() * 3);
        if (e.pos >= TRACK) {
          winner = e;
          break;
        }
      }
      await interaction.editReply({ embeds: [render('...')] }).catch(() => {});
      await new Promise(r => setTimeout(r, 800));
    }

    const final = new EmbedBuilder()
      .setColor(Colors.success)
      .setTitle('🏆 الفائز!')
      .setDescription(
        `${winner.animal} **<@${winner.id}>** وصل إلى الخط أولاً! 🎉\n\n` +
        entrants
          .filter(e => e !== winner)
          .map(e => `${e.animal} <@${e.id}> — ${Math.min(e.pos, TRACK)}/${TRACK}`)
          .join('\n')
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [final] });
  },
};

function shuffleIds(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default command;
