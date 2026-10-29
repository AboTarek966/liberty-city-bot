"use strict";
// ============================================
// Liberty City Bot - AI Translator
// ============================================
// ترجمة فورية لأي رسالة: كشف اللغة التلقائي + 50+ لغة
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
exports.AITranslator = exports.SUPPORTED_LANGUAGES = void 0;
const discord_js_1 = require("discord.js");
const helpers_1 = require("../utils/helpers");
const embeds_1 = require("../utils/embeds");
const translateStore_1 = require("../utils/translateStore");
const logger = (0, helpers_1.createLogger)('AITranslator');
// اللغات المدعومة (رمز ISO + الاسم + الفлаг)
exports.SUPPORTED_LANGUAGES = {
    'ar': { name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
    'en': { name: 'English', flag: '🇺🇸', nativeName: 'English' },
    'fr': { name: 'French', flag: '🇫🇷', nativeName: 'Français' },
    'es': { name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
    'de': { name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
    'it': { name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
    'pt': { name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
    'ru': { name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
    'zh': { name: 'Chinese', flag: '🇨🇳', nativeName: '中文' },
    'ja': { name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
    'ko': { name: 'Korean', flag: '🇰🇷', nativeName: '한국어' },
    'tr': { name: 'Turkish', flag: '🇹🇷', nativeName: 'Türkçe' },
    'nl': { name: 'Dutch', flag: '🇳🇱', nativeName: 'Nederlands' },
    'pl': { name: 'Polish', flag: '🇵🇱', nativeName: 'Polski' },
    'sv': { name: 'Swedish', flag: '🇸🇪', nativeName: 'Svenska' },
    'da': { name: 'Danish', flag: '🇩🇰', nativeName: 'Dansk' },
    'no': { name: 'Norwegian', flag: '🇳🇴', nativeName: 'Norsk' },
    'fi': { name: 'Finnish', flag: '🇫🇮', nativeName: 'Suomi' },
    'cs': { name: 'Czech', flag: '🇨🇿', nativeName: 'Čeština' },
    'hu': { name: 'Hungarian', flag: '🇭🇺', nativeName: 'Magyar' },
    'ro': { name: 'Romanian', flag: '🇷🇴', nativeName: 'Română' },
    'uk': { name: 'Ukrainian', flag: '🇺🇦', nativeName: 'Українська' },
    'he': { name: 'Hebrew', flag: '🇮🇱', nativeName: 'עברית' },
    'hi': { name: 'Hindi', flag: '🇮🇳', nativeName: 'हिन्दी' },
    'th': { name: 'Thai', flag: '🇹🇭', nativeName: 'ไทย' },
    'vi': { name: 'Vietnamese', flag: '🇻🇳', nativeName: 'Tiếng Việt' },
    'id': { name: 'Indonesian', flag: '🇮🇩', nativeName: 'Bahasa Indonesia' },
    'ms': { name: 'Malay', flag: '🇲🇾', nativeName: 'Bahasa Melayu' },
    'fa': { name: 'Persian', flag: '🇮🇷', nativeName: 'فارسی' },
    'el': { name: 'Greek', flag: '🇬🇷', nativeName: 'Ελληνικά' },
    'bg': { name: 'Bulgarian', flag: '🇧🇬', nativeName: 'Български' },
    'hr': { name: 'Croatian', flag: '🇭🇷', nativeName: 'Hrvatski' },
    'sk': { name: 'Slovak', flag: '🇸🇰', nativeName: 'Slovenčina' },
    'sl': { name: 'Slovenian', flag: '🇸🇮', nativeName: 'Slovenščina' },
    'et': { name: 'Estonian', flag: '🇪🇪', nativeName: 'Eesti' },
    'lv': { name: 'Latvian', flag: '🇱🇻', nativeName: 'Latviešu' },
    'lt': { name: 'Lithuanian', flag: '🇱🇹', nativeName: 'Lietuvių' },
    'sr': { name: 'Serbian', flag: '🇷🇸', nativeName: 'Српски' },
    'bs': { name: 'Bosnian', flag: '🇧🇦', nativeName: 'Bosanski' },
    'mk': { name: 'Macedonian', flag: '🇲🇰', nativeName: 'Македонски' },
    'sq': { name: 'Albanian', flag: '🇦🇱', nativeName: 'Shqip' },
    'mt': { name: 'Maltese', flag: '🇲🇹', nativeName: 'Malti' },
    'ga': { name: 'Irish', flag: '🇮🇪', nativeName: 'Gaeilge' },
    'cy': { name: 'Welsh', flag: '🇬🇧', nativeName: 'Cymraeg' },
    'eu': { name: 'Basque', flag: '🇪🇸', nativeName: 'Euskara' },
    'ca': { name: 'Catalan', flag: '🇪🇸', nativeName: 'Català' },
    'gl': { name: 'Galician', flag: '🇪🇸', nativeName: 'Galego' },
    'is': { name: 'Icelandic', flag: '🇮🇸', nativeName: 'Íslenska' },
    'auto': { name: 'Auto-detect', flag: '🌐', nativeName: 'Auto' },
};
const DEFAULT_CONFIG = {
    enabled: false,
    defaultTargetLang: 'ar',
    autoTranslateChannels: [],
    ignoredChannels: [],
    ignoredRoles: [],
    showOriginal: true,
    maxLength: 2000,
};
class AITranslator {
    client;
    aiHandler;
    translationCache = new Map();
    CACHE_TTL = 10 * 60 * 1000; // 10 دقائق
    constructor(client) {
        this.client = client;
        this.aiHandler = client.aiHandler;
    }
    // --------------------------------------------
    // ترجمة نص
    // --------------------------------------------
    async translate(text, targetLang, sourceLang = 'auto', guildId) {
        try {
            // فحص الكاش
            const cacheKey = `${text}:${sourceLang}:${targetLang}`;
            const cached = this.translationCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                return cached;
            }
            // بناء البرومبت
            const prompt = this.buildTranslationPrompt(text, targetLang, sourceLang);
            const response = await this.aiHandler.generateResponse('system-translator', guildId || 'dm', 'dm', prompt, [], false, false, { fromCommand: true });
            if (!response?.content)
                return null;
            // استخراج الترجمة من الرد
            const translation = this.extractTranslation(response.content, text);
            const result = {
                originalText: text,
                translatedText: translation,
                sourceLang: sourceLang === 'auto' ? this.detectLanguage(text) : sourceLang,
                targetLang,
                confidence: 90,
            };
            // تخزين في الكاش
            this.translationCache.set(cacheKey, { ...result, timestamp: Date.now() });
            return result;
        }
        catch (error) {
            logger.error(`AI Translator error: ${error.message}`);
            return null;
        }
    }
    buildTranslationPrompt(text, targetLang, sourceLang) {
        const langName = exports.SUPPORTED_LANGUAGES[targetLang]?.name || targetLang;
        const sourceName = sourceLang === 'auto' ? 'Auto-detect' : (exports.SUPPORTED_LANGUAGES[sourceLang]?.name || sourceLang);
        return `You are a professional translator. Translate the following text from ${sourceName} to ${langName}.

**Rules:**
1. Translate naturally — not word-for-word
2. Preserve tone, context, and formatting
3. Keep emojis, mentions, code blocks as-is
4. Return ONLY the translation, no explanations
5. If text is already in target language, return it unchanged

**Source text:**
"${text}"

**Translation to ${langName}:**`;
    }
    extractTranslation(response, original) {
        // تنظيف الرد
        let translation = response.trim();
        // إزالة علامات الاقتباس إن وجدت
        translation = translation.replace(/^["']|["']$/g, '');
        // لو الرد يحتوي على أسطر توضيحية، نأخذ السطر الأخير غير الفارغ
        const lines = translation.split('\n').filter(l => l.trim());
        if (lines.length > 1) {
            // آخر سطر غالباً الترجمة
            translation = lines[lines.length - 1].trim();
        }
        return translation || original;
    }
    detectLanguage(text) {
        // كشف بسيط باللغة العربية/الإنجليزية
        const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
        const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
        if (arabicChars > englishChars)
            return 'ar';
        if (englishChars > arabicChars)
            return 'en';
        return 'auto';
    }
    // --------------------------------------------
    // ترجمة رسالة (مع معالجة المنشن/الرد)
    // --------------------------------------------
    async translateMessage(message, targetLang, guildId) {
        const text = message.content.trim();
        if (!text)
            return null;
        const config = await this.getConfigForGuild(guildId || '').catch(() => this.getConfig(guildId));
        const lang = targetLang || config.defaultTargetLang;
        return this.translate(text, lang, 'auto', guildId);
    }
    // --------------------------------------------
    // ترجمة تلقائية في قنوات محددة
    // --------------------------------------------
    async autoTranslateIfNeeded(message) {
        try {
            const guildId = message.guild?.id;
            if (!guildId)
                return;
            const settings = await this.getSettings(guildId);
            const config = this.getConfigFromSettings(settings);
            if (!config.enabled)
                return;
            if (message.author.bot || message.webhookId)
                return;
            if (config.ignoredChannels?.includes(message.channel.id))
                return;
            if (message.member && config.ignoredRoles?.some(r => message.member.roles.cache.has(r)))
                return;
            if (message.member?.permissions.has('Administrator'))
                return;
            // فحص لو القناة في القائمة التلقائية
            if (!config.autoTranslateChannels?.includes(message.channel.id))
                return;
            const result = await this.translateMessage(message, undefined, guildId);
            if (!result)
                return;
            // إرسال الترجمة كرد
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`${exports.SUPPORTED_LANGUAGES[result.targetLang]?.flag || '🌐'} ترجمة إلى ${exports.SUPPORTED_LANGUAGES[result.targetLang]?.name || result.targetLang}`)
                .setColor(embeds_1.Colors.info)
                .setDescription(result.translatedText)
                .setFooter({ text: `من: ${result.sourceLang === 'auto' ? 'Auto-detect' : exports.SUPPORTED_LANGUAGES[result.sourceLang]?.name || result.sourceLang}` })
                .setTimestamp();
            if (config.showOriginal) {
                embed.addFields({ name: '📝 النص الأصلي', value: result.originalText.substring(0, 1000) });
            }
            await message.reply({ embeds: [embed] }).catch(() => { });
        }
        catch (error) {
            logger.error(`Auto-translate error: ${error.message}`);
        }
    }
    // --------------------------------------------
    // أمر سلاش /translate
    // --------------------------------------------
    async handleTranslateCommand(interaction, text, targetLang, sourceLang) {
        await interaction.deferReply({ ephemeral: false });
        const guildId = interaction.guild?.id;
        const config = guildId
            ? await this.getConfigForGuild(guildId).catch(() => this.getConfig(guildId))
            : this.getConfig(guildId);
        const lang = targetLang || config.defaultTargetLang;
        const srcLang = sourceLang || 'auto';
        const result = await this.translate(text, lang, srcLang, guildId);
        if (!result) {
            await interaction.editReply({ content: '❌ فشل الترجمة — جرب مرة تانية' });
            return;
        }
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle(`${exports.SUPPORTED_LANGUAGES[result.targetLang]?.flag || '🌐'} ترجمة إلى ${exports.SUPPORTED_LANGUAGES[result.targetLang]?.name || result.targetLang}`)
            .setColor(embeds_1.Colors.success)
            .setDescription(result.translatedText)
            .addFields({ name: '🌍 من', value: exports.SUPPORTED_LANGUAGES[result.sourceLang]?.name || result.sourceLang, inline: true }, { name: '🎯 إلى', value: exports.SUPPORTED_LANGUAGES[result.targetLang]?.name || result.targetLang, inline: true }, { name: '🎯 ثقة', value: `${result.confidence}%`, inline: true })
            .setFooter({ text: `Liberty City Translator • ${interaction.user.tag}` })
            .setTimestamp();
        if (config.showOriginal) {
            embed.addFields({ name: '📝 النص الأصلي', value: result.originalText.substring(0, 1000) });
        }
        // أزرار للغات سريعة
        const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`translate:copy`).setLabel('📋 نسخ').setStyle(discord_js_1.ButtonStyle.Secondary), new discord_js_1.ButtonBuilder().setCustomId(`translate:retry:${lang}`).setLabel('🔄 إعادة').setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`translate:lang`).setLabel('🌐 تغيير اللغة').setStyle(discord_js_1.ButtonStyle.Success));
        await interaction.editReply({ embeds: [embed], components: [row] });
        // حفظ النص الأصلي لأزرار (نسخ/إعادة/تغيير اللغة)
        const sent = await interaction.fetchReply().catch(() => null);
        if (sent) {
            (0, translateStore_1.putTranslation)(sent.id, { text, sourceLang: result.sourceLang, targetLang: result.targetLang, translatedText: result.translatedText });
        }
    }
    getConfig(guildId) {
        // سيتم جلب الإعدادات من قاعدة البيانات
        return DEFAULT_CONFIG;
    }
    getConfigFromSettings(settings) {
        const t = settings?.protection?.aiTranslator || settings?.aiTranslator;
        if (!t)
            return DEFAULT_CONFIG;
        return {
            enabled: t.enabled ?? false,
            defaultTargetLang: t.defaultTargetLang ?? 'ar',
            autoTranslateChannels: t.autoTranslateChannels ?? [],
            ignoredChannels: t.ignoredChannels ?? [],
            ignoredRoles: t.ignoredRoles ?? [],
            showOriginal: t.showOriginal ?? true,
            maxLength: t.maxLength ?? 2000,
            logChannel: t.logChannel,
        };
    }
    async getSettings(guildId) {
        const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../models')));
        return getGuildSettings(guildId);
    }
    // --------------------------------------------
    // تحديث الإعدادات
    // --------------------------------------------
    async updateConfig(guildId, updates) {
        const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../models')));
        const settings = await getGuildSettings(guildId);
        const prot = settings.protection;
        const merged = { ...this.getConfigFromSettings(settings), ...updates };
        if (prot)
            prot.aiTranslator = merged;
        else
            settings.aiTranslator = merged;
        await settings.save();
    }
    async getConfigForGuild(guildId) {
        const settings = await this.getSettings(guildId);
        return this.getConfigFromSettings(settings);
    }
}
exports.AITranslator = AITranslator;
exports.default = AITranslator;
//# sourceMappingURL=AITranslator.js.map