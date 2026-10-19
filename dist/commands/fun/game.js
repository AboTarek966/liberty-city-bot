"use strict";
// ============================================
// Liberty City Bot - Game Commands
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('GameCommand');
const gameCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('game')
        .setDescription('الألعاب الجماعية')
        .addSubcommand(subcommand => subcommand
        .setName('uno')
        .setDescription('لعبة UNO الورقية')
        .addIntegerOption(option => option.setName('bet').setDescription('الرهان (اختياري)').setRequired(false).setMinValue(0))
        .addIntegerOption(option => option.setName('players').setDescription('عدد اللاعبين (2-10)').setRequired(false).setMinValue(2).setMaxValue(10)))
        .addSubcommand(subcommand => subcommand
        .setName('trivia')
        .setDescription('لعبة الأسئلة العامة')
        .addIntegerOption(option => option.setName('bet').setDescription('الرهان (اختياري)').setRequired(false).setMinValue(0)))
        .addSubcommand(subcommand => subcommand
        .setName('wordle')
        .setDescription('تخمين الكلمة (5 حروف، 6 محاولات)')
        .addIntegerOption(option => option.setName('bet').setDescription('الرهان (اختياري)').setRequired(false).setMinValue(0)))
        .addSubcommand(subcommand => subcommand
        .setName('blackjack')
        .setDescription('لعبة 21 (بلاك جاك)')
        .addIntegerOption(option => option.setName('bet').setDescription('الرهان (إجباري)').setRequired(true).setMinValue(100)))
        .addSubcommand(subcommand => subcommand
        .setName('connect4')
        .setDescription('لعبة 4 في صف')
        .addUserOption(option => option.setName('opponent').setDescription('المنافس').setRequired(true))
        .addIntegerOption(option => option.setName('bet').setDescription('الرهان (اختياري)').setRequired(false).setMinValue(0)))
        .addSubcommand(subcommand => subcommand
        .setName('join')
        .setDescription('الانضمام للعبة في القناة الحالية'))
        .addSubcommand(subcommand => subcommand
        .setName('leave')
        .setDescription('مغادرة اللعبة الحالية'))
        .addSubcommand(subcommand => subcommand
        .setName('start')
        .setDescription('بدء اللعبة (للمضيف فقط)'))
        .addSubcommand(subcommand => subcommand
        .setName('status')
        .setDescription('حالة اللعبة الحالية في القناة'))
        .setDMPermission(false),
    async execute(interaction) {
        const client = interaction.client;
        const gameHandler = client.gameHandler;
        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: false });
        try {
            const guild = interaction.guild;
            const member = interaction.member;
            switch (subcommand) {
                case 'uno': {
                    const bet = interaction.options.getInteger('bet') || 0;
                    const maxPlayers = interaction.options.getInteger('players') || 10;
                    if (bet > 0) {
                        const profile = await client.economyHandler.getProfile(guild.id, member.id);
                        if (profile.balance < bet) {
                            await interaction.editReply({ content: `❌ رصيد غير كافي. المطلوب: ${bet}` });
                            return;
                        }
                    }
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (existing && existing.status !== 'finished') {
                        await interaction.editReply({ content: '❌ يوجد لعبة جارية في هذه القناة' });
                        return;
                    }
                    const session = gameHandler.createSession('uno', guild.id, interaction.channelId, member.id, bet);
                    session.maxPlayers = Math.min(Math.max(2, maxPlayers), 10);
                    session.minPlayers = 2;
                    await gameHandler.joinSession(session.id, member.user);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🎮 لعبة UNO جديدة!')
                        .setColor(discord_js_1.Colors.Blue)
                        .setDescription(`أنشئت بواسطة ${member}`)
                        .addFields({ name: '💰 الرهان', value: bet > 0 ? bet.toLocaleString() : 'بدون رهان', inline: true }, { name: '👥 اللاعبين', value: `${session.players.length}/${session.maxPlayers}`, inline: true }, { name: '🎯 للاشتراك', value: 'اكتب `/game join`', inline: true })
                        .setFooter({ text: 'لبدء اللعبة: /game start' })
                        .setTimestamp();
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId(`game_join:${session.id}`)
                        .setLabel('الانضمام')
                        .setStyle(discord_js_1.ButtonStyle.Success)
                        .setEmoji('🎮'), new discord_js_1.ButtonBuilder()
                        .setCustomId(`game_start:${session.id}`)
                        .setLabel('بدء اللعبة')
                        .setStyle(discord_js_1.ButtonStyle.Primary)
                        .setEmoji('▶️'), new discord_js_1.ButtonBuilder()
                        .setCustomId(`game_leave:${session.id}`)
                        .setLabel('مغادرة')
                        .setStyle(discord_js_1.ButtonStyle.Danger)
                        .setEmoji('🚪'));
                    await interaction.editReply({ embeds: [embed], components: [row] });
                    break;
                }
                case 'trivia': {
                    const bet = interaction.options.getInteger('bet') || 0;
                    if (bet > 0) {
                        const profile = await client.economyHandler.getProfile(guild.id, member.id);
                        if (profile.balance < bet) {
                            await interaction.editReply({ content: `❌ رصيد غير كافي. المطلوب: ${bet}` });
                            return;
                        }
                    }
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (existing && existing.status !== 'finished') {
                        await interaction.editReply({ content: '❌ يوجد لعبة جارية في هذه القناة' });
                        return;
                    }
                    const session = gameHandler.createSession('trivia', guild.id, interaction.channelId, member.id, bet);
                    session.maxPlayers = 20;
                    session.minPlayers = 1;
                    await gameHandler.joinSession(session.id, member.user);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🧠 لعبة Trivia!')
                        .setColor(discord_js_1.Colors.Purple)
                        .setDescription(`أنشئت بواسطة ${member}\nأجب على 10 أسئلة في 30 ثانية لكل سؤال`)
                        .addFields({ name: '💰 الرهان', value: bet > 0 ? bet.toLocaleString() : 'بدون رهان', inline: true }, { name: '👥 اللاعبين', value: `${session.players.length}/${session.maxPlayers}`, inline: true }, { name: '🎯 للاشتراك', value: 'اكتب `/game join`', inline: true })
                        .setFooter({ text: 'لبدء اللعبة: /game start' })
                        .setTimestamp();
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId(`game_join:${session.id}`)
                        .setLabel('الانضمام')
                        .setStyle(discord_js_1.ButtonStyle.Success)
                        .setEmoji('🧠'), new discord_js_1.ButtonBuilder()
                        .setCustomId(`game_start:${session.id}`)
                        .setLabel('بدء اللعبة')
                        .setStyle(discord_js_1.ButtonStyle.Primary)
                        .setEmoji('▶️'), new discord_js_1.ButtonBuilder()
                        .setCustomId(`game_leave:${session.id}`)
                        .setLabel('مغادرة')
                        .setStyle(discord_js_1.ButtonStyle.Danger)
                        .setEmoji('🚪'));
                    await interaction.editReply({ embeds: [embed], components: [row] });
                    break;
                }
                case 'wordle': {
                    const bet = interaction.options.getInteger('bet') || 0;
                    if (bet > 0) {
                        const profile = await client.economyHandler.getProfile(guild.id, member.id);
                        if (profile.balance < bet) {
                            await interaction.editReply({ content: `❌ رصيد غير كافي. المطلوب: ${bet}` });
                            return;
                        }
                    }
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (existing && existing.status !== 'finished') {
                        await interaction.editReply({ content: '❌ يوجد لعبة جارية في هذه القناة' });
                        return;
                    }
                    const session = gameHandler.createSession('wordle', guild.id, interaction.channelId, member.id, bet);
                    session.maxPlayers = 1;
                    session.minPlayers = 1;
                    await gameHandler.joinSession(session.id, member.user);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🔤 لعبة Wordle!')
                        .setColor(discord_js_1.Colors.Green)
                        .setDescription(`أنشئت بواسطة ${member}\nخمن الكلمة (5 حروف) في 6 محاولات`)
                        .addFields({ name: '💰 الرهان', value: bet > 0 ? bet.toLocaleString() : 'بدون رهان', inline: true }, { name: '👤 اللاعب', value: member.user.username, inline: true })
                        .setFooter({ text: 'استخدم /game guess <كلمة> للتخمين' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'blackjack': {
                    const bet = interaction.options.getInteger('bet', true);
                    const profile = await client.economyHandler.getProfile(guild.id, member.id);
                    if (profile.balance < bet) {
                        await interaction.editReply({ content: `❌ رصيد غير كافي. المطلوب: ${bet}` });
                        return;
                    }
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (existing && existing.status !== 'finished') {
                        await interaction.editReply({ content: '❌ يوجد لعبة جارية في هذه القناة' });
                        return;
                    }
                    const session = gameHandler.createSession('blackjack', guild.id, interaction.channelId, member.id, bet);
                    session.maxPlayers = 7;
                    session.minPlayers = 1;
                    await gameHandler.joinSession(session.id, member.user);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🃏 لعبة Blackjack!')
                        .setColor(discord_js_1.Colors.Gold)
                        .setDescription(`أنشئت بواسطة ${member}\nالرهان: ${bet.toLocaleString()}`)
                        .addFields({ name: '💰 الرهان', value: bet.toLocaleString(), inline: true }, { name: '👤 اللاعب', value: member.user.username, inline: true })
                        .setFooter({ text: 'اللعبة ستبدأ فوراً' })
                        .setTimestamp();
                    // Auto-start blackjack (single player vs dealer)
                    await client.gameHandler.startGame(session.id);
                    const gameState = session.state;
                    const playerHand = gameState.playerHands[member.id];
                    const embed2 = new discord_js_1.EmbedBuilder()
                        .setTitle('🃏 Blackjack - دورك')
                        .setColor(discord_js_1.Colors.Gold)
                        .setDescription(`بطاقاتك: ${playerHand.cards.map((c) => `${c.value}${c.suit}`).join(' | ')} (المجموع: ${getHandValue(playerHand.cards)})\nبطاقة الموزع المكشوفة: ${gameState.dealerUpCard?.value}${gameState.dealerUpCard?.suit}`)
                        .addFields({ name: '💰 الرهان', value: bet.toLocaleString(), inline: true }, { name: '🎯 رصيدك', value: member.user.username, inline: true })
                        .setTimestamp();
                    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                        .setCustomId(`bj_hit:${session.id}`)
                        .setLabel('Hit (سحب بطاقة)')
                        .setStyle(discord_js_1.ButtonStyle.Primary)
                        .setEmoji('🃏'), new discord_js_1.ButtonBuilder()
                        .setCustomId(`bj_stand:${session.id}`)
                        .setLabel('Stand (تثبيت)')
                        .setStyle(discord_js_1.ButtonStyle.Secondary)
                        .setEmoji('✋'), new discord_js_1.ButtonBuilder()
                        .setCustomId(`bj_double:${session.id}`)
                        .setLabel('Double Down')
                        .setStyle(discord_js_1.ButtonStyle.Success)
                        .setEmoji('💰'));
                    await interaction.editReply({ embeds: [embed2], components: [row] });
                    break;
                }
                case 'connect4': {
                    const opponent = interaction.options.getUser('opponent', true);
                    const bet = interaction.options.getInteger('bet') || 0;
                    if (opponent.id === member.id) {
                        await interaction.editReply({ content: '❌ لا يمكنك اللعب ضد نفسك' });
                        return;
                    }
                    if (opponent.bot) {
                        await interaction.editReply({ content: '❌ لا يمكنك اللعب ضد بوت' });
                        return;
                    }
                    if (bet > 0) {
                        const profile = await client.economyHandler.getProfile(guild.id, member.id);
                        if (profile.balance < bet) {
                            await interaction.editReply({ content: `❌ رصيد غير كافي. المطلوب: ${bet}` });
                            return;
                        }
                        const oppProfile = await client.economyHandler.getProfile(guild.id, opponent.id);
                        if (oppProfile.balance < bet) {
                            await interaction.editReply({ content: `❌ ${opponent.username} رصيده غير كافي` });
                            return;
                        }
                    }
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (existing && existing.status !== 'finished') {
                        await interaction.editReply({ content: '❌ يوجد لعبة جارية في هذه القناة' });
                        return;
                    }
                    const session = gameHandler.createSession('connect4', guild.id, interaction.channelId, member.id, bet);
                    session.maxPlayers = 2;
                    session.minPlayers = 2;
                    await gameHandler.joinSession(session.id, member.user);
                    await gameHandler.joinSession(session.id, opponent);
                    // Assign colors
                    session.players[0].data.color = '🔴';
                    session.players[1].data.color = '🟡';
                    await client.gameHandler.startGame(session.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🔴🟡 Connect 4!')
                        .setColor(discord_js_1.Colors.Blue)
                        .setDescription(`${member} (🔴) vs ${opponent} (🟡)\nدور: ${session.players[session.state.currentPlayer].username}`)
                        .setTimestamp();
                    // Show board
                    const board = renderConnect4Board(session.state.board);
                    const embed2 = new discord_js_1.EmbedBuilder()
                        .setTitle('🔴🟡 Connect 4 - دورك')
                        .setColor(discord_js_1.Colors.Blue)
                        .setDescription(board)
                        .setFooter({ text: `دور: ${session.players[session.state.currentPlayer].username} (${session.players[session.state.currentPlayer].data.color})` })
                        .setTimestamp();
                    // Create column buttons
                    const components = [];
                    for (let row = 0; row < 2; row++) {
                        const rowButtons = new discord_js_1.ActionRowBuilder();
                        for (let col = row * 4; col < Math.min((row + 1) * 4, 7); col++) {
                            rowButtons.addComponents(new discord_js_1.ButtonBuilder()
                                .setCustomId(`c4_drop:${session.id}:${col}`)
                                .setLabel(`${col + 1}`)
                                .setStyle(discord_js_1.ButtonStyle.Primary));
                        }
                        components.push(rowButtons);
                    }
                    await interaction.editReply({ embeds: [embed2], components });
                    break;
                }
                case 'join': {
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (!existing || existing.status !== 'waiting') {
                        await interaction.editReply({ content: '❌ لا يوجد لعبة في انتظار لاعبين في هذه القناة' });
                        return;
                    }
                    const result = await gameHandler.joinSession(existing.id, member.user);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(result.success ? '✅ انضممت للعبة!' : '❌ لم تستطع الانضمام')
                        .setColor(result.success ? discord_js_1.Colors.Green : discord_js_1.Colors.Red)
                        .setDescription(result.message)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'leave': {
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (!existing) {
                        await interaction.editReply({ content: '❌ لا يوجد لعبة في هذه القناة' });
                        return;
                    }
                    const result = await gameHandler.leaveSession(existing.id, member.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(result.success ? '🚪 غادرت اللعبة' : '❌ لم تستطع المغادرة')
                        .setColor(result.success ? discord_js_1.Colors.Green : discord_js_1.Colors.Red)
                        .setDescription(result.message)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'start': {
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (!existing) {
                        await interaction.editReply({ content: '❌ لا يوجد لعبة في هذه القناة' });
                        return;
                    }
                    if (existing.hostId !== member.id) {
                        await interaction.editReply({ content: '❌ فقط المضيف يمكنه بدء اللعبة' });
                        return;
                    }
                    const result = await client.gameHandler.startGame(existing.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(result.success ? '▶️ بدأت اللعبة!' : '❌ لم تستطع البدء')
                        .setColor(result.success ? discord_js_1.Colors.Green : discord_js_1.Colors.Red)
                        .setDescription(result.message)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'status': {
                    const existing = gameHandler.getSessionByChannel(interaction.channelId);
                    if (!existing) {
                        await interaction.editReply({ content: '❌ لا يوجد لعبة في هذه القناة' });
                        return;
                    }
                    const statusMap = {
                        waiting: '⏳ في انتظار اللاعبين',
                        active: '🎮 جارية',
                        finished: '🏁 منتهية',
                        cancelled: '❌ ملغية'
                    };
                    const statusText = statusMap[existing.status] || 'غير معروف';
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🎮 حالة اللعبة')
                        .setColor(discord_js_1.Colors.Blue)
                        .addFields({ name: 'النوع', value: existing.type, inline: true }, { name: 'الحالة', value: statusText, inline: true }, { name: 'اللاعبين', value: `${existing.players.length}/${existing.maxPlayers}`, inline: true }, { name: 'الرهان', value: existing.bet > 0 ? existing.bet.toLocaleString() : 'بدون', inline: true }, { name: 'الجائزة', value: existing.pot > 0 ? existing.pot.toLocaleString() : 'لا يوجد', inline: true }, { name: 'اللاعبين', value: existing.players.map((p) => `${p.username} (${p.status})`).join('\n') || 'لا يوجد' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
            }
        }
        catch (error) {
            logger.error(`Game command error: ${error.message}`);
            await interaction.editReply({ content: `❌ ${error.message}` });
        }
    },
};
// ============================================
// Helper Functions (standalone to avoid Command interface issues)
// ============================================
function getHandValue(cards) {
    let value = 0;
    let aces = 0;
    for (const card of cards) {
        if (card.value === 'A') {
            aces++;
            value += 11;
        }
        else if (['J', 'Q', 'K'].includes(card.value)) {
            value += 10;
        }
        else {
            value += parseInt(card.value);
        }
    }
    while (value > 21 && aces > 0) {
        value -= 10;
        aces--;
    }
    return value;
}
function renderConnect4Board(board) {
    let str = '  1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣\n';
    for (let row = 0; row < 6; row++) {
        str += board[row].map(cell => cell || '⚪').join(' ') + '\n';
    }
    return `\`\`\`\n${str}\`\`\``;
}
exports.default = gameCommand;
//# sourceMappingURL=game.js.map