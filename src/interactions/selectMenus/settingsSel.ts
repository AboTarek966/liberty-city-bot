// ============================================
// Settings Panel - Select Menus (رولات، قنوات، قوائم)
// ============================================

import {
  RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  ChannelType,
  TextChannel,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { SelectMenuHandler } from '../../handlers/InteractionHandler';
import { buildPanel, canManageSettings, buildLevelIgnorePanel, buildVerificationPanel, buildTicketAdvancedPanel, buildCommands, buildShop, getActivePanel, SettingsCategory } from '../../utils/settingsPanel';
import { getGuildSettings, AIConfig } from '../../models';
import { LibertyClient } from '../../LibertyClient';

type AnySelect =
  | RoleSelectMenuInteraction
  | ChannelSelectMenuInteraction
  | StringSelectMenuInteraction
  | UserSelectMenuInteraction;

const handler: SelectMenuHandler = {
  id: 'settings_sel',
  async execute(interaction: AnySelect) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    if (!canManageSettings(interaction as any)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }

    // ✅ اختيار رول مكافأة → نافذة إدخال المستوى (showModal كأول استجابة — قبل deferUpdate)
    if (interaction.customId === 'settings_sel:levels:reward_role') {
      const roleId = interaction.values[0];
      if (!roleId) {
        await interaction.reply({ content: '❌ لم تختر رولاً', ephemeral: true });
        return;
      }
      const levelInput = new TextInputBuilder()
        .setCustomId('value')
        .setLabel('المستوى الذي تُمنح فيه المكافأة (1-1000)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(4)
        .setPlaceholder('مثال: 10')
        .setRequired(true);
      const modal = new ModalBuilder()
        .setCustomId(`settings_modal:levels:reward:${roleId}`)
        .setTitle('مستوى المكافأة')
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(levelInput));
      await interaction.showModal(modal);
      return;
    }

    // ✅ اختيار رول عنصر المتجر → مودال الاسم والسعر (showModal كأول استجابة)
    if (interaction.customId === 'settings_sel:shop:role') {
      const roleId = interaction.values[0];
      if (!roleId) {
        await interaction.reply({ content: '❌ لم تختر رولاً', ephemeral: true });
        return;
      }
      const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('اسم العنصر في المتجر')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(100)
        .setPlaceholder('مثال: رتبة VIP')
        .setRequired(true);
      const priceInput = new TextInputBuilder()
        .setCustomId('price')
        .setLabel('السعر بالرصيد (رقم)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(15)
        .setPlaceholder('مثال: 5000')
        .setRequired(true);
      const modal = new ModalBuilder()
        .setCustomId(`settings_modal:shop:add:${roleId}`)
        .setTitle('🛍️ إضافة عنصر للمتجر')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput)
        );
      await interaction.showModal(modal);
      return;
    }

    await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل

    const parts = interaction.customId.split(':');
    const section = parts[1] as SettingsCategory;
    const field = parts[2];
    const values = interaction.values;
    const guildId = interaction.guild.id;

    const settings = await getGuildSettings(guildId);

    switch (`${section}:${field}`) {
      case 'tickets:category':
        (settings.tickets as any).categoryId = values[0] || null;
        break;
      case 'tickets:log':
        (settings.tickets as any).logChannelId = values[0] || null;
        break;
      case 'tickets:roles':
        settings.tickets.supportRoleIds = [...values];
        break;
      case 'tickets:adminroles': {
        settings.tickets.adminRoleIds = values;
        await settings.save();
        const advPanel = buildTicketAdvancedPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: advPanel.embeds, components: advPanel.components as any });
        await interaction.followUp({
          content: values.length
            ? `✅ عند الضغط على 🔔 استدعاء الإدارة سيُمنشن: ${values.map((v: string) => `<@&${v}>`).join(' , ')}`
            : '↩️ تمت الإزالة — سيُمنشن رولات الدعم عند الاستدعاء',
          ephemeral: true,
        });
        return;
      }
      case 'tickets:panel': {
        // إنشاء/نقل لوحة التذاكر — يستبدل اللوحة القديمة ويرث محتواها وأنواعها
        const newChannelId = values[0] || null;
        if (newChannelId) {
          const client = interaction.client as LibertyClient;
          const channel = interaction.guild!.channels.cache.get(newChannelId);
          if (!channel || channel.type !== ChannelType.GuildText) {
            await interaction.editReply({ content: '❌ اختر قناة نصية صالحة' });
            return;
          }

          const existing = getActivePanel(settings);
          // createPanel يرث options/image تلقائياً من اللوحة السابقة ويحذف رسالتها القديمة
          await client.ticketHandler.createPanel(interaction.guild!, channel as TextChannel, {
            id: '',
            name: existing?.name || 'تذاكر الدعم',
            emoji: existing?.emoji || '🎫',
            description:
              existing?.description ||
              'اختر نوع التذكرة من القائمة بالأسفل وسيتم فتح تذكرة بنفس الاسم 💬\n\n' +
              '📋 **قبل الفتح:**\n> • اكتب سؤالك بوضوح\n> • تابع رد فريق الدعم داخل تذكرتك',
            type: 'select',
            fields: [],
            supportRoleIds: [...settings.tickets.supportRoleIds],
          });
        }
        break;
      }
      case 'welcome:channel':
        (settings.welcome as any).channelId = values[0] || null;
        break;
      case 'verification:role':
        settings.verification.roleId = values[0] || undefined;
        await settings.save();
        {
          const vp = buildVerificationPanel(interaction.guild!, settings);
          await interaction.editReply({ embeds: vp.embeds, components: vp.components as any });
        }
        return;
      case 'verification:channel':
        settings.verification.channelId = values[0] || undefined;
        await settings.save();
        {
          const vp = buildVerificationPanel(interaction.guild!, settings);
          await interaction.editReply({ embeds: vp.embeds, components: vp.components as any });
        }
        return;
      case 'leave:channel':
        (settings.leave as any).channelId = values[0] || null;
        break;
      case 'logging:channel':
        (settings.logging as any).channelId = values[0] || null;
        break;
      case 'levels:channel':
        (settings.leveling as any).levelUpChannelId = values[0] || null;
        break;
      case 'levels:ignore_channels': {
        settings.leveling.ignoredChannels = [...values];
        await settings.save();
        const panel = buildLevelIgnorePanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });
        return;
      }
      case 'levels:ignore_roles': {
        settings.leveling.ignoredRoles = [...values];
        await settings.save();
        const panel = buildLevelIgnorePanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });
        return;
      }
      case 'logging:events': {
        const preset = values[0];
        const ALL = [
          'messageDelete', 'messageEdit', 'memberJoin', 'memberLeave',
          'memberBan', 'memberUnban', 'memberUpdate',
          'channelCreate', 'channelDelete', 'channelUpdate',
          'roleCreate', 'roleDelete',
          'voiceStateUpdate', 'inviteCreate', 'inviteDelete',
        ];
        if (preset === 'all') settings.logging.types = ALL;
        else if (preset === 'none') settings.logging.types = [];
        else if (preset === 'messages') settings.logging.types = ['messageDelete', 'messageEdit'];
        else if (preset === 'members') settings.logging.types = ['memberJoin', 'memberLeave', 'memberBan', 'memberUnban', 'memberUpdate'];
        else if (preset === 'channels') settings.logging.types = ['channelCreate', 'channelDelete', 'channelUpdate'];
        else if (preset === 'roles') settings.logging.types = ['roleCreate', 'roleDelete'];
        else if (preset === 'voice') settings.logging.types = ['voiceStateUpdate'];
        else if (preset === 'invites') settings.logging.types = ['inviteCreate', 'inviteDelete'];
        break;
      }
      case 'ai:lang': {
        const lang = values[0] as 'ar' | 'en' | 'both';
        settings.ai.responseLanguage = lang;
        await AIConfig.findOneAndUpdate(
          { guildId },
          { language: lang },
          { upsert: true }
        ).catch(() => {});
        break;
      }
      case 'automod:action':
        settings.automod.badWordsAction = values[0] as any;
        break;
      case 'commands:remove': {
        const name = values[0];
        const before = (settings.customCommands || []).length;
        settings.customCommands = (settings.customCommands || []).filter((c: any) => c.name !== name);
        if (settings.customCommands.length === before) {
          await interaction.editReply({ content: `❌ الأمر \`${name}\` غير موجود` });
          return;
        }
        await settings.save();
        const cPanel = buildCommands(interaction.guild!, settings);
        await interaction.editReply({ embeds: cPanel.embeds, components: cPanel.components as any });
        await interaction.followUp({ content: `🗑️ تم حذف الأمر \`${name}\``, ephemeral: true });
        return;
      }
      case 'shop:remove': {
        const itemId = values[0];
        const item = (settings.shop?.items || []).find((it: any) => it.id === itemId);
        settings.shop.items = (settings.shop?.items || []).filter((it: any) => it.id !== itemId);
        await settings.save();
        const sPanel = buildShop(interaction.guild!, settings);
        await interaction.editReply({ embeds: sPanel.embeds, components: sPanel.components as any });
        await interaction.followUp({ content: `🗑️ تم حذف **${item?.name || 'العنصر'}** من المتجر`, ephemeral: true });
        return;
      }
      default:
        await interaction.editReply({ content: '❌ خيار غير معروف' });
        return;
    }

    await settings.save();

    if (section === 'logging') {
      const client = interaction.client as LibertyClient;
      client.loggingHandler?.invalidateCache?.(guildId);
    }

    const panel = await buildPanel(section, interaction.guild, interaction.user.id);
    await interaction.editReply({
      embeds: panel.embeds,
      components: panel.components as any,
    });
  },
};

export default handler;
