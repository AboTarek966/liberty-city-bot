// ============================================
// Liberty City Bot - Role Picker Select (قائمة اختيار الرولات)
// تحديث العدد المحدد عند تغيير الاختيارات
// ============================================

import { StringSelectMenuInteraction, GuildMember } from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { getRolePickerState, buildRolePicker } from '../../utils/rolePicker';

const handler: SelectMenuHandler = {
  id: 'rolepick',
  async execute(interaction) {
    const sel = interaction as StringSelectMenuInteraction;
    if (!sel.guild) return;

    const parts = sel.customId.split(':');
    const sid = parts[1];
    const page = Number(parts[2] ?? '0');

    const state = getRolePickerState(sid);
    if (!state) {
      await sel.reply({
        content: '❌ انتهت صلاحية اللوحة — استخدم الأمر من جديد',
        ephemeral: true,
      });
      return;
    }

    if (state.userId !== sel.user.id) {
      await sel.reply({
        content: '❌ هذه اللوحة مخصصة لمن أنشأها فقط',
        ephemeral: true,
      });
      return;
    }

    await sel.deferUpdate();

    if (!Number.isNaN(page)) {
      state.selections.set(page, [...sel.values]);
    }

    const executor = (await sel.guild.members.fetch(sel.user.id).catch(() => null)) as GuildMember | null;
    if (!executor) {
      await sel.editReply({ content: '❌ حدث خطأ في جلب بياناتك' }).catch(() => {});
      return;
    }

    const { content, components } = buildRolePicker(state, sel.guild, executor);
    await sel.editReply({ content, components }).catch(() => {});
  },
};

export default handler;
