// ============================================
// Liberty City Bot - Whitelist Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  User,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('إدارة القائمة البيضاء (للعرض فقط — لا تمنح أي استثناء أمني)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('إضافة مستخدم للقائمة البيضاء (للعرض فقط)')
        .addUserOption(option =>
          option.setName('user').setDescription('المستخدم المراد إضافته').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason').setDescription('السبب').setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('إزالة مستخدم من القائمة البيضاء')
        .addUserOption(option =>
          option.setName('user').setDescription('المستخدم المراد إزالته').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('عرض أعضاء القائمة البيضاء')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('تفعيل/تعطيل القائمة البيضاء (لا تؤثر على الحماية)')
        .addBooleanOption(option =>
          option.setName('enabled').setDescription('حالة التفعيل').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    await interaction.deferReply({ ephemeral: true });

    const settings = await getGuildSettings(guild.id);
    if (!settings.protection.whitelist) {
      settings.protection.whitelist = { enabled: false, userIds: [] };
    }
    const wl = settings.protection.whitelist;

    if (subcommand === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled', true);
      wl.enabled = enabled;
      await settings.save();
      await interaction.editReply({
        content:
          `${enabled ? '✅ تم تفعيل' : '❌ تم تعطيل'} القائمة البيضاء\n` +
          '⚠️ للعرض فقط — لا تمنح أي استثناء أمني، والجميع يُعامل بالتساوي.',
      });
      return;
    }

    if (subcommand === 'add') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

      if (wl.userIds.includes(user.id)) {
        await interaction.editReply({ content: `⚠️ ${user} موجود بالفعل في القائمة البيضاء` });
        return;
      }

      wl.userIds.push(user.id);
      await settings.save();

      const embed = new EmbedBuilder()
        .setTitle('✅ تم إضافة عضو للقائمة البيضاء')
        .setColor(Colors.success)
        .addFields(
          { name: '👤 المستخدم', value: `${user} (\`${user.id}\`)`, inline: true },
          { name: '📝 السبب', value: reason, inline: true },
          { name: '🛡️ بواسطة', value: `${interaction.user}`, inline: true },
          {
            name: '⚠️ تنبيه',
            value: 'هذه القائمة للعرض فقط — لا تمنح أي استثناء. العضو أو البوت هنا يُعاقب مثل أي شخص آخر.',
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'remove') {
      const user = interaction.options.getUser('user', true);

      if (!wl.userIds.includes(user.id)) {
        await interaction.editReply({ content: `⚠️ ${user} غير موجود في القائمة البيضاء` });
        return;
      }

      wl.userIds = wl.userIds.filter(id => id !== user.id);
      await settings.save();

      await interaction.editReply({ content: `✅ تم إزالة ${user} من القائمة البيضاء` });
      return;
    }

    if (subcommand === 'list') {
      if (wl.userIds.length === 0) {
        await interaction.editReply({ content: '📋 القائمة البيضاء فارغة' });
        return;
      }

      const members = await Promise.all(
        wl.userIds.map(async (id) => {
          const user = await interaction.client.users.fetch(id).catch(() => null);
          return user ? `${user} (\`${id}\`)` : `\`${id}\` (مستخدم غير موجود)`;
        })
      );

      const embed = new EmbedBuilder()
        .setTitle('👑 أعضاء القائمة البيضاء')
        .setColor(Colors.info)
        .setDescription(
          '⚠️ للعرض فقط — لا تمنح أي استثناء أمني.\n\n' +
          members.map((m, i) => `${i + 1}. ${m}`).join('\n')
        )
        .setFooter({ text: `إجمالي: ${wl.userIds.length} عضو (بدون صلاحيات)` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};

export default command;