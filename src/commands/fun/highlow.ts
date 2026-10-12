// ============================================
// Liberty City Bot - High / Low (أعلى أم أقل)
// بطاقة مخفية — خمن أعلى أو أقل من رقم البوت
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { UserProfile } from '../../models';
import { formatNumber } from '../../utils/helpers';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('highlow')
    .setDescription('🎴 لعبة أعلى/أقل — خمن قيمة بطاقة البوت (فوز ×2)')
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('مبلغ الرهان').setRequired(true).setMinValue(10).setMaxValue(100000)
    )
    .addStringOption(opt =>
      opt
        .setName('guess')
        .setDescription('تخمينك')
        .setRequired(true)
        .addChoices(
          { name: '📈 أعلى (High)', value: 'high' },
          { name: '📉 أقل (Low)', value: 'low' }
        )
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger('amount', true);
    const guess = interaction.options.getString('guess', true);
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

    const mine = 2 + Math.floor(Math.random() * 10); // 2-11
    const botCard = 2 + Math.floor(Math.random() * 10);

    profile.balance -= amount;

    let won = false;
    if (mine !== botCard) {
      won = guess === 'high' ? botCard > mine : botCard < mine;
    }

    if (won) {
      profile.balance += amount * 2;
    }
    await profile.save();

    const result = won ? '🎉 ربحت!' : mine === botCard ? '🤝 تعادل (نفس الرقم)' : '💀 خسرت';

    await interaction.reply({
      content:
        `${result} • بطاقتك: \`${mine}\` • بطاقة البوت: \`${botCard}\` • ` +
        `الرهان: \`${formatNumber(amount)}\` • الربح: \`${formatNumber(won ? amount * 2 : 0)}\` • ` +
        `رصيدك: \`${formatNumber(profile.balance)}\``,
    });
  },
};

export default command;
