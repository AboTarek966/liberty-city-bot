// ============================================
// Omni Bot - 🔫 أزرار لعبة الروليت (اللوبي + اختيار الطرد)
// ============================================

import { ButtonInteraction, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { PermissionFlagsBits } from 'discord.js';
import {
  rouletteGames,
  addToRouletteLobby,
  removeFromRouletteLobby,
  lobbyEmbed,
  lobbyRow,
  resolveKick,
  startRouletteGame,
  MIN_ROULETTE_PLAYERS,
} from '../../utils/rouletteGame';
import { OmniClient } from '../../OmniClient';

function playerFromMember(member: any) {
  return {
    id: member.id,
    username: member.user?.username || member.username || 'لاعب',
    avatarUrl:
      member.displayAvatarURL?.({ extension: 'png', size: 64 }) ||
      member.user?.displayAvatarURL?.({ extension: 'png', size: 64 }),
  };
}

const handler: ButtonHandler = {
  id: 'roulette',
  async execute(interaction: ButtonInteraction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const gameId = parts[2];

    if (!interaction.guild) {
      await interaction.reply({ content: '❌ تعمل داخل السيرفر فقط', ephemeral: true });
      return;
    }

    const game = gameId ? rouletteGames.get(gameId) : undefined;
    if (!game) {
      await interaction.reply({ content: '❌ هذه اللعبة انتهت أو لم تعد متوفرة.', ephemeral: true });
      return;
    }

    // ========== دخول اللعبة ==========
    if (action === 'join') {
      if (game.phase !== 'lobby') {
        await interaction.reply({ content: '❌ بدأت اللعبة — ممنوع الانضمام الآن.', ephemeral: true });
        return;
      }
      const member = interaction.member as any;
      const result = addToRouletteLobby(game.id, playerFromMember(member));
      if (!result.ok) {
        await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
        return;
      }
      await interaction.update({
        embeds: [lobbyEmbed(game)],
        components: lobbyRow(game),
      });
      return;
    }

    // ========== 🤖 إضافة بوتات — اختر العدد من قائمة منبثقة ==========
    if (action === 'addbots') {
      if (game.phase !== 'lobby') {
        await interaction.reply({ content: '❌ بدأت اللعبة بالفعل — ممنوع الإضافة الآن.', ephemeral: true });
        return;
      }
      const options = [
        ...Array.from({ length: 8 }, (_, i) => ({ label: `${i + 1} بوت`, value: String(i + 1), emoji: '🤖' })),
        { label: '10 بوتات', value: '10', emoji: '👾' },
        { label: '25 — كل البوتات', value: '25', emoji: '🎉' },
      ];
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`roulette_bot_count:${gameId}`)
        .setPlaceholder('كم بوت تحب أضيف؟')
        .addOptions(options);
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
      await interaction.reply({
        content: '🤖 **اختر عدد البوتات اللي تحب تضيفها للعبة:**',
        components: [row],
        ephemeral: true,
      });
      return;
    }

    // ========== ⚡ ابدأ الآن — بداية فورية بدون انتظار ٦٠ ثانية ==========
    if (action === 'start') {
      if (game.phase !== 'lobby') {
        await interaction.reply({ content: '❌ بدأت اللعبة بالفعل — استمتع بالجولة!', ephemeral: true });
        return;
      }
      const member = interaction.member as any;
      const perms = member?.permissions;
      const isCreator = game.players[0]?.id === interaction.user.id;
      const isAdmin =
        interaction.guild!.ownerId === interaction.user.id ||
        perms?.has?.(PermissionFlagsBits.ManageGuild) ||
        perms?.has?.(PermissionFlagsBits.Administrator);
      if (!isCreator && !isAdmin) {
        await interaction.reply({
          content: '⛔ الزر ده لمنشئ اللعبة أو لإدارة السيرفر فقط.',
          ephemeral: true,
        });
        return;
      }
      if (game.players.length < MIN_ROULETTE_PLAYERS) {
        await interaction.reply({
          content: `⚠️ لازم عدد **${MIN_ROULETTE_PLAYERS}** لاعبين على الأقل للبداية — اظغط **🤖 إضافة بوتات** أو انتظر دخول البقية.`,
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({ content: '⚡ **بدأت اللعبة الآن!** — العجلة الجاهزة تدور...', ephemeral: true });
      // نفس مسار المؤقّت — لكن فوراً (وفي حال اكتمل العدد نكمل نفس الخطوات)
      await startRouletteGame(interaction.client as OmniClient, game.id);
      return;
    }

    // ========== خروج من اللعبة ==========
    if (action === 'leave') {
      if (game.phase !== 'lobby') {
        await interaction.reply({ content: '❌ بدأت اللعبة — الطرد هو الفاصل الوحيد.', ephemeral: true });
        return;
      }
      const result = removeFromRouletteLobby(game.id, interaction.user.id);
      if (!result.ok) {
        await interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
        return;
      }
      await interaction.update({
        embeds: [lobbyEmbed(game)],
        components: lobbyRow(game),
      });
      return;
    }

    // ========== اختيار الطرد ==========
    if (action === 'kick') {
      const targetId = parts[3];
      if (!targetId) {
        await interaction.reply({ content: '❌ زر غير صالح.', ephemeral: true });
        return;
      }
      if (game.phase !== 'choosing') {
        await interaction.reply({ content: '❌ ليس وقت الاختيار الآن.', ephemeral: true });
        return;
      }
      // فقط اللي اختارته العجلة يقدر يضغط
      if (interaction.user.id !== game.chooserId) {
        await interaction.reply({
          content: '❌ مش دورك — العجلة اختارت لاعب تاني.',
          ephemeral: true,
        });
        return;
      }
      const res = await resolveKick(interaction.client as OmniClient, game, targetId);
      if (!res.ok) {
        await interaction.reply({ content: `❌ ${res.reason}`, ephemeral: true });
        return;
      }
      await interaction.reply({
        content: `🔫 اخترت طرد <@${targetId}> من اللعبة!`,
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ content: '❌ زر غير معروف.', ephemeral: true });
  },
};

export default handler;
