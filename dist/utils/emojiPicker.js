"use strict";
// ============================================
// Liberty City Bot - نافذة إضافة أمر مخصص
// مودال الإضافة المشترك (للجميع / للإداريين)
// اختيار الإيموجي صار عبر أمر /emoji (قائمة ديسكورد نفسها)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCommandAddModal = buildCommandAddModal;
const discord_js_1 = require("discord.js");
/** نافذة إضافة أمر مخصص — النطاق يُرسل في customId */
function buildCommandAddModal(scope) {
    const isAdmin = scope === 'admin';
    const nameInput = new discord_js_1.TextInputBuilder()
        .setCustomId('name')
        .setLabel('اسم الأمر (الكلمة التي تُكتب في الشات)')
        .setStyle(discord_js_1.TextInputStyle.Short)
        .setMaxLength(50)
        .setRequired(true);
    const contentInput = new discord_js_1.TextInputBuilder()
        .setCustomId('content')
        .setLabel('رد البوت (حتى 1900 حرف) — {user} {server}')
        .setStyle(discord_js_1.TextInputStyle.Paragraph)
        .setMaxLength(1900)
        .setRequired(true);
    return new discord_js_1.ModalBuilder()
        .setCustomId(`settings_modal:commands:add:${scope}`)
        .setTitle(isAdmin ? '🔒 أمر للإداريين فقط' : '🔓 أمر للجميع')
        .addComponents(new discord_js_1.ActionRowBuilder().addComponents(nameInput), new discord_js_1.ActionRowBuilder().addComponents(contentInput));
}
//# sourceMappingURL=emojiPicker.js.map