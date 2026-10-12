// ============================================
// Liberty City Bot - AFK Command (وضع عدم الوجود)
// /afk [السبب] — تفعيل أو إلغاء وضع AFK
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Colors } from '../../utils/embeds';
import { getAFK, setAFK, removeAFK } from '../../utils/afk';
import { formatDuration } from '../../utils/helpers';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('وضع عدم الوجود (AFK) — يُلغى تلقائياً عند أول رسالة منك')
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب غيابك (سيظهر لمن يذكرك)')
        .setRequired(false)
        .setMaxLength(100)
    ),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const reason = interaction.options.getString('reason')?.trim();

    const existing = await getAFK(guildId, userId);

    // كنت AFK → إلغاء
    if (existing) {
      await removeAFK(guildId, userId);
      const duration = formatDuration(Date.now() - existing.since, { compact: true });
      const embed = new EmbedBuilder()
        .setTitle('👋 مرحباً بعودتك!')
        .setColor(Colors.success)
        .setDescription(
          `تم إلغاء وضع AFK — **كنت غائباً لمدة ${duration}**\n\n` +
          `💬 ارجع للدردشة بحرية، وسيُبلغ البوت من يذكرك أنك عدت`
        )
        .setFooter({ text: 'Liberty City Bot' })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // تفعيل AFK
    const finalReason = reason || 'غائب حالياً';
    await setAFK(guildId, userId, finalReason);

    const embed = new EmbedBuilder()
      .setTitle('💤 تم تفعيل وضع AFK')
      .setColor(Colors.primary)
      .setDescription(
        `**السبب:** ${finalReason}\n\n` +
        `✅ سيُلغى تلقائياً عند أول رسالة تكتبها\n` +
        `📣 من يذكرك في رسالة سيظهر له سبب غيابك فوراً`
      )
      .setFooter({ text: 'Liberty City Bot' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
