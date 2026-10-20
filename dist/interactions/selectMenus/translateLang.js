"use strict";
// ============================================
// Liberty City Bot - Translate Language Picker
// ============================================
// قائمة اختيار اللغة لأزرار /translate (ترجمة النص الأصلي بلغة جديدة)
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const AITranslator_1 = require("../../handlers/AITranslator");
const translateStore_1 = require("../../utils/translateStore");
const handler = {
    id: 'translate:lang',
    async execute(interaction) {
        // هذا المُعالج مخصص لقوائم الاختيار النصية فقط
        const i = interaction;
        const client = i.client;
        const parts = i.customId.split(':'); // translate:lang:messageId
        const messageId = parts[2];
        const stored = (0, translateStore_1.getTranslation)(messageId);
        if (!stored) {
            await i.update({
                content: '❌ انتهت صلاحية النص الأصلي — استخدم `/translate` مرة أخرى',
                embeds: [],
                components: [],
            });
            return;
        }
        const targetLang = i.values[0];
        await i.deferUpdate();
        const result = await client.aiTranslator.translate(stored.text, targetLang, stored.sourceLang, i.guild?.id);
        if (!result) {
            await i.followUp({ content: '❌ فشل الترجمة — جرب مرة تانية', ephemeral: true });
            return;
        }
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId('translate:copy').setLabel('📋 نسخ').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(`translate:retry:${targetLang}`).setLabel('🔄 إعادة').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId('translate:lang').setLabel('🌐 تغيير اللغة').setStyle(discord_js_1.ButtonStyle.Success));
        // تحديث رسالة الترجمة الأصلية (وليس الرسالة المؤقتة)
        const original = await i.channel?.messages?.fetch(messageId).catch(() => null);
        if (original) {
            const embed = original.embeds[0]
                ? { ...original.embeds[0].data, title: `${AITranslator_1.SUPPORTED_LANGUAGES[targetLang]?.flag || '🌐'} ترجمة إلى ${AITranslator_1.SUPPORTED_LANGUAGES[targetLang]?.name || targetLang}`, description: result.translatedText }
                : null;
            await original.edit({ embeds: embed ? [embed] : [], components: [row] }).catch(() => { });
        }
        await i.editReply({ content: `✅ تم الترجمة إلى ${AITranslator_1.SUPPORTED_LANGUAGES[targetLang]?.flag || ''} ${AITranslator_1.SUPPORTED_LANGUAGES[targetLang]?.name || targetLang}`, components: [] });
    },
};
exports.default = handler;
//# sourceMappingURL=translateLang.js.map