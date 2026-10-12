// ============================================
// Liberty City Bot - Unjail Command (إلغاء سجن عضو)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { getGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('UnjailCommand');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unjail')
    .setDescription('إلغاء سجن عضو (استعادة رولاته)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o =>
      o.setName('user').setDescription('العضو المراد إلغاء سجنه').setRequired(true)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('سبب إلغاء السجن').setRequired(false)
    ),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const guild = interaction.guild!;
    // ⚠️ getMember قد يُرجع كائن خام — نجلب العضو من السيرفر مباشرة
    const targetUser = interaction.options.getUser('user', true);
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    const reason = interaction.options.getString('reason') || 'إلغاء سجن يدوي';

    if (!member) {
      await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
      return;
    }

    // لا يمكن إلغاء سجن نفسك
    if (member.id === interaction.user.id) {
      await interaction.reply({ content: '❌ لا يمكنك إلغاء سجن نفسك', ephemeral: true });
      return;
    }

    // التحقق من صلاحيات البوت
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ البوت يحتاج صلاحية إدارة الرتب', ephemeral: true });
      return;
    }

    // التحقق من أن رتبة البوت أعلى من رتبة العضو
    if (guild.members.me!.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
      return;
    }

    // التحقق من أن رتبة المنفذ أعلى من رتبة العضو (المالك يستثنى)
    const executorMember = interaction.member as GuildMember;
    const isOwner = interaction.user.id === guild.ownerId;
    if (!isOwner && executorMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      // جلب بيانات السجن من قاعدة البيانات
      const { JailData } = await import('../../models');
      const jailData = await JailData.findOne({ guildId: guild.id, userId: member.id });

      if (!jailData) {
        await interaction.editReply({ content: '❌ هذا العضو غير مسجون حالياً' });
        return;
      }

      const jailRole = guild.roles.cache.get(jailData.jailRoleId);

      // إزالة رول السجن (إن كان موجوداً — قد يحذفه بوت آخر)
      if (jailRole && guild.members.me!.roles.highest.comparePositionTo(jailRole) > 0) {
        if (member.roles.cache.has(jailRole.id)) {
          await member.roles.remove(jailRole, reason).catch(() => {});
        }
      }

      // 🔓 حذف صلاحيات العضو المباشرة (member overwrites) من كل الرومات
      // هذه هي الصلاحيات الأساسية التي تمنع العضو من رؤية الرومات
      const { ChannelType } = await import('discord.js');
      const allChannels = guild.channels.cache.filter(
        c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildCategory
      );
      let removedOverwrites = 0;
      for (const channel of allChannels.values()) {
        try {
          if ((channel as any).permissionOverwrites?.cache?.has(member.id)) {
            await (channel as any).permissionOverwrites.delete(member, reason).catch(() => {});
            removedOverwrites++;
          }
        } catch {}
      }
      // حذف صلاحيات رول السجن أيضاً (إن بقيت)
      if (jailRole) {
        for (const channel of allChannels.values()) {
          try {
            if ((channel as any).permissionOverwrites?.cache?.has(jailRole.id)) {
              await (channel as any).permissionOverwrites.delete(jailRole, reason).catch(() => {});
            }
          } catch {}
        }
      }

      // استعادة الرولات السابقة
      const previousRoles = jailData.previousRoles || [];
      for (const roleId of previousRoles) {
        const role = guild.roles.cache.get(roleId);
        if (role && !member.roles.cache.has(roleId)) {
          try {
            await member.roles.add(role, reason);
          } catch {}
        }
      }

      // تنظيف بيانات السجن
      await JailData.findOneAndDelete({ guildId: guild.id, userId: member.id });

      // الرد — رسالة نصية بسيطة
      await interaction.editReply({ content: `🔓 **${member}** تم إلغاء سجنه واستعادة ${previousRoles.length} رول | ${reason}` });

      // تسجيل في السجلات
      try {
        const settings = await getGuildSettings(guild.id);
        if (settings.logging?.enabled && settings.logging.channelId) {
          const logChannel = guild.channels.cache.get(settings.logging.channelId);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🔓 إلغاء سجن عضو')
              .setColor(Colors.success)
              .addFields(
                { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
                { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                { name: '📝 السبب', value: reason, inline: false },
              )
              .setTimestamp();
            await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      } catch {}

      // إشعار العضو في الخاص
      try {
        await member.send(
          `🔓 تم إلغاء سجنك في **${guild.name}** — يمكنك الآن الوصول لجميع القنوات | 📝 السبب: ${reason}`
        ).catch(() => {});
      } catch {}

      logger.info(`Manual unjail: ${member.id} by ${interaction.user.id} in ${guild.name}`);

    } catch (error) {
      logger.error('Unjail command failed:', error);
      await interaction.editReply({ content: '❌ حدث خطأ أثناء تنفيذ الأمر' });
    }
  },
};

export default command;