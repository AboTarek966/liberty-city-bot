"use strict";
// ============================================
// Settings Panel - Select Menus (رولات، قنوات، قوائم)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const settingsPanel_1 = require("../../utils/settingsPanel");
const models_1 = require("../../models");
const pendingWarnRoles_1 = require("../../utils/pendingWarnRoles");
const handler = {
    id: 'settings_sel',
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        const access = (0, settingsPanel_1.checkSettingsAccess)(interaction);
        if (access === 'noperm') {
            await interaction.reply({ content: '❌ تحتاج صلاحية إدارة السيرفر', ephemeral: true });
            return;
        }
        if (access === 'needpassword') {
            // 🔐 انتهت الجلسة → إعادة فتح نافذة كلمة المرور (قبل أي استجابة أخرى)
            await interaction.showModal((0, settingsPanel_1.buildSettingsPasswordModal)());
            return;
        }
        // ✅ اختيار رول مكافأة → نافذة إدخال المستوى (showModal كأول استجابة — قبل deferUpdate)
        if (interaction.customId === 'settings_sel:levels:reward_role') {
            const roleId = interaction.values[0];
            if (!roleId) {
                await interaction.reply({ content: '❌ لم تختر رولاً', ephemeral: true });
                return;
            }
            const levelInput = new discord_js_1.TextInputBuilder()
                .setCustomId('value')
                .setLabel('المستوى الذي تُمنح فيه المكافأة (1-1000)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setMaxLength(4)
                .setPlaceholder('مثال: 10')
                .setRequired(true);
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`settings_modal:levels:reward:${roleId}`)
                .setTitle('مستوى المكافأة')
                .addComponents(new discord_js_1.ActionRowBuilder().addComponents(levelInput));
            await interaction.showModal(modal);
            return;
        }
        // ✅ اختيار عنصر بطاقة الترحيب → مودال الإحداثيات (showModal كأول استجابة)
        if (interaction.customId === 'settings_sel:welcome:cardpos') {
            const element = interaction.values[0];
            if (!['avatar', 'name', 'count'].includes(element)) {
                await interaction.reply({ content: '❌ عنصر غير معروف', ephemeral: true });
                return;
            }
            const st = await (0, models_1.getGuildSettings)(interaction.guild.id);
            const c = st.welcome.card || {};
            const pos = element === 'avatar'
                ? { x: c.avatarX ?? 130, y: c.avatarY ?? 150, size: c.avatarSize ?? 170, color: '' }
                : element === 'name'
                    ? { x: c.nameX ?? 350, y: c.nameY ?? 130, size: c.nameSize ?? 52, color: c.nameColor ?? '#FFFFFF' }
                    : { x: c.countX ?? 350, y: c.countY ?? 195, size: c.countSize ?? 28, color: c.countColor ?? '#C7CED8' };
            const xInput = new discord_js_1.TextInputBuilder()
                .setCustomId('x')
                .setLabel('الإحداثي الأفقي X (0-800)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setMaxLength(4)
                .setValue(String(pos.x))
                .setRequired(true);
            const yInput = new discord_js_1.TextInputBuilder()
                .setCustomId('y')
                .setLabel('الإحداثي العمودي Y (0-300)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setMaxLength(4)
                .setValue(String(pos.y))
                .setRequired(true);
            const sizeInput = new discord_js_1.TextInputBuilder()
                .setCustomId('size')
                .setLabel('الحجم بالبكسل')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setMaxLength(4)
                .setValue(String(pos.size))
                .setRequired(true);
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`settings_modal:welcome:cardpos:${element}`)
                .setTitle('📍 مواضع العنصر على البطاقة')
                .addComponents(new discord_js_1.ActionRowBuilder().addComponents(xInput), new discord_js_1.ActionRowBuilder().addComponents(yInput), new discord_js_1.ActionRowBuilder().addComponents(sizeInput));
            if (element !== 'avatar') {
                const colorInput = new discord_js_1.TextInputBuilder()
                    .setCustomId('color')
                    .setLabel('اللون HEX (اختياري)')
                    .setStyle(discord_js_1.TextInputStyle.Short)
                    .setMaxLength(7)
                    .setValue(pos.color || '')
                    .setRequired(false);
                modal.addComponents(new discord_js_1.ActionRowBuilder().addComponents(colorInput));
            }
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
            const nameInput = new discord_js_1.TextInputBuilder()
                .setCustomId('name')
                .setLabel('اسم العنصر في المتجر')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setMaxLength(100)
                .setPlaceholder('مثال: رتبة VIP')
                .setRequired(true);
            const priceInput = new discord_js_1.TextInputBuilder()
                .setCustomId('price')
                .setLabel('السعر بالرصيد (رقم)')
                .setStyle(discord_js_1.TextInputStyle.Short)
                .setMaxLength(15)
                .setPlaceholder('مثال: 5000')
                .setRequired(true);
            const modal = new discord_js_1.ModalBuilder()
                .setCustomId(`settings_modal:shop:add:${roleId}`)
                .setTitle('🛍️ إضافة عنصر للمتجر')
                .addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput), new discord_js_1.ActionRowBuilder().addComponents(priceInput));
            await interaction.showModal(modal);
            return;
        }
        await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل
        const parts = interaction.customId.split(':');
        const section = parts[1];
        const field = parts[2];
        const values = interaction.values;
        const guildId = interaction.guild.id;
        const settings = await (0, models_1.getGuildSettings)(guildId);
        switch (`${section}:${field}`) {
            case 'tickets:category':
                settings.tickets.categoryId = values[0] || null;
                break;
            case 'tickets:log':
                settings.tickets.logChannelId = values[0] || null;
                break;
            case 'tickets:roles':
                settings.tickets.supportRoleIds = [...values];
                break;
            case 'tickets:adminroles': {
                settings.tickets.adminRoleIds = values;
                await settings.save();
                const advPanel = (0, settingsPanel_1.buildTicketAdvancedPanel)(interaction.guild, settings);
                await interaction.editReply({ embeds: advPanel.embeds, components: advPanel.components });
                await interaction.followUp({
                    content: values.length
                        ? `✅ عند الضغط على 🔔 استدعاء الإدارة سيُمنشن: ${values.map((v) => `<@&${v}>`).join(' , ')}`
                        : '↩️ تمت الإزالة — سيُمنشن رولات الدعم عند الاستدعاء',
                    ephemeral: true,
                });
                return;
            }
            case 'tickets:panel': {
                // إنشاء/نقل لوحة التذاكر — يستبدل اللوحة القديمة ويرث محتواها وأنواعها
                const newChannelId = values[0] || null;
                if (newChannelId) {
                    const client = interaction.client;
                    const channel = interaction.guild.channels.cache.get(newChannelId);
                    if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
                        await interaction.editReply({ content: '❌ اختر قناة نصية صالحة' });
                        return;
                    }
                    const existing = (0, settingsPanel_1.getActivePanel)(settings);
                    // createPanel يرث options/image تلقائياً من اللوحة السابقة ويحذف رسالتها القديمة
                    await client.ticketHandler.createPanel(interaction.guild, channel, {
                        id: '',
                        name: existing?.name || 'تذاكر الدعم',
                        emoji: existing?.emoji || '🎫',
                        description: existing?.description ||
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
                settings.welcome.channelId = values[0] || null;
                break;
            case 'verification:role':
                settings.verification.roleId = values[0] || undefined;
                await settings.save();
                {
                    const vp = (0, settingsPanel_1.buildVerificationPanel)(interaction.guild, settings);
                    await interaction.editReply({ embeds: vp.embeds, components: vp.components });
                }
                return;
            case 'verification:channel':
                settings.verification.channelId = values[0] || undefined;
                await settings.save();
                {
                    const vp = (0, settingsPanel_1.buildVerificationPanel)(interaction.guild, settings);
                    await interaction.editReply({ embeds: vp.embeds, components: vp.components });
                }
                return;
            case 'leave:channel':
                settings.leave.channelId = values[0] || null;
                break;
            case 'logging:channel':
                settings.logging.channelId = values[0] || null;
                break;
            case 'jail:channel':
                // دفاعياً: ممكن تكون وثيقة السيرفر القديمة بدون كائن jail
                if (!settings.jail)
                    settings.jail = {};
                settings.jail.channelId = values[0] || null;
                break;
            case 'protection:logChannel':
                settings.protection.logChannel = values[0] || null;
                break;
            case 'logging:split': {
                // 🔀 اختيار مجموعة → عرض قائمة قنوات لتعيين روم مخصص
                const group = settingsPanel_1.LOG_SPLIT_GROUPS.find((g) => g.id === values[0]);
                if (!group) {
                    await interaction.editReply({ content: '❌ مجموعة غير معروفة', embeds: [], components: [] });
                    return;
                }
                const hint = new discord_js_1.EmbedBuilder()
                    .setTitle(`${group.emoji} ${group.label}`)
                    .setColor(0x3498db)
                    .setDescription(`اختر **الروم** الذي تُسجَّل فيه هذه الأحداث — أو اختر **0 قنوات** (زر Clear) لإرجاعها للقناة الرئيسية\n\n` +
                    `> الأنواع المشمولة: ${group.types.map((t) => `\`${t}\``).join('، ')}`);
                const channelRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ChannelSelectMenuBuilder()
                    .setCustomId(`settings_sel:logging:split_ch:${group.id}`)
                    .setPlaceholder(`📤 اختر روم «${group.label}»`)
                    .setChannelTypes(discord_js_1.ChannelType.GuildText)
                    .setMinValues(0)
                    .setMaxValues(1));
                const backRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId('settings_btn:logging:split')
                    .setLabel('رجوع')
                    .setStyle(discord_js_1.ButtonStyle.Secondary)
                    .setEmoji('↩️'));
                await interaction.editReply({ content: undefined, embeds: [hint], components: [channelRow, backRow] });
                return;
            }
            case 'logging:split_ch': {
                // 🔀 حفظ روم المجموعة (أو الإلغاء عند اختيار 0 قنوات)
                const group = settingsPanel_1.LOG_SPLIT_GROUPS.find((g) => g.id === parts[3]);
                if (!group) {
                    await interaction.editReply({ content: '❌ مجموعة غير معروفة', embeds: [], components: [] });
                    return;
                }
                const channelId = values[0];
                const channels = { ...(settings.logging.channels || {}) };
                if (channelId) {
                    for (const t of group.types)
                        channels[t] = channelId;
                }
                else {
                    for (const t of group.types)
                        delete channels[t];
                }
                settings.logging.channels = channels;
                await settings.save();
                {
                    const client = interaction.client;
                    client.loggingHandler?.invalidateCache?.(guildId);
                }
                const splitPanel = (0, settingsPanel_1.buildLoggingSplitPanel)(interaction.guild, settings);
                await interaction.editReply({ content: undefined, embeds: splitPanel.embeds, components: splitPanel.components });
                await interaction.followUp({
                    content: channelId
                        ? `✅ **${group.label}** ← <#${channelId}> — سيتم توجيهها هناك فوراً`
                        : `↩️ **${group.label}** — عادت للقناة الرئيسية`,
                    ephemeral: true,
                });
                return;
            }
            case 'levels:channel':
                settings.leveling.levelUpChannelId = values[0] || null;
                break;
            case 'levels:ignore_channels': {
                settings.leveling.ignoredChannels = [...values];
                await settings.save();
                const panel = (0, settingsPanel_1.buildLevelIgnorePanel)(interaction.guild, settings);
                await interaction.editReply({ embeds: panel.embeds, components: panel.components });
                return;
            }
            case 'levels:ignore_roles': {
                settings.leveling.ignoredRoles = [...values];
                await settings.save();
                const panel = (0, settingsPanel_1.buildLevelIgnorePanel)(interaction.guild, settings);
                await interaction.editReply({ embeds: panel.embeds, components: panel.components });
                return;
            }
            case 'logging:events': {
                const preset = values[0];
                const ALL = [
                    'messageDelete', 'messageEdit', 'memberJoin', 'memberLeave',
                    'memberBan', 'memberUnban', 'memberUpdate', 'memberTimeout',
                    'channelCreate', 'channelDelete', 'channelUpdate',
                    'roleCreate', 'roleDelete',
                    'voiceStateUpdate', 'inviteCreate', 'inviteDelete',
                ];
                if (preset === 'all')
                    settings.logging.types = ALL;
                else if (preset === 'none')
                    settings.logging.types = [];
                else if (preset === 'messages')
                    settings.logging.types = ['messageDelete', 'messageEdit'];
                else if (preset === 'members')
                    settings.logging.types = ['memberJoin', 'memberLeave', 'memberBan', 'memberUnban', 'memberUpdate', 'memberTimeout'];
                else if (preset === 'channels')
                    settings.logging.types = ['channelCreate', 'channelDelete', 'channelUpdate'];
                else if (preset === 'roles')
                    settings.logging.types = ['roleCreate', 'roleDelete'];
                else if (preset === 'voice')
                    settings.logging.types = ['voiceStateUpdate'];
                else if (preset === 'invites')
                    settings.logging.types = ['inviteCreate', 'inviteDelete'];
                break;
            }
            case 'ai:lang': {
                const lang = values[0];
                settings.ai.responseLanguage = lang;
                await models_1.AIConfig.findOneAndUpdate({ guildId }, { language: lang }, { upsert: true }).catch(() => { });
                break;
            }
            case 'automod:action':
                settings.automod.badWordsAction = values[0];
                break;
            case 'commands:remove': {
                const name = values[0];
                const before = (settings.customCommands || []).length;
                settings.customCommands = (settings.customCommands || []).filter((c) => c.name !== name);
                if (settings.customCommands.length === before) {
                    await interaction.editReply({ content: `❌ الأمر \`${name}\` غير موجود` });
                    return;
                }
                await settings.save();
                const cPanel = (0, settingsPanel_1.buildCommands)(interaction.guild, settings);
                await interaction.editReply({ embeds: cPanel.embeds, components: cPanel.components });
                await interaction.followUp({ content: `🗑️ تم حذف الأمر \`${name}\``, ephemeral: true });
                return;
            }
            case 'shop:remove': {
                const itemId = values[0];
                const item = (settings.shop?.items || []).find((it) => it.id === itemId);
                settings.shop.items = (settings.shop?.items || []).filter((it) => it.id !== itemId);
                await settings.save();
                const sPanel = (0, settingsPanel_1.buildShop)(interaction.guild, settings);
                await interaction.editReply({ embeds: sPanel.embeds, components: sPanel.components });
                await interaction.followUp({ content: `🗑️ تم حذف **${item?.name || 'العنصر'}** من المتجر`, ephemeral: true });
                return;
            }
            case 'warnroles:members': {
                // 👮‍♂️ رولات تحذير الأعضاء — تُجهَّز مؤقتاً ولا تُحفظ إلا بـ ✅ تأكيد
                (0, pendingWarnRoles_1.setPendingWarnRoles)(interaction.guild.id, { members: [...values] }, interaction.user.id);
                const wPanel = (0, settingsPanel_1.buildWarnRolesPanel)(interaction.guild, settings);
                await interaction.editReply({ embeds: wPanel.embeds, components: wPanel.components });
                await interaction.followUp({
                    content: values.length
                        ? `⏳ **رولات تحذير الأعضاء:** ${values.map((v) => `<@&${v}>`).join(' , ')}\n👉 اضغط **✅ تأكيد وحفظ** لتطبيقها`
                        : `⏳ سيتم **مسح** رولات تحذير الأعضاء\n👉 اضغط **✅ تأكيد وحفظ** للتأكيد`,
                    ephemeral: true,
                });
                return;
            }
            case 'warnroles:admins': {
                // 🛡️ رولات تحذير الإداريين (قائمة) — تُجهَّز مؤقتاً
                (0, pendingWarnRoles_1.setPendingWarnRoles)(interaction.guild.id, { admins: [...values] }, interaction.user.id);
                const wPanel = (0, settingsPanel_1.buildWarnRolesPanel)(interaction.guild, settings);
                await interaction.editReply({ embeds: wPanel.embeds, components: wPanel.components });
                await interaction.followUp({
                    content: values.length
                        ? `⏳ **رولات تحذير الإداريين:** ${values.map((v) => `<@&${v}>`).join(' , ')}\n👉 اضغط **✅ تأكيد وحفظ** لتطبيقها`
                        : `⏳ سيتم **مسح** رولات تحذير الإداريين\n👉 اضغط **✅ تأكيد وحفظ** للتأكيد`,
                    ephemeral: true,
                });
                return;
            }
            case 'warnroles:sequential': {
                // ⚡ النظام التسلسلي: القيم المختارة هي role IDs مباشرة (بالترتيب 1، 2، 3+)
                (0, pendingWarnRoles_1.setPendingWarnRoles)(interaction.guild.id, { sequential: [...values] }, interaction.user.id);
                const wPanel = (0, settingsPanel_1.buildWarnRolesPanel)(interaction.guild, settings);
                await interaction.editReply({ embeds: wPanel.embeds, components: wPanel.components });
                const seqLabels = ['1️⃣ تحذير 1', '2️⃣ تحذير 2', '3️⃣ تحذير 3+'];
                await interaction.followUp({
                    content: `⏳ **النظام التسلسلي (تجميعي):**\n` +
                        seqLabels.map((l, i) => `${l}: ${values[i] ? `<@&${values[i]}>` : '—'}`).join('\n') +
                        `\n👉 اضغط **✅ تأكيد وحفظ** لتطبيقها`,
                    ephemeral: true,
                });
                return;
            }
            default:
                await interaction.editReply({ content: '❌ خيار غير معروف' });
                return;
            case 'announce:channel': {
                const channelId = interaction.values[0];
                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel || channel.type !== 0) {
                    await interaction.editReply({ content: '❌ قناة غير صالحة' });
                    return;
                }
                // نحتاج محتوى الرسالة - نقرأه من settings.announcements.history آخر إدخال
                const settings = await (0, models_1.getGuildSettings)(interaction.guildId);
                const lastAnnounce = settings.announcements?.history?.slice(-1).find((a) => a.type === 'channel' && !a.sent);
                if (!lastAnnounce) {
                    await interaction.editReply({ content: '❌ لا توجد رسالة معلقة للإرسال' });
                    return;
                }
                const content = lastAnnounce.content;
                try {
                    await channel.send(content);
                    lastAnnounce.sent = true;
                    await settings.save();
                    await interaction.editReply({ content: `✅ تم الإرسال في ${channel}` });
                }
                catch (error) {
                    await interaction.editReply({ content: `❌ فشل الإرسال: ${error.message}` });
                }
                return;
            }
        }
        await settings.save();
        if (section === 'logging') {
            const client = interaction.client;
            client.loggingHandler?.invalidateCache?.(guildId);
        }
        // 🧠 قسم السجن يُعرض ضمن لوحة الحماية → أعد بناء لوحة الحماية (لا الرئيسية)
        const panelSection = section === 'jail' ? 'protection' : section;
        const panel = await (0, settingsPanel_1.buildPanel)(panelSection, interaction.guild, interaction.user.id);
        await interaction.editReply({
            embeds: panel.embeds,
            components: panel.components,
        });
    },
};
exports.default = handler;
//# sourceMappingURL=settingsSel.js.map