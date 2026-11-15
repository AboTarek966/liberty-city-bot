// ============================================
// Omni Bot - 🧹 /resetstats — مسح إحصائيات التفاعل
// الصلاحيات: ManageGuild (الإدارة). يتطلب تأكيداً صريحاً.
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { ActivityStats } from '../../handlers/ActivityTracker';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('ResetStats');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('resetstats')
    .setDescription('🧹 تصفير كل إحصائيات الرسائل والفويس — عملية نهائية')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addStringOption((o) =>
      o
        .setName('scope')
        .setDescription('ما الذي تريد تصفيره؟')
        .setRequired(true)
        .addChoices(
          { name: 'الكل — رسائل وفويس', value: 'all' },
          { name: 'كتابياً — الرسائل فقط', value: 'messages' },
          { name: 'صوتياً — الفويس فقط', value: 'voice' }
        )
    )
    .addStringOption((o) =>
      o
        .setName('period')
        .setDescription('الفترة الزمنية المراد تصفيرها')
        .setRequired(true)
        .addChoices(
          { name: 'الكلي', value: 'total' },
          { name: 'هذا الشهر', value: 'month' },
          { name: 'هذا الأسبوع', value: 'week' },
          { name: 'اليوم', value: 'day' },
          { name: 'كل الفترات', value: 'all' }
        )
    )
    .addStringOption((o) =>
      o
        .setName('confirm')
        .setDescription('اكتب «تصفير» للتأكيد — هذه العملية نهائية ولا يمكن التراجع عنها')
        .setRequired(true)
        .setMaxLength(32)
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    // تأكيد صريح
    const confirm = String(interaction.options.getString('confirm', true) || '').trim().toLowerCase();
    if (confirm !== 'تصفير' && confirm !== 'reset') {
      await interaction.reply({
        content: '❌ يجب كتابة «تصفير» في حقل confirm للتأكيد — هذه عملية نهائية ولا يمكن التراجع عنها.',
        ephemeral: true,
      });
      return;
    }

    const scope = interaction.options.getString('scope', true);
    const period = interaction.options.getString('period', true);

    const filter: any = { guildId: interaction.guild.id };
    if (period !== 'all') filter.period = period;

    await interaction.deferReply({ ephemeral: true });

    let result: { message: string; count: number } = { message: '', count: 0 };
    try {
      if (scope === 'all') {
        const r = await ActivityStats.deleteMany(filter);
        result = { message: 'كل إحصائيات التفاعل (الرسائل + الفويس)', count: r.deletedCount || 0 };
      } else if (scope === 'messages') {
        const r = await ActivityStats.updateMany(filter, { $set: { messages: 0 } });
        result = { message: 'إحصائيات الرسائل', count: r.modifiedCount || 0 };
      } else if (scope === 'voice') {
        const r = await ActivityStats.updateMany(
          filter,
          { $set: { voiceMinutes: 0, voiceJoins: 0 } }
        );
        result = { message: 'إحصائيات الفويس', count: r.modifiedCount || 0 };
      }
    } catch (err: any) {
      logger.error(`resetstats failed: ${err?.message || err}`);
      await interaction.editReply({ content: `❌ حدث خطأ أثناء المسح: ${err?.message || 'غير معروف'}` });
      return;
    }

    const periodLabel = { all: 'كل الفترات', total: 'الكلي', month: 'الشهر الحالي', week: 'الأسبوع الحالي', day: 'اليوم' }[period];

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🧹 تم تصفير الإحصائيات')
      .addFields(
        { name: 'النطاق', value: result.message, inline: false },
        { name: 'الفترة الزمنية', value: periodLabel || period, inline: false },
        { name: 'السجلّات المُعدَّلة', value: String(result.count), inline: false },
      )
      .setFooter({ text: 'تم بواسطة: ' + interaction.user.tag })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
