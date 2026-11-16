// ============================================
// Omni Bot - 👑 أزرار موافقة/رفض مالك السيرفر على إطفاء الحماية
//    customId: ownappr:yes:{field} | ownappr:no:{field}
//    يقرّر: صاحب التاج (المالك 👑) + مطوّر البوت (🛠️ DEVELOPER_USER_ID).
// ============================================

import { ButtonInteraction, GuildMember } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { getGuildSettings, invalidateGuildSettings } from '../../models';
import { OmniClient } from '../../OmniClient';
import { takePending, protectionFieldLabel, hasHighestServerRole, logProtectionGateDecision } from '../../utils/ownerApproval';
import { isBotOwner } from '../../utils/botOwner';

const handler: ButtonHandler = {
  id: 'ownappr',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    // ✅ يحق القرار لمالك البوت أو حامل أعلى رول في السيرفر
    const isBotAdmin = await isBotOwner(interaction.client, interaction.user.id);
    const member =
      interaction.member instanceof GuildMember
        ? interaction.member
        : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const isTopRole = hasHighestServerRole(interaction.guild, member);

    if (!isBotAdmin && !isTopRole) {
      await interaction.reply({
        content: '👑 يحق الموافقة/الرفض على إطفاء الحماية **لمالك البوت أو صاحب أعلى رول في السيرفر فقط**',
        ephemeral: true,
      });
      return;
    }
    const who = isBotAdmin ? 'مالك البوت' : 'صاحب أعلى رول';

    const parts = interaction.customId.split(':'); // [ownappr, yes|no, field]
    const verdict = parts[1];
    const field = parts[2];
    const label = protectionFieldLabel(field);

    const pending = takePending(interaction.guild.id, field);
    if (!pending) {
      await interaction.update({
        content: `⏰ انتهت صلاحية طلب إيقاف **${label}** (5 دقائق) — أرسل الطلب من جديد من الإعدادات`,
        embeds: [],
        components: [],
      });
      await logProtectionGateDecision({
        guild: interaction.guild,
        field,
        outcome: 'expired',
        userId: interaction.user.id,
        requestedByTag: interaction.user.tag,
        source: 'لوحة التحكم',
        note: 'انتهت صلاحية الطلب (5 دقائق)',
      });
      return;
    }

    const sourceTag = pending.requestedByTag || null;
    const logSource = 'لوحة التحكم';

    if (verdict === 'no') {
      await interaction.update({
        content: `❌ رفض ${who} ${interaction.user} طلب إيقاف **${label}** — الحماية تبقى مفعّلة ✅\nطلبه: <@${pending.requestedBy}>`,
        embeds: [],
        components: [],
      });
      await logProtectionGateDecision({
        guild: interaction.guild,
        field,
        outcome: 'denied',
        userId: interaction.user.id,
        requestedByTag: sourceTag || interaction.user.tag,
        source: logSource,
        note: `رفض بواسطة ${who}`,
      });
      return;
    }

    // ✅ موافقة → تُطبَّق الإطفاء فوراً
    try {
      const settings = await getGuildSettings(interaction.guild.id);
      const prot = settings.protection as any;

      if (field.startsWith('chan:')) {
        // 🎯 استثناء داخل قناة محددة (وليس إطفاءً عاماً)
        const [, channelId, check] = field.split(':');
        if (!Array.isArray(prot.channelOverrides)) prot.channelOverrides = [];
        let entry = prot.channelOverrides.find(
          (o: any) => String(o.channelId) === String(channelId)
        );
        if (!entry) {
          entry = { channelId, disabled: [] };
          prot.channelOverrides.push(entry);
        }
        if (!Array.isArray(entry.disabled)) entry.disabled = [];
        if (!entry.disabled.includes(check)) entry.disabled.push(check);
      } else if (field === 'ownerApproval') {
        prot.ownerApproval = false; // خيار الموافقة نفسه — بوليان مستقل
      } else if (field === 'blocknames') {
        prot.blockMaliciousNames = false; // بوليان مستقل
      } else if (field === 'lockdown') {
        prot.lockdown = false; // بوليان مستقل (وضع الطوارئ)
      } else if (field === 'silentSecurityAlerts') {
        prot.silentSecurityAlerts = false; // تبديل وضع الصمت الأمني
      } else if (field.startsWith('aiAutoMod:category:')) {
        // 🧠 تعطيل فئة محددة من ذكاء الأوتومود بدل إطفاء الذكاء كله
        const catId = field.split(':')[2];
        if (!prot.aiAutoMod || typeof prot.aiAutoMod !== 'object') prot.aiAutoMod = { enabled: true, categories: {} };
        if (!prot.aiAutoMod.categories || typeof prot.aiAutoMod.categories !== 'object') prot.aiAutoMod.categories = {};
        prot.aiAutoMod.categories[catId] = false;
      } else if (field.startsWith('path:')) {
        // 🧭 بوليان متداخلة عشوائية (مثل aiTicketAssistant.autoClaim) — نعبر المسار كامل ونضع false
        const dotted = field.slice(5);
        const parts = dotted.split('.').filter(Boolean);
        if (parts.length) {
          let node: any = prot;
          for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            if (!node[p] || typeof node[p] !== 'object' || Array.isArray(node[p])) node[p] = {};
            node = node[p];
          }
          node[parts[parts.length - 1]] = false;
        }
      } else {
        if (!prot[field]) prot[field] = { enabled: false };
        prot[field].enabled = false;
      }
      await settings.save();
      // ♻️ إبطال الكاش فوراً — الإطفاء يُطبَّق مباشرة على كل معالجات الحماية
      invalidateGuildSettings(interaction.guild.id);
      const client = interaction.client as OmniClient;
      if (field === 'autoBackup') {
        await client.securityHandler?.syncAutoBackup(interaction.guild, false).catch(() => {});
      } else if (field === 'autoScan') {
        await client.securityHandler?.syncAutoScan(interaction.guild).catch(() => {});
      } else if (field === 'antiNuke') {
        await client.securityHandler?.syncRapidGuard(interaction.guild).catch(() => {});
      } else if (field === 'inviteTracker') {
        await client.inviteTrackerHandler?.cacheGuildInvites(interaction.guild).catch(() => {});
      }

      await interaction.update({
        content: `✅ وافق ${who} ${interaction.user} — تم إيقاف **${label}** فوراً\nطلبها: <@${pending.requestedBy}> (${pending.requestedByTag})`,
        embeds: [],
        components: [],
      });
      await logProtectionGateDecision({
        guild: interaction.guild,
        settings,
        field,
        outcome: 'approved',
        userId: interaction.user.id,
        requestedByTag: pending.requestedByTag || sourceTag || interaction.user.tag,
        source: logSource,
        note: `موافقة بواسطة ${who} على طلب <@${pending.requestedBy}>`,
      });
    } catch (error) {
      await interaction
        .update({ content: '❌ حدث خطأ أثناء تطبيق الموافقة — الحماية كما كانت', embeds: [], components: [] })
        .catch(() => {});
    }
  },
};

export default handler;
