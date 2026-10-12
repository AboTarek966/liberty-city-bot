// ============================================
// Liberty City Bot - Pay Command (تحويل الرصيد)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { UserProfile } from '../../models';
import { formatNumber } from '../../utils/helpers';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('💸 تحويل رصيد لعضو آخر')
    .addUserOption(option =>
      option.setName('user').setDescription('العضو المستلم').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('amount').setDescription('المبلغ (1 على الأقل)').setRequired(true).setMinValue(1)
    )
    .setDMPermission(false),

  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);

    if (target.bot) {
      await interaction.reply({ content: '❌ لا يمكن التحويل لبوت', ephemeral: true });
      return;
    }
    if (target.id === interaction.user.id) {
      await interaction.reply({ content: '❌ لا يمكنك التحويل لنفسك', ephemeral: true });
      return;
    }

    const sender = await UserProfile.findOne({
      userId: interaction.user.id,
      guildId: interaction.guildId!,
    }).catch(() => null);

    if (!sender || sender.balance < amount) {
      await interaction.reply({
        content: `❌ رصيدك غير كافٍ — تحتاج **${formatNumber(amount)}** ولديك **${formatNumber(sender?.balance || 0)}**`,
        ephemeral: true,
      });
      return;
    }

    // خصم من المرسل + إضافة للمستلم (upsert)
    sender.balance -= amount;
    await sender.save();
    await UserProfile.updateOne(
      { userId: target.id, guildId: interaction.guildId! },
      { $inc: { balance: amount } },
      { upsert: true }
    ).exec();

    await interaction.reply({
      content:
        `💸 حوّلت **${formatNumber(amount)}** عملة إلى ${target} • ` +
        `رصيدك الآن: **${formatNumber(sender.balance)}**`,
    });
  },
};

export default command;
