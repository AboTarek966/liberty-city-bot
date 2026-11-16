// ============================================
// Omni Bot - ⚔️ نموذج بدء مسابقة العشائر
//    customId: clancomp:startmodal
//    يقرأ أسماء العشائر + عدد الأيام + اسم المسابقة ويُنشئ ClanBattle.
// ============================================

import { ModalSubmitInteraction, GuildMember, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { ModalHandler } from '../../handlers/InteractionHandler';
import { canManageClans, clanAccessDeniedMessage } from '../../utils/clanPerms';
import { Clan, ClanBattle } from '../../models';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('ClanCompModal');
const DEFAULT_COLOR = 0x3498db;

const handler: ModalHandler = {
  id: 'clancomp',
  async execute(interaction: ModalSubmitInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    const userId = interaction.user.id;

    const allowed = await canManageClans(guild, userId, interaction.member as any, interaction.client).catch(() => false);
    if (!allowed) {
      await interaction.reply({ content: clanAccessDeniedMessage(), ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: false });

    const clansStr = (interaction.fields.getTextInputValue('clans') || '').trim();
    const daysRaw = (interaction.fields.getTextInputValue('days') || '').trim();
    const nameInput = (interaction.fields.getTextInputValue('name') || '').trim();

    const days = parseInt(daysRaw, 10);
    if (Number.isNaN(days) || days < 1 || days > 30) {
      await interaction.editReply({ content: '❌ عدد الأيام غير صالح — اكتب رقم بين 1 و 30' });
      return;
    }

    const rawNames = clansStr.split(/[,،]\s*/).map((s) => s.trim()).filter(Boolean);
    if (rawNames.length < 2) {
      await interaction.editReply({ content: '❌ اكتب عشيرتين على الأقل مفصولة بفاصلة' });
      return;
    }

    const allClans = await Clan.find({ guildId: guild.id, active: true }).lean();
    const picked: any[] = [];
    const missing: string[] = [];
    for (const n of rawNames) {
      const found = allClans.find((c) => c.name.toLowerCase() === n.toLowerCase());
      if (found) picked.push(found);
      else missing.push(n);
    }
    if (missing.length) {
      await interaction.editReply({ content: `❌ لم أجد العشائر: ${missing.map((m) => `«${m}»`).join('، ')}` });
      return;
    }
    const clanIds = picked.map((p) => String(p._id));

    const active = await ClanBattle.findOne({ guildId: guild.id, status: 'active' });
    if (active) {
      await interaction.editReply({ content: '❌ هناك مسابقة نشطة حالياً — ألغها أولاً (🛑 إلغاء المسابقة)' });
      return;
    }

    // القناة: من الإعدادات أولاً، وإلا قناة اللوحة/القناة الحالية
    let channelId: string | undefined;
    try {
      const { getGuildSettings } = await import('../../models');
      const settings: any = await getGuildSettings(guild.id);
      channelId = settings?.clans?.battleChannelId;
    } catch {
      channelId = undefined;
    }
    if (!channelId) {
      channelId = interaction.channel?.id;
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
    const battle = await ClanBattle.create({
      guildId: guild.id,
      name: nameInput || 'مسابقة عشائرية',
      clanIds,
      durationDays: days,
      startsAt,
      endsAt,
      channelId,
      status: 'active',
    });

    const mentions = picked.map((p) => `**${p.name}** (${p.members.length} عضو)`).join('\n');
    const desc =
      `⚔️ بدأت «${battle.name}»!\n\nالعشائر المتنافسة:\n${mentions}\n\n` +
      `⏰ المدة: ${days} يوم\n` +
      `📅 تنتهي: ${endsAt.toLocaleString('ar')}\n` +
      (channelId ? `📣 إعلان الفائز في: <#${channelId}>` : '📣 أخبرنا بقناة إعلان الفائز عبر /clan settings');

    const embed = new EmbedBuilder()
      .setColor(DEFAULT_COLOR)
      .setTitle('⚔️ انطلقت المسابقة!')
      .setDescription(desc.slice(0, 4096))
      .setTimestamp();

    logger.info(`Clan battle started: ${battle.name} (${clanIds.length} clans) by ${userId}`);
    await interaction.editReply({ embeds: [embed] });
  },
};

export default handler;
