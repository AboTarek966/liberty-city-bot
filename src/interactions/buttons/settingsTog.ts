// ============================================
// Settings Panel - Toggle Buttons (تفعيل/تعطيل)
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { buildPanel, checkSettingsAccess, buildSettingsPasswordModal, buildVerificationPanel, buildShop, sendWelcomeCardPanel, SettingsCategory } from '../../utils/settingsPanel';
import { getGuildSettings, invalidateGuildSettings, AIConfig } from '../../models';
import { LibertyClient } from '../../LibertyClient';
import { setLockdown } from '../../utils/lockdown';
import { gateProtectionOff } from '../../utils/ownerApproval';

const handler: ButtonHandler = {
  id: 'settings_tog',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    const access = checkSettingsAccess(interaction);
    if (access === 'noperm') {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }
    if (access === 'needpassword') {
      // 🔐 انتهت الجلسة → إعادة فتح نافذة كلمة المرور
      await interaction.showModal(buildSettingsPasswordModal());
      return;
    }

    await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل

    const parts = interaction.customId.split(':');
    const section = parts[1] as SettingsCategory;
    const field = parts[2];

    const settings = await getGuildSettings(interaction.guild.id);

    switch (parts[1]) {
      case 'protection': {
        const prot = settings.protection as any;
        // 🔒 وضع الطوارئ: يقفل/يفتح القنوات فعلياً (وليس مجرد مفتاح)
        if (field === 'lockdown') {
          const newState = !prot.lockdown;
          const result = await setLockdown(interaction.guild!, newState);
          prot.lockdown = newState;
          await interaction.followUp({
            content: newState
              ? `🔒 **تم تفعيل وضع الطوارئ** — أُغلقت ${result.textChannels} قناة نصية و${result.voiceChannels} صوتية\nاستخدم الزر مرة أخرى أو \`/lockdown state:off\` للإلغاء`
              : `🔓 **تم إلغاء وضع الطوارئ** — فُتحت ${result.textChannels} قناة نصية و${result.voiceChannels} صوتية`,
            ephemeral: true,
          });
          break;
        }

        // 👑 بوابة الموافقة — هل هذا الزر "إطفاء"؟ (الميزة مفعّلة الآن والزر سيعطّلها)
        const curOn =
          field === 'ownerApproval'
            ? prot.ownerApproval !== false
            : !!(prot[field] && prot[field].enabled);
        if (curOn) {
          const gateMsg = await gateProtectionOff({
            settings,
            guild: interaction.guild!,
            user: interaction.user,
            channel: interaction.channel,
            field,
          });
          if (gateMsg) {
            await interaction.followUp({ content: gateMsg, ephemeral: true });
            return; // ⛔ لم يُطبَّق شيء — الحماية تبقى كما هي بانتظار المالك
          }
        }

        if (field === 'ownerApproval') {
          // خيار الموافقة نفسه — بوليان مستقل (وليس { enabled })
          prot.ownerApproval = !(prot.ownerApproval !== false);
          break;
        }
        if (!prot[field]) prot[field] = { enabled: false };
        prot[field].enabled = !prot[field].enabled;
        break;
      }
      case 'verification': {
        settings.verification.enabled = !settings.verification.enabled;
        break;
      }
      case 'welcome':
        if (field === 'card') {
          // 🎴 تفعيل/تعطيل بطاقة الترحيب المرسومة
          const card = (settings.welcome as any).card;
          if (card) card.enabled = !card.enabled;
        } else {
          settings.welcome.enabled = !settings.welcome.enabled;
        }
        break;
      case 'leave':
        settings.leave.enabled = !settings.leave.enabled;
        break;
      case 'logging':
        if (field === 'snipe') {
          // 🕵️ تفعيل/تعطيل السنايب (استرجاع الرسائل المحذوفة)
          if (!settings.snipe) settings.snipe = { enabled: true };
          settings.snipe.enabled = !settings.snipe.enabled;
        } else {
          settings.logging.enabled = !settings.logging.enabled;
        }
        break;
      case 'levels':
        settings.leveling.enabled = !settings.leveling.enabled;
        break;
      case 'automod':
        if (field === 'zalgo') {
          settings.automod.zalgoEnabled = !settings.automod.zalgoEnabled;
        } else {
          settings.automod.enabled = !settings.automod.enabled;
        }
        break;
      case 'ai': {
        settings.ai.enabled = !settings.ai.enabled;
        // مزامنة مع AIConfig (يستخدمه مسار المنشن)
        await AIConfig.findOneAndUpdate(
          { guildId: interaction.guild.id },
          { enabled: settings.ai.enabled },
          { upsert: true }
        ).catch(() => {});
        break;
      }
      case 'shop': {
        if (!settings.shop) settings.shop = { enabled: true, items: [] };
        settings.shop.enabled = !settings.shop.enabled;
        break;
      }
      case 'tickets': {
        if (field === 'survey') {
          settings.tickets.surveyEnabled = !settings.tickets.surveyEnabled;
          break;
        }
        if (field === 'lockclaim') {
          settings.tickets.lockUntilClaim = !settings.tickets.lockUntilClaim;
          break;
        }
        if (field === 'welcome') {
          settings.tickets.welcomeEnabled = !settings.tickets.welcomeEnabled;
          break;
        }
        // 🤖 AI Ticket Assistant toggles
        // ملاحظة: الـ schema يحفظ aiTicketAssistant داخل protection (وليس الجذر)
        const prot0 = (settings as any).protection;
        if (!prot0) {
          await interaction.editReply({ content: '❌ إعدادات الحماية غير مكتملة' });
          return;
        }
        const s: any = prot0;
        if (field === 'aienabled') {
          if (!s.aiTicketAssistant) s.aiTicketAssistant = { enabled: false, autoClaim: false, analyzeOnCreate: true, requireAdminApprovalForRoles: true, requireAdminApprovalForPermissions: true, requireAdminApprovalForBans: true, maxAutoActionsPerTicket: 3, confidenceThreshold: 70, notifyAdminsOnFailure: true };
          s.aiTicketAssistant.enabled = !s.aiTicketAssistant.enabled;
          break;
        }
        if (field === 'aiclaim') {
          if (!s.aiTicketAssistant) s.aiTicketAssistant = { enabled: true, autoClaim: false, analyzeOnCreate: true, requireAdminApprovalForRoles: true, requireAdminApprovalForPermissions: true, requireAdminApprovalForBans: true, maxAutoActionsPerTicket: 3, confidenceThreshold: 70, notifyAdminsOnFailure: true };
          s.aiTicketAssistant.autoClaim = !s.aiTicketAssistant.autoClaim;
          break;
        }
        if (field === 'aianalyze') {
          if (!s.aiTicketAssistant) s.aiTicketAssistant = { enabled: true, autoClaim: false, analyzeOnCreate: true, requireAdminApprovalForRoles: true, requireAdminApprovalForPermissions: true, requireAdminApprovalForBans: true, maxAutoActionsPerTicket: 3, confidenceThreshold: 70, notifyAdminsOnFailure: true };
          s.aiTicketAssistant.analyzeOnCreate = !s.aiTicketAssistant.analyzeOnCreate;
          break;
        }
        if (field === 'aiadminroles') {
          if (!s.aiTicketAssistant) s.aiTicketAssistant = { enabled: true, autoClaim: false, analyzeOnCreate: true, requireAdminApprovalForRoles: true, requireAdminApprovalForPermissions: true, requireAdminApprovalForBans: true, maxAutoActionsPerTicket: 3, confidenceThreshold: 70, notifyAdminsOnFailure: true };
          s.aiTicketAssistant.requireAdminApprovalForRoles = !s.aiTicketAssistant.requireAdminApprovalForRoles;
          break;
        }
        if (field === 'aiadminperms') {
          if (!s.aiTicketAssistant) s.aiTicketAssistant = { enabled: true };
          s.aiTicketAssistant.requireAdminApprovalForPermissions = !s.aiTicketAssistant.requireAdminApprovalForPermissions;
          break;
        }
        if (field === 'aiadminbans') {
          if (!s.aiTicketAssistant) s.aiTicketAssistant = { enabled: true };
          s.aiTicketAssistant.requireAdminApprovalForBans = !s.aiTicketAssistant.requireAdminApprovalForBans;
          break;
        }
        await interaction.editReply({ content: '❌ إعداد غير معروف' });
        return;
      }
      case 'aiTranslator': {
        // 🌐 تفعيل/تعطيل مترجم الذكاء الاصطناعي (مخزّن داخل protection في الـ schema)
        const prot = settings.protection as any;
        if (!prot.aiTranslator) {
          prot.aiTranslator = { enabled: false, defaultTargetLang: 'ar', autoTranslateChannels: [], ignoredChannels: [], ignoredRoles: [], showOriginal: true, maxLength: 2000 };
        }
        prot.aiTranslator.enabled = !prot.aiTranslator.enabled;
        break;
      }
      case 'music': {
        // 🎵 تفعيل/تعطيل أوضاع الموسيقى
        if (!settings.music) {
          settings.music = { enabled: true, defaultVolume: 100, maxQueueSize: 50, allowDJ: false, autoplay: false, restrictToChannels: [] };
        }
        if (field === 'enabled') settings.music.enabled = !settings.music.enabled;
        else if (field === 'autoplay') settings.music.autoplay = !settings.music.autoplay;
        else if (field === 'dj') settings.music.allowDJ = !settings.music.allowDJ;
        else {
          await interaction.editReply({ content: '❌ إعداد غير معروف' });
          return;
        }
        break;
      }
      default:
        await interaction.editReply({ content: '❌ قسم غير معروف' });
        return;
    }

    await settings.save();
    // ♻️ أبطِل كاش الإعدادات فوراً حتى يُطبَّق التبديل في كل معالجات الحماية بلا تأخير
    invalidateGuildSettings(interaction.guild.id);
    if (section === 'logging') {
      const client = interaction.client as LibertyClient;
      client.loggingHandler?.invalidateCache?.(interaction.guild.id);
    }

    // 💾 مزامنة مؤقت النسخ الاحتياطي التلقائي فور تبديلته
    if (section === 'protection' && field === 'autoBackup') {
      const client = interaction.client as LibertyClient;
      const nowEnabled = (settings.protection as any).autoBackup?.enabled;
      await client.securityHandler?.syncAutoBackup(interaction.guild, !!nowEnabled).catch(() => {});
    }

    // 🔍 مزامنة مؤقت الفحص الدوري فور تبديلته
    if (section === 'protection' && field === 'autoScan') {
      const client = interaction.client as LibertyClient;
      if (!(settings.protection as any).autoScan) {
        (settings.protection as any).autoScan = { enabled: true, interval: 6 };
        await settings.save();
      }
      await client.securityHandler?.syncAutoScan(interaction.guild).catch(() => {});
    }

    // 📨 تحديث كاش الدعوات عند تفعيل/تعطيل Invite Tracker
    if (section === 'protection' && field === 'inviteTracker') {
      const client = interaction.client as LibertyClient;
      if (!(settings.protection as any).inviteTracker) {
        (settings.protection as any).inviteTracker = { enabled: true };
        await settings.save();
      }
      await client.inviteTrackerHandler?.cacheGuildInvites(interaction.guild).catch(() => {});
    }

    // 🤖 AI Auto-Mod: لا يحتاج تهيئة خاصة، الإعدادات تُحفظ مباشرة
    if (section === 'protection' && field === 'aiAutoMod') {
      if (!(settings.protection as any).aiAutoMod) {
        (settings.protection as any).aiAutoMod = { enabled: true };
        await settings.save();
      }
    }

    if ((section as string) === 'welcome' && field === 'card') {
      // 🎴 تفعيل/تعطيل البطاقة → أرسل المحرر مع صورة حية
      await sendWelcomeCardPanel(interaction, settings);
      return;
    }

    const panel =
      section === 'verification'
        ? buildVerificationPanel(interaction.guild!, settings)
        : (section as string) === 'shop'
          ? buildShop(interaction.guild!, settings)
          : await buildPanel(section, interaction.guild, interaction.user.id);
    await interaction.editReply({
      embeds: panel.embeds,
      components: panel.components as any,
    });
  },
};

export default handler;
