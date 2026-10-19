// ============================================
// Liberty City Bot - RoleAdd Command (إضافة رول)
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
import {
  createRolePickerState,
  buildRolePicker,
  getGrantableRoles,
} from '../../utils/rolePicker';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('roleadd')
    .setDescription('إضافة رول لعضو (للمالك فقط)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o =>
      o.setName('user').setDescription('العضو المراد إضافة الرول له').setRequired(true)
    )
    .addRoleOption(o =>
      o
        .setName('role')
        .setDescription('الرول الأول (اتركه فارغاً لفتح لوحة الاختيار)')
        .setRequired(false)
    )
    .addRoleOption(o =>
      o.setName('role2').setDescription('رول إضافي 2').setRequired(false)
    )
    .addRoleOption(o =>
      o.setName('role3').setDescription('رول إضافي 3').setRequired(false)
    )
    .addRoleOption(o =>
      o.setName('role4').setDescription('رول إضافي 4').setRequired(false)
    )
    .addRoleOption(o =>
      o.setName('role5').setDescription('رول إضافي 5').setRequired(false)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('السبب').setRequired(false)
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const guild = interaction.guild!;
    const member = interaction.options.getMember('user') as GuildMember;
    const reason = interaction.options.getString('reason') || 'إضافة رول';

    // 🔒 للمالك فقط (owner فقط)
    if (interaction.user.id !== guild.ownerId) {
      await interaction.reply({ content: '❌ هذا الأمر للمالك فقط', ephemeral: true });
      return;
    }

    // ✅ كل الرولات المحددة في نفس الأمر (role حتى role5)
    const requestedRoles = (['role', 'role2', 'role3', 'role4', 'role5'] as const)
      .map(n => interaction.options.getRole(n))
      .filter((r): r is Role => r !== null);
    const uniqueRoles = [...new Map(requestedRoles.map(r => [r.id, r])).values()];

    if (!member) {
      await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
      return;
    }

    // لا يمكن تعديل رولات مالك السيرفر (إلا لو كان المنفذ هو المالك نفسه)
    if (member.id === guild.ownerId && interaction.user.id !== guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكن تعديل رولات مالك السيرفر', ephemeral: true });
      return;
    }

    const executorMember = interaction.member as GuildMember;

    // --------------------------------------------
    // لوحة اختيار الرولات (لم يتم تحديد أي رول)
    // --------------------------------------------
    if (uniqueRoles.length === 0) {
      const grantable = getGrantableRoles(guild, executorMember);
      if (grantable.length === 0) {
        await interaction.reply({
          content: '❌ لا توجد رولات يمكنك إعطاؤها — تأكد من رتبتك ورتبة البوت',
          ephemeral: true,
        });
        return;
      }

      // تأجيل الرد لتجنب مهلة الانتهاء
      await interaction.deferReply({ ephemeral: false });

      const state = createRolePickerState(interaction.user.id, member.id, reason);
      const { content, components } = buildRolePicker(state, guild, executorMember);
      await interaction.editReply({ content, components });
      return;
    }

    // --------------------------------------------
    // فحص كل الرولات المحددة
    // --------------------------------------------
    const isOwner = interaction.user.id === guild.ownerId;
    const grantable: Role[] = [];
    const execBlocked: Role[] = [];
    const botBlocked: Role[] = [];
    const alreadyOwned: Role[] = [];

    for (const role of uniqueRoles) {
      if (member.roles.cache.has(role.id)) {
        alreadyOwned.push(role);
        continue;
      }
      if (!isOwner && executorMember.roles.highest.comparePositionTo(role) <= 0) {
        execBlocked.push(role);
        continue;
      }
      if (guild.members.me!.roles.highest.comparePositionTo(role) <= 0) {
        botBlocked.push(role);
        continue;
      }
      grantable.push(role);
    }

    if (grantable.length === 0) {
      let msg = `❌ العضو يملك هذه الرولات بالفعل (${alreadyOwned.length})`;
      if (execBlocked.length) msg = '❌ رتبتك يجب أن تكون أعلى من الرول المضاف';
      else if (botBlocked.length) msg = '❌ رتبة البوت يجب أن تكون أعلى من الرول المضاف';
      await interaction.reply({ content: msg, ephemeral: true });
      return;
    }

    try {
      await member.roles.add(
        grantable.map(r => r.id),
        `${reason} | بواسطة ${interaction.user.tag}`,
      );

      const rolesText = grantable.map(r => `${r}`).join(', ');
      const skippedCount = execBlocked.length + botBlocked.length + alreadyOwned.length;

      await interaction.reply({
        content: `➕ **${member}** ← ${rolesText}` +
          (skippedCount ? ` (تخطي ${skippedCount})` : ''),
      });

      // Log
      try {
        const { getGuildSettings } = await import('../../models');
        const settings = await getGuildSettings(guild.id);
        if (settings.logging?.enabled && settings.logging.channelId) {
          const logChannel = guild.channels.cache.get(settings.logging.channelId);
          if (logChannel && logChannel.isTextBased()) {
            const skippedText = [
              ...execBlocked.map(r => `${r} (أعلى من رتبتك)`),
              ...botBlocked.map(r => `${r} (أعلى من رتبة البوت)`),
              ...alreadyOwned.map(r => `${r} (مملوك بالفعل)`),
            ].slice(0, 10).join('\n');

            const logEmbed = new EmbedBuilder()
              .setTitle(grantable.length > 1 ? '➕ إضافة رولات' : '➕ إضافة رول')
              .setColor(Colors.success)
              .addFields(
                { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
                { name: '🎭 الرولات', value: rolesText, inline: false },
                { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                { name: '📝 السبب', value: reason, inline: false },
                ...(skippedText
                  ? [{ name: '⚠️ تم تخطيها', value: skippedText, inline: false }]
                  : []),
              )
              .setTimestamp();
            await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      } catch {}
    } catch (error) {
      await interaction.reply({ content: '❌ فشل إضافة الرول — تحقق من صلاحيات البوت', ephemeral: true });
    }
  },
};

export default command;