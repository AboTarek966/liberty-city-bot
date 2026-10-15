// ============================================
// Liberty City Bot - Recover Command
// استعادة الأعضاء المطرودين
//
// ⚠️ حقيقة ديسكورد: **ما فيها أمر "إلغاء طرد"** — المطرود يرجع بنفسه
//    من رابط الدعوة فقط. فما نقدر "نرجّعهم"، نقدر نرسل لهم الرابط.
//    هذا سبب وجود هذا الأمر (٧٥ طرداً يدوياً = تعذّب).
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('recover')
    .setDescription('👢 استعادة الأعضاء المطرودين — يرسل لهم رابط الدعوة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o =>
      o
        .setName('limit')
        .setDescription('أقصى عدد من المطرودين (1-200)')
        .setMinValue(1)
        .setMaxValue(200)
    ),

  cooldown: 30,
  permissions: [PermissionFlagsBits.Administrator],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const guild = interaction.guild!;
    const limit = interaction.options.getInteger('limit') ?? 75;

    // ⏳ يقرأ السجلات + يرسل الرسائل — قد يستغرق دقيقة أو أكثر
    await interaction.deferReply();

    try {
      const result = await client.securityHandler.recoverKickedFromAudit(guild, limit);

      if (!result.invite) {
        await interaction.editReply({
          content:
            '❌ لا يوجد رابط دعوة — تأكد أن للبوت صلاحية **Create Invite** في قناة نصية',
        });
        return;
      }

      if (result.total === 0) {
        await interaction.editReply({
          content: `✅ لا يوجد مطرودون في سجلات التدقيق (${limit} آخر طرداً)`,
        });
        return;
      }

      // سطر واحد مضغوط + شرح قصير إذا في رسائل لم تصل
      const note =
        result.failed > 0
          ? `\n_${result.failed} عضو خصوصيتهم مغلقة أو حسابهم محذوف — وصلهم أحد الأصدقاء يدوياً._`
          : '';

      await interaction.editReply({
        content:
          `👢 استعادة المطرودين — أُرسل الرابط إلى **${result.sent}/${result.total}** عضو\n` +
          `🔗 ${result.invite}${note}`,
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ فشلت الاستعادة — ${error?.message ?? 'خطأ غير معروف'}`,
      });
    }
  },
};

export default command;
