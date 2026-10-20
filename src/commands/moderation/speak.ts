// ============================================
// Liberty City Bot - Speak Command
// ============================================
// السماح لعضو بالكلام بعد منع الكتابة:
// 1) يزيل منع الكتابة من صلاحيات القناة (overwrite)
// 2) يزيل رول الكتم إن كان عليه
// 3) يلغي تايم أوت إن كان مكتوماً

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { MuteRole } from '../../models';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('speak')
    .setDescription('السماح لعضو بالكلام بعد منع الكتابة')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('العضو المراد السماح له بالكلام')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('القناة (افتراضي: القناة الحالية)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('reason')
        .setDescription('سبب السماح بالكلام')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageChannels],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'السماح بالكلام';

    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const member = await guild?.members.fetch(target.id).catch(() => null);
    if (!member) {
      await interaction.editReply({ content: '❌ العضو غير موجود في السيرفر' });
      return;
    }
    if (member.user.bot) {
      await interaction.editReply({ content: '❌ لا يمكن تطبيق الأمر على بوت' });
      return;
    }

    const channel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;
    const fixed: string[] = [];
    const problems: string[] = [];

    // ---------- 1) إزالة منع الكتابة من صلاحيات القناة ----------
    const canManageChannels = channel.permissionsFor(client.user!)?.has(PermissionFlagsBits.ManageChannels);
    if (!canManageChannels) {
      problems.push('⚠️ لا أملك صلاحية `إدارة القنوات` في هذه القناة');
    } else {
      const overwrite = channel.permissionOverwrites?.cache.get(member.id);

      if (overwrite?.deny.has(PermissionFlagsBits.SendMessages)) {
        await channel.permissionOverwrites
          .edit(member.id, {
            ViewChannel: true,
            SendMessages: true,
            SendMessagesInThreads: true,
            ReadMessageHistory: true,
            AddReactions: true,
          }, { reason: `${reason} — بواسطة ${interaction.user.tag}` })
          .then(() => fixed.push(`🔓 **القناة:** أُزيل منع الكتابة في <#${channel.id}>`))
          .catch(() => problems.push(`⚠️ فشل تعديل صلاحيات القناة <#${channel.id}>`));
      } else if (overwrite?.allow.has(PermissionFlagsBits.SendMessages)) {
        fixed.push(`ℹ️ القناة <#${channel.id}>: الكتابة مسموحة له أصلاً`);
      }
    }

    // ---------- 2) إزالة رول الكتم ----------
    const canManageRoles = guild?.members.me?.permissions.has(PermissionFlagsBits.ManageRoles);
    const muteRoleData = await MuteRole.findOne({ guildId: guild?.id }).catch(() => null);
    if (muteRoleData && member.roles.cache.has(muteRoleData.roleId)) {
      const muteRole = guild?.roles.cache.get(muteRoleData.roleId);
      if (!canManageRoles) {
        problems.push('⚠️ لا أملك صلاحية `إدارة الرتب` لإزالة رول الكتم');
      } else if (muteRole && guild!.members.me!.roles.highest.position <= muteRole.position) {
        problems.push('⚠️ رول الكتم أعلى من رتبتي — لا يمكنني إزالةه');
      } else if (muteRole) {
        await member.roles.remove(muteRole, `${reason} — بواسطة ${interaction.user.tag}`)
          .then(() => fixed.push('🔇 **الكتم:** أُزيل رول الكتم'))
          .catch(() => problems.push('⚠️ فشل إزالة رول الكتم'));
      }
    }

    // ---------- 3) إلغاء تايم أوت ----------
    if (member.isCommunicationDisabled()) {
      const canModerate = guild?.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers);
      if (!canModerate) {
        problems.push('⚠️ لا أملك صلاحية `إدارة الأعضاء` لإلغاء التايم أوت');
      } else if (!member.moderatable) {
        problems.push('⚠️ رتبة العضو أعلى من رتبتي — لا يمكن إلغاء التايم أوت');
      } else {
        await member.timeout(null, `${reason} — بواسطة ${interaction.user.tag}`)
          .then(() => fixed.push('⏱️ **التايم أوت:** أُلغي الكتم المؤقت'))
          .catch(() => problems.push('⚠️ فشل إلغاء التايم أوت'));
      }
    }

    // ---------- التقرير ----------
    const lines = [
      `🗣️ **السماح بالكلام:** ${target}`,
      `📝 السبب: ${reason}`,
      '',
      ...(fixed.length ? fixed : ['ℹ️ لم أجد أي منع كتابة مطبّق على العضو في هذه القناة']),
      ...problems,
    ];

    await interaction.editReply({ content: lines.join('\n') });
  },
};

export default command;
