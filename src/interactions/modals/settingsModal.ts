// ============================================
// Settings Panel - Modals (بادئة، رسائل، ترحيب، تذاكر، شخصية...)
// ============================================

import { ModalSubmitInteraction, PermissionFlagsBits, ChannelSelectMenuBuilder, ChannelType, ActionRowBuilder, EmbedBuilder } from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import { buildPanel, checkSettingsAccess, setPasswordVerified, buildLevelRewardsPanel, buildVerificationPanel, buildCommands, buildShop, sendWelcomeCardPanel, getActivePanel, SettingsCategory } from '../../utils/settingsPanel';
import { getGuildSettings, AIConfig } from '../../models';
import { LibertyClient } from '../../LibertyClient';
import { sleep } from '../../utils/helpers';

const handler: ModalHandler = {
  id: 'settings_modal',
  async execute(interaction: ModalSubmitInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const parts0 = interaction.customId.split(':');
    const section0 = parts0[1];
    const field0 = parts0[2];

    // 🔐 مودال كلمة المرور: يتحقق فقط من صلاحية الإدارة (لا يشترط كلمة المرور بعد، فهي ما سيتحقق منها الآن)
    if (section0 === 'password') {
      const member = interaction.member as any;
      const perms = member?.permissions;
      const hasAdminPerms = !!perms && (
        perms.has(PermissionFlagsBits.ManageGuild) ||
        perms.has(PermissionFlagsBits.Administrator)
      );
      const isOwner = interaction.user.id === interaction.guild.ownerId;
      if (!hasAdminPerms && !isOwner) {
        await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
        return;
      }
    } else {
      // 🔐 مودالات الإعدادات الأخرى: فحص الصلاحيات + الجلسة (رسالة مميزة لكل حالة)
      const access = checkSettingsAccess(interaction);
      if (access === 'noperm') {
        await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
        return;
      }
      if (access === 'needpassword') {
        // لا يمكن فتح مودال من مودال → رسالة إرشادية لإعادة الفتح
        await interaction.reply({
          content: '❌ انتهت جلسة كلمة المرور — افتح لوحة الإعدادات من جديد (`/settings`) وأعد إدخالها ثم كرر المحاولة',
          ephemeral: true,
        });
        return;
      }
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
    const settings = await getGuildSettings(guildId) as any;
    let panelEdited = false;

    // 🔐 كلمة المرور تُعالج هنا قبل السويتش (لأن customId = settings_modal:password بدون حقل ثانٍ)
    if (parts0[1] === 'password') {
      const correctPassword = settings.settingsPassword || '7421';

      if (value === correctPassword) {
        setPasswordVerified(interaction.user.id);

        // فتح لوحة الإعدادات مباشرة بعد التحقق بنجاح
        const panel = await buildPanel('home', interaction.guild!, interaction.user.id);
        await interaction.editReply({
          embeds: panel.embeds,
          components: panel.components as any,
        });
        await interaction.followUp({
          content: '✅ **كلمة المرور صحيحة!** تم فتح لوحة الإعدادات.',
          ephemeral: true,
        });
      } else {
        // ❌ كلمة خاطئة → نبقي اللوحة وأزرارها للاختبار مباشرة
        const retryPanel = await buildPanel('home', interaction.guild!, interaction.user.id);
        await interaction.editReply({
          content: '❌ **كلمة المرور خاطئة!** اضغط أي زر وحاول مرة أخرى.',
          embeds: retryPanel.embeds,
          components: retryPanel.components as any,
        });
      }
      return;
    }

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
      case 'welcome:cardurl':
        if (value && !/^https?:\/\//i.test(value)) {
          await interaction.editReply({ content: '❌ يجب أن يبدأ الرابط بـ http:// أو https://' });
          return;
        }
        settings.set('welcome.card.backgroundUrl', value || null);
        await settings.save();
        {
          await sendWelcomeCardPanel(interaction, settings);
          await interaction.followUp({
            content: value ? '✅ تم ضبط خلفية البطاقة' : '↩️ تمت الإزالة — الخلفية تدرّج افتراضي',
            ephemeral: true,
          });
        }
        return;
      case 'welcome:cardpos': {
        // 📍 حفظ إحداثيات عنصر البطاقة (X، Y، الحجم، اللون)
        const element = parts[3];
        if (!['avatar', 'name', 'count'].includes(element)) {
          await interaction.editReply({ content: '❌ عنصر غير معروف' });
          return;
        }
        const readNum = (id: string): number => {
          try {
            return Number.parseInt(interaction.fields.getTextInputValue(id).trim(), 10);
          } catch {
            return NaN;
          }
        };
        const x = readNum('x');
        const y = readNum('y');
        const size = readNum('size');
        if (!Number.isFinite(x) || x < 0 || x > 800 || !Number.isFinite(y) || y < 0 || y > 300) {
          await interaction.editReply({ content: '❌ الإحداثيات خارج النطاق — X بين 0 و800 و Y بين 0 و300' });
          return;
        }
        if (!Number.isFinite(size) || size < 8 || size > 300) {
          await interaction.editReply({ content: '❌ الحجم غير صالح (من 8 إلى 300 بكسل)' });
          return;
        }
        let color = '';
        if (element !== 'avatar') {
          try {
            color = interaction.fields.getTextInputValue('color').trim();
          } catch {
            /* لون اختياري */
          }
        }
        if (color && !/^#?([0-9a-fA-F]{6})$/.test(color)) {
          await interaction.editReply({ content: '❌ لون غير صالح — استخدم صيغة HEX مثل #FFFFFF' });
          return;
        }
        const card = (settings.welcome as any).card || ((settings.welcome as any).card = {});
        if (element === 'avatar') {
          card.avatarX = x;
          card.avatarY = y;
          card.avatarSize = size;
        } else if (element === 'name') {
          card.nameX = x;
          card.nameY = y;
          card.nameSize = size;
          if (color) card.nameColor = color.startsWith('#') ? color : `#${color}`;
        } else {
          card.countX = x;
          card.countY = y;
          card.countSize = size;
          if (color) card.countColor = color.startsWith('#') ? color : `#${color}`;
        }
        await settings.save();
        await sendWelcomeCardPanel(interaction, settings);
        await interaction.followUp({ content: '✅ تم الضبط — الصورة أدناه محدّثة', ephemeral: true });
        return;
      }
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
      case 'music:volume': {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 0 || n > 200) {
          await interaction.editReply({ content: '❌ أدخل رقماً بين 0 و 200' });
          return;
        }
        if (!settings.music) settings.music = { enabled: true, defaultVolume: 100, maxQueueSize: 50, allowDJ: false, autoplay: false, restrictToChannels: [] };
        settings.music.defaultVolume = n;
        await settings.save();
        await interaction.editReply({ content: `✅ تم تعيين الصوت الافتراضي إلى **${n}%**` });
        return;
      }
      case 'music:queue_limit': {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1 || n > 200) {
          await interaction.editReply({ content: '❌ أدخل رقماً بين 1 و 200' });
          return;
        }
        if (!settings.music) settings.music = { enabled: true, defaultVolume: 100, maxQueueSize: 50, allowDJ: false, autoplay: false, restrictToChannels: [] };
        settings.music.maxQueueSize = n;
        await settings.save();
        await interaction.editReply({ content: `✅ تم تعيين حد القائمة إلى **${n}** أغنية` });
        return;
      }
      case 'automod:words':
        settings.automod.badWords = value.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);
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
      case 'translator:settings': {
        try {
          const parsed = JSON.parse(value);
          if (!settings.protection.aiTranslator) settings.protection.aiTranslator = { enabled: false, defaultTargetLang: 'ar', autoTranslateChannels: [], ignoredChannels: [], ignoredRoles: [], showOriginal: true, maxLength: 2000 };
          settings.protection.aiTranslator.enabled = !!parsed.enabled;
          settings.protection.aiTranslator.defaultTargetLang = parsed.defaultTargetLang || 'ar';
          settings.protection.aiTranslator.autoTranslateChannels = Array.isArray(parsed.autoTranslateChannels) ? parsed.autoTranslateChannels.filter((c: string) => c.trim()) : [];
          settings.protection.aiTranslator.ignoredChannels = Array.isArray(parsed.ignoredChannels) ? parsed.ignoredChannels.filter((c: string) => c.trim()) : [];
          settings.protection.aiTranslator.ignoredRoles = Array.isArray(parsed.ignoredRoles) ? parsed.ignoredRoles.filter((r: string) => r.trim()) : [];
          settings.protection.aiTranslator.showOriginal = !!parsed.showOriginal;
          settings.protection.aiTranslator.maxLength = Number(parsed.maxLength) || 2000;
          settings.protection.aiTranslator.logChannel = parsed.logChannel || undefined;
        } catch (e) {
          await interaction.editReply({ content: '❌ JSON غير صالح — راجع التنسيق' });
          return;
        }
        break;
      }
      case 'announce:dm': {
        const content = value.trim();
        if (!content) {
          await interaction.editReply({ content: '❌ الرسالة مطلوبة' });
          return;
        }
        if (!settings.protection) (settings as any).protection = {};
        const ann = (settings.protection as any).announcements || ((settings.protection as any).announcements = { history: [] });
        ann.history.push({
          type: 'dm',
          content,
          at: new Date(),
          sentBy: interaction.user.id,
        });
        await settings.save();

        // إرسال للجميع
        const client = interaction.client as LibertyClient;
        const guild = interaction.guild!;
        const members = await guild.members.fetch().catch(() => null);
        if (!members) {
          await interaction.editReply({ content: '❌ فشل جلب الأعضاء' });
          return;
        }

        await interaction.editReply({ content: `⏳ جاري الإرسال لـ ${members.size} عضو...` });

        let sent = 0, failed = 0;
        for (const [, member] of members) {
          if (member.user.bot) continue;
          try {
            const msg = content
              .replace(/\{user\}/g, member.toString())
              .replace(/\{server\}/g, guild.name)
              .replace(/\{count\}/g, guild.memberCount.toString());
            await member.send(msg).catch(() => {});
            sent++;
            await sleep(50); // تجنب rate limit
          } catch {
            failed++;
          }
        }

        await interaction.editReply({ content: `✅ تم الإرسال: ${sent} ✅ | ${failed} ❌` });
        return;
      }
      case 'announce:channel': {
        const content = value.trim();
        if (!content) {
          await interaction.editReply({ content: '❌ الرسالة مطلوبة' });
          return;
        }
        if (!settings.protection) (settings as any).protection = {};
        const ann2 = (settings.protection as any).announcements || ((settings.protection as any).announcements = { history: [] });
        ann2.history.push({
          type: 'channel',
          content,
          at: new Date(),
          sentBy: interaction.user.id,
        });
        await settings.save();

        // اختيار القناة — نفتح list menus
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId('settings_sel:announce:channel')
          .setPlaceholder('📢 اختر القناة للإرسال')
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1)
          .setMaxValues(1);

        await interaction.reply({
          content: '📢 اختر القناة التي تريد الإرسال فيها:',
          components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect)],
          ephemeral: true,
        });
        return;
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
        // 🔓/🔒 النطاق يصل من customId: settings_modal:commands:add:public|admin
        const scope: 'public' | 'admin' = parts[3] === 'admin' ? 'admin' : 'public';
        const name = interaction.fields.getTextInputValue('name').trim().toLowerCase().substring(0, 50);
        const content = interaction.fields.getTextInputValue('content').trim().substring(0, 1900);
        if (!name || !content) {
          await interaction.editReply({ content: '❌ اسم الأمر والرد مطلوبان' });
          return;
        }
        if (!Array.isArray(settings.customCommands)) settings.customCommands = [];
        const existing = settings.customCommands.find((c: any) => c.name.toLowerCase() === name);
        if (existing) {
          existing.content = content; // تحديث الرد
          existing.scope = scope; // تحديث النطاق أيضاً
        } else {
          if (settings.customCommands.length >= 25) {
            await interaction.editReply({ content: '❌ الحد الأقصى 25 أمر مخصص — احذف بعضها أولاً' });
            return;
          }
          settings.customCommands.push({
            name, content, embed: false, scope,
            createdBy: interaction.user.id, createdAt: new Date(), uses: 0,
          });
        }
        await settings.save();
        const cPanel = buildCommands(interaction.guild!, settings);
        await interaction.editReply({ embeds: cPanel.embeds, components: cPanel.components as any });
        await interaction.followUp({
          content: scope === 'admin'
            ? `🔒 تم ${existing ? 'تحديث' : 'إضافة'} الأمر \`${name}\` — **للإداريين فقط** (لا يرد على الأعضاء العاديين إطلاقاً)`
            : `🔓 تم ${existing ? 'تحديث' : 'إضافة'} الأمر \`${name}\` — **للجميع** (أي عضو يكتب الكلمة يرد البوت)`,
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
