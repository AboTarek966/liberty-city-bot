// ============================================
// Liberty City Bot - Verify Button (توثيق العضوية بالزر)
// ============================================
// يدعم: شرط عمر الحساب · كابتشا رياضية · إزالة رول الحجر · سجل تدقيق

import {
  ButtonInteraction,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getGuildSettings } from '../../models';
import {
  createVerificationChallenge,
  getAccountAgeDays,
  grantVerifiedRole,
  logVerification,
} from '../../utils/verification';

const handler: ButtonHandler = {
  id: 'verify',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const settings = await getGuildSettings(interaction.guild.id);
    const v = settings.verification;

    if (!v?.enabled || !v.roleId) {
      await interaction.reply({ content: '⚠️ نظام التوثيق غير مفعّل حالياً', ephemeral: true });
      return;
    }

    const member =
      interaction.guild.members.cache.get(interaction.user.id) ||
      (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));

    if (!member) {
      await interaction.reply({ content: '❌ لم يتم العثور على عضويتك', ephemeral: true });
      return;
    }

    if (member.roles.cache.has(v.roleId)) {
      // لو بقي رول الحجر بعد التوثيق، نزيله حتى لا يبقى العضو محجوراً
      if (v.quarantineRoleId && member.roles.cache.has(v.quarantineRoleId)) {
        await grantVerifiedRole(interaction.guild, member, v, 'تنظيف رول الحجر');
      }
      await interaction.reply({ content: '✅ أنت **موثّق بالفعل** — شكراً لك!', ephemeral: true });
      return;
    }

    // 🔞 شرط عمر الحساب
    const minAge = Math.max(0, v.minAccountAgeDays || 0);
    if (minAge > 0) {
      const age = getAccountAgeDays(member.user);
      if (age < minAge) {
        const reason = `عمر حسابك ${age} يوم — الحد الأدنى ${minAge} يوم`;
        await logVerification(interaction.guild, member, 'fail', reason);

        if (v.kickOnFail) {
          await member
            .kick(`فشل شرط عمر الحساب في التوثيق (${age}/${minAge} يوم)`)
            .catch(() => {});
          await interaction.reply({
            content: `⛔ **تم طردك** — ${reason}.\nيمكنك المحاولة مجدداً بعد اكتمال عمر الحساب المطلوب.`,
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: `⛔ **لا يمكنك التوثيق الآن** — ${reason}.\nحاول مجدداً بعد اكتمال المدة.`,
          ephemeral: true,
        });
        return;
      }
    }

    // 🧮 كابتشا رياضية
    if (v.captchaEnabled) {
      const challenge = createVerificationChallenge(interaction.user.id);
      if (!challenge.ok) {
        await logVerification(
          interaction.guild,
          member,
          'blocked',
          `محاولات كابتشا كثيرة — حظر مؤقت ${challenge.blockedMinutes} دقيقة`
        );
        await interaction.reply({
          content: `⛔ **محاولات كثيرة خاطئة** — حاول مجدداً بعد \`${challenge.blockedMinutes}\` دقيقة.`,
          ephemeral: true,
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('verify_modal')
        .setTitle('🧮 التحقق من العضوية')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('answer')
              .setLabel(`🧮 ما ناتج ${challenge.question}`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('اكتب الناتج بالأرقام فقط')
              .setMinLength(1)
              .setMaxLength(4)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
      return;
    }

    // ✅ بدون كابتشا — توثيق مباشر
    await interaction.deferReply({ ephemeral: true });
    const result = await grantVerifiedRole(interaction.guild, member, v);
    await interaction.editReply({ content: result.message });

    await logVerification(
      interaction.guild,
      member,
      result.ok ? 'success' : 'fail',
      result.ok ? 'تم التوثيق بالزر (بدون كابتشا)' : result.message
    );
  },
};

export default handler;
