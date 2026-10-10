// ============================================
// Liberty City Bot - استبيان رضا التذاكر (⭐ 1-5)
// يصل للعضو في رسالة خاصة بعد إغلاق تذكرته
// ============================================

import { ButtonInteraction, TextChannel } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { Ticket, getGuildSettings } from '../../models';
import { createEmbed, Colors } from '../../utils/embeds';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('TicketSurvey');

const handler: ButtonHandler = {
  id: 'ticket_survey',
  async execute(interaction: ButtonInteraction) {
    const parts = interaction.customId.split(':');
    const ticketDbId = parts[1];
    const stars = Number.parseInt(parts[2], 10);

    if (!ticketDbId || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      await interaction.reply({ content: '❌ تقييم غير صالح', ephemeral: true });
      return;
    }

    await interaction.deferUpdate(); // ✅ فوراً قبل أي عملية أخرى

    const ticket = await Ticket.findById(ticketDbId).catch(() => null);
    if (!ticket) {
      await interaction.editReply({ content: '❌ لم يتم العثور على التذكرة' });
      return;
    }
    if (ticket.userId !== interaction.user.id) {
      await interaction.reply({ content: '❌ هذا التقييم ليس لك', ephemeral: true });
      return;
    }

    // تسجيل التقييم في قناة سجلات التذاكر
    try {
      const guild = interaction.client.guilds.cache.get(ticket.guildId);
      if (guild) {
        const settings = await getGuildSettings(guild.id);
        const logId = settings.tickets.logChannelId || settings.logging.channelId;
        const logChannel = logId ? (guild.channels.cache.get(logId) as TextChannel) : null;
        if (logChannel && 'send' in logChannel) {
          await logChannel.send({
            embeds: [
              createEmbed({
                title: `⭐ تقييم عضو جديد — ${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)} (${stars}/5)`,
                description:
                  `> 👤 العضو: <@${ticket.userId}>\n` +
                  `> 📂 نوع التذكرة: ${ticket.type}\n` +
                  `> 📅 أُغلقت: ${ticket.closedAt ? `<t:${Math.floor(ticket.closedAt.getTime() / 1000)}:R>` : 'غير معروف'}`,
                color: stars >= 4 ? Colors.success : stars === 3 ? Colors.warning : Colors.error,
                footer: { text: 'Liberty City Ticket Surveys' },
              }),
            ],
          });
        }
      }
    } catch (error) {
      logger.error('Failed to log survey rating:', error);
    }

    await interaction.editReply({
      embeds: [
        createEmbed({
          title: 'شكراً لك! 💙',
          description: `قيّمت تجربتك بـ **${'⭐'.repeat(stars)}** (${stars}/5)\nرأيك يساعدنا على تحسين خدمة الدعم`,
          color: Colors.success,
        }),
      ],
      components: [],
    });
  },
};

export default handler;
