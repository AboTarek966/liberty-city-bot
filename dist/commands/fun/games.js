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
    { value: 'roulette', label: '🔫 روليت', usage: '/roulette @user @user2 ... — البارودة تختار ضحية عشوائية من المشاركين' },
    { value: 'race', label: '🏁 سباق حيوانات', usage: '/race @user — سباق متحرك بين 2-6 متسابقين' },
    { value: 'xo', label: '❌⭕ إكس أو', usage: '/xo @user — تحدي لاعب في XO بالأزرار' },
    { value: 'rps', label: '🪨 ورقة حجر مقص', usage: '/rps choice:حجر|ورقة|مقص — ضد البوت' },
    { value: 'slots', label: '🎰 ماكينة الحظ', usage: '/slots amount:100 — رهان من رصيدك، ثلاث نفسية = ×5' },
    { value: 'highlow', label: '🎴 أعلى/أقل', usage: '/highlow amount:100 guess:high|low — فوز ×2' },
    { value: 'dice', label: '🎲 نرد', usage: '/dice — رمية نرد عشوائية' },
    { value: 'flip', label: '🪙 عملة', usage: '/flip — صورة أو كتابة' },
    { value: 'eightball', label: '🎱 كرة السحر', usage: '/eightball question:... — اسأل كرة السحر' },
    { value: 'joke', label: '😂 نكتة', usage: '/joke — نكتة عشوائية' },
    { value: 'rate', label: '💯 قيّم', usage: '/rate thing:... — البوت يقيّم شيئاً من 0-100' },
    { value: 'choose', label: '🤔 اختار', usage: '/choose options:... — البوت يختار من خياراتك' },
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
            exports.GAMES_LIST.map(g => `${g.label}`).join('  •  '))
            .setFooter({ text: 'بعض الألعاب تستخدم رصيدك — اجمعه بـ /daily والنشر' })
            .setTimestamp();
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