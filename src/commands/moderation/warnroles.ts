// ============================================
// Liberty City Bot - WarnRoles Debug Command
// تشخيص إعدادات رولات التحذير التسلسلية
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildMember,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { getGuildSettings, invalidateGuildSettings } from '../../models';
import { GuildSettings } from '../../models';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warnroles')
    .setDescription('تشخيص وإدارة رولات التحذير التسلسلية')
    .addSubcommand(sub =>
      sub
        .setName('debug')
        .setDescription('فحص إعدادات رولات التحذير التسلسلية في قاعدة البيانات')
    )
    .addSubcommand(sub =>
      sub
        .setName('refresh')
        .setDescription('إعادة تحميل إعدادات رولات التحذير من قاعدة البيانات')
    )
    .addSubcommand(sub =>
      sub
        .setName('test')
        .setDescription('اختبار إعطاء رول تحذير تسلسلي لإداري')
        .addUserOption(opt =>
          opt.setName('target').setDescription('الإداري المراد تحذيره').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('level').setDescription('مستوى التحذير (1/2/3)').setRequired(true).setMinValue(1).setMaxValue(3)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    await interaction.deferReply({ ephemeral: true });

    try {
      if (subcommand === 'debug') {
        // إبطال الكاش وجلب بيانات طازجة
        invalidateGuildSettings(guild.id);
        const settings = await getGuildSettings(guild.id);
        const sequential = settings.warnRoles?.adminSequential || {};

        const embed = {
          title: '🔍 تشخيص رولات التحذير التسلسلية',
          color: 0x00D4FF,
          fields: [
            {
              name: '📊 البيانات من قاعدة البيانات',
              value: [
                `**role1Id:** ${sequential.role1Id || '❌ غير مضبوط'}`,
                `**role2Id:** ${sequential.role2Id || '❌ غير مضبوط'}`,
                `**role3Id:** ${sequential.role3Id || '❌ غير مضبوط'}`,
              ].join('\n'),
              inline: false,
            },
            {
              name: '🔍 تحقق من وجود الرولات في السيرفر',
              value: [
                `role1Id: ${sequential.role1Id ? (interaction.guild!.roles.cache.has(sequential.role1Id) ? '✅ موجود' : '❌ غير موجود في السيرفر') : '❌ غير مضبوط'}`,
                `role2Id: ${sequential.role2Id ? (interaction.guild!.roles.cache.has(sequential.role2Id) ? '✅ موجود' : '❌ غير موجود في السيرفر') : '❌ غير مضبوط'}`,
                `role3Id: ${sequential.role3Id ? (interaction.guild!.roles.cache.has(sequential.role3Id) ? '✅ موجود' : '❌ غير موجود في السيرفر') : '❌ غير مضبوط'}`,
              ].join('\n'),
              inline: false,
            },
            {
              name: '📦 الكاش',
              value: `TTL: 30 ثانية\nاستخدم \`/warnroles refresh\` لمسح الكاش`,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
        };

        await interaction.editReply({ embeds: [embed] });

      } else if (subcommand === 'refresh') {
        invalidateGuildSettings(guild.id);
        const freshSettings = await getGuildSettings(guild.id);
        await interaction.editReply({
          content: `✅ تم تحديث الإعدادات من قاعدة البيانات\n\n**البيانات الحالية:**\n1️⃣ ${freshSettings.warnRoles?.adminSequential?.role1Id ? `<@&${freshSettings.warnRoles.adminSequential.role1Id}>` : '❌'}\n2️⃣ ${freshSettings.warnRoles?.adminSequential?.role2Id ? `<@&${freshSettings.warnRoles.adminSequential.role2Id}>` : '❌'}\n3️⃣ ${freshSettings.warnRoles?.adminSequential?.role3Id ? `<@&${freshSettings.warnRoles.adminSequential.role3Id}>` : '❌'}`,
        });

      } else if (subcommand === 'test') {
        const target = interaction.options.getUser('target', true);
        const level = interaction.options.getInteger('level', true);

        const member = await guild.members.fetch(target.id).catch(() => null);
        if (!member) {
          await interaction.editReply({ content: '❌ العضو غير موجود في السيرفر' });
          return;
        }

        invalidateGuildSettings(guild.id);
        const settings = await getGuildSettings(guild.id);

        // محاكاة التحذير التسلسلي
        const { applySequentialAdminWarnRoles } = await import('../../utils/warnRoles');
        const result = await applySequentialAdminWarnRoles({
          settings,
          guild,
          executor: interaction.member as GuildMember,
          target: member,
          reason: `اختبار تحذير تسلسلي رقم ${level}`,
        });

        if (result) {
          await interaction.editReply({ content: `✅ ${result}` });
        } else {
          await interaction.editReply({ content: `❌ فشل: لا يوجد رول تحذير رقم ${level} مُعد أو العضو مش إداري` });
        }
      }
    } catch (error: any) {
      await interaction.editReply({ content: `❌ خطأ: ${error.message}` });
    }
  },
};

export default command;