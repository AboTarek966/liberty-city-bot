"use strict";
// ============================================
// Liberty City Bot - Translate Buttons
// ============================================
// أزرار نتيجة /translate: 📋 نسخ | 🔄 إعادة | 🌐 تغيير اللغة
// (كان مفقوداً تماماً → "This interaction failed")
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const AITranslator_1 = require("../../handlers/AITranslator");
const translateStore_1 = require("../../utils/translateStore");
// أول 24 لغة (حد ديسكورد 25 خياراً) + إخفاء القائمة عند الاكتمال
const LANG_CHOICES = Object.entries(AITranslator_1.SUPPORTED_LANGUAGES)
    .filter(([code]) => code !== 'auto')
    .slice(0, 24);
const handler = {
    id: 'translate',
    async execute(interaction) {
        const client = interaction.client;
        const parts = interaction.customId.split(':'); // translate:action:extra?
        const action = parts[1];
        const extra = parts[2];
        // ---------- 📋 نسخ: يرسل النص في رسالة خاصة ليستطيع المستخدم نسخه ----------
        if (action === 'copy') {
            const stored = (0, translateStore_1.getTranslation)(interaction.message.id);
            const text = stored?.translatedText || interaction.message.embeds[0]?.description || '';
            if (!text) {
                await interaction.reply({ content: '❌ لم يتم العثور على النص — استخدم `/translate` مرة أخرى', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            await interaction.reply({
                content: `📋 **انسخ النص:**\n\`\`\`\n${text.substring(0, 1900)}\n\`\`\``,
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // ---------- 🌐 تغيير اللغة: قائمة اختيار لغة ----------
        if (action === 'lang') {
            const menu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId(`translate:lang:${interaction.message.id}`)
                .setPlaceholder('🌐 اختر اللغة الجديدة')
                .addOptions(LANG_CHOICES.map(([code, info]) => ({
                label: `${info.flag} ${info.name}`,
                value: code,
                description: info.nativeName,
            })));
            await interaction.reply({
                components: [new discord_js_1.ActionRowBuilder().addComponents(menu)],
                flags: discord_js_1.MessageFlags.Ephemeral,
            });
            return;
        }
        // ---------- 🔄 إعادة الترجمة ----------
        if (action === 'retry') {
            const stored = (0, translateStore_1.getTranslation)(interaction.message.id);
            if (!stored) {
                await interaction.reply({ content: '❌ انتهت صلاحية النص الأصلي — استخدم `/translate` مرة أخرى', flags: discord_js_1.MessageFlags.Ephemeral });
                return;
            }
            await interaction.deferReply({ flags: discord_js_1.MessageFlags.Ephemeral });
            const translator = client.aiTranslator;
            const targetLang = extra && AITranslator_1.SUPPORTED_LANGUAGES[extra] ? extra : stored.targetLang;
            const result = await translator.translate(stored.text, targetLang, stored.sourceLang, interaction.guild?.id);
            if (!result) {
                await interaction.editReply({ content: '❌ فشل الترجمة — جرب مرة تانية' });
                return;
            }
            await interaction.editReply({
                content: `🔄 **إعادة الترجمة إلى ${AITranslator_1.SUPPORTED_LANGUAGES[targetLang]?.flag || ''} ${AITranslator_1.SUPPORTED_LANGUAGES[targetLang]?.name || targetLang}:**\n\`\`\`\n${result.translatedText.substring(0, 1900)}\n\`\`\``,
            });
            return;
        }
        await interaction.reply({ content: '❌ إجراء غير معروف', flags: discord_js_1.MessageFlags.Ephemeral });
    },
};
exports.default = handler;
//# sourceMappingURL=translate.js.map