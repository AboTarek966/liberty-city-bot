// ============================================
// Liberty City Bot - Embed Builder Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { createSession, renderMain } from '../../utils/embedBuilderState';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('📝 أنشئ رسالة Embed جميلة عبر نموذج سهل')
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('قناة الإرسال (الافتراضي: القناة الحالية)')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    // 🧠 إنشاء جلسة جديدة للمستخدم (TTL = 10 دقائق)
    const target = interaction.options.getChannel('channel');
    const session = createSession(interaction.user.id, target?.id);

    // 👀 الرد بمعاينة حية + أزرار التحكم (رسالة مؤقتة خاصة)
    const view = renderMain(session.data);
    await interaction.reply({
      content: '👀 معاينة — ابدأ بالتعديل',
      embeds: view.embeds,
      components: view.components,
      ephemeral: true,
    });
  },
};

export default command;
