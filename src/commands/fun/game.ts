// ============================================
// Liberty City Bot - Game Commands
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  User,
  GuildMember,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  Colors,
  Message,
  TextChannel,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { GameHandler, GameSession } from '../../handlers/GameHandler';
import { LibertyClient } from '../../LibertyClient';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('GameCommand');

const gameCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('الألعاب الجماعية')
    .addSubcommand(subcommand =>
      subcommand
        .setName('uno')
        .setDescription('لعبة UNO الورقية')
        .addIntegerOption(option =>
          option.setName('bet').setDescription('الرهان (اختياري)').setRequired(false).setMinValue(0)
        )
        .addIntegerOption(option =>
          option.setName('players').setDescription('عدد اللاعبين (2-10)').setRequired(false).setMinValue(2).setMaxValue(10)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('trivia')
        .setDescription('لعبة الأسئلة العامة')
        .addIntegerOption(option =>
          option.setName('bet').setDescription('الرهان (اختياري)').setRequired(false).setMinValue(0)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('wordle')
        .setDescription('تخمين الكلمة (5 حروف، 6 محاولات)')
        .addIntegerOption(option =>
          option.setName('bet').setDescription('الرهان (اختياري)').setRequired(false).setMinValue(0)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('blackjack')
        .setDescription('لعبة 21 (بلاك جاك)')
        .addIntegerOption(option =>
          option.setName('bet').setDescription('الرهان (إجباري)').setRequired(true).setMinValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('connect4')
        .setDescription('لعبة 4 في صف')
        .addUserOption(option =>
          option.setName('opponent').setDescription('المنافس').setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('bet').setDescription('الرهان (اختياري)').setRequired(false).setMinValue(0)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('الانضمام للعبة في القناة الحالية')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('leave')
        .setDescription('مغادرة اللعبة الحالية')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('start')
        .setDescription('بدء اللعبة (للمضيف فقط)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('حالة اللعبة الحالية في القناة')
    )
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as any;
    const gameHandler = client.gameHandler;
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({ ephemeral: false });

    try {
      const guild = interaction.guild!;
      const member = interaction.member as GuildMember;

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

          const embed = new EmbedBuilder()
            .setTitle('🎮 لعبة UNO جديدة!')
            .setColor(Colors.Blue)
            .setDescription(`أنشئت بواسطة ${member}`)
            .addFields(
              { name: '💰 الرهان', value: bet > 0 ? bet.toLocaleString() : 'بدون رهان', inline: true },
              { name: '👥 اللاعبين', value: `${session.players.length}/${session.maxPlayers}`, inline: true },
              { name: '🎯 للاشتراك', value: 'اكتب `/game join`', inline: true }
            )
            .setFooter({ text: 'لبدء اللعبة: /game start' })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`game_join:${session.id}`)
              .setLabel('الانضمام')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🎮'),
            new ButtonBuilder()
              .setCustomId(`game_start:${session.id}`)
              .setLabel('بدء اللعبة')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('▶️'),
            new ButtonBuilder()
              .setCustomId(`game_leave:${session.id}`)
              .setLabel('مغادرة')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🚪')
          );

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

          const embed = new EmbedBuilder()
            .setTitle('🧠 لعبة Trivia!')
            .setColor(Colors.Purple)
            .setDescription(`أنشئت بواسطة ${member}\nأجب على 10 أسئلة في 30 ثانية لكل سؤال`)
            .addFields(
              { name: '💰 الرهان', value: bet > 0 ? bet.toLocaleString() : 'بدون رهان', inline: true },
              { name: '👥 اللاعبين', value: `${session.players.length}/${session.maxPlayers}`, inline: true },
              { name: '🎯 للاشتراك', value: 'اكتب `/game join`', inline: true }
            )
            .setFooter({ text: 'لبدء اللعبة: /game start' })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`game_join:${session.id}`)
              .setLabel('الانضمام')
              .setStyle(ButtonStyle.Success)
              .setEmoji('🧠'),
            new ButtonBuilder()
              .setCustomId(`game_start:${session.id}`)
              .setLabel('بدء اللعبة')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('▶️'),
            new ButtonBuilder()
              .setCustomId(`game_leave:${session.id}`)
              .setLabel('مغادرة')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🚪')
          );

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

          const embed = new EmbedBuilder()
            .setTitle('🔤 لعبة Wordle!')
            .setColor(Colors.Green)
            .setDescription(`أنشئت بواسطة ${member}\nخمن الكلمة (5 حروف) في 6 محاولات`)
            .addFields(
              { name: '💰 الرهان', value: bet > 0 ? bet.toLocaleString() : 'بدون رهان', inline: true },
              { name: '👤 اللاعب', value: member.user.username, inline: true }
            )
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

          const embed = new EmbedBuilder()
            .setTitle('🃏 لعبة Blackjack!')
            .setColor(Colors.Gold)
            .setDescription(`أنشئت بواسطة ${member}\nالرهان: ${bet.toLocaleString()}`)
            .addFields(
              { name: '💰 الرهان', value: bet.toLocaleString(), inline: true },
              { name: '👤 اللاعب', value: member.user.username, inline: true }
            )
            .setFooter({ text: 'اللعبة ستبدأ فوراً' })
            .setTimestamp();

          // Auto-start blackjack (single player vs dealer)
          await client.gameHandler.startGame(session.id);

          const gameState = session.state;
          const playerHand = gameState.playerHands[member.id];
          
          const embed2 = new EmbedBuilder()
            .setTitle('🃏 Blackjack - دورك')
            .setColor(Colors.Gold)
            .setDescription(`بطاقاتك: ${playerHand.cards.map((c: any) => `${c.value}${c.suit}`).join(' | ')} (المجموع: ${getHandValue(playerHand.cards)})\nبطاقة الموزع المكشوفة: ${gameState.dealerUpCard?.value}${gameState.dealerUpCard?.suit}`)
            .addFields(
              { name: '💰 الرهان', value: bet.toLocaleString(), inline: true },
              { name: '🎯 رصيدك', value: member.user.username, inline: true }
            )
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`bj_hit:${session.id}`)
              .setLabel('Hit (سحب بطاقة)')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🃏'),
            new ButtonBuilder()
              .setCustomId(`bj_stand:${session.id}`)
              .setLabel('Stand (تثبيت)')
              .setStyle(ButtonStyle.Secondary)
              .setEmoji('✋'),
            new ButtonBuilder()
              .setCustomId(`bj_double:${session.id}`)
              .setLabel('Double Down')
              .setStyle(ButtonStyle.Success)
              .setEmoji('💰')
          );

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

          const embed = new EmbedBuilder()
            .setTitle('🔴🟡 Connect 4!')
            .setColor(Colors.Blue)
            .setDescription(`${member} (🔴) vs ${opponent} (🟡)\nدور: ${session.players[session.state.currentPlayer].username}`)
            .setTimestamp();

          // Show board
          const board = renderConnect4Board(session.state.board);
          
          const embed2 = new EmbedBuilder()
            .setTitle('🔴🟡 Connect 4 - دورك')
            .setColor(Colors.Blue)
            .setDescription(board)
            .setFooter({ text: `دور: ${session.players[session.state.currentPlayer].username} (${session.players[session.state.currentPlayer].data.color})` })
            .setTimestamp();

          // Create column buttons
          const components = [];
          for (let row = 0; row < 2; row++) {
            const rowButtons = new ActionRowBuilder<ButtonBuilder>();
            for (let col = row * 4; col < Math.min((row + 1) * 4, 7); col++) {
              rowButtons.addComponents(
                new ButtonBuilder()
                  .setCustomId(`c4_drop:${session.id}:${col}`)
                  .setLabel(`${col + 1}`)
                  .setStyle(ButtonStyle.Primary)
              );
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
          
          const embed = new EmbedBuilder()
            .setTitle(result.success ? '✅ انضممت للعبة!' : '❌ لم تستطع الانضمام')
            .setColor(result.success ? Colors.Green : Colors.Red)
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
          
          const embed = new EmbedBuilder()
            .setTitle(result.success ? '🚪 غادرت اللعبة' : '❌ لم تستطع المغادرة')
            .setColor(result.success ? Colors.Green : Colors.Red)
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
          
          const embed = new EmbedBuilder()
            .setTitle(result.success ? '▶️ بدأت اللعبة!' : '❌ لم تستطع البدء')
            .setColor(result.success ? Colors.Green : Colors.Red)
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

          const statusMap: Record<string, string> = {
            waiting: '⏳ في انتظار اللاعبين',
            active: '🎮 جارية',
            finished: '🏁 منتهية',
            cancelled: '❌ ملغية'
          };
          const statusText = statusMap[existing.status] || 'غير معروف';

          const embed = new EmbedBuilder()
            .setTitle('🎮 حالة اللعبة')
            .setColor(Colors.Blue)
            .addFields(
              { name: 'النوع', value: existing.type, inline: true },
              { name: 'الحالة', value: statusText, inline: true },
              { name: 'اللاعبين', value: `${existing.players.length}/${existing.maxPlayers}`, inline: true },
              { name: 'الرهان', value: existing.bet > 0 ? existing.bet.toLocaleString() : 'بدون', inline: true },
              { name: 'الجائزة', value: existing.pot > 0 ? existing.pot.toLocaleString() : 'لا يوجد', inline: true },
              { name: 'اللاعبين', value: existing.players.map((p: any) => `${p.username} (${p.status})`).join('\n') || 'لا يوجد' }
            )
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          break;
        }
      }
    } catch (error: any) {
      logger.error(`Game command error: ${error.message}`);
      await interaction.editReply({ content: `❌ ${error.message}` });
    }
  },

  };
// ============================================
// Helper Functions (standalone to avoid Command interface issues)
// ============================================
function getHandValue(cards: any[]): number {
  let value = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.value === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.value)) {
      value += 10;
    } else {
      value += parseInt(card.value);
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
}

function renderConnect4Board(board: any[][]): string {
  let str = '  1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣\n';
  for (let row = 0; row < 6; row++) {
    str += board[row].map(cell => cell || '⚪').join(' ') + '\n';
  }
  return `\`\`\`\n${str}\`\`\``;
}

export default gameCommand;