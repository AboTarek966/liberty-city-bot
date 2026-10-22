// ============================================
// Liberty City Bot - 👑 أزرار موافقة/رفض مالك السيرفر على إطفاء الحماية
//    customId: ownappr:yes:{field} | ownappr:no:{field}
//    يقرّر: صاحب التاج (المالك 👑) + مطوّر البوت (🛠️ DEVELOPER_USER_ID).
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getGuildSettings } from '../../models';
import { LibertyClient } from '../../LibertyClient';
import { takePending, PROTECTION_LABELS } from '../../utils/ownerApproval';

const handler: ButtonHandler = {
  id: 'ownappr',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    // 👑 يحق القرار لمالك السيرفر (التاج) + 🛠️ مطوّر البوت — الأساسيان
    const devId = process.env.DEVELOPER_USER_ID;
    const isOwner = interaction.user.id === interaction.guild.ownerId;
    const isDev = !!devId && interaction.user.id === devId;
    if (!isOwner && !isDev) {
      await interaction.reply({
        content: '👑 يحق الموافقة على إطفاء الحماية **لمالك السيرفر 👑 والمطوّر 🛠️ فقط**',
        ephemeral: true,
      });
      return;
    }
    const who = isOwner ? 'مالك السيرفر' : 'المطوّر';

    const parts = interaction.customId.split(':'); // [ownappr, yes|no, field]
    const verdict = parts[1];
    const field = parts[2];
    const label = PROTECTION_LABELS[field] || field;

    const pending = takePending(interaction.guild.id, field);
    if (!pending) {
      await interaction.update({
        content: `⏰ انتهت صلاحية طلب إيقاف **${label}** (5 دقائق) — أرسل الطلب من جديد من الإعدادات`,
        embeds: [],
        components: [],
      });
      return;
    }

    if (verdict === 'no') {
      await interaction.update({
        content: `❌ رفض ${who} ${interaction.user} طلب إيقاف **${label}** — الحماية تبقى مفعّلة ✅\nطلبه: <@${pending.requestedBy}>`,
        embeds: [],
        components: [],
      });
      return;
    }

    // ✅ موافقة → تُطبَّق الإطفاء فوراً
    try {
      const settings = await getGuildSettings(interaction.guild.id);
      const prot = settings.protection as any;

      if (field === 'ownerApproval') {
        prot.ownerApproval = false; // خيار الموافقة نفسه — بوليان مستقل
      } else {
        if (!prot[field]) prot[field] = { enabled: false };
        prot[field].enabled = false;
      }
      await settings.save();

      // 💾 مزامنة مؤقتات خاصة فور الإطفاء (نفس ما تفعله أزرار اللوحة بعد الحفظ)
      const client = interaction.client as LibertyClient;
      if (field === 'autoBackup') {
        await client.securityHandler?.syncAutoBackup(interaction.guild, false).catch(() => {});
      } else if (field === 'autoScan') {
        await client.securityHandler?.syncAutoScan(interaction.guild).catch(() => {});
      } else if (field === 'inviteTracker') {
        await client.inviteTrackerHandler?.cacheGuildInvites(interaction.guild).catch(() => {});
      }

      await interaction.update({
        content: `✅ وافق ${who} ${interaction.user} — تم إيقاف **${label}** فوراً\nطلبها: <@${pending.requestedBy}> (${pending.requestedByTag})`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      await interaction
        .update({ content: '❌ حدث خطأ أثناء تطبيق الموافقة — الحماية كما كانت', embeds: [], components: [] })
        .catch(() => {});
    }
  },
};

export default handler;
