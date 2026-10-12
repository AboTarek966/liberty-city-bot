// ============================================
// Liberty City Bot - Role Picker Buttons (أزرار لوحة الرولات)
// السابق ▶ / التالي ◀ / تحديد ✅ / إلغاء ❌
// ============================================

import { ButtonInteraction, GuildMember, Role, EmbedBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import {
  getRolePickerState,
  deleteRolePickerState,
  getSelectedRoleIds,
  buildRolePicker,
} from '../../utils/rolePicker';
import { Colors } from '../../utils/embeds';

const handler: ButtonHandler = {
  id: 'rolepick_btn',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const parts = interaction.customId.split(':');
    const sid = parts[1];
    const action = parts[2];

    const state = getRolePickerState(sid);
    if (!state) {
      await interaction.reply({
        content: '❌ انتهت صلاحية اللوحة — استخدم الأمر من جديد',
        ephemeral: true,
      });
      return;
    }

    if (state.userId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ هذه اللوحة مخصصة لمن أنشأها فقط',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    const executor = interaction.member as GuildMember;

    // --------------------------------------------
    // ❌ إلغاء
    // --------------------------------------------
    if (action === 'cancel') {
      await interaction.deferUpdate();
      deleteRolePickerState(sid);
      await interaction
        .editReply({
          content: `❌ تم إلغاء العملية — لم يتم إعطاء أي رول لـ <@${state.targetId}>`,
          components: [],
        })
        .catch(() => {});
      return;
    }

    // --------------------------------------------
    // ◀ السابق / ▶ التالي
    // --------------------------------------------
    if (action === 'prev' || action === 'next') {
      await interaction.deferUpdate();
      state.page += action === 'next' ? 1 : -1;
      if (state.page < 0) state.page = 0;

      const { content, components } = buildRolePicker(state, guild, executor);
      await interaction.editReply({ content, components }).catch(() => {});
      return;
    }

    // --------------------------------------------
    // ✅ تحديد (تأكيد إعطاء الرولات)
    // --------------------------------------------
    if (action === 'confirm') {
      await interaction.deferUpdate();

      const ids = getSelectedRoleIds(state);
      if (ids.length === 0) {
        await interaction
          .followUp({ content: '❌ لم تختر أي رول — اختر من القائمة أولاً', ephemeral: true })
          .catch(() => {});
        return;
      }

      const target = await guild.members.fetch(state.targetId).catch(() => null);
      if (!target) {
        await interaction
          .followUp({ content: '❌ العضو غير موجود في السيرفر', ephemeral: true })
          .catch(() => {});
        return;
      }

      const isOwner = executor.id === guild.ownerId;
      const botTop = guild.members.me?.roles.highest.position ?? 0;
      const execTop = executor.roles.highest.position;

      const grantable: Role[] = [];
      let blocked = 0;
      let already = 0;

      for (const id of ids) {
        const r = guild.roles.cache.get(id);
        if (!r || r.id === guild.id || r.managed) {
          blocked++;
          continue;
        }
        if (r.position >= botTop || (!isOwner && r.position >= execTop)) {
          blocked++;
          continue;
        }
        if (target.roles.cache.has(r.id)) {
          already++;
          continue;
        }
        grantable.push(r);
      }

      if (grantable.length === 0) {
        let msg = '❌ لا يمكن إعطاء هذه الرولات';
        if (blocked > 0) msg = '❌ بعض الرولات أعلى من رتبتك أو رتبة البوت — لا يمكن إعطاؤها';
        else if (already > 0) msg = `✅ العضو يملك هذه الرولات بالفعل (${already})`;
        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
        return;
      }

      try {
        const auditReason =
          `${state.reason} | بواسطة ${executor.user.tag}`;
        await target.roles.add(
          grantable.map(r => r.id),
          auditReason,
        );

        deleteRolePickerState(sid);

        const roleList =
          grantable.slice(0, 10).map(r => `${r}`).join(' ') +
          (grantable.length > 10 ? ` و${grantable.length - 10} أخرى` : '');
        const skipped = blocked + already;

        const content =
          `✅ تمت إضافة **${grantable.length}** رول لـ ${target}\n` +
          `${roleList}\n` +
          `🛡️ بواسطة ${executor}` +
          (skipped > 0 ? `\n⚠️ تم تخطي ${skipped} رول (غير قابلة للإعطاء أو مملوكة بالفعل)` : '');

        await interaction.editReply({ content, components: [] }).catch(() => {});

        // سجل العملية
        try {
          const { getGuildSettings } = await import('../../models');
          const settings = await getGuildSettings(guild.id);
          if (settings.logging?.enabled && settings.logging.channelId) {
            const logChannel = guild.channels.cache.get(settings.logging.channelId);
            if (logChannel && (logChannel as any).isTextBased()) {
              const logEmbed = new EmbedBuilder()
                .setTitle('➕ إضافة رولات')
                .setColor(Colors.success)
                .addFields(
                  { name: '👤 العضو', value: `${target} (\`${target.id}\`)`, inline: true },
                  {
                    name: '🎭 الرولات',
                    value: grantable.slice(0, 15).map(r => `${r}`).join(', ') || '—',
                    inline: false,
                  },
                  { name: '🛡️ المنفذ', value: `${executor} (\`${executor.id}\`)`, inline: true },
                  { name: '📝 السبب', value: state.reason, inline: false },
                )
                .setTimestamp()
                .setFooter({ text: `Liberty City | ${guild.name}` });
              await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
            }
          }
        } catch {}
      } catch (error: any) {
        await interaction
          .followUp({
            content: `❌ فشل إعطاء الرولات — ${error.message || 'تحقق من صلاحيات البوت'}`,
            ephemeral: true,
          })
          .catch(() => {});
      }
      return;
    }

    await interaction.reply({ content: '❌ إجراء غير معروف', ephemeral: true }).catch(() => {});
  },
};

export default handler;
