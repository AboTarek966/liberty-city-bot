// ============================================
// Settings Panel - Toggle Buttons (تفعيل/تعطيل)
// ============================================

import { ButtonInteraction } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { buildPanel, canManageSettings, buildVerificationPanel, buildShop, SettingsCategory } from '../../utils/settingsPanel';
import { getGuildSettings, AIConfig } from '../../models';
import { LibertyClient } from '../../LibertyClient';
import { setLockdown } from '../../utils/lockdown';

const handler: ButtonHandler = {
  id: 'settings_tog',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    if (!canManageSettings(interaction as any)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
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
        if (!prot[field]) prot[field] = { enabled: false };
        prot[field].enabled = !prot[field].enabled;
        break;
      }
      case 'verification': {
        settings.verification.enabled = !settings.verification.enabled;
        break;
      }
      case 'welcome':
        settings.welcome.enabled = !settings.welcome.enabled;
        break;
      case 'leave':
        settings.leave.enabled = !settings.leave.enabled;
        break;
      case 'logging':
        settings.logging.enabled = !settings.logging.enabled;
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
        await interaction.editReply({ content: '❌ إعداد غير معروف' });
        return;
      }
      default:
        await interaction.editReply({ content: '❌ قسم غير معروف' });
        return;
    }

    await settings.save();

    // Invalidate logging cache when logging toggled
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
