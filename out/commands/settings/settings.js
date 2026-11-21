"use strict";
// ============================================
// Omni Bot - Settings Command (UI Panel)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSettingsAllowed = isSettingsAllowed;
const discord_js_1 = require("discord.js");
const settingsPanel_1 = require("../../utils/settingsPanel");
const models_1 = require("../../models");
const botOwner_1 = require("../../utils/botOwner");
/** هل يملك هذا المستخدم صلاحية استخدام لوحة الإعدادات؟ — مالك السيرفر أو مالك/مطوّر البوت + من سمح له */
async function isSettingsAllowed(client, guild, userId, allowlist) {
    if (!guild || !userId)
        return false;
    if (guild.ownerId === userId)
        return true;
    // 🛠️ مالك/مطوّر البوت — يتجاوز بوابة مالك السيرفر
    if (await (0, botOwner_1.isBotOwner)(client, userId))
        return true;
    return Array.isArray(allowlist) && allowlist.map(String).includes(String(userId));
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('settings')
        .setDescription('🎛️ لوحة إعدادات السيرفر — واجهة سهلة وجميلة لكل الإعدادات')
        .setDMPermission(false),
    cooldown: 3,
    async execute(interaction) {
        const guild = interaction.guild;
        const settings = await (0, models_1.getGuildSettings)(guild.id).catch(() => null);
        const allowlist = settings && Array.isArray(settings?.settingsAllowlist)
            ? settings.settingsAllowlist.map(String)
            : [];
        // المالك ومطوّر البوت دائماً مسموحان — غيرهما فقط من أضافهم المالك عبر /settings-access
        if (!(await isSettingsAllowed(interaction.client, guild, interaction.user.id, allowlist))) {
            await interaction.reply({
                content: '❌ **الإعدادات محصورة بمالك السيرفر أو مالك/مطوّر البوت** — حتى لو كانت رتبتك أعلى رول في السيرفر.\n' +
                    '> 👑 المالك يملك السماح لك عبر الأمر `/settings-access add @أنت` ثم تفتح الإعدادات مرة أخرى.',
                ephemeral: true,
            });
            return;
        }
        // فتح اللوحة مباشرة — كلمة المرور تُطلب تلقائياً عند الضغط على أي زر للتعديل
        // (الأزرار تعرض نافذة كلمة المرور، وهذا يعمل حتى لو فُتحت اللوحة من الاختصار)
        const panel = await (0, settingsPanel_1.buildPanel)('home', guild, interaction.user.id);
        await interaction.reply({
            embeds: panel.embeds,
            components: panel.components,
            ephemeral: true,
        });
    },
};
exports.default = command;
//# sourceMappingURL=settings.js.map