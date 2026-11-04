// ============================================
// Omni Bot - Verify Modal (كابتشا التوثيق)
// ============================================

import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import { getGuildSettings } from '../../models';
import {
  consumeVerificationChallenge,
  grantVerifiedRole,
  logVerification,
} from '../../utils/verification';

const handler: ModalHandler = {
  id: 'verify_modal',
  async execute(interaction: ModalSubmitInteraction) {
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

    const member =
      interaction.guild.members.cache.get(interaction.user.id) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

    if (!member) {
      await interaction.editReply({ content: '❌ لم يتم العثور على عضويتك' });
      return;
    }

    if (member.roles.cache.has(v.roleId)) {
      await interaction.editReply({ content: '✅ أنت **موثّق بالفعل** — شكراً لك!' });
      return;
    }

    const answer = interaction.fields.getTextInputValue('answer');
    const result = consumeVerificationChallenge(interaction.user.id, answer);

    if (result.status === 'expired') {
      await interaction.editReply({
        content: '⏰ **انتهت صلاحية السؤال** — اضغط زر التوثيق مرة أخرى للحصول على سؤال جديد.',
      });
      return;
    }

    if (result.status === 'blocked') {
      await logVerification(
        interaction.guild,
        member,
        'blocked',
        `تجاوز محاولات الكابتشا — حظر مؤقت ${result.blockedMinutes} دقيقة`
      );
      await interaction.editReply({
        content: `⛔ **محاولات كثيرة خاطئة** — حاول مجدداً بعد \`${result.blockedMinutes}\` دقيقة.`,
      });
      return;
    }

    if (result.status === 'wrong') {
      await logVerification(
        interaction.guild,
        member,
        'fail',
        `إجابة كابتشا خاطئة — تبقى ${result.attemptsLeft} محاولة`
      );
      await interaction.editReply({
        content:
          `❌ **الإجابة غير صحيحة** — تبقى لك \`${result.attemptsLeft}\` محاولة.\n` +
          `اضغط زر التوثيق مرة أخرى للمحاولة بسؤال جديد.`,
      });
      return;
    }

    const granted = await grantVerifiedRole(interaction.guild, member, v, 'توثيق ذاتي بعد الكابتشا');
    await interaction.editReply({ content: granted.message });
    await logVerification(
      interaction.guild,
      member,
      granted.ok ? 'success' : 'fail',
      granted.ok ? 'تم التوثيق بالزر بعد اجتياز الكابتشا' : granted.message
    );
  },
};

export default handler;
