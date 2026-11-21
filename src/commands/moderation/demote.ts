// ============================================
// Omni Bot - Demote Command (تنزيل/إنزال ترقية)
// ============================================
// لو إداري عنده رلول إدارة وترقيته مو منسجمة مع الخطوة، اكتب /demote
// ويسحب البوت **أعلى رول إدارة** فقط — وتبقى الرولات الأدنى كما هي.
//
// القيود من ديسكورد:
// - مالك السيرفر مستثنى.
// - الرولات الأعلى من رول البوت لا يمكن سحبها.
// - رولات التكاملات (Managed) لا يمكن سحبها.
//
// الاختصار "تنتيل" مدمج (builtin) ويظهر في /alias list.

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  Role,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { isEnvBotOwner } from '../../utils/botOwner';
import { getGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('DemoteAdmin');

// 🛡️ نفس تعريف "رول إدارة" المستخدم في /dismiss
const ADMIN_PERMISSIONS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageNicknames,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.ManageEvents,
  PermissionFlagsBits.ViewAuditLog,
];

function isAdminRole(role: Role): boolean {
  if (!role || role.id === role.guild.id) return false;
  if (role.managed) return false;
  return ADMIN_PERMISSIONS.some((perm) => role.permissions.has(perm));
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('⬇️ تنزيل ترقية — إسقاط أعلى رول إدارة من عضو (يبقي الرولات الأدنى)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((o) =>
      o.setName('user').setDescription('العضو المراد إنزاله (منشن أو اختيار)').setRequired(true)
    )
    .addStringOption((o) =>
      o
        .setName('reason')
        .setDescription('سبب الإنزال (اختياري)')
        .setRequired(false)
        .setMaxLength(300)
    ),

  cooldown: 3,
  permissions: [PermissionFlagsBits.Administrator],
  // لا تُسجل عالمياً: ديسكورد يحد 100 أمر عالمي — guildOnly لكل سيرفر
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ هذا الأمر داخل السيرفر فقط', ephemeral: true });
      return;
    }

    const executor = interaction.member as GuildMember | null;
    const isOwner =
      interaction.user.id === guild.ownerId || isEnvBotOwner(interaction.user.id);
    const hasAdmin = isOwner || !!executor?.permissions.has(PermissionFlagsBits.Administrator);
    if (!hasAdmin) {
      await interaction.reply({
        content: '⛔ هذا الأمر لمن يملك صلاحية **Administrator** فقط.',
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const member =
      (interaction.options.getMember('user') as GuildMember | null) ||
      (await guild.members.fetch(targetUser.id).catch(() => null));
    if (!member) {
      await interaction.reply({
        content: `❌ **${targetUser.tag}** ليس موجوداً في السيرفر.`,
        ephemeral: true,
      });
      return;
    }

    if (member.user.bot) {
      await interaction.reply({ content: '❌ لا يمكن إنزال البوتات ❌', ephemeral: true });
      return;
    }
    if (member.id === guild.ownerId) {
      await interaction.reply({
        content: '❌ لا يمكن إنزال مالك السيرفر — مالك السيرفر مستثنى بحكم ديسكورد.',
        ephemeral: true,
      });
      return;
    }

    const me = guild.members.me;
    if (!me) {
      await interaction.reply({ content: '❌ تعذر الوصول إلى عضوية البوت.', ephemeral: true });
      return;
    }
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content: '❌ البوت لا يملك صلاحية **Manage Roles** لسحب الرولات.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const reason = (interaction.options.getString('reason') || 'تنزيل ترقية').slice(0, 300);
    const auditReason = `تنزيل ترقية | ${reason} | بواسطة ${interaction.user.tag}`.slice(0, 512);

    const adminRoles = member.roles.cache.filter(isAdminRole);
    if (adminRoles.size === 0) {
      await interaction.editReply({
        content: `ℹ️ **${member.user.tag}** لا يملك أي رول إدارة في هذا السيرفر.`,
      });
      return;
    }

    // الأعلى رتبة — فقط رول إدارة واحد فقط يُسحب
    const ordered = [...adminRoles.values()].sort((a, b) => b.position - a.position);
    const botPosition = me.roles.highest.position;
    const topRole = ordered[0];

    // 🥇 تحقُّق من إمكانية السحب — لو الأعلى مستعصي لا نمسّ الأدنى، ونوضّح السبب
    if (!topRole.editable || topRole.position >= botPosition) {
      await interaction.editReply({
        content: `⚠️ **${member.user.tag}** يملك رول «${topRole.name}» وهو أعلى من رول البوت — لا أستطيع سحبه دون تعديل ترتيب الرول.\n> اسحب رول البوت فوق «${topRole.name}» أولاً ثم كرّر الأمر.`,
      });
      return;
    }

    try {
      await member.roles.remove(topRole, auditReason);
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ تعذر سحب «${topRole.name}» — ${error?.message || error}`,
      });
      logger.warn(`تعذر سحب الرول «${topRole.name}» من ${member.user.tag}: ${error?.message || error}`);
      return;
    }

    const remaining = member.roles.cache.filter(isAdminRole).map((r) => `«${r.name}»`);

    const lines = [
      `⬇️ **${member.user.tag}** أُنزِل — سُحب الرول «${topRole.name}» (${reason}).`,
    ];
    if (remaining.length > 1) {
      lines.push(`🔗 تبقى له: ${remaining.join('، ')}`);
    } else if (remaining.length === 1) {
      lines.push(`🔗 تبقى له: ${remaining[0]}`);
    } else {
      lines.push('📭 فُصل من الإدارة — لم يبقَ له أي رول إدارة.');
    }
    await interaction.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } });

    const embed = new EmbedBuilder()
      .setTitle('⬇️ تنزيل ترقية')
      .setColor(Colors.warning)
      .setDescription(
        `تم إسقاط أعلى رول إدارة من **${member.user.tag}** (\`${member.id}\`).`
      )
      .addFields(
        { name: '👤 العضو', value: `**${member.user.tag}**`, inline: true },
        { name: '🛡️ المنفذ', value: `**${interaction.user.tag}**`, inline: true },
        { name: '🗑️ الرول المسحوب', value: `«${topRole.name}» (\`${topRole.id}\`)`, inline: true },
        { name: '📝 السبب', value: reason, inline: false },
        {
          name: '🔗 المتبقي',
          value: remaining.length ? remaining.join('، ') : 'فارغ (لا يملك أي رول إدارة)',
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({ text: `${guild.name} • Demote Admin` });

    try {
      const settings: any = await getGuildSettings(guild.id);
      const logId =
        settings?.logging?.enabled && settings.logging.channelId
          ? settings.logging.channelId
          : settings?.protection?.logChannel;
      const logChannel = logId ? guild.channels.cache.get(logId) : null;
      if (logChannel && logChannel.isTextBased()) {
        await (logChannel as any).send({ embeds: [embed] }).catch(() => {});
      }
    } catch {
      /* السجل اختياري */
    }

    logger.info(
      `⬇️ Demote: ${member.user.tag} (${member.id}) → أعلى رول «${topRole.name}» مع «${interaction.user.tag}» في ${guild.name}`
    );
  },
};

export default command;
