"use strict";
// ============================================
// Liberty City Bot - Emoji Command (/emoji)
// قائمة إيموجي تنزل بخانة الكتابة مباشرة (مثل زر الإيموجي
// الأصلي بتاعة ديسكورد) — تختار والبوت يرسله جاهز للنسخ واللصق
// في أي رد تلقائي أو رسالة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
/** إيموجي يونيكود الشائعة + اسمها العربي (تظهر بعد إيموجي السيرفر) */
const COMMON = [
    ['😀', 'ضحكة'], ['😂', 'ضحك بدموع'], ['🤣', 'انهيار ضحك'], ['😭', 'بكاء'], ['😢', 'حزن'],
    ['😡', 'غضب'], ['🤬', 'نرفزة'], ['😎', 'كوول'], ['🤔', 'تفكير'], ['😴', 'نعسان'],
    ['🥳', 'مناسبة'], ['🙃', 'مزح'], ['💀', 'موت من الضحك'], ['👻', 'شبح'], ['🥵', 'حر'],
    ['❤️', 'قلب أحمر'], ['🧡', 'قلب برتقالي'], ['💛', 'قلب أصفر'], ['💚', 'قلب أخضر'], ['💙', 'قلب أزرق'],
    ['💜', 'قلب بنفسجي'], ['💖', 'قلب مضيء'], ['💔', 'قلب مكسور'], ['🔥', 'نار'], ['⭐', 'نجمة'],
    ['✨', 'لمعان'], ['💯', 'مئة بالمية'], ['✅', 'صح'], ['❌', 'غلط'], ['⚠️', 'تحذير'],
    ['🚀', 'صاروخ'], ['💪', 'عضلات'], ['🙏', 'دعاء'], ['👍', 'إعجاب'], ['👎', 'عدم إعجاب'],
    ['👏', 'تصفيق'], ['🤝', 'مصافحة'], ['👑', 'تاج'], ['🏆', 'كأس'], ['🥇', 'ميدالية ذهبية'],
    ['🛡️', 'درع'], ['⚔️', 'سيوف'], ['💣', 'قنبلة'], ['🎮', 'لعبة'], ['🎵', 'موسيقى'],
    ['🎤', 'مايك'], ['🍿', 'فشار'], ['🍕', 'بيتزا'], ['☕', 'قهوة'], ['💎', 'جوهرة'],
    ['💰', 'فلوس'], ['🎁', 'هدية'], ['🌙', 'قمر'], ['☀️', 'شمس'], ['🐱', 'قطة'],
    ['🐶', 'كلب'], ['🦁', 'أسد'], ['🐉', 'تنين'], ['🤖', 'روبوت'], ['⚽', 'كرة قدم'],
    ['📱', 'موبايل'], ['🖥️', 'كمبيوتر'], ['🔑', 'مفتاح'], ['🔒', 'قفل'], ['📌', 'دبوس'],
    ['💬', 'كلام'], ['🎉', 'احتفال'], ['💣', 'قنبلة'], ['⏳', 'ساعة'], ['🌈', 'قوس قزح'],
];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('emoji')
        .setDescription('اختر أي إيموجي — القائمة تنزل بخانة الكتابة مباشرة وتبحث بالعربي')
        .addStringOption(option => option
        .setName('name')
        .setDescription('اكتب اسم الإيموجي أو جزءاً منه (مثال: نار، قلب، تاج)')
        .setRequired(true)
        .setAutocomplete(true)),
    cooldown: 2,
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase().trim();
        const choices = [];
        // 1️⃣ إيموجي السيرفر أولاً — بحث على الاسم
        if (interaction.guild) {
            for (const e of interaction.guild.emojis.cache.values()) {
                if (!e.name)
                    continue;
                if (!focused || e.name.toLowerCase().includes(focused)) {
                    choices.push({
                        name: `:${e.name}:`,
                        value: `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`,
                    });
                }
                if (choices.length >= 20)
                    break;
            }
        }
        // 2️⃣ إيموجي يونيكود الشائعة — بحث بالعربي
        for (const [ch, label] of COMMON) {
            if (choices.length >= 25)
                break;
            if (!focused || label.includes(focused)) {
                choices.push({ name: `${ch} ${label}`, value: ch });
            }
        }
        await interaction.respond(choices.slice(0, 25));
    },
    async execute(interaction) {
        const value = interaction.options.getString('name', true);
        await interaction.reply({
            content: `${value}\n\n` +
                `انسخ الإيموجي اللي فوق والصقه بأي رد تلقائي أو رسالة ✅\n` +
                `💡 *أو اكتب \`:\` واسم الإيموجي داخل رد البوت — البوت يحوّله تلقائياً*`,
            ephemeral: true,
        });
    },
};
exports.default = command;
//# sourceMappingURL=emoji.js.map