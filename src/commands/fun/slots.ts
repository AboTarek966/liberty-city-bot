// ============================================
// Liberty City Bot - Slots (ماكينة الحظ)
// رهان من الرصيد — ثلاث نفسية = فوز ×5
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ColorResolvable } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { UserProfile } from '../../models';
import { Colors } from '../../utils/embeds';
import { formatNumber } from '../../utils/helpers';

const SYMBOLS = ['🍒', '🍋', '💎', '🔔', '⭐', '7️⃣'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('🎰 ماكينة الحظ — اختر رهانك واربح (ثلاث نفسية = ×5!)')
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('مبلغ الرهان').setRequired(true).setMinValue(10).setMaxValue(100000)
    )
    .setDMPermission(false),

  cooldown: 6,

  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);
    const userId = interaction.user.id;
    const guildId = interaction.guildId!;

    const profile = await UserProfile.findOne({ userId, guildId }).catch(() => null);
    if (!profile || profile.balance < amount) {
      await interaction.reply({
        content: `❌ رصيدك غير كافٍ — لديك **${formatNumber(profile?.balance || 0)}** ورهانك **${formatNumber(amount)}**`,
        ephemeral: true,
      });
      return;
    }

    profile.balance -= amount;

    const spin = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const a = spin(), b = spin(), c = spin();

    let title: string;
    let color: ColorResolvable;
    let payout = 0;

    if (a === b && b === c) {
      payout = amount * 5;
      title = '💎💎💎 جاكبوت! ثلاث نفسية — ربحت ×5!';
      color = Colors.success;
    } else if (a === b || b === c || a === c) {
      payout = amount * 2;
      title = '🎉 زوجان! ربحت ×2';
      color = Colors.success;
    } else {
      title = '💀 حظ أوفر هذه المرة';
      color = Colors.error;
    }

    profile.balance += payout;
    await profile.save();

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle('🎰 ماكينة الحظ')
          .setDescription(
            `> │ ${a} │ ${b} │ ${c} │\n\n` +
            `${title}\n\n` +
            `**الرهان:** \`${formatNumber(amount)}\` — **الربح:** \`${formatNumber(payout)}\`\n` +
            `**رصيدك:** \`${formatNumber(profile.balance)}\``
          )
          .setTimestamp(),
      ],
    });
  },
};

export default command;
