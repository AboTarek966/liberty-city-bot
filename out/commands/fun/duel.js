"use strict";
// ============================================
// Liberty City Bot - Duel (مبارزة)
// معركة جولة بجولة مع شريط صحة متحرك
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const gameUtil_1 = require("../../utils/gameUtil");
const MAX_HP = 100;
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('duel')
        .setDescription('⚔️ مبارزة — تحدَّ صديقاً في معركة جولة بجولة!')
        .addUserOption(opt => opt.setName('user').setDescription('الخصم الأول').setRequired(false))
        .addUserOption(opt => opt.setName('user2').setDescription('خصم ثانٍ (لعبة ثلاثية)').setRequired(false))
        .setDMPermission(false),
    cooldown: 10,
    async execute(interaction) {
        await interaction.deferReply();
        const ids = [];
        for (const key of ['user', 'user2']) {
            const u = interaction.options.getUser(key);
            if (u && !u.bot && !ids.includes(u.id))
                ids.push(u.id);
        }
        if (!ids.includes(interaction.user.id))
            ids.unshift(interaction.user.id);
        if (ids.length < 2) {
            const members = interaction.guild.members.cache.filter(m => !m.user.bot && m.id !== interaction.user.id);
            const random = (0, gameUtil_1.shuffle)(members.map(m => m.id))[0];
            if (random)
                ids.push(random);
        }
        if (ids.length < 2) {
            await interaction.editReply({ content: '❌ المبارزة تحتاج خصماً واحداً على الأقل' });
            return;
        }
        const fighters = ids.map(id => ({ id, hp: MAX_HP }));
        const board = (phase) => `${phase} • ` + fighters.map(f => `<@${f.id}> ${(0, gameUtil_1.hpBar)(f.hp, MAX_HP, 6)} ${f.hp}`).join(' • ');
        await interaction.editReply({ content: `⚔️ ${board('المبارزة بدأت!')}` }).catch(() => { });
        await (0, gameUtil_1.sleep)(900);
        let round = 0;
        while (fighters.filter(f => f.hp > 0).length > 1 && round < 30) {
            round++;
            // كل المبارزين يضربون في نفس الجولة (إلا المنهوكين)
            const alive = fighters.filter(f => f.hp > 0);
            for (const attacker of alive) {
                const targets = fighters.filter(f => f !== attacker && f.hp > 0);
                if (!targets.length)
                    break;
                const target = targets[Math.floor(Math.random() * targets.length)];
                const dmg = 12 + Math.floor(Math.random() * 20);
                target.hp = Math.max(0, target.hp - dmg);
            }
            await interaction.editReply({ content: board(`الجولة ${round}`) }).catch(() => { });
            await (0, gameUtil_1.sleep)(780);
        }
        const survivors = fighters.filter(f => f.hp > 0);
        const result = survivors.length === 1
            ? `🏆 **<@${survivors[0].id}>** فاز بالمبارزة بعد ${round} جولة! 🎉`
            : `🤝 تعادل بعد ${round} جولة!`;
        await interaction.editReply({
            content: `${result} • ` + fighters
                .map(f => `<@${f.id}> ${f.hp}/${MAX_HP}`)
                .join(' • '),
        }).catch(() => { });
    },
};
exports.default = command;
//# sourceMappingURL=duel.js.map