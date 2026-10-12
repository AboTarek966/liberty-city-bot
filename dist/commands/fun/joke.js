"use strict";
// ============================================
// Liberty City Bot - Joke Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const JOKES = [
    'لماذا لا يحب الحاسوب الرياضيات؟\nلأنه يخاف من المتغيرات! 😄',
    '👩‍💻 قلت للحاسوب: أحتاج مساعدة...\nقال: تمام، جرّب Ctrl+Z على حياتك! 💀',
    '👨‍🍳 لماذا سقط المبرمج من السلالم؟\nلأنه نسي إغلاق الأقواس! 📉',
    '🐸 ضفدع جلس على الشاطئ...\nقال له الثاني: "croak" — يعني؟ ولا شيء، بس يحب يصرخ! 🐸',
    '👦 قال الولد لأبوه: أبي أعمل مثلك لما أكبر...\nقال: طيب اصبر لين تكبر! 😂',
    '📚 كتابان وقعا من الرف...\nأحدهما قال: "أنا أسف" — والآخر: "أنت اعتذرت أول؟ طيب أسف أنا كمان!"',
    '🧠 الذكاء الاصطناعي دخل مقهى...\nطلب "قهوة بقدر من الأخطاء"، فأخذها مجاناً!',
    '🤖 قال روبوت لإنسان: أنت تنسى أشياء كثيرة!\nقال الإنسان: مثل ماذا؟\nقال: لا أتذكر 😅',
    '🎨 رسمة عشوائية في المعرض...\nكتب عليها زائر: "هذا فن!" — فاشتريها صاحب المعرض! 🖼️',
    '🍪 أكلت كوكيز اليوم...\nوسأكرر الجريمة غداً 🔞',
    '💤 النوم حلال...\nوالسهر ذنب... لكن المذاكرة ذنب أكبر!',
    '😂 واحد نكتة: لماذا لا يقرأ البوت النكتة القديمة؟\nلأنها buffer قديم! 📦',
    '🚗 روبوت دخل مقهى وطلب كابتشينو...\nفقال له البائع: "عندك فلوس؟" — فسحب سلك الطاقة من جيبه! 🔌',
    '☕ قهوة الصباح: تمنحني قوة أفعل فيها أشياء... لا أتذكر بعدها! ⚡',
    '👨‍👩‍👧‍👦 عائلة دخلت مطعم...\nوصاح الولد: أنا جوعان! ردت الأم: نحن هنا لأكل الطعام لا للأصوات! 🍽️',
];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('joke')
        .setDescription('😂 نكتة عربية عشوائية تضحكك'),
    cooldown: 5,
    async execute(interaction) {
        const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('😂 نكتة اليوم')
            .setColor(embeds_1.Colors.warning)
            .setDescription(joke)
            .setFooter({ text: `طلبها ${interaction.user.username} — اكتب /joke لمزيد!` })
            .setTimestamp();
        await interaction.reply({ embeds: [embed] });
    },
};
exports.default = command;
//# sourceMappingURL=joke.js.map