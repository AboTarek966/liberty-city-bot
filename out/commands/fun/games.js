"use strict";
// ============================================
// Liberty City Bot - Games Menu (قائمة الألعاب)
// اختصار لكل الألعاب في قائمة واحدة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAMES_LIST = void 0;
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
exports.GAMES_LIST = [
    // ⚔️ تحدي مباشر
    { value: 'roulette', label: '🔫 روليت', usage: '/roulette @user @user2 ... — البارودة تختار ضحية عشوائية من المشاركين' },
    { value: 'duel', label: '⚔️ مبارزة', usage: '/duel @user — معركة جولة بجولة مع شريط صحة' },
    { value: 'tug', label: '🧱 سحب الحبل', usage: '/tug @user ... — فريقان يسحبان الحبل حتى خط النهاية' },
    { value: 'dragon', label: '🐉 معركة التنين', usage: '/dragon — اهزم التنين وانقذ القرية' },
    { value: 'blackjack', label: '🃏 بلك جاك', usage: '/blackjack — سحب أو قف، اقترب من 21 دون تجاوزها' },
    { value: 'race', label: '🏁 سباق حيوانات', usage: '/race @user — سباق متحرك بين 2-6 متسابقين' },
    { value: 'xo', label: '❌⭕ إكس أو', usage: '/xo @user — تحدي لاعب في XO بالأزرار' },
    { value: 'rps', label: '🪨 ورقة حجر مقص', usage: '/rps choice:حجر|ورقة|مقص — ضد البوت' },
    { value: 'power', label: '🏋️ تدريب القوة', usage: '/power [user] — اضرب الكيس وشوف قوتك، أو واجه صديقاً' },
    // 🍀 حظ وجوائز
    { value: 'slots', label: '🎰 ماكينة الحظ', usage: '/slots amount:100 — رهان من رصيدك، ثلاث نفسية = ×5' },
    { value: 'wheel', label: '🍀 عجلة الحظ', usage: '/wheel — دوّر العجلة وشوف ماذا تربح' },
    { value: 'treasure', label: '💰 صناديق الكنز', usage: '/treasure — ثلاثة صناديق وكنز واحد، اختر بحكمة' },
    { value: 'bomb', label: '💣 اقطع السلك', usage: '/bomb — أربعة أسلاك وسلك واحد ينقذك، حدد المجموع أولاً' },
    { value: 'flip', label: '🪙 عملة', usage: '/flip — صورة أو كتابة' },
    { value: 'eightball', label: '🎱 كرة السحر', usage: '/eightball question:... — اسأل كرة السحر' },
    { value: 'highlow', label: '🎴 أعلى/أقل', usage: '/highlow amount:100 guess:high|low — فوز ×2' },
    // 🎯 مهارة ونقاط
    { value: 'fish', label: '🎣 صيد السمك', usage: '/fish — ارمِ الطعم وشوف ماذا تُصطاد (الحوت نادر!)' },
    { value: 'darts', label: '🎯 رمي السهم', usage: '/darts — ثلاث رميات، من يصل إلى القلب؟' },
    { value: 'bowling', label: '🎳 بولينغ', usage: '/bowling — ثلاث كرات لكسر الأعمدة العشرة' },
    { value: 'dice', label: '🎲 نرد', usage: '/dice — رمية نرد عشوائية' },
    // 🧠 عقل وترفيه
    { value: 'riddle', label: '🧩 لغز', usage: '/riddle — أربعة خيارات و25 ثانية، أول إجابة صحيحة يفوز' },
    { value: 'choose', label: '🤔 اختار', usage: '/choose options:... — البوت يختار من خياراتك' },
    { value: 'rate', label: '💯 قيّم', usage: '/rate thing:... — البوت يقيّم شيئاً من 0-100' },
    { value: 'joke', label: '😂 نكتة', usage: '/joke — نكتة عشوائية' },
    { value: 'poll', label: '🗳️ تصويت', usage: '/poll question:... options:... — تصويت بالأزرار' },
];
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('games')
        .setDescription('🎮 قائمة الألعاب — اختر لعبة من القائمة!')
        .setDMPermission(false),
    cooldown: 3,
    async execute(interaction) {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(embeds_1.Colors.primary)
            .setTitle('🎮 قائمة الألعاب')
            .setDescription(`**اختر لعبة من القائمة بالأسفل** — توصلك طريقة اللعب فوراً\n\n` +
            exports.GAMES_LIST.map(g => `${g.label}`).join('  •  '));
        const select = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId('games_menu')
            .setPlaceholder('🎮 اختر لعبة')
            .addOptions(exports.GAMES_LIST.slice(0, 25).map(g => ({
            label: g.label.replace(/^\S+\s/, ''),
            description: g.usage.substring(0, 90),
            value: g.value,
            emoji: g.label.match(/^(\S+)/)?.[1],
        })));
        await interaction.reply({
            embeds: [embed],
            components: [new discord_js_1.ActionRowBuilder().addComponents(select)],
        });
    },
};
exports.default = command;
//# sourceMappingURL=games.js.map