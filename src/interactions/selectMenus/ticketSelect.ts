// ============================================
// Liberty City Bot - Ticket Type Select Menu
// القيمة المختارة = اسم النوع، ويصبح اسم قناة التذكرة بذلك الاسم
// ============================================

import { StringSelectMenuInteraction } from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { LibertyClient } from '../../LibertyClient';
import { getGuildSettings } from '../../models';

// محاولة مساعدة للألواح القديمة (قيم كانت معرفات حقول)
const legacyNames: Record<string, string> = {
  support: 'دعم فني',
  inquiry: 'استفسار',
  report: 'إبلاغ',
};

const handler: SelectMenuHandler = {
  id: 'ticket_select',
  async execute(interaction) {
    const selectInteraction = interaction as StringSelectMenuInteraction;
    const client = selectInteraction.client as LibertyClient;
    if (!selectInteraction.guild) return;

    await selectInteraction.deferReply({ ephemeral: true });

    try {
      const member = await selectInteraction.guild.members.fetch(selectInteraction.user.id);
      const panelId = selectInteraction.customId.replace('ticket_select_', '');
      const value = selectInteraction.values[0];

      // حل القيمة → اسم النوع (من خيارات اللوحة أو القيم القديمة أو النص الخام)
      let type = value;
      const settings = await getGuildSettings(selectInteraction.guild.id).catch(() => null);
      const panel = settings?.tickets?.panels?.find((p: any) => p.id === panelId);
      if (panel) {
        const opt = (panel.options || []).find((o: any) => o.label === value);
        if (opt) {
          type = opt.label;
        } else {
          const field = (panel.fields || []).find((f: any) => f.id === value || f.label === value);
          if (field) type = field.label;
        }
      }
      if (legacyNames[type]) type = legacyNames[type];

      const ticket = await client.ticketHandler.createTicket({
        guild: selectInteraction.guild,
        user: member,
        type,
        panelId,
      });

      await selectInteraction.editReply({
        content: `✅ تم إنشاء تذكرتك (${type}) بنجاح: <#${ticket.channelId}>`,
      });
    } catch (error: any) {
      await selectInteraction.editReply({
        content: `❌ ${error.message || 'حدث خطأ أثناء إنشاء التذكرة'}`,
      });
    }
  },
};

export default handler;
