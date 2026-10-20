"use strict";
// ============================================
// Liberty City Bot - Translate Command
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const translateStore_1 = require("../../utils/translateStore");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('translate')
        .setDescription('ترجمة نص فورية')
        .addStringOption(option => option
        .setName('text')
        .setDescription('النص المراد ترجمته')
        .setRequired(true)
        .setMaxLength(2000))
        .addStringOption(option => option
        .setName('target_lang')
        .setDescription('اللغة الهدف')
        .setRequired(false)
        .addChoices({ name: '🇸🇦 العربية', value: 'ar' }, { name: '🇺🇸 English', value: 'en' }, { name: '🇫🇷 French', value: 'fr' }, { name: '🇪🇸 Spanish', value: 'es' }, { name: '🇩🇪 German', value: 'de' }, { name: '🇮🇹 Italian', value: 'it' }, { name: '🇵🇹 Portuguese', value: 'pt' }, { name: '🇷🇺 Russian', value: 'ru' }, { name: '🇨🇳 Chinese', value: 'zh' }, { name: '🇯🇵 Japanese', value: 'ja' }, { name: '🇰🇷 Korean', value: 'ko' }, { name: '🇹🇷 Turkish', value: 'tr' }, { name: '🇮🇷 Persian', value: 'fa' }, { name: '🇮🇳 Hindi', value: 'hi' }, { name: '🌐 Auto', value: 'auto' }))
        .addStringOption(option => option
        .setName('source_lang')
        .setDescription('لغة النص الأصلي (اختياري - كشف تلقائي)')
        .setRequired(false)
        .addChoices({ name: '🌐 Auto-detect', value: 'auto' }, { name: '🇸🇦 Arabic', value: 'ar' }, { name: '🇺🇸 English', value: 'en' }, { name: '🇫🇷 French', value: 'fr' }, { name: '🇪🇸 Spanish', value: 'es' }, { name: '🇩🇪 German', value: 'de' }))
        .setDMPermission(true),
    async execute(interaction) {
        const text = interaction.options.getString('text', true);
        const targetLang = interaction.options.getString('target_lang') || 'ar';
        const sourceLang = interaction.options.getString('source_lang') || 'auto';
        await interaction.deferReply({ ephemeral: false });
        const client = interaction.client;
        const translator = client.aiTranslator;
        if (!translator) {
            await interaction.editReply({ content: '❌ مترجم الذكاء الاصطناعي غير متاح' });
            return;
        }
        const result = await translator.translate(text, targetLang, sourceLang, interaction.guild?.id);
        if (!result) {
            await interaction.editReply({ content: '❌ فشل الترجمة — جرب مرة تانية' });
            return;
        }
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = await Promise.resolve().then(() => __importStar(require('discord.js')));
        const { Colors } = await Promise.resolve().then(() => __importStar(require('../../utils/embeds')));
        const { SUPPORTED_LANGUAGES } = await Promise.resolve().then(() => __importStar(require('../../handlers/AITranslator')));
        const embed = new EmbedBuilder()
            .setTitle(`${SUPPORTED_LANGUAGES[result.targetLang]?.flag || '🌐'} ترجمة إلى ${SUPPORTED_LANGUAGES[result.targetLang]?.name || result.targetLang}`)
            .setColor(0x00FF88)
            .setDescription(result.translatedText)
            .addFields({ name: '🌍 من', value: SUPPORTED_LANGUAGES[result.sourceLang]?.name || result.sourceLang, inline: true }, { name: '🎯 إلى', value: SUPPORTED_LANGUAGES[result.targetLang]?.name || result.targetLang, inline: true }, { name: '🎯 ثقة', value: `${result.confidence}%`, inline: true })
            .setFooter({ text: `Liberty City Translator • ${interaction.user.tag}` })
            .setTimestamp();
        // أزرار للغات سريعة
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`translate:copy:${interaction.id}`).setLabel('📋 نسخ').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(`translate:retry:${targetLang}`).setLabel('🔄 إعادة').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`translate:lang`).setLabel('🌐 تغيير اللغة').setStyle(ButtonStyle.Success));
        await interaction.editReply({ embeds: [embed], components: [row] });
        // حفظ النص الأصلي لأزرار (نسخ/إعادة/تغيير اللغة)
        const sent = await interaction.fetchReply().catch(() => null);
        if (sent) {
            (0, translateStore_1.putTranslation)(sent.id, { text, sourceLang: result.sourceLang, targetLang: result.targetLang, translatedText: result.translatedText });
        }
    },
};
exports.default = command;
//# sourceMappingURL=translate.js.map