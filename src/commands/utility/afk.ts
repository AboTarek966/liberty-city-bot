// ============================================
// Liberty City Bot - AFK Command (وضع عدم الوجود)
// /afk [السبب] — تفعيل أو إلغاء وضع AFK
// ============================================

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
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
      await interaction.editReply({ content: `👋 أهلاً بعودتك — كنت غائباً لمدة ${duration}` });
      return;
    }

    // تفعيل AFK
    const finalReason = reason || 'غائب حالياً';
    await setAFK(guildId, userId, finalReason);

    await interaction.editReply({
      content: `💤 تم تفعيل AFK — السبب: ${finalReason} (يُلغى تلقائياً عند أول رسالة)`,
    });
  },
};

export default command;
