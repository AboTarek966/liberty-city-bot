"use strict";
// ============================================
// Liberty City Bot - Interactive Games Button (ألعاب الأزرار)
// يخدم 4 ألعاب عبر بادئة واحدة: fun:<لعبة>:<id>:<اختيار>
//   fun:riddle    → لغز (أول إجابة صحيحة يفوز)
//   fun:treasure  → صناديق الكنز (أول ضغطة تكشف)
//   fun:bomb      → اقطع السلك (سلك واحد صحيح)
//   fun:bj        → بلك جاك (سحب / قف)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const funGameState_1 = require("../../utils/funGameState");
const blackjack_1 = require("../../utils/blackjack");
const CHEST_EMOJI = ['📦', '🎁', '🗃️'];
const WIRE_EMOJI = ['🔴', '🔵', '🟢', '🟡'];
const handler = {
    id: 'fun',
    async execute(interaction) {
        await interaction.deferUpdate(); // ✅ فوراً
        const [, kind, id, arg] = interaction.customId.split(':');
        const state = (0, funGameState_1.getFunState)(id);
        if (!state || state.kind !== kind) {
            await interaction
                .followUp({ content: '⌛ انتهت هذه الجولة — ابدأ لعبة جديدة بالأمر', ephemeral: true })
                .catch(() => { });
            return;
        }
        switch (kind) {
            case 'riddle':
                return riddlePlay(interaction, id, state.data, Number.parseInt(arg, 10));
            case 'treasure':
                return treasurePlay(interaction, id, state.data, Number.parseInt(arg, 10));
            case 'bomb':
                return bombPlay(interaction, id, state.data, Number.parseInt(arg, 10));
            case 'bj':
                return blackjackPlay(interaction, id, state.data, arg);
            default:
                await interaction.followUp({ content: '❌ لعبة غير معروفة', ephemeral: true }).catch(() => { });
        }
    },
};
/** إقفال الجولة بعد الحسم */
function close(id) {
    (0, funGameState_1.delFunState)(id);
}
// --------------------------------------------
// 🧩 اللغز
// --------------------------------------------
async function riddlePlay(interaction, id, data, idx) {
    if (data.done) {
        await interaction.followUp({ content: '⏳ أُجابت بالفعل!', ephemeral: true }).catch(() => { });
        return;
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= data.options.length)
        return;
    if (idx === data.answer) {
        data.done = true;
        close(id);
        await interaction
            .editReply({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(embeds_1.Colors.success)
                    .setTitle('✅ إجابة صحيحة!')
                    .setDescription(`**${data.q}**\n\n🏆 <@${interaction.user.id}> أجاب **${data.options[data.answer]}** — أول من أمسك الجواب!`),
            ],
            components: [],
        })
            .catch(() => { });
        return;
    }
    await interaction
        .followUp({
        content: `❌ إجابة خاطئة (${data.options[idx]}) — حاول مرة ثانية!`,
        ephemeral: true,
    })
        .catch(() => { });
}
// --------------------------------------------
// 💰 صناديق الكنز
// --------------------------------------------
async function treasurePlay(interaction, id, data, idx) {
    if (data.taken) {
        await interaction
            .followUp({ content: '⏳ انكشف الصناديق من قبل شخص آخر!', ephemeral: true })
            .catch(() => { });
        return;
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= CHEST_EMOJI.length)
        return;
    data.taken = true;
    const won = idx === data.prizeIdx;
    close(id);
    const reveal = CHEST_EMOJI.map((e, i) => `${e} الصندوق ${i + 1} — ${i === data.prizeIdx ? '💎 **الكنز هنا!**' : 'فارغ'}`).join('\n');
    await interaction
        .editReply({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(won ? embeds_1.Colors.success : embeds_1.Colors.error)
                .setTitle(won ? '💎 وجدت الكنز!' : '💀 الصندوق فارغ!')
                .setDescription(`${reveal}\n\n` +
                (won
                    ? `🏆 <@${interaction.user.id}> اختار الصندوق الصحيح وأمسك الكنز!`
                    : `<@${interaction.user.id}> اختار الصندوق ${idx + 1} — كان فارغاً والكنز في **${data.prizeIdx + 1}**`)),
        ],
        components: [],
    })
        .catch(() => { });
}
// --------------------------------------------
// 💣 قطع السلك
// --------------------------------------------
async function bombPlay(interaction, id, data, idx) {
    if (data.done) {
        await interaction.followUp({ content: '⏳ تم قطع سلك بالفعل!', ephemeral: true }).catch(() => { });
        return;
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= data.labels.length)
        return;
    data.done = true;
    const safe = idx === data.correct;
    close(id);
    const wires = data.labels
        .map((l, i) => `${WIRE_EMOJI[i]} \`${l}\` ${i === data.correct ? '← **هذا هو**' : ''}`)
        .join('  •  ');
    await interaction
        .editReply({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(safe ? embeds_1.Colors.success : embeds_1.Colors.error)
                .setTitle(safe ? '✂️ قطعت السلك الصحيح!' : '💥 انفجرت!')
                .setDescription((safe
                ? `✂️ <@${interaction.user.id}> قطع السلك الصحيح (\`=${data.target}\`) ووقفت القنبلة!`
                : `💥 <@${interaction.user.id}> قطع سلكاً خاطئاً — الانفجار واجهك!`) +
                `\n\n${wires}`),
        ],
        components: [],
    })
        .catch(() => { });
}
// --------------------------------------------
// 🃏 بلك جاك
// --------------------------------------------
async function blackjackPlay(interaction, id, data, action) {
    if (data.done) {
        await interaction
            .followUp({ content: '⏳ انتهت اليد — ابدأ لعبة جديدة', ephemeral: true })
            .catch(() => { });
        return;
    }
    if (action === 'hit') {
        const card = data.deck.pop();
        if (card)
            data.player.push(card);
        const pv = (0, blackjack_1.handValue)(data.player);
        if (pv > 21)
            return bjFinish(interaction, id, data, 'bust');
        if (pv === 21) {
            (0, blackjack_1.dealerDraw)(data.dealer, data.deck);
            return bjFinish(interaction, id, data, 'compare');
        }
        return bjRender(interaction, data);
    }
    if (action === 'stand') {
        (0, blackjack_1.dealerDraw)(data.dealer, data.deck);
        return bjFinish(interaction, id, data, 'compare');
    }
}
async function bjRender(interaction, data) {
    await interaction
        .editReply({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(embeds_1.Colors.primary)
                .setTitle('🃏 بلك جاك — دورك')
                .setDescription(`✋ يدك: **${(0, blackjack_1.renderHand)(data.player)} = ${(0, blackjack_1.handValue)(data.player)}**\n` +
                `🎩 يد الموزع: **${(0, blackjack_1.renderHand)(data.dealer, true)} = ?**\n\n` +
                `اجمع **21** أو اقترب منها — تجاوزها وخسرت.`),
        ],
    })
        .catch(() => { });
}
async function bjFinish(interaction, id, data, mode) {
    data.done = true;
    close(id);
    const pv = (0, blackjack_1.handValue)(data.player);
    const dv = (0, blackjack_1.handValue)(data.dealer);
    let title;
    let color;
    let verdict;
    if (mode === 'bust') {
        title = '💀 تجاوزت 21!';
        color = embeds_1.Colors.error;
        verdict = 'الموزع يفوز — أكثر من 21 يعني الخسارة مباشرة.';
    }
    else if (dv > 21) {
        title = '🎉 الموزع تجاوز 21!';
        color = embeds_1.Colors.success;
        verdict = `🏆 <@${interaction.user.id}> فاز!`;
    }
    else if (pv > dv) {
        title = '🏆 فوز!';
        color = embeds_1.Colors.success;
        verdict = `🏆 <@${interaction.user.id}> فاز بـ ${pv} مقابل ${dv}!`;
    }
    else if (pv < dv) {
        title = '💀 الموزع فاز';
        color = embeds_1.Colors.error;
        verdict = `🎩 الموزع فاز بـ ${dv} مقابل ${pv}.`;
    }
    else {
        title = '🤝 تعادل';
        color = embeds_1.Colors.warning;
        verdict = `تعادل ${pv} - ${dv} — يعود الرهان لك.`;
    }
    await interaction
        .editReply({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(color)
                .setTitle(`🃏 ${title}`)
                .setDescription(`✋ يدك: **${(0, blackjack_1.renderHand)(data.player)} = ${pv}**\n` +
                `🎩 يد الموزع: **${(0, blackjack_1.renderHand)(data.dealer)} = ${dv}**\n\n${verdict}`),
        ],
        components: [],
    })
        .catch(() => { });
}
exports.default = handler;
//# sourceMappingURL=funGames.js.map