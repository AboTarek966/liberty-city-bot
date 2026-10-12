// ============================================
// Liberty City Bot - Slots (ماكينة الحظ)
// رهان من الرصيد — ثلاث نفسية = فوز ×5
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { UserProfile } from '../../models';
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
    let payout = 0;

    if (a === b && b === c) {
      payout = amount * 5;
      title = '💎💎💎 جاكبوت! ثلاث نفسية — ربحت ×5!';
    } else if (a === b || b === c || a === c) {
      payout = amount * 2;
      title = '🎉 زوجان! ربحت ×2';
    } else {
      title = '💀 حظ أوفر هذه المرة';
    }

    profile.balance += payout;
    await profile.save();

    await interaction.reply({
      content:
        `🎰 │ ${a} │ ${b} │ ${c} │ — ${title} • ` +
        `الرهان: \`${formatNumber(amount)}\` • الربح: \`${formatNumber(payout)}\` • ` +
        `رصيدك: \`${formatNumber(profile.balance)}\``,
    });
  },
};

export default command;
