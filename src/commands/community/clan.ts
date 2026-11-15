// ============================================
// Omni Bot - 🛡️ العشائر (Clans)
// ============================================
// /clan create name:... owner:... members:...
// /clan addmember name:... user:...
// /clan removemember name:... user:...
// /clan delete name:...
// /clan list
// /clan info name:...
// /clan leaderboard [period]
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { Clan } from '../../models';
import { ActivityStats } from '../../handlers/ActivityTracker';
import { renderClanLeaderboard, ClanLeaderboardEntry } from '../../utils/clanImage';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('Clan');

const DEFAULT_COLOR = 0x3498db;
const MAX_CLANS_PER_GUILD = 15;

const clanEmoji = (name: string): string => {
  const emojis = ['🛡️', '⚔️', '🏹', '🔥', '🌟', '⚡', '🍀', '🦅', '🐉', '🐯', '🐺', '👑'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return emojis[hash % emojis.length];
};

function parseMemberIds(input: string, guild: any): string[] {
  const ids = new Set<string>();
  const mention = /<@!?(\d{17,20})>/g;
  let m: RegExpExecArray | null;
  while ((m = mention.exec(input)) !== null) ids.add(m[1]);
  const bare = /(?<!\d)(\d{17,20})(?!\d)/g;
  while ((m = bare.exec(input)) !== null) ids.add(m[1]);
  return [...ids];
}

async function resolveMemberIds(input: string, guild: any): Promise<string[]> {
  const ids = parseMemberIds(input, guild);
  const valid: string[] = [];
  for (const id of ids) {
    if (guild?.members?.cache?.has(id)) valid.push(id);
    else {
      const fetched = await guild?.members?.fetch?.(id).catch(() => null);
      if (fetched) valid.push(id);
    }
  }
  return [...new Set(valid)];
}

function periodDate(period: string): string {
  const now = new Date();
  if (period === 'day') {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (period === 'week') {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  if (period === 'month') return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return 'all';
}

async function clanScore(guildId: string, memberIds: string[], period: 'day' | 'week' | 'month' | 'total') {
  const date = periodDate(period);
  const docs = await ActivityStats.find({ guildId, userId: { $in: memberIds }, period, date }).lean();
  let messages = 0;
  let voiceMinutes = 0;
  let voiceJoins = 0;
  for (const doc of docs) {
    messages += doc.messages || 0;
    voiceMinutes += doc.voiceMinutes || 0;
    voiceJoins += doc.voiceJoins || 0;
  }
  return { messages, voiceMinutes, voiceJoins };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('🛡️ إدارة العشائر — متتبع تفاعلاتها داخل السيرفر')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('✨ إنشاء عشيرة جديدة واحدة فقط (إدارة)')
        .addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true).setMaxLength(32))
        .addUserOption((o) =>
          o.setName('owner').setDescription('مسؤول العشيرة (قائد)').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('members').setDescription('أعضاء العشيرة (منشن أو معرفات، مفصولة بمسافات)').setRequired(true)
        )
        .addIntegerOption((o) =>
          o.setName('color').setDescription('لون تمييز العشيرة (hex number، اختياري)').setMinValue(0x000000).setMaxValue(0xffffff)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('addmember')
        .setDescription('➕ إضافة أعضاء للعشيرة')
        .addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true))
        .addStringOption((o) => o.setName('members').setDescription('الأعضاء المراد إضافتهم (منشن أو معرفات)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('removemember')
        .setDescription('➖ إزالة أعضاء من العشيرة')
        .addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true))
        .addStringOption((o) => o.setName('members').setDescription('الأعضاء المراد إزالتهم (منشن أو معرفات)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName('delete').setDescription('🗑️ حذف العشيرة').addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('📋 عرض كل العشائر'))
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('👤 معلومات عشيرة').addStringOption((o) => o.setName('name').setDescription('اسم العشيرة').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('leaderboard')
        .setDescription('🏆 لوحة أفضل العشائر (صورة)')
        .addStringOption((o) =>
          o
            .setName('period')
            .setDescription('الفترة الزمنية')
            .addChoices(
              { name: 'الكلي', value: 'total' },
              { name: 'الشهر', value: 'month' },
              { name: 'الأسبوع', value: 'week' },
              { name: 'اليوم', value: 'day' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('competition')
        .setDescription('⚔️ بدء مسابقة بين عشائر محددة (بعدد أيام محدد)')
        .addStringOption((o) =>
          o
            .setName('clans')
            .setDescription('أسماء العشائر المتنافسة (افصل بفاصلة)')
            .setRequired(true)
            .setMaxLength(200)
        )
        .addIntegerOption((o) =>
          o
            .setName('days')
            .setDescription('عدد أيام المسابقة')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(30)
        )
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('القناة التي يُنشر فيها إعلان الفائز')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('اسم المسابقة (اختياري)')
            .setMaxLength(48)
        )
    )
    .addSubcommand((sub) => sub.setName('comp-cancel').setDescription('🛑 إلغاء المسابقة الجارية'))
    .addSubcommand((sub) => sub.setName('comp-status').setDescription('📡 عرض تفاصيل المسابقة الجارية'))
    .addSubcommand((sub) =>
      sub
        .setName('settings')
        .setDescription('⚙️ عرض/تغيير إعدادات مسابقة العشائر')
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('قناة إعلان الفائز (للتحديث)')
        )
        .addIntegerOption((o) =>
          o
            .setName('days')
            .setDescription('المدة الافتراضية بالأيام — 1..30')
            .setMinValue(1)
            .setMaxValue(30)
        )
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    // 🔒 ما يقدرش يعمل كلانات (أو يعدّلها) غير من معه أدمنستريتور فقط
    const READ_ONLY_SUBS = new Set(['list', 'info', 'leaderboard', 'comp-status']);
    if (!READ_ONLY_SUBS.has(sub)) {
      const isOwner = guild.ownerId === interaction.user.id;
      const hasAdmin =
        interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator) ??
        (interaction.member as any)?.permissions?.has?.(PermissionFlagsBits.Administrator);
      if (!isOwner && !hasAdmin) {
        await interaction.reply({
          content:
            '⛔ **إدارة العشائر محصورة بحاملي صلاحية أدمنستريتور فقط**\n' +
            '(القراءة متاحة للطاقم: `/clan list`، `/clan info`، `/clan leaderboard`، `/clan comp-status`)',
          ephemeral: true,
        });
        return;
      }
    }

    // ===== create =====
    if (sub === 'create') {
      await interaction.deferReply({ ephemeral: false });
      const name = (interaction.options.getString('name', true) || '').trim();
      if (!name || name.length > 32) {
        await interaction.editReply({ content: '❌ اسم العشيرة غير صالح (حد 32 حرفاً)' });
        return;
      }
      const owner = interaction.options.getUser('owner', true);
      const membersInput = interaction.options.getString('members', true);
      const colorOpt = interaction.options.getInteger('color');
      const color = colorOpt === null || colorOpt === undefined ? DEFAULT_COLOR : Number(colorOpt);

      const memberIds = await resolveMemberIds(membersInput, guild);
      if (!memberIds.length) {
        await interaction.editReply({ content: '❌ لم أتعرف على أي أعضاء في القائمة — اكتب منشن أو معرفات مفصولة بمسافات' });
        return;
      }
      if (memberIds.length > 50) {
        await interaction.editReply({ content: '❌ الحد الأقصى 50 عضواً لكل عشيرة' });
        return;
      }
      if (!memberIds.includes(owner.id)) memberIds.unshift(owner.id);

      const existing = await Clan.countDocuments({ guildId: guild.id, active: true });
      if (existing >= MAX_CLANS_PER_GUILD) {
        await interaction.editReply({ content: `❌ حد السيرفر (${MAX_CLANS_PER_GUILD} عشيرة) — احذف واحدة أولاً` });
        return;
      }

      const clash = await Clan.findOne({ guildId: guild.id, name });
      if (clash) {
        await interaction.editReply({ content: `❌ عشيرة باسم «${name}» موجودة بالفعل` });
        return;
      }

      const taken = await Clan.find({ guildId: guild.id, active: true, members: { $in: memberIds } }).lean();
      if (taken.length) {
        const names = taken.map((t) => `«${t.name}»`).join('، ');
        await interaction.editReply({ content: `❌ بعض الأعضاء موجودون بالفعل في ${names} — عضو لا يمكن أن ينتمي لأكثر من عشيرة` });
        return;
      }

      const clan = await Clan.create({
        guildId: guild.id,
        name,
        ownerId: owner.id,
        members: memberIds,
        color,
        description: '',
        active: true,
      });

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${clanEmoji(name)} «${name}»`)
        .setDescription('تم إنشاء العشيرة بنجاح ✅')
        .addFields(
          { name: '👑 المسؤول', value: `<@${owner.id}>`, inline: true },
          { name: '👥 عدد الأعضاء', value: String(memberIds.length), inline: true },
        )
        .setFooter({ text: 'احسب رسائل وفويس تلقائياً — /clan leaderboard' })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ===== addmember =====
    if (sub === 'addmember') {
      await interaction.deferReply({ ephemeral: true });
      const name = interaction.options.getString('name', true).trim();
      const membersInput = interaction.options.getString('members', true);
      const clan = await Clan.findOne({ guildId: guild.id, name, active: true });
      if (!clan) {
        await interaction.editReply({ content: `❌ لا توجد عشيرة باسم «${name}»` });
        return;
      }
      const ids = await resolveMemberIds(membersInput, guild);
      if (!ids.length) {
        await interaction.editReply({ content: '❌ لم أجد أعضاء صالحين في المدخل' });
        return;
      }
      const before = new Set(clan.members);
      const added: string[] = [];
      for (const id of ids) {
        if (before.has(id)) continue;
        const elsewhere = await Clan.exists({ guildId: guild.id, active: true, members: id });
        if (elsewhere) continue;
        before.add(id);
        added.push(id);
      }
      if (!added.length) {
        await interaction.editReply({ content: 'ℹ️ لا توجد إضافات — الأعضاء موجودون أو في عشائر أخرى' });
        return;
      }
      clan.members = [...before];
      await clan.save();
      await interaction.editReply({ content: `✅ أُضيف ${added.length} عضو لعشيرة «${name}»` });
      return;
    }

    // ===== removemember =====
    if (sub === 'removemember') {
      await interaction.deferReply({ ephemeral: true });
      const name = interaction.options.getString('name', true).trim();
      const membersInput = interaction.options.getString('members', true);
      const clan = await Clan.findOne({ guildId: guild.id, name, active: true });
      if (!clan) {
        await interaction.editReply({ content: `❌ لا توجد عشيرة باسم «${name}»` });
        return;
      }
      const ids = new Set(parseMemberIds(membersInput, guild));
      const before = clan.members.length;
      clan.members = clan.members.filter((id: string) => !ids.has(id));
      const removed = before - clan.members.length;
      if (removed <= 0) {
        await interaction.editReply({ content: 'ℹ️ لم أجد أي عضو من المدخل داخل العشيرة' });
        return;
      }
      await clan.save();
      await interaction.editReply({ content: `✅ أُزيل ${removed} عضو من عشيرة «${name}»` });
      return;
    }

    // ===== delete =====
    if (sub === 'delete') {
      await interaction.deferReply({ ephemeral: true });
      const name = interaction.options.getString('name', true).trim();
      const clan = await Clan.findOne({ guildId: guild.id, name, active: true });
      if (!clan) {
        await interaction.editReply({ content: `❌ لا توجد عشيرة باسم «${name}»` });
        return;
      }
      await clan.deleteOne();
      await interaction.editReply({ content: `🗑️ تم حذف عشيرة «${name}» نهائياً` });
      return;
    }

    // ===== list =====
    if (sub === 'list') {
      await interaction.deferReply({ ephemeral: false });
      const clans = await Clan.find({ guildId: guild.id, active: true }).sort({ createdAt: 1 }).lean();
      if (!clans.length) {
        await interaction.editReply({ content: '📭 لا توجد عشائر بعد — ابدأ بـ `/clan create`' });
        return;
      }
      const lines = clans.map((c, i) => `${i + 1}. ${clanEmoji(c.name)} **${c.name}** — ${c.members.length} عضو`);
      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle(`🛡️ عشائر ${guild.name}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${clans.length} عشيرة` })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ===== info =====
    if (sub === 'info') {
      await interaction.deferReply({ ephemeral: false });
      const name = interaction.options.getString('name', true).trim();
      const clan = await Clan.findOne({ guildId: guild.id, name, active: true }).lean();
      if (!clan) {
        await interaction.editReply({ content: `❌ لا توجد عشيرة باسم «${name}»` });
        return;
      }
      const [today, week, month, total] = await Promise.all([
        clanScore(guild.id, clan.members, 'day'),
        clanScore(guild.id, clan.members, 'week'),
        clanScore(guild.id, clan.members, 'month'),
        clanScore(guild.id, clan.members, 'total'),
      ]);
      const fmtScore = (label: string, s: { messages: number; voiceMinutes: number }) =>
        `**${label}:** 💬 ${s.messages} رسالة · 🔊 ${Math.floor(s.voiceMinutes / 60)}س ${s.voiceMinutes % 60}د`;
      const embed = new EmbedBuilder()
        .setColor(clan.color || DEFAULT_COLOR)
        .setTitle(`🛡️ «${clan.name}»`)
        .addFields(
          { name: '👑 المسؤول', value: `<@${clan.ownerId}>`, inline: true },
          { name: '👥 الأعضاء', value: String(clan.members.length), inline: true },
          {
            name: '📊 إحصائيات التفاعل',
            value: [fmtScore('اليوم', today), fmtScore('الأسبوع', week), fmtScore('الشهر', month), fmtScore('الكلي', total)].join('\n'),
          }
        )
        .setTimestamp();

      const memberList = clan.members.slice(0, 25).map((id: string) => `<@${id}>`).join(' • ');
      if (memberList) embed.addFields({ name: '👥 أعضاء', value: memberList.slice(0, 1024) });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ===== settings =====
    if (sub === 'settings') {
      await interaction.deferReply({ ephemeral: true });
      const { getGuildSettings, invalidateGuildSettings } = await import('../../models');
      const settings = await getGuildSettings(guild.id);
      const clansCfg: any = (settings as any)?.clans || {};
      const chOpt = interaction.options.getChannel('channel');
      const daysOpt = interaction.options.getInteger('days');
      if (chOpt) (settings as any).clans = { ...clansCfg, battleChannelId: chOpt.id };
      if (daysOpt) (settings as any).clans = { ...(settings as any).clans, battleDurationDays: daysOpt };
      if (chOpt || daysOpt) {
        try { await settings.save(); invalidateGuildSettings(guild.id); } catch { /* تجاهل */ }
      }
      const after = (settings as any).clans || {};
      const battleCh = after.battleChannelId ? `<#${after.battleChannelId}>` : 'غير محددة';
      const days = after.battleDurationDays ?? 7;
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('⚙️ إعدادات مسابقة العشائر')
        .addFields(
          { name: '📣 قناة إعلان الفائز', value: battleCh, inline: true },
          { name: '⏱️ المدة الافتراضية', value: `${days} يوم`, inline: true }
        )
        .setFooter({ text: 'الإعدادات تُطبّق على مسابقات العشائر' });
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ===== competition =====
    if (sub === 'competition') {
      await interaction.deferReply({ ephemeral: false });
      const { getGuildSettings, invalidateGuildSettings, ClanBattle, Clan } = await import('../../models');
      const clansStr = (interaction.options.getString('clans', true) || '').trim();
      const days = interaction.options.getInteger('days', true);
      const channel = interaction.options.getChannel('channel', true);
      const nameInput = (interaction.options.getString('name') || '').trim();
      const battleName = nameInput || 'مسابقة عشائرية';

      // parse clans by name (comma or Arabic comma)
      const rawNames = clansStr.split(/[,،]\s*/).map(s => s.trim()).filter(Boolean);
      if (rawNames.length < 2) {
        await interaction.editReply({ content: '❌ اكتب عشيرتين على الأقل مفصولة بفاصلة' });
        return;
      }
      const allClans = await Clan.find({ guildId: guild.id, active: true }).lean();
      const picked: any[] = [];
      const missing: string[] = [];
      for (const n of rawNames) {
        const found = allClans.find(c => c.name.toLowerCase() === n.toLowerCase());
        if (found) picked.push(found);
        else missing.push(n);
      }
      if (missing.length) {
        await interaction.editReply({ content: `❌ لم أجد العشائر: ${missing.map(m => `«${m}»`).join('، ')}` });
        return;
      }
      const clanIds = picked.map(p => String(p._id));

      // cancel any active battle
      const active = await ClanBattle.findOne({ guildId: guild.id, status: 'active' });
      if (active) {
        await interaction.editReply({ content: '❌ هناك مسابقة نشطة حالياً — ألغها أولاً بـ `/clan comp-cancel`' });
        return;
      }

      const duration = Math.max(1, Math.min(30, days || 7));
      const startsAt = new Date();
      const endsAt = new Date(startsAt.getTime() + duration * 24 * 60 * 60 * 1000);

      const battle = await ClanBattle.create({
        guildId: guild.id,
        name: battleName,
        clanIds,
        durationDays: duration,
        startsAt,
        endsAt,
        channelId: channel.id,
        status: 'active',
      });

      const mentions = picked.map(p => `**${p.name}** (${p.members.length} عضو)`).join('\n');
      await interaction.editReply({
        content: `⚔️ بدأت «${battleName}»!\n\nالعشائر المتنافسة:\n${mentions}\n\n⏰ المدة: ${duration} يوم\n📅 تنتهي: ${endsAt.toLocaleString('ar')}\n📣 إعلان الفائز في: <#${channel.id}>`,
      });
      return;
    }

    // ===== comp-cancel =====
    if (sub === 'comp-cancel') {
      await interaction.deferReply({ ephemeral: true });
      const { ClanBattle } = await import('../../models');
      const active = await ClanBattle.findOne({ guildId: guild.id, status: 'active' });
      if (!active) {
        await interaction.editReply({ content: '💤 لا توجد مسابقة نشطة لإلغائها' });
        return;
      }
      active.status = 'cancelled';
      await active.save();
      await interaction.editReply({ content: `✅ تم إلغاء المسابقة «${active.name}»` });
      return;
    }

    // ===== comp-status =====
    if (sub === 'comp-status') {
      await interaction.deferReply({ ephemeral: false });
      const { ClanBattle, Clan } = await import('../../models');
      const battle = await ClanBattle.findOne({ guildId: guild.id, status: 'active' }).lean();
      if (!battle) {
        await interaction.editReply({ content: '💤 لا توجد مسابقة نشطة حالياً' });
        return;
      }
      const clans = await Clan.find({ _id: { $in: battle.clanIds } }).lean();
      const now = Date.now();
      const remainingMs = Math.max(0, new Date(battle.endsAt).getTime() - now);
      const rDays = Math.floor(remainingMs / 86_400_000);
      const rHours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
      const rMin = Math.floor((remainingMs % 3_600_000) / 60_000);
      const embed = new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle(`⚔️ ${battle.name} — جارية`)
        .addFields(
          { name: '👥 العشائر', value: clans.map(c => `**${c.name}** — ${c.members.length} عضو`).join('\n') || 'لا توجد' },
          { name: '⏱️ الوقت المتبقي', value: `${rDays} يوم ${rHours} ساعة ${rMin} دقيقة` },
          { name: '📅 تنتهي', value: `<t:${Math.floor(new Date(battle.endsAt).getTime() / 1000)}:F>` },
          { name: '📣 قناة الإعلان', value: battle.channelId ? `<#${battle.channelId}>` : 'لم تحدد' },
        )
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // ===== leaderboard =====
    if (sub === 'leaderboard') {
      await interaction.deferReply({ ephemeral: false });
      const period = (interaction.options.getString('period') || 'total') as
        | 'day'
        | 'week'
        | 'month'
        | 'total';
      const clans = await Clan.find({ guildId: guild.id, active: true }).lean();
      const entries: ClanLeaderboardEntry[] = [];
      for (const clan of clans) {
        const stats = await clanScore(guild.id, clan.members, period);
        entries.push({
          name: clan.name,
          ownerId: clan.ownerId,
          memberCount: clan.members.length,
          messages: stats.messages,
          voiceMinutes: stats.voiceMinutes,
          color: clan.color,
        });
      }
      entries.sort((a, b) => (b.messages + b.voiceMinutes * 10) - (a.messages + a.voiceMinutes * 10));
      const top = entries.slice(0, 6);

      let image: Buffer | null = null;
      try {
        image = await renderClanLeaderboard(guild.name, top);
      } catch (err: any) {
        logger.warn(`clan leaderboard render failed: ${err?.message || err}`);
      }

      const periodLabel = { day: 'اليوم', week: 'الأسبوع', month: 'الشهر', total: 'الكلي' }[period];
      if (image) {
        const file = new AttachmentBuilder(image, { name: 'clans.png' });
        await interaction.editReply({
          content: `🏆 أفضل العشائر — ${periodLabel}`,
          files: [file],
        });
      } else {
        // فشل الرسم — رد نصي
        const lines = top.length
          ? top.map((e, i) => `${i + 1}. **${e.name}** — 💬 ${e.messages} · 🔊 ${e.voiceMinutes}m · 👥 ${e.memberCount}`).join('\n')
          : 'لا توجد عشائر بعد.';
        await interaction.editReply({ content: `🏆 أفضل العشائر — ${periodLabel}\n${lines}` });
      }
      return;
    }
  },
};

export default command;
