"use strict";
// ============================================
// Liberty City Bot - Music Generation Command
// توليد موسيقى بالذكاء الاصطناعي — مجاني بالكامل عبر Hugging Face Spaces
// يتطلب HF_TOKEN (حساب Hugging Face مجاني — بلا بطاقة ائتمان)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const mediaGen_1 = require("../../utils/mediaGen");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('music')
        .setDescription('توليد موسيقى بالذكاء الاصطناعي (مجاني)')
        .addStringOption((opt) => opt
        .setName('prompt')
        .setDescription('وصف اللحن — بالعربي أو الإنجليزي (الإنجليزي أدق)')
        .setRequired(true)
        .setMaxLength(400))
        .addIntegerOption((opt) => opt
        .setName('seconds')
        .setDescription('مدة المقطع بالثواني (1-60)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(60)),
    cooldown: 15,
    async execute(interaction) {
        const avail = (0, mediaGen_1.mediaGenAvailable)();
        if (!avail.music) {
            await interaction.reply({ content: `❌ توليد الموسيقى غير مفعّل — ${avail.reason}` });
            return;
        }
        const prompt = interaction.options.getString('prompt', true).trim();
        if (prompt.length < 3) {
            await interaction.reply({ content: '❌ اكتب وصفاً أوضح للحن (٣ أحرف على الأقل).' });
            return;
        }
        const seconds = interaction.options.getInteger('seconds') ?? 15;
        const short = prompt.length > 100 ? prompt.slice(0, 100) + '…' : prompt;
        await interaction.deferReply();
        const music = await (0, mediaGen_1.generateMusic)(prompt, { seconds });
        if (!music) {
            await interaction.editReply('❌ فشل توليد الموسيقى — قد تكون المساحة المجانية مشغولة الآن. حاول بعد دقيقة.');
            return;
        }
        await interaction.editReply({
            content: `🎵 **${short}**`,
            files: [{ attachment: music.data, name: `music.${music.ext}` }],
        });
    },
};
exports.default = command;
//# sourceMappingURL=music.js.map