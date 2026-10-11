// ============================================
// Liberty City Bot - Promote Command (ترقية رول)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Role,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('ترقية عضو للرول التالي في هرمية الرتب')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o =>
      o.setName('user').setDescription('العضو المراد ترقيته').setRequired(true)
    )
    .addRoleOption(o =>
      o.setName('role').setDescription('رول محدد للترقية إليه (اختياري - وإلا للرول التالي)').setRequired(false)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('سبب الترقية').setRequired(false)
    ),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction) {
    const executorMember = interaction.member as GuildMember;
    const client = interaction.client as LibertyClient;
    const guild = interaction.guild!;
    const member = interaction.options.getMember('user') as GuildMember;
    const targetRole = interaction.options.getRole('role');
    const reason = interaction.options.getString('reason') || 'ترقية عبر الأمر';

    if (!member) {
      await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
      return;
    }

    // لا يمكن ترقية نفسك
    if (member.id === interaction.user.id) {
      await interaction.reply({ content: '❌ لا يمكنك ترقية نفسك', ephemeral: true });
      return;
    }

    // لا يمكن ترقية مالك السيرفر (إلا لو كان المنفذ هو المالك نفسه)
    if (member.id === guild.ownerId && interaction.user.id !== guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكنك ترقية مالك السيرفر', ephemeral: true });
      return;
    }

    // التحقق من صلاحيات البوت
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({ content: '❌ البوت لا يملك صلاحية إدارة الرتب', ephemeral: true });
      return;
    }

    // التحقق من أن رتبة البوت أعلى من رتبة العضو
    if (guild.members.me!.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
      return;
    }

    // التحقق من أن رتبة المنفذ أعلى من رتبة العضو (المالك يستثنى)
    const isOwner = interaction.user.id === guild.ownerId;
    if (!isOwner && executorMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من رتبة العضو', ephemeral: true });
      return;
    }

    let newRole: Role | null = null;

    if (targetRole) {
      // ترقية لرول محدد
      newRole = targetRole as Role;
      
      // التحقق من أن رتبة البوت أعلى من الرول المستهدف
      if (guild.members.me!.roles.highest.comparePositionTo(newRole) <= 0) {
        await interaction.reply({ content: '❌ رتبة البوت يجب أن تكون أعلى من الرول المستهدف', ephemeral: true });
        return;
      }
      
      // التحقق من أن رتبة المنفذ أعلى من الرول المستهدف
      if (!isOwner && executorMember.roles.highest.comparePositionTo(newRole) <= 0) {
        await interaction.reply({ content: '❌ رتبتك يجب أن تكون أعلى من الرول المستهدف', ephemeral: true });
        return;
      }
      
      // التحقق من أن العضو لا يملك الرول بالفعل
      if (member.roles.cache.has(newRole.id)) {
        await interaction.reply({ content: `❌ العضو يملك رول ${newRole} بالفعل`, ephemeral: true });
        return;
      }
    } else {
      // ترقية تلقائية للرول التالي في الهرمية (التدرج الطبيعي)
      const botTopRole = guild.members.me!.roles.highest;
      const executorTopRole = executorMember.roles.highest;
      const memberTopRole = member.roles.highest;
      const isOwner = interaction.user.id === guild.ownerId;
       
      // ابحث عن جميع الرتب فوق رتبة العضو الحالية
      const higherRoles = guild.roles.cache
        .filter(r => 
          r.position > memberTopRole.position &&           // أعلى من رتبة العضو الحالية
          r.position < botTopRole.position &&              // أقل من رتبة البوت
          r.id !== guild.id &&                             // ليس @everyone
          !r.managed                                       // ليس رول مدار (بوتات)
        )
        // للمالك: لا قيود إضافية. لغير المالك: لا يتجاوز رتبته
        .filter(r => isOwner || r.position <= executorTopRole.position)
        .sort((a, b) => a.position - b.position); // الأقرب لرتبة العضو الحالية أولاً (التدرج الطبيعي)
       
      if (higherRoles.size === 0) {
        await interaction.reply({ 
          content: '❌ لا يوجد رول أعلى متاح للترقية (الرتبة التالية أعلى من رتبة البوت)', 
          ephemeral: true 
        });
        return;
      }
       
      // أخذ أول رول = الرتبة التالية مباشرة في الهرمية
      newRole = higherRoles.first()!;
    }

    // إضافة الرول
    try {
      await member.roles.add(newRole, `${reason} | بواسطة ${interaction.user.tag}`);
    } catch (error) {
      await interaction.reply({ content: '❌ فشل إضافة الرول — تحقق من صلاحيات البوت', ephemeral: true });
      return;
    }

    // الرد
    const embed = new EmbedBuilder()
      .setTitle('⬆️ تم ترقية العضو')
      .setColor(Colors.success)
      .addFields(
        { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
        { name: '🎭 الرول الجديد', value: `${newRole}`, inline: true },
        { name: '🛡️ المنفذ', value: `${interaction.user}`, inline: true },
        { name: '📝 السبب', value: reason, inline: false },
      )
      .setTimestamp()
      .setFooter({ text: `Liberty City | ${guild.name}` });

    await interaction.reply({ embeds: [embed] });

    // تسجيل في السجلات
    try {
      const settings = await (await import('../../models')).getGuildSettings(guild.id);
      if (settings.logging?.enabled && settings.logging.channelId) {
        const logChannel = guild.channels.cache.get(settings.logging.channelId);
        if (logChannel && logChannel.isTextBased()) {
          const logEmbed = new EmbedBuilder()
            .setTitle('⬆️ ترقية عضو')
            .setColor(Colors.success)
            .addFields(
              { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
              { name: '🎭 الرول', value: `${newRole}`, inline: true },
              { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
              { name: '📝 السبب', value: reason, inline: false },
            )
            .setTimestamp();
          await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
        }
      }
    } catch {
      // تجاهل أخطاء السجل
    }
  },
};

export default command;