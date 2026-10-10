// ============================================
// Liberty City Bot - Balance Command (الرصيد)
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { UserProfile } from '../../models';
import { Colors } from '../../utils/embeds';
import { formatNumber } from '../../utils/helpers';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('💰 عرض رصيدك — المحفظة والبنك')
    .addUserOption(option =>
      option.setName('user').setDescription('العضو (افتراضياً: أنت)').setRequired(false)
    )
    .setDMPermission(false),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser('user') || interaction.user;

    const profile = await UserProfile.findOne({
      userId: target.id,
      guildId: interaction.guildId!,
    }).catch(() => null);

    const wallet = profile?.balance || 0;
    const bank = profile?.bank || 0;

    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle(`💰 رصيد ${target.username}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '👛 المحفظة', value: `\`${formatNumber(wallet)}\``, inline: true },
        { name: '🏦 البنك', value: `\`${formatNumber(bank)}\``, inline: true },
        { name: '📊 الإجمالي', value: `\`${formatNumber(wallet + bank)}\``, inline: true },
      )
      .setFooter({ text: 'اجمع الرصيد بالنشر و/daily ثم اصرفه من /shop' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
