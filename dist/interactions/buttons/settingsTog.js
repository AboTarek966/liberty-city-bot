"use strict";
// ============================================
// Settings Panel - Toggle Buttons (تفعيل/تعطيل)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const settingsPanel_1 = require("../../utils/settingsPanel");
const models_1 = require("../../models");
const lockdown_1 = require("../../utils/lockdown");
const handler = {
    id: 'settings_tog',
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
            // 🔐 انتهت الجلسة → إعادة فتح نافذة كلمة المرور
            await interaction.showModal((0, settingsPanel_1.buildSettingsPasswordModal)());
            return;
        }
        await interaction.deferUpdate(); // ✅ منع انتهاء صلاحية التفاعل
        const parts = interaction.customId.split(':');
        const section = parts[1];
        const field = parts[2];
        const settings = await (0, models_1.getGuildSettings)(interaction.guild.id);
        switch (parts[1]) {
            case 'protection': {
                const prot = settings.protection;
                // 🔒 وضع الطوارئ: يقفل/يفتح القنوات فعلياً (وليس مجرد مفتاح)
                if (field === 'lockdown') {
                    const newState = !prot.lockdown;
                    const result = await (0, lockdown_1.setLockdown)(interaction.guild, newState);
                    prot.lockdown = newState;
                    await interaction.followUp({
                        content: newState
                            ? `🔒 **تم تفعيل وضع الطوارئ** — أُغلقت ${result.textChannels} قناة نصية و${result.voiceChannels} صوتية\nاستخدم الزر مرة أخرى أو \`/lockdown state:off\` للإلغاء`
                            : `🔓 **تم إلغاء وضع الطوارئ** — فُتحت ${result.textChannels} قناة نصية و${result.voiceChannels} صوتية`,
                        ephemeral: true,
                    });
                    break;
                }
                if (!prot[field])
                    prot[field] = { enabled: false };
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
                    const card = settings.welcome.card;
                    if (card)
                        card.enabled = !card.enabled;
                }
                else {
                    settings.welcome.enabled = !settings.welcome.enabled;
                }
                break;
            case 'leave':
                settings.leave.enabled = !settings.leave.enabled;
                break;
            case 'logging':
                if (field === 'snipe') {
                    // 🕵️ تفعيل/تعطيل السنايب (استرجاع الرسائل المحذوفة)
                    if (!settings.snipe)
                        settings.snipe = { enabled: true };
                    settings.snipe.enabled = !settings.snipe.enabled;
                }
                else {
                    settings.logging.enabled = !settings.logging.enabled;
                }
                break;
            case 'levels':
                settings.leveling.enabled = !settings.leveling.enabled;
                break;
            case 'automod':
                if (field === 'zalgo') {
                    settings.automod.zalgoEnabled = !settings.automod.zalgoEnabled;
                }
                else {
                    settings.automod.enabled = !settings.automod.enabled;
                }
                break;
            case 'ai': {
                settings.ai.enabled = !settings.ai.enabled;
                // مزامنة مع AIConfig (يستخدمه مسار المنشن)
                await models_1.AIConfig.findOneAndUpdate({ guildId: interaction.guild.id }, { enabled: settings.ai.enabled }, { upsert: true }).catch(() => { });
                break;
            }
            case 'shop': {
                if (!settings.shop)
                    settings.shop = { enabled: true, items: [] };
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
            const client = interaction.client;
            client.loggingHandler?.invalidateCache?.(interaction.guild.id);
        }
        // 💾 مزامنة مؤقت النسخ الاحتياطي التلقائي فور تبديلته
        if (section === 'protection' && field === 'autoBackup') {
            const client = interaction.client;
            const nowEnabled = settings.protection.autoBackup?.enabled;
            await client.securityHandler?.syncAutoBackup(interaction.guild, !!nowEnabled).catch(() => { });
        }
        // 🔍 مزامنة مؤقت الفحص الدوري فور تبديلته
        if (section === 'protection' && field === 'autoScan') {
            const client = interaction.client;
            if (!settings.protection.autoScan) {
                settings.protection.autoScan = { enabled: true, interval: 6 };
                await settings.save();
            }
            await client.securityHandler?.syncAutoScan(interaction.guild).catch(() => { });
        }
        // 🛡️ تفعيل/تعطيل الجدار الحديدي فوراً
        if (section === 'protection' && field === 'ironWall') {
            const client = interaction.client;
            const newState = !!settings.protection.ironWall;
            if (newState) {
                await interaction.followUp({
                    content: '🛡️ **جاري تفعيل الجدار الحديدي...** (يمنع إنشاء قنوات/رولات للجميع عدا الأونر + البوت)',
                    ephemeral: true,
                });
            }
            const result = await client.securityHandler?.applyIronWall(interaction.guild, newState).catch(() => ({ text: 0, voice: 0, roles: 0 }));
            await interaction.followUp({
                content: newState
                    ? `🛡️ **تم تفعيل الجدار الحديدي** — أُزيلت صلاحيات الإنشاء من ${result?.roles ?? 0} رول\n⚠️ **الأونر + البوت بس** يقدر يعمل قنوات/رولات\n💡 الأدمنز: استخدموا \`/channel create\` و \`/role create\``
                    : `🔓 **تم تعطيل الجدار الحديدي** — الأونر يرجع الصلاحيات يدوياً من إعدادات السيرفر`,
                ephemeral: true,
            });
        }
        if (section === 'welcome' && field === 'card') {
            // 🎴 تفعيل/تعطيل البطاقة → أرسل المحرر مع صورة حية
            await (0, settingsPanel_1.sendWelcomeCardPanel)(interaction, settings);
            return;
        }
        const panel = section === 'verification'
            ? (0, settingsPanel_1.buildVerificationPanel)(interaction.guild, settings)
            : section === 'shop'
                ? (0, settingsPanel_1.buildShop)(interaction.guild, settings)
                : await (0, settingsPanel_1.buildPanel)(section, interaction.guild, interaction.user.id);
        await interaction.editReply({
            embeds: panel.embeds,
            components: panel.components,
        });
    },
};
exports.default = handler;
//# sourceMappingURL=settingsTog.js.map