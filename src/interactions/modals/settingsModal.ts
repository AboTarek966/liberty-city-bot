// ============================================
// Settings Panel - Modals (بادئة، رسائل، ترحيب، تذاكر، شخصية...)
// ============================================

import { ModalSubmitInteraction } from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import { buildPanel, canManageSettings, buildLevelRewardsPanel, buildVerificationPanel, buildCommands, buildShop, getActivePanel, SettingsCategory } from '../../utils/settingsPanel';
import { getGuildSettings, AIConfig } from '../../models';
import { LibertyClient } from '../../LibertyClient';

const handler: ModalHandler = {
  id: 'settings_modal',
  async execute(interaction: ModalSubmitInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    if (!canManageSettings(interaction as any)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
      return;
    }

    await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل (فوراً!)

    const parts = interaction.customId.split(':');
    const section = parts[1] as SettingsCategory;
    const field = parts[2];

    // حقل نصي واحد إن وُجد (مودالات بحقلين تقرأ حقولها في cases المخصصة)
    let value = '';
    try {
      value = interaction.fields.getTextInputValue('value').trim();
    } catch {
      /* مودال بدون حقل 'value' */
    }

    const guildId = interaction.guild.id;
    const settings = await getGuildSettings(guildId);
    let panelEdited = false;

    switch (`${section}:${field}`) {
      case 'general:prefix':
        settings.prefix = value.substring(0, 5);
        break;
      case 'general:tz':
        settings.timezone = value.substring(0, 50);
        break;
      case 'welcome:msg':
        settings.welcome.message = value;
        break;
      case 'leave:msg':
        settings.leave.message = value;
        break;
      case 'welcome:title':
        settings.welcome.embedTitle = value.substring(0, 256) || 'مرحباً بك!';
        break;
      case 'welcome:color': {
        const hex = value.startsWith('#') ? value : `#${value}`;
        if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
          await interaction.editReply({ content: '❌ لون غير صالح — استخدم صيغة HEX مثل #5865F2' });
          return;
        }
        settings.welcome.embedColor = hex;
        break;
      }
      case 'welcome:imgurl':
        if (value && !/^https?:\/\//i.test(value)) {
          await interaction.editReply({ content: '❌ يجب أن يبدأ الرابط بـ http:// أو https://' });
          return;
        }
        settings.set('welcome.imageBackground', value || null);
        break;
      case 'tickets:autotext':
        settings.tickets.autoMessage = value.substring(0, 1500);
        break;
      case 'tickets:types': {
        const panel = getActivePanel(settings);
        if (!panel) {
          await interaction.editReply({ content: '⚠️ لا توجد لوحة بعد — أنشئها من زر 🎨 نقل اللوحة في الإعدادات' });
          return;
        }

        // كل سطر = نوع واحد: "🍕 الاسم | الوصف" (الوصف والإيموجي اختياريان)
        const lines = value.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 25);
        const parsed: Array<{ label: string; description?: string; emoji?: string }> = [];
        const seen = new Set<string>();

        for (const line of lines) {
          const parts = line.split('|');
          let labelPart = (parts[0] || '').trim();
          const description = (parts[1] || '').trim().substring(0, 100) || undefined;

          // استخراج الإيموجي من بداية السطر إن وُجد
          let emoji: string | undefined;
          const emojiMatch = labelPart.match(
            /^(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)\s+/u
          );
          if (emojiMatch) {
            emoji = emojiMatch[1];
            labelPart = labelPart.substring(emojiMatch[0].length).trim();
          }

          const label = labelPart.substring(0, 100);
          if (!label || seen.has(label)) continue; // تجاهل المكرر (قيم مميزة فقط)
          seen.add(label);
          parsed.push({ label, description, emoji });
        }

        if (parsed.length === 0) {
          await interaction.editReply({
            content: '❌ لم يتم إدخال أي نوع صالح — كل سطر يجب أن يحتوي على اسم النوع',
          });
          return;
        }

        panel.options = parsed;
        panel.type = 'select';
        panelEdited = true;
        break;
      }
      case 'tickets:panel': {
        const panel = getActivePanel(settings);
        if (!panel) {
          await interaction.editReply({ content: '⚠️ لا توجد لوحة بعد — أنشئها من زر 🎨 نقل اللوحة في الإعدادات' });
          return;
        }
        const title = interaction.fields.getTextInputValue('title').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        panel.name = title.substring(0, 256) || panel.name;
        panel.description = description.substring(0, 2000);
        panelEdited = true;
        break;
      }
      case 'verification:msg': {
        const vTitle = interaction.fields.getTextInputValue('title').trim();
        const vDesc = interaction.fields.getTextInputValue('description').trim();
        const vLabel = interaction.fields.getTextInputValue('label').trim();
        settings.verification.title = vTitle.substring(0, 256) || '✅ توثيق العضوية';
        settings.verification.description = vDesc.substring(0, 1000);
        settings.verification.buttonLabel = vLabel.substring(0, 80) || 'توثيق';
        await settings.save();
        const vp = buildVerificationPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: vp.embeds, components: vp.components as any });
        await interaction.followUp({ content: '✅ تم حفظ رسالة التوثيق', ephemeral: true });
        return;
      }
      case 'automod:words':
        settings.automod.badWords = value.split(',').map(w => w.trim()).filter(w => w.length > 0);
        break;
      case 'ai:personality': {
        await settings.save();
        await AIConfig.findOneAndUpdate(
          { guildId },
          { customPersonality: value },
          { upsert: true }
        ).catch(() => {});
        break;
      }
      case 'levels:msg': {
        const title = interaction.fields.getTextInputValue('title').trim();
        const message = interaction.fields.getTextInputValue('message').trim();
        let color = '';
        try {
          color = interaction.fields.getTextInputValue('color').trim();
        } catch {
          /* لون اختياري */
        }
        settings.leveling.levelUpTitle = title.substring(0, 256) || '🎉 ترقية جديدة!';
        settings.leveling.levelUpMessage = message.substring(0, 1500);
        if (color && /^#?([0-9a-fA-F]{6})$/.test(color)) {
          settings.leveling.levelUpColor = color.startsWith('#') ? color : `#${color}`;
        }
        break;
      }
      case 'levels:reward': {
        const lvl = Number.parseInt(value, 10);
        const roleId = parts[3];
        if (!Number.isInteger(lvl) || lvl < 1 || lvl > 1000 || !roleId) {
          await interaction.editReply({ content: '❌ مستوى غير صالح (من 1 إلى 1000)' });
          return;
        }
        if (!Array.isArray(settings.leveling.levelRewards)) settings.leveling.levelRewards = [];
        // استبدل أي مكافأة لنفس الرول (رول = مكافأة واحدة)
        settings.leveling.levelRewards = settings.leveling.levelRewards.filter(
          (r: any) => r.roleId !== roleId
        );
        settings.leveling.levelRewards.push({ level: lvl, roleId });
        await settings.save();

        const panel = buildLevelRewardsPanel(interaction.guild!, settings);
        await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });
        await interaction.followUp({ content: `✅ تمت إضافة مكافأة المستوى **${lvl}**`, ephemeral: true });
        return;
      }
      case 'commands:add': {
        const name = interaction.fields.getTextInputValue('name').trim().toLowerCase().substring(0, 50);
        const content = interaction.fields.getTextInputValue('content').trim().substring(0, 1900);
        if (!name || !content) {
          await interaction.editReply({ content: '❌ اسم الأمر والرد مطلوبان' });
          return;
        }
        if (!Array.isArray(settings.customCommands)) settings.customCommands = [];
        const existing = settings.customCommands.find((c: any) => c.name.toLowerCase() === name);
        if (existing) {
          existing.content = content; // تحديث الأمر الموجود
        } else {
          if (settings.customCommands.length >= 25) {
            await interaction.editReply({ content: '❌ الحد الأقصى 25 أمر مخصص — احذف بعضها أولاً' });
            return;
          }
          settings.customCommands.push({
            name, content, embed: false,
            createdBy: interaction.user.id, createdAt: new Date(), uses: 0,
          });
        }
        await settings.save();
        const cPanel = buildCommands(interaction.guild!, settings);
        await interaction.editReply({ embeds: cPanel.embeds, components: cPanel.components as any });
        await interaction.followUp({
          content: `✅ تم ${existing ? 'تحديث' : 'إضافة'} الأمر \`${name}\` — أي عضو يكتب الكلمة يرد البوت فوراً`,
          ephemeral: true,
        });
        return;
      }
      case 'shop:add': {
        const roleId = parts[3];
        const name = interaction.fields.getTextInputValue('name').trim().substring(0, 100);
        const price = Number.parseInt(interaction.fields.getTextInputValue('price').trim(), 10);
        if (!roleId || !name || !Number.isInteger(price) || price < 0 || price > 1_000_000_000) {
          await interaction.editReply({ content: '❌ بيانات غير صالحة — الاسم والسعر (رقم صحيح ≥ 0) مطلوبان' });
          return;
        }
        if (!settings.shop) settings.shop = { enabled: true, items: [] };
        if (!Array.isArray(settings.shop.items)) settings.shop.items = [];
        if (settings.shop.items.length >= 15) {
          await interaction.editReply({ content: '❌ الحد الأقصى 15 عنصراً في المتجر — احذف عنصراً أولاً' });
          return;
        }
        const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 10000)}`;
        settings.shop.items.push({ id, name, price, roleId });
        await settings.save();
        const sPanel = buildShop(interaction.guild!, settings);
        await interaction.editReply({ embeds: sPanel.embeds, components: sPanel.components as any });
        await interaction.followUp({ content: `✅ تمت إضافة **${name}** بسعر 💰 \`${price}\` إلى المتجر`, ephemeral: true });
        return;
      }
      default:
        await interaction.editReply({ content: '❌ حقل غير معروف' });
        return;
    }

    await settings.save();

    // تحديث رسالة لوحة التذاكر مباشرة بعد تعديل محتواها (+ رابط قفز للتأكد)
    if (panelEdited) {
      const client = interaction.client as LibertyClient;
      const activePanel = getActivePanel(settings);
      await client.ticketHandler
        .updatePanelMessage(interaction.guild!, activePanel as any)
        .catch(() => {});

      const panel = await buildPanel(section, interaction.guild, interaction.user.id);
      await interaction.editReply({ embeds: panel.embeds, components: panel.components as any });

      const jump =
        activePanel?.channelId && activePanel?.messageId
          ? `\n🎫 **[اضغط هنا لعرض اللوحة مباشرة](https://discord.com/channels/${guildId}/${activePanel.channelId}/${activePanel.messageId})**`
          : '';
      await interaction.followUp({ content: `✅ تم الحفظ وتحديث رسالة اللوحة${jump}`, ephemeral: true });
      return;
    }

    const panel = await buildPanel(section, interaction.guild, interaction.user.id);
    await interaction.editReply({
      embeds: panel.embeds,
      components: panel.components as any,
    });
    await interaction.followUp({ content: '✅ تم الحفظ بنجاح', ephemeral: true });
  },
};

export default handler;
