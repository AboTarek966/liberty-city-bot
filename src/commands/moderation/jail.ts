// ============================================
// Liberty City Bot - Jail Command (سجن عضو)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Role,
  GuildMember,
  TextChannel,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';
import { getGuildSettings } from '../../models';
import { createLogger } from '../../utils/helpers';

const logger = createLogger('JailCommand');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('سجن عضو (منعه من رؤية/الكتابة في كل الرومات إلا روم السجن)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addUserOption(o =>
      o.setName('user').setDescription('العضو المراد سجنه').setRequired(true)
    )
    .addChannelOption(o =>
      o.setName('jail_channel')
        .setDescription('روم السجن (الذي سيبقى العضو قادراً على رؤيته والكتابة فيه)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName('reason').setDescription('سبب السجن').setRequired(false)
    )
    .addStringOption(o =>
      o.setName('duration').setDescription('مدة السجن (مثال: 10m, 1h, 1d). فارغ = دائم').setRequired(false)
    ),

  cooldown: 5,
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const guild = interaction.guild!;
    // ⚠️ getMember قد يُرجع كائن خام (APIInteractionGuildMember) بدون roles.cache
    // لذلك نجلب العضو من السيرفر مباشرة لضمان كائن GuildMember كامل
    const targetUser = interaction.options.getUser('user', true);
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    const jailChannel = interaction.options.getChannel('jail_channel') as TextChannel | null;
    const reason = interaction.options.getString('reason') || 'سجن عبر الأمر';
    const duration = interaction.options.getString('duration');

    if (!member) {
      await interaction.reply({ content: '❌ لم يتم العثور على العضو', ephemeral: true });
      return;
    }

    // لا يمكن سجن نفسك
    if (member.id === interaction.user.id) {
      await interaction.reply({ content: '❌ لا يمكنك سجن نفسك', ephemeral: true });
      return;
    }

    // لا يمكن سجن مالك السيرفر (إلا لو كان المنفذ هو المالك نفسه)
    if (member.id === guild.ownerId && interaction.user.id !== guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكن سجن مالك السيرفر', ephemeral: true });
      return;
    }

    // التحقق من صلاحيات البوت
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
        !guild.members.me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({ content: '❌ البوت يحتاج صلاحية إدارة الرتب والقنوات', ephemeral: true });
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
      const settings = await getGuildSettings(guild.id);
      
      // تحديد روم السجن
      let targetJailChannel = jailChannel;
      if (!targetJailChannel) {
        // محاولة استخدام روم السجن من الإعدادات
        const settingsJailChannelId = settings.jail?.channelId;
        if (settingsJailChannelId) {
          targetJailChannel = guild.channels.cache.get(settingsJailChannelId) as TextChannel;
        }
      }
      
      if (!targetJailChannel) {
        await interaction.editReply({ content: '❌ لم يتم تحديد روم السجن. استخدم الخيار `jail_channel` أو أضف روم سجن في الإعدادات (`/settings` → الترحيب/السجن)' });
        return;
      }

      // التحقق من أن البوت يستطيع إدارة روم السجن
      const botPermsInJail = targetJailChannel.permissionsFor(guild.members.me!);
      if (!botPermsInJail?.has(PermissionFlagsBits.ViewChannel) || !botPermsInJail?.has(PermissionFlagsBits.SendMessages)) {
        await interaction.editReply({ content: '❌ البوت لا يملك صلاحية رؤية/إرسال رسائل في روم السجن المحدد' });
        return;
      }

      // التحقق من أن البوت يملك ManageChannels في روم السجن (لازم لتعديل الصلاحيات)
      if (!botPermsInJail?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.editReply({
          content: '❌ البوت لا يملك صلاحية **Manage Channels** في روم السجن.\n\n' +
            '**الحل:** اذهب إلى إعدادات السيرفر → الرتب → رول البوت → فعّل "Manage Channels" (إدارة القنوات) ثم أعد المحاولة.',
        });
        return;
      }

      // إنشاء/جلب رول "السجن"
      let jailRole = guild.roles.cache.find(r => r.name === '🔒 جايـل' || r.name === 'Jail');
      if (!jailRole) {
        jailRole = await guild.roles.create({
          name: '🔒 جايـل',
          color: 0x555555,
          reason: 'رول السجن التلقائي',
          permissions: [],
        });
      }

      // التحقق من أن رتبة البوت أعلى من رول السجن
      if (guild.members.me!.roles.highest.comparePositionTo(jailRole) <= 0) {
        await interaction.editReply({ content: '❌ رتبة البوت يجب أن تكون أعلى من رول السجن' });
        return;
      }

      // 🔒 استبدال جميع رولات العضو برول السجن فقط (استدعاء API واحد)
      // هذا ضروري لأن Discord يُعطي أولوية للـ ALLOW من أي رول آخر
      // نحفظ الرولات الحالية أولاً لاستعادتها لاحقاً عند إلغاء السجن
      const currentRoles = member.roles.cache
        .filter(r => r.id !== guild.id) // استبعاد @everyone
        .map(r => r.id);

      // roles.set() يستبدل كل الرولات دفعة واحدة — أسرع وأأمن من إزالتها واحداً واحداً
      // (يتجنب أخطاء "Unknown Role" من رولات محذوفة في الكاش)
      await member.roles.set([jailRole], `سجن: ${reason}`);
      
      // تخزين بيانات السجن في قاعدة البيانات
      const { JailData } = await import('../../models');
      await JailData.findOneAndUpdate(
        { guildId: guild.id, userId: member.id },
        {
          guildId: guild.id,
          userId: member.id,
          previousRoles: currentRoles,
          jailRoleId: jailRole.id,
          jailedBy: interaction.user.id,
          reason,
          jailedAt: new Date(),
          duration: duration ? parseDuration(duration) : null,
          jailChannelId: targetJailChannel.id,
        },
        { upsert: true, new: true }
      );

      // 🔒 إعداد الصلاحيات: منع رؤية جميع القنوات (نصية + صوتية + كاتيجوريز) إلا روم السجن
      // الاستراتيجية: تعديل الكاتيجوريز أولاً (ينتقل للأبناء)، ثم القنوات التي لها overwrites خاصة
      const allChannels = guild.channels.cache.filter(
        c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildCategory
      );

      let failedChannels: string[] = [];
      let successCount = 0;

      for (const channel of allChannels.values()) {
        if (channel.id === targetJailChannel.id) continue;

        try {
          await channel.permissionOverwrites.edit(jailRole, {
            ViewChannel: false,
            SendMessages: false,
            Connect: false,
          }, { reason: `سجن ${member.user.tag}` });
          successCount++;
        } catch (e) {
          failedChannels.push(`${channel.name} (${channel.id})`);
          logger.warn(`Failed to set jail overwrite for ${channel.name}:`, e);
        }
      }

      // السماح بالرؤية في روم السجن (مع صلاحيات كاملة للكتابة)
      try {
        await targetJailChannel.permissionOverwrites.edit(jailRole, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
          UseExternalEmojis: true,
          AddReactions: true,
        }, { reason: `سجن ${member.user.tag}` });
      } catch (e) {
        logger.error('Failed to set jail channel permissions:', e);
        await interaction.editReply({ content: '❌ فشل إعداد صلاحيات روم السجن — تأكد أن رتبة البوت أعلى من رول السجن ولديه ManageChannels' });
        return;
      }

      // تسجيل القنوات التي فشلت (للتشخيص)
      if (failedChannels.length > 0) {
        logger.warn(`Jail: failed to set overwrites on ${failedChannels.length} channels:`, failedChannels.slice(0, 10));
        // لا نفشل الأمر بالكامل — بعض القنوات قد تكون مقفلة أو البوت بلا صلاحية فيها
      }

      logger.info(`Jail: applied overwrites to ${successCount} channels, failed: ${failedChannels.length}`);

      // جدولة الإفراج التلقائي إن وُجدت مدة — معطل بناءً على الطلب (إفراج يدوي فقط)
      // if (duration) {
      //   const ms = parseDuration(duration);
      //   if (ms) {
      //     setTimeout(async () => {
      //       try {
      //         await unjailUser(guild, member.id, jailRole, currentRoles, 'انتهت مدة السجن');
      //       } catch (e) {
      //         logger.error('Auto unjail failed:', e);
      //       }
      //     }, ms);
      //   }
      // }

      // الرد
      const embed = new EmbedBuilder()
        .setTitle('🔒 تم سجن العضو')
        .setColor(Colors.error)
        .addFields(
          { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
          { name: '🔒 روم السجن', value: `${targetJailChannel}`, inline: true },
          { name: '🛡️ المنفذ', value: `${interaction.user}`, inline: true },
          { name: '📝 السبب', value: reason, inline: false },
          { name: '⏱️ المدة', value: duration || 'دائم (يحتاج إفراج يدوي)', inline: true },
        )
        .setTimestamp()
        .setFooter({ text: `Liberty City | ${guild.name}` });

      await interaction.editReply({ embeds: [embed] });

      // تسجيل في السجلات
      try {
        const settings = await getGuildSettings(guild.id);
        if (settings.logging?.enabled && settings.logging.channelId) {
          const logChannel = guild.channels.cache.get(settings.logging.channelId);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🔒 سجن عضو')
              .setColor(Colors.error)
              .addFields(
                { name: '👤 العضو', value: `${member} (\`${member.id}\`)`, inline: true },
                { name: '🔒 روم السجن', value: `${targetJailChannel}`, inline: true },
                { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true },
                { name: '📝 السبب', value: reason, inline: false },
              )
              .setTimestamp();
            await (logChannel as any).send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      } catch {}

      // إرسال رسالة في روم السجن
      try {
        await targetJailChannel.send({
          content: `<@${member.id}> 🔒 **تم سجنك**\n**السبب:** ${reason}\n**المدة:** ${duration || 'دائم'}\n\nأنت الآن في سجن السيرفر. يمكنك التحدث هنا فقط. احترم القوانين لتفرج عنك.`
        }).catch(() => {});
      } catch {}

    } catch (error: any) {
      logger.error('Jail command failed:', error);
      await interaction.editReply({
        content: `❌ حدث خطأ أثناء سجن العضو:\n\`\`\`${error?.message || error}\`\`\``,
      }).catch(() => {});
    }
  },
};

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 0);
}

async function unjailUser(
  guild: any,
  userId: string,
  jailRole: any,
  previousRoles: string[],
  reason: string
): Promise<void> {
  try {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    // إزالة رول السجن
    if (member.roles.cache.has(jailRole.id)) {
      await member.roles.remove(jailRole, reason);
    }

    // استعادة الرولات السابقة
    for (const roleId of previousRoles) {
      const role = guild.roles.cache.get(roleId);
      if (role && !member.roles.cache.has(roleId)) {
        try {
          await member.roles.add(role, reason);
        } catch {}
      }
    }

    // تنظيف بيانات السجن
    const { JailData } = await import('../../models');
    await JailData.findOneAndDelete({ guildId: guild.id, userId });

    logger.info(`Auto-unjail: ${userId} in ${guild.name}`);
  } catch (error) {
    logger.error('Unjail failed:', error);
  }
}

export default command;