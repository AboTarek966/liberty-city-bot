// ============================================
// Omni Bot - ⚔️ لوحة أزرار مسابقات العشائر
//    customId: clancomp:start | clancomp:cancel | clancomp:standings | clancomp:status
//    أزرار إدارة/عرض المسابقة — نفس سياسة /clan (إدارة محصورة، العرض متاح).
// ============================================

import {
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { ButtonHandler } from '../../handlers/InteractionHandler';
import { canManageClans, clanAccessDeniedMessage } from '../../utils/clanPerms';
import { Clan, ClanBattle } from '../../models';
import { ActivityStats, getDayKey, getWeekKey, getMonthKey } from '../../handlers/ActivityTracker';

const COLOR = 0x3b82f6;

function fmtScore(s: { messages: number; voiceMinutes: number; voiceJoins: number }): string {
  const h = Math.floor(s.voiceMinutes / 60);
  const m = s.voiceMinutes % 60;
  return `💬 ${s.messages} رسالة · 🔊 ${h}س ${m}د · 🎙️ ${s.voiceJoins} انضمام`;
}

const periodDateKey = (period: 'day' | 'week' | 'month' | 'total'): string => {
  const now = new Date();
  if (period === 'day') return getDayKey(now);
  if (period === 'week') return getWeekKey(now);
  if (period === 'month') return getMonthKey(now);
  return 'all';
};

async function clanScore(guildId: string, memberIds: string[], period: 'day' | 'week' | 'month' | 'total') {
  const date = periodDateKey(period);
  const docs = await ActivityStats.find({ guildId, userId: { $in: memberIds }, period, date }).lean();
  return docs.reduce(
    (acc, d: any) => {
      acc.messages += d.messages || 0;
      acc.voiceMinutes += d.voiceMinutes || 0;
      acc.voiceJoins += d.voiceJoins || 0;
      return acc;
    },
    { messages: 0, voiceMinutes: 0, voiceJoins: 0 }
  );
}

function buildStartRow(): ActionRowBuilder<ButtonBuilder> {
  const start = new ButtonBuilder()
    .setCustomId('clancomp:start')
    .setLabel('بدء مسابقة')
    .setEmoji('▶️')
    .setStyle(ButtonStyle.Success);
  const standings = new ButtonBuilder()
    .setCustomId('clancomp:standings')
    .setLabel('الترتيب الحالي')
    .setEmoji('📊')
    .setStyle(ButtonStyle.Primary);
  const status = new ButtonBuilder()
    .setCustomId('clancomp:status')
    .setLabel('الحالة')
    .setEmoji('📋')
    .setStyle(ButtonStyle.Secondary);
  const cancel = new ButtonBuilder()
    .setCustomId('clancomp:cancel')
    .setLabel('إلغاء المسابقة')
    .setEmoji('🛑')
    .setStyle(ButtonStyle.Danger);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(start, standings, status, cancel);
}

/** بناء لوحة المسابقة — تُستخدم من /clan comp */
export function buildClanCompPanel(): ActionRowBuilder<ButtonBuilder> {
  return buildStartRow();
}

const handler: ButtonHandler = {
  id: 'clancomp',
  async execute(interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    const userId = interaction.user.id;
    const action = interaction.customId.split(':')[1] || '';

    // ===== الحالة / الترتيب: عرض فقط =====
    if (action === 'status' || action === 'standings') {
      const battle = await ClanBattle.findOne({ guildId: guild.id, status: 'active' }).lean();
      if (!battle) {
        await interaction.reply({
          content: '💤 لا توجد مسابقة نشطة حالياً — اضغط «بدء مسابقة» من اللوحة',
          ephemeral: true,
        });
        return;
      }
      const clans = await Clan.find({ _id: { $in: battle.clanIds } }).lean();

      if (action === 'status') {
        const remainingMs = Math.max(0, new Date(battle.endsAt).getTime() - Date.now());
        const rDays = Math.floor(remainingMs / 86_400_000);
        const rHours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
        const rMin = Math.floor((remainingMs % 3_600_000) / 60_000);
        const embed = new EmbedBuilder()
          .setColor(COLOR)
          .setTitle(`⚔️ ${battle.name} — جارية`)
          .addFields(
            { name: '👥 العشائر', value: clans.map((c) => `**${c.name}** (${c.members.length})`).join('\n') || 'لا توجد' },
            { name: '⏱️ الوقت المتبقي', value: `${rDays} يوم ${rHours} ساعة ${rMin} دقيقة` },
            { name: '📅 تنتهي', value: `<t:${Math.floor(new Date(battle.endsAt).getTime() / 1000)}:F>` },
            { name: '📣 قناة الإعلان', value: battle.channelId ? `<#${battle.channelId}>` : 'لم تحدد' },
          )
          .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      // standings
      const entries: Array<{ name: string; score: number; line: string }> = [];
      for (const clan of clans) {
        const [day, week, month] = await Promise.all([
          clanScore(guild.id, clan.members, 'day'),
          clanScore(guild.id, clan.members, 'week'),
          clanScore(guild.id, clan.members, 'month'),
        ]);
        const allMsg = month.messages, allVoice = month.voiceMinutes, allJoins = month.voiceJoins;
        const score = allMsg + allVoice * 10;
        entries.push({
          name: clan.name,
          score,
          line:
            `**${clan.name}** — نقاط: ${score}\n` +
            `• اليوم: ${fmtScore(day)}\n• الأسبوع: ${fmtScore(week)}\n• الشهر: ${fmtScore(month)}`,
        });
      }
      entries.sort((a, b) => b.score - a.score);
      const embed = new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('📊 الترتيب الحالي — مسابقة العشائر')
        .setDescription(entries.map((e, i) => `${i + 1}. ${e.line}`).join('\n\n').slice(0, 4000) || 'لا توجد بيانات بعد')
        .setFooter({ text: 'النقاط = رسائل + (دقائق فويس × 10) — خلال الشهر الحالي' })
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // ===== start / cancel: تحتاج صلاحية إدارة =====
    const allowed = await canManageClans(guild, userId, interaction.member as any, interaction.client).catch(() => false);
    if (!allowed) {
      await interaction.reply({ content: clanAccessDeniedMessage(), ephemeral: true });
      return;
    }

    if (action === 'start') {
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder: ARBuilder } = require('discord.js');
      const modal = new ModalBuilder().setCustomId('clancomp:startmodal').setTitle('⚔️ بدء مسابقة عشائرية');

      const clansInput = new TextInputBuilder()
        .setCustomId('clans')
        .setLabel('أسماء العشائر المتنافسة (مفصولة بفاصلة)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200)
        .setPlaceholder('مثال: صقور الصحراء، أشبال المدينة');
      const daysInput = new TextInputBuilder()
        .setCustomId('days')
        .setLabel('عدد أيام المسابقة (1-30)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(2)
        .setPlaceholder('7');
      const nameInput = new TextInputBuilder()
        .setCustomId('name')
        .setLabel('اسم المسابقة (اختياري)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(48)
        .setPlaceholder('مسابقة عشائرية');

      const row1 = new ARBuilder().addComponents(clansInput);
      const row2 = new ARBuilder().addComponents(daysInput);
      const row3 = new ARBuilder().addComponents(nameInput);
      modal.addComponents(row1, row2, row3);

      await interaction.showModal(modal);
      return;
    }

    if (action === 'cancel') {
      const active = await ClanBattle.findOne({ guildId: guild.id, status: 'active' });
      if (!active) {
        await interaction.reply({ content: '💤 لا توجد مسابقة نشطة لإلغائها', ephemeral: true });
        return;
      }
      active.status = 'cancelled';
      await active.save();
      await interaction.reply({ content: `✅ تم إلغاء المسابقة «${active.name}»`, ephemeral: true });
      return;
    }

    await interaction.reply({ content: '❌ زر غير معروف', ephemeral: true });
  },
};

export default handler;
