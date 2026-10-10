// ============================================
// Settings Panel - Action Buttons (لغة، بادئة، XP، مودالات...)
// ============================================

import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  GuildMember,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  RoleSelectMenuBuilder,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { buildPanel, canManageSettings, buildLevelIgnorePanel, buildLevelRewardsPanel, buildTicketMovePanel, buildTicketAdvancedPanel, buildVerificationPanel, buildCommands, buildShop, getActivePanel, SettingsCategory } from '../../utils/settingsPanel';
import { getGuildSettings, AIConfig } from '../../models';
import { LibertyClient } from '../../LibertyClient';
import { handleWelcome } from '../../events/guildMemberAdd';
import { handleLeave } from '../../events/guildMemberRemove';
import { setPendingImageUpload } from '../../utils/pendingUploads';

const handler: ButtonHandler = {
  id: 'settings_btn',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    if (!canManageSettings(interaction as any)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }

    const parts = interaction.customId.split(':');
    const section = parts[1] as SettingsCategory;
    const action = parts[2];
    const guildId = interaction.guild.id;

    const settings = await getGuildSettings(guildId);

    // ---------- مودالات (تفتح مودال = رد فوري) ----------
    const openModal = async (
      title: string,
      placeholder: string,
      style: TextInputStyle,
      max: number,
      value = '',
      required = true
    ): Promise<void> => {
      const input = new TextInputBuilder()
        .setCustomId('value')
        .setLabel(title.substring(0, 45))
        .setStyle(style)
        .setPlaceholder(placeholder)
        .setMaxLength(max)
        .setRequired(required);
      if (value) input.setValue(value.substring(0, max));

      const modal = new ModalBuilder()
        .setCustomId(`settings_modal:${section}:${action}`)
        .setTitle(title.substring(0, 45))
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

      await interaction.showModal(modal);
    };

    // مودال خاص: محتوى لوحة التذاكر (عنوان + وصف معاً)
    if (`${section}:${action}` === 'tickets:panel') {
      const panel = getActivePanel(settings);
      if (!panel) {
        await interaction.reply({
          content: '⚠️ أنشئ اللوحة أولاً: اختر **قناة لوحة التذاكر** من قائمة القنوات في هذه اللوحة',
          ephemeral: true,
        });
        return;
      }

      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('عنوان اللوحة')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(256)
        .setRequired(true)
        .setValue((panel.name || '').substring(0, 256));
      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('محتوى اللوحة')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(true)
        .setValue((panel.description || '').substring(0, 2000));

      const modal = new ModalBuilder()
        .setCustomId('settings_modal:tickets:panel')
        .setTitle('تعديل محتوى لوحة التذاكر')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
        );

      await interaction.showModal(modal);
      return;
    }

    // مودال خاص: رسالة التوثيق (عنوان + نص + نص الزر)
    if (`${section}:${action}` === 'verification:msg') {
      const v = settings.verification || {};
      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('عنوان رسالة التوثيق')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(256)
        .setRequired(true)
        .setValue((v.title || '✅ توثيق العضوية').substring(0, 256));
      const descInput = new TextInputBuilder()
        .setCustomId('description')
        .setLabel('نص الرسالة')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(true)
        .setValue((v.description || 'اضغط الزر بالأسفل للحصول على رتبة العضو').substring(0, 1000));
      const labelInput = new TextInputBuilder()
        .setCustomId('label')
        .setLabel('نص الزر')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(80)
        .setRequired(true)
        .setValue((v.buttonLabel || 'توثيق').substring(0, 80));

      const modal = new ModalBuilder()
        .setCustomId('settings_modal:verification:msg')
        .setTitle('رسالة التوثيق')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(labelInput)
        );

      await interaction.showModal(modal);
      return;
    }

    // مودال خاص: رسالة الترقية (عنوان + نص + لون معاً)
    if (`${section}:${action}` === 'levels:msg') {
      const lv = settings.leveling;
      const titleInput = new TextInputBuilder()
        .setCustomId('title')
        .setLabel('عنوان رسالة الترقية')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(256)
        .setRequired(true)
        .setValue((lv.levelUpTitle || '🎉 ترقية جديدة!').substring(0, 256));
      const msgInput = new TextInputBuilder()
        .setCustomId('message')
        .setLabel('نص الرسالة (يدعم المتغيرات)')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1500)
        .setRequired(true)
        .setValue((lv.levelUpMessage || 'تهانينا {user}! لقد وصلت للمستوى {level} 🎉').substring(0, 1500));
      const colorInput = new TextInputBuilder()
        .setCustomId('color')
        .setLabel('اللون (HEX) — اختياري')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(7)
        .setRequired(false)
        .setValue((lv.levelUpColor || '#e67e22').substring(0, 7));

      const modal = new ModalBuilder()
        .setCustomId('settings_modal:levels:msg')
        .setTitle('رسالة الترقية')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(msgInput),
          new ActionRowBuilder<TextInputBuilder>().addComponents(colorInput)
        );

      await interaction.showModal(modal);
      return;
    }

    // الإجراءات التي تفتح مودال → ترجع فوراً (showModal هو الرد)
    const modalActions = [
      'general:prefix', 'general:tz', 'welcome:msg', 'leave:msg',
      'automod:words', 'ai:personality',
      'welcome:title', 'welcome:color', 'welcome:imgurl',
      'tickets:autotext', 'tickets:pimg', 'tickets:types',
    ];
    if (modalActions.includes(`${section}:${action}`)) {
      switch (`${section}:${action}`) {
        case 'general:prefix':
          return openModal('تغيير بادئة الأوامر', 'مثال: lc! أو ! أو ?', TextInputStyle.Short, 5);
        case 'general:tz':
          return openModal('المنطقة الزمنية', 'مثال: Asia/Riyadh أو Europe/London', TextInputStyle.Short, 50);
        case 'welcome:msg':
          return openModal('رسالة الترحيب', '{user} {server} {count}', TextInputStyle.Paragraph, 1000);
        case 'leave:msg':
          return openModal('رسالة المغادرة', '{user} {server} {count}', TextInputStyle.Paragraph, 1000);
        case 'automod:words':
          return openModal('الكلمات المحظورة', 'كلمة1, كلمة2, كلمة3 (مفصولة بفواصل)', TextInputStyle.Paragraph, 1000);
        case 'ai:personality': {
          const aiConfig = await AIConfig.findOne({ guildId }).catch(() => null);
          return openModal(
            'شخصية الذكاء الاصطناعي',
            'مثال: أنت مساعد ودود يحب الفكاهة...',
            TextInputStyle.Paragraph,
            1000,
            aiConfig?.customPersonality || ''
          );
        }
        case 'welcome:title':
          return openModal(
            'عنوان رسالة الترحيب',
            'مثال: مرحباً بك في السيرفر!',
            TextInputStyle.Short,
            256,
            settings.welcome.embedTitle || ''
          );
        case 'welcome:color':
          return openModal(
            'لون الإمبد (HEX)',
            'مثال: #5865F2',
            TextInputStyle.Short,
            7,
            settings.welcome.embedColor || '#00D4FF'
          );
        case 'welcome:imgurl':
          return openModal(
            'رابط صورة الترحيب',
            'https://... — اتركه فارغاً لحذف الصورة',
            TextInputStyle.Short,
            500,
            settings.welcome.imageBackground || '',
            false
          );
        case 'tickets:autotext':
          return openModal(
            'الرسالة التلقائية داخل التذكرة',
            '{user} {ticket} {server}',
            TextInputStyle.Paragraph,
            1500,
            settings.tickets.autoMessage || ''
          );
        case 'tickets:types': {
          if (!getActivePanel(settings)) {
            await interaction.reply({
              content: '⚠️ أنشئ اللوحة أولاً من زر **🎨 نقل اللوحة**',
              ephemeral: true,
            });
            return;
          }
          const opts = getActivePanel(settings).options || [];
          const prefill = opts
            .map((o: any) => `${o.emoji ? o.emoji + ' ' : ''}${o.label}${o.description ? ' | ' + o.description : ''}`)
            .join('\n');
          return openModal(
            'أنواع التذاكر (نوع واحد في كل سطر)',
            '🔧 دعم فني | مساعدة تقنية\n💰 طلب شراكة | طلبات الشراكة\n⚠️ إبلاغ | الإبلاغ عن مشكلة',
            TextInputStyle.Paragraph,
            1800,
            prefill
          );
        }
        case 'tickets:pimg':
          if (!getActivePanel(settings)) {
            await interaction.reply({
              content: '⚠️ أنشئ اللوحة أولاً من زر **🎨 نقل اللوحة**',
              ephemeral: true,
            });
            return;
          }
          return openModal(
            'رابط صورة اللوحة',
            'https://... — اتركه فارغاً لحذف الصورة',
            TextInputStyle.Short,
            500,
            getActivePanel(settings).image || '',
            false
          );
      }
    }

    // ---------- إجراءات تحدث اللوحة (تحتاج deferUpdate) ----------
    await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل

    switch (`${section}:${action}`) {
      case 'general:lang': {
        settings.language = settings.language === 'ar' ? 'en' : 'ar';
        await settings.save();
        break;
      }
      case 'welcome:dm': {
        settings.welcome.dmEnabled = !settings.welcome.dmEnabled;
        await settings.save();
        break;
      }
      case 'welcome:img': {
        settings.welcome.imageEnabled = !settings.welcome.imageEnabled;
        await settings.save();
        break;
      }
      case 'tickets:auto': {
        settings.tickets.autoMessageEnabled = !settings.tickets.autoMessageEnabled;
        await settings.save();
        break;
      }
      case 'tickets:move': {
        // لوحة فرعية: إنشاء/نقل لوحة التذاكر
        const movePanel = buildTicketMovePanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: movePanel.embeds, components: movePanel.components as any });
        return;
      }
      case 'tickets:advanced': {
        // لوحة فرعية: صورة اللوحة + رولات الإدارة العليا
        const advPanel = buildTicketAdvancedPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: advPanel.embeds, components: advPanel.components as any });
        return;
      }
      case 'tickets:pupimg': {
        // رفع مباشر: أول رسالة مرفقة من المستخدم خلال 60 ثانية = صورة اللوحة
        if (!getActivePanel(settings)) {
          await interaction.followUp({
            content: '⚠️ أنشئ اللوحة أولاً من زر **نقل اللوحة** ثم ارفع الصورة',
            ephemeral: true,
          });
          return;
        }
        setPendingImageUpload(interaction.user.id, interaction.guildId!, interaction.channelId);
        await interaction.followUp({
          content: '📤 **ارفع صورة اللوحة الآن** — أرسل أي صورة في هذه القناة خلال 60 ثانية وستصبح بانر اللوحة تلقائياً',
          ephemeral: true,
        });
        return;
      }
      case 'verification:open': {
        const vPanel = buildVerificationPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: vPanel.embeds, components: vPanel.components as any });
        return;
      }
      case 'verification:send': {
        // إعادة عرض لوحة التوثيق أولاً
        const vPanel = buildVerificationPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: vPanel.embeds, components: vPanel.components as any });

        const v = settings.verification;
        if (!v?.roleId || !v?.channelId) {
          await interaction.followUp({
            content: '⚠️ حدد **رول التوثيق** و**قناة الرسالة** أولاً من القوائم بالأعلى',
            ephemeral: true,
          });
          return;
        }
        const vChannel = interaction.guild!.channels.cache.get(v.channelId);
        if (!vChannel || vChannel.type !== ChannelType.GuildText) {
          await interaction.followUp({ content: '❌ قناة التوثيق غير موجودة أو ليست نصية', ephemeral: true });
          return;
        }
        // فحص أن رتبة البوت أعلى من رول التوثيق
        const vRole = interaction.guild!.roles.cache.get(v.roleId);
        const botMember = interaction.guild!.members.me;
        if (!vRole) {
          await interaction.followUp({ content: '❌ رول التوثيق لم يعد موجودة', ephemeral: true });
          return;
        }
        if (botMember && botMember.roles.highest.position <= vRole.position) {
          await interaction.followUp({
            content:
              '⚠️ **ارفع رتبة البوت أعلى من رول التوثيق** حتى يتمكن من إعطائه — لم يتم إرسال الرسالة',
            ephemeral: true,
          });
          return;
        }

        const guildIcon = interaction.guild!.iconURL();
        const sent = await vChannel
          .send({
            embeds: [
              {
                color: 0x5865f2,
                title: v.title || '✅ توثيق العضوية',
                description: v.description || 'اضغط الزر بالأسفل للحصول على رتبة العضو',
                ...(guildIcon ? { thumbnail: { url: guildIcon } } : {}),
                footer: { text: 'Liberty City Verification' },
              },
            ],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('verify')
                  .setLabel((v.buttonLabel || 'توثيق').substring(0, 80))
                  .setStyle(ButtonStyle.Success)
                  .setEmoji(v.buttonEmoji || '✅')
              ),
            ],
          })
          .catch(() => null);

        if (!sent) {
          await interaction.followUp({
            content: `❌ فشل الإرسال إلى ${vChannel} — تحقق من صلاحية **إرسال الرسائل** للبوت`,
            ephemeral: true,
          });
          return;
        }
        await interaction.followUp({
          content: `✅ تم إرسال رسالة التوثيق إلى ${vChannel}`,
          ephemeral: true,
        });
        return;
      }
      case 'welcome:test': {
        // معاينة حقيقية بنفس كود حدث الانضمام (force تتجاهل حالة التفعيل)
        const result = await handleWelcome(interaction.member as GuildMember, { force: true });
        const panel = await buildPanel('welcome', interaction.guild, interaction.user.id);
        await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });
        const note =
          result === 'sent'
            ? `✅ تمت المعاينة${settings.welcome.dmEnabled ? ' + رسالة خاصة 📩' : ''}${
                settings.welcome.enabled ? '' : ' ⚠️ *النظام معطّل حالياً*'
              }`
            : result === 'no-channel'
              ? '⚠️ لم تحدد قناة الترحيب بعد — اخترها من القائمة بالأسفل'
              : result === 'bad-channel'
                ? '❌ قناة الترحيب غير موجودة أو ليست نصية'
                : '❌ فشل الإرسال — تحقق من صلاحية **إرسال الرسائل** للبوت في القناة';
        await interaction.followUp({ content: note, ephemeral: true });
        return;
      }
      case 'leave:test': {
        const result = await handleLeave(interaction.member as GuildMember, { force: true });
        const panel = await buildPanel('leave', interaction.guild, interaction.user.id);
        await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });
        const note =
          result === 'sent'
            ? `✅ تمت معاينة رسالة المغادرة${settings.leave.enabled ? '' : ' ⚠️ *النظام معطّل حالياً*'}`
            : result === 'no-channel'
              ? '⚠️ لم تحدد قناة المغادرة بعد — اخترها من القائمة بالأسفل'
              : result === 'bad-channel'
                ? '❌ قناة المغادرة غير موجودة أو ليست نصية'
                : '❌ فشل الإرسال — تحقق من صلاحية **إرسال الرسائل** للبوت في القناة';
        await interaction.followUp({ content: note, ephemeral: true });
        return;
      }
      case 'ai:inc':
      case 'ai:dec': {
        let aiConfig = await AIConfig.findOne({ guildId });
        if (!aiConfig) aiConfig = await AIConfig.create({ guildId });
        const delta = action === 'inc' ? 1 : -1;
        aiConfig.cooldown = Math.min(60, Math.max(1, (aiConfig.cooldown || 3) + delta));
        await aiConfig.save();
        break;
      }
      case 'levels:inc':
      case 'levels:dec': {
        const delta = action === 'inc' ? 5 : -5;
        settings.leveling.xpPerMessage = Math.min(500, Math.max(1, settings.leveling.xpPerMessage + delta));
        await settings.save();
        break;
      }
      case 'levels:voice_inc':
      case 'levels:voice_dec': {
        const delta = action === 'levels:voice_inc' ? 5 : -5;
        settings.leveling.voiceXpPerMinute = Math.min(500, Math.max(1, (settings.leveling.voiceXpPerMinute || 10) + delta));
        await settings.save();
        break;
      }
      case 'levels:cooldown_inc':
      case 'levels:cooldown_dec': {
        const delta = action === 'levels:cooldown_inc' ? 10000 : -10000;
        settings.leveling.xpCooldown = Math.min(300000, Math.max(5000, (settings.leveling.xpCooldown || 60000) + delta));
        await settings.save();
        break;
      }
      case 'levels:style': {
        settings.leveling.levelUpStyle = settings.leveling.levelUpStyle === 'text' ? 'embed' : 'text';
        await settings.save();
        break;
      }
      case 'levels:test': {
        // إرسال معاينة رسالة الترقية للقناة الحالية
        const client = interaction.client as LibertyClient;
        await client.levelingHandler
          .sendLevelUpMessage(interaction.member as any, 99, interaction.channelId)
          .catch(() => {});
        break;
      }
      case 'levels:rewards': {
        const panel = buildLevelRewardsPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });
        return;
      }
      case 'levels:ignore': {
        const panel = buildLevelIgnorePanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });
        return;
      }
      case 'levels:back': {
        // يعود للوحة المستويات الرئيسية (عبر buildPanel أدناه)
        break;
      }
      case 'levels:reward_remove': {
        const lvl = Number(parts[3]);
        const roleId = parts[4];
        if (Array.isArray(settings.leveling.levelRewards)) {
          settings.leveling.levelRewards = settings.leveling.levelRewards.filter(
            (r: any) => !(Number(r.level) === lvl && r.roleId === roleId)
          );
          await settings.save();
        }
        const panel = buildLevelRewardsPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });
        return;
      }
      case 'tickets:inc':
      case 'tickets:dec': {
        const delta = action === 'inc' ? 1 : -1;
        settings.tickets.maxPerUser = Math.min(10, Math.max(1, settings.tickets.maxPerUser + delta));
        await settings.save();
        break;
      }
      case 'general:shop': {
        // لوحة فرعية: متجر السيرفر
        const sPanel = buildShop(interaction.guild!, settings);
        await interaction.editReply({ embeds: sPanel.embeds, components: sPanel.components as any });
        return;
      }
      case 'commands:add': {
        // مودال بحقلين: اسم الأمر + الرد
        const nameInput = new TextInputBuilder()
          .setCustomId('name')
          .setLabel('اسم الأمر (الكلمة التي تُكتب في الشات)')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(50)
          .setRequired(true);
        const contentInput = new TextInputBuilder()
          .setCustomId('content')
          .setLabel('رد البوت (حتى 1900 حرف) — متغيرات: {user} {server}')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1900)
          .setRequired(true);
        const modal = new ModalBuilder()
          .setCustomId('settings_modal:commands:add')
          .setTitle('➕ إضافة أمر مخصص')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput)
          );
        await interaction.showModal(modal);
        return;
      }
      case 'commands:clear': {
        settings.customCommands = [];
        await settings.save();
        const cPanel = buildCommands(interaction.guild!, settings);
        await interaction.editReply({ embeds: cPanel.embeds, components: cPanel.components as any });
        return;
      }
      case 'shop:add': {
        // الخطوة الأولى: اختيار رول العنصر — ثم يفتح مودال الاسم والسعر
        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId('settings_sel:shop:role')
          .setPlaceholder('🛍️ اختر الرول الذي يحصل عليه المشتري')
          .setMinValues(1)
          .setMaxValues(1);
        await interaction.reply({
          content: '🛍️ اختر **الرول** الذي سيحصل عليه المشتري عند شراء هذا العنصر:',
          components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect)],
          ephemeral: true,
        });
        return;
      }
      default:
        await interaction.editReply({ content: '❌ إجراء غير معروف' });
        return;
    }

    const panel = await buildPanel(section, interaction.guild, interaction.user.id);
    await interaction.editReply({
      embeds: panel.embeds,
      components: panel.components as any,
    });
  },
};

export default handler;