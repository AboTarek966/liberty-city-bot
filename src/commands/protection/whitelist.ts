// ============================================
// Omni Bot - Whitelist Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  User,
  Guild,
  Client,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getGuildSettings, invalidateGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';
import { isBotOwner } from '../../utils/botOwner';

/** 🛡️ إدارة الوايت ليست (إضافة/إزالة) للبشر = مالك البوت فقط + صاحب أعلى رول في السيرفر */
export async function canManageWhitelist(client: Client, guild: Guild, userId: string): Promise<boolean> {
  // 🛠️ مالك البوت
  if (await isBotOwner(client, userId)) return true;
  // 👑 صاحب أعلى رول في السيرفر (ومنطقي فقط لو السيرفر فيه رول أعلى من @everyone)
  if (!guild || guild.roles.highest.position <= 0) return false;
  let member = guild.members.cache.get(userId);
  if (!member) member = await guild.members.fetch(userId).catch(() => undefined);
  if (!member) return false;
  return member.roles.highest.position === guild.roles.highest.position;
}

/** 👑 إضافة/إزالة **بوت** من أي وايت ليست = مالك السيرفر أو مالك/مطوّر البوت — لا أعلى رول */
export async function canManageBotWhitelist(
  client: Client,
  guild: Guild,
  userId: string
): Promise<boolean> {
  // 🛠️ مالك/مطوّر البوت — يتجاوز بوابة مالك السيرفر
  if (await isBotOwner(client, userId)) return true;
  // 👑 مالك السيرفر صاحب التاج
  return !!guild && guild.ownerId === userId;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('القائمة البيضاء — استثناء من الحظر الوقائي فقط، والهجوم السريع يُعاقب')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('إضافة مستخدم/بوت للقائمة البيضاء (استثناء وقائي فقط)')
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
        .setDescription('تفعيل/تعطيل استثناء الحظر الوقائي')
        .addBooleanOption(option =>
          option.setName('enabled').setDescription('حالة التفعيل').setRequired(true)
        )
    )
    // 🎯 السماح للجميع بفتح الأمر — التحكم الفعلي مضمون في الكود (مالك البوت + أعلى رول فقط)
    .setDefaultMemberPermissions(0)
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
      invalidateGuildSettings(guild.id);
      await interaction.editReply({
        content:
          `${enabled ? '✅ تم تفعيل' : '❌ تم تعطيل'} استثناء القائمة البيضاء\n` +
          '🛡️ المفعّل: لا يُحظر البوت/العضو وقائياً عند الدخول أو الفحص التلقائي — لكن أي هجوم سريع (حذف/إنشاء/تعديل جماعي) يُعاقب فوراً.',
      });
      return;
    }

    if (subcommand === 'add') {
      const user = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason') || 'لا يوجد سبب';

      // 🔒 إضافة بشر للوايت ليست = مالك البوت أو صاحب أعلى رول في السيرفر فقط
      //    🔒 إضافة **بوت** = مالك السيرفر أو مالك/مطوّر البوت — لا أحد غيرهما
      const allowed = user.bot
        ? await canManageBotWhitelist(interaction.client, guild, interaction.user.id)
        : await canManageWhitelist(interaction.client, guild, interaction.user.id);
      if (!allowed) {
        await interaction.editReply({
          content: user.bot
            ? '⛔ **إضافة بوت للوايت ليست محصورة بمالك السيرفر أو مالك/مطوّر البوت فقط**\n' +
              'حتى صاحب أعلى رول مو قادر يضيفه — لو بوتك تبيه مرخص، لازم يرفعه المالك الرسمي أو مطوّر البوت.'
            : '🔒 **إضافة أي عضو للقائمة البيضاء محصورة بمالك البوت وصاحب أعلى رول في السيرفر فقط**\n' +
              'إذا كنت تحتاج استثناء شخص معين، تواصل مع 👑 صاحب أعلى رول أو 🛠️ مالك البوت.',
        });
        return;
      }

      if (wl.userIds.includes(user.id)) {
        if (!wl.enabled) {
          wl.enabled = true;
          await settings.save();
          invalidateGuildSettings(guild.id);
          await interaction.editReply({
            content:
              `⚠️ ${user} موجود بالفعل — وتم **تفعيل** القائمة البيضاء تلقائياً.\n` +
              '🛡️ استثناء وقائي فقط، وأي هجوم سريع يُعاقب.',
          });
          return;
        }
        await interaction.editReply({ content: `⚠️ ${user} موجود بالفعل في القائمة البيضاء` });
        return;
      }

      wl.userIds.push(user.id);
      wl.enabled = true; // الإضافة تعني الاستثناء الوقائي فوراً
      await settings.save();
      invalidateGuildSettings(guild.id);

      const embed = new EmbedBuilder()
        .setTitle('✅ تم إضافة عضو للقائمة البيضاء')
        .setColor(Colors.success)
        .addFields(
          { name: '👤 المستخدم', value: `${user} (\`${user.id}\`)`, inline: true },
          { name: '📝 السبب', value: reason, inline: true },
          { name: '🛡️ بواسطة', value: `${interaction.user}`, inline: true },
          {
            name: '✅ الحالة',
            value: 'تم تفعيل الاستثناء الوقائي تلقائياً.',
            inline: false,
          },
          {
            name: '⚠️ تنبيه',
            value:
              'هذا استثناء من الحظر الوقائي فقط (الدخول/الفحص التلقائي).\n' +
              '🚨 أي هجوم سريع — حذف/إنشاء/تعديل جماعي أو سبام — يُعاقب فوراً كأي مخالف.',
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'remove') {
      const user = interaction.options.getUser('user', true);

      // 🔒 إزالة بشر من الوايت ليست = مالك البوت أو صاحب أعلى رول في السيرفر فقط
      //    🔒 إزالة **بوت** = مالك السيرفر أو مالك/مطوّر البوت
      const removeAllowed = user.bot
        ? await canManageBotWhitelist(interaction.client, guild, interaction.user.id)
        : await canManageWhitelist(interaction.client, guild, interaction.user.id);
      if (!removeAllowed) {
        await interaction.editReply({
          content: user.bot
            ? '⛔ **إزالة بوت من الوايت ليست محصورة بمالك السيرفر أو مالك/مطوّر البوت فقط**'
            : '🔒 **إزالة أي عضو من القائمة البيضاء محصورة بمالك البوت أو صاحب أعلى رول في السيرفر**',
        });
        return;
      }

      if (!wl.userIds.includes(user.id)) {
        await interaction.editReply({ content: `⚠️ ${user} غير موجود في القائمة البيضاء` });
        return;
      }

      wl.userIds = wl.userIds.filter(id => id !== user.id);
      await settings.save();
      invalidateGuildSettings(guild.id);

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
          `${wl.enabled ? '✅ الاستثناء الوقائي مفعّل' : '⚠️ الاستثناء الوقائي معطّل (toggle)'}\n` +
          '🛡️ لا يُحظرون وقائياً — لكن الهجوم السريع يُعاقب.\n\n' +
          members.map((m, i) => `${i + 1}. ${m}`).join('\n')
        )
        .setFooter({ text: `إجمالي: ${wl.userIds.length} عضو/بوت (استثناء وقائي فقط)` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  },
};

export default command;