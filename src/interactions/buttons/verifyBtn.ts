// ============================================
// Liberty City Bot - Verify Button (توثيق العضوية بالزر)
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getGuildSettings } from '../../models';

const handler: ButtonHandler = {
  id: 'verify',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const settings = await getGuildSettings(interaction.guild.id);
    const v = settings.verification;

    if (!v?.enabled || !v.roleId) {
      await interaction.editReply({ content: '⚠️ نظام التوثيق غير مفعّل حالياً' });
      return;
    }

    const member = interaction.guild.members.cache.get(interaction.user.id) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
    if (!member) {
      await interaction.editReply({ content: '❌ لم يتم العثور على عضويتك' });
      return;
    }

    // لديه الرول بالفعل؟
    if (member.roles.cache.has(v.roleId)) {
      await interaction.editReply({ content: '✅ أنت **موثّق بالفعل** — شكراً لك!' });
      return;
    }

    // فحص أن رتبة البوت أعلى من رول التوثيق
    const botMember = interaction.guild.members.me;
    const role = interaction.guild.roles.cache.get(v.roleId);
    if (!role) {
      await interaction.editReply({ content: '❌ رول التوثيق لم يعد موجودة — أبلغ الإدارة' });
      return;
    }
    if (botMember && botMember.roles.highest.position <= role.position) {
      await interaction.editReply({
        content: '❌ لا أستطيع إعطاء الرول — **ارفع رتبة البوت أعلى من رول التوثيق**',
      });
      return;
    }

    try {
      await member.roles.add(role, 'توثيق ذاتي بالزر');
      await interaction.editReply({
        content: `🎉 **تم توثيقك بنجاح!**\nيمكنك الآن التفاعل في السيرفر — أهلاً بك <@${member.id}>`,
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ فشل إعطاء الرول: \`${error.message}\` — تحقق من صلاحيات البوت`,
      });
    }
  },
};

export default handler;
