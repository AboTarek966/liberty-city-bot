// ============================================
// Omni Bot - Settings Access Command
// 🔐 ذو الملكية الرسمية للسيرفر فقط يحدد من يقدر يستخدم لوحة الإعدادات.
//    حتى لا أعلى رول في السيرفر يقدر فتح/تعديل الإعدادات بدون إذن المالك.
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { getGuildSettings, invalidateGuildSettings } from '../../models';
import { Colors } from '../../utils/embeds';
import { isBotOwner } from '../../utils/botOwner';

async function requireServerOwner(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
    return false;
  }
  if (
    interaction.guild.ownerId !== interaction.user.id &&
    !(await isBotOwner(interaction.client, interaction.user.id))
  ) {
    await interaction.reply({
      content:
        '❌ **هذا الأمر لمالك السيرفر أو مالك/مطوّر البوت فقط** (صاحب التاج 👑 أو 🛠️ مطوّر البوت).\n' +
        'حتى أعلى رول في السيرفر مو قادر يستخدم هذا الأمر أو يفتح الإعدادات بدون إذن.',
      ephemeral: true,
    });
    return false;
  }
  return true;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('settings-access')
    .setDescription('🔐 التحكم بمن يقدر يستخدم لوحة الإعدادات — مالك السيرفر أو مالك/مطوّر البوت')
    .setDefaultMemberPermissions(0)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('إضافة عضو إلى من يقدر يفتح ويستخدم الإعدادات')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('العضو المسموح له باستخدام الإعدادات').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('note').setDescription('ملاحظة اختيارية (لماذا سمحت له)').setRequired(false).setMaxLength(200)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('سحب إذن استخدام الإعدادات من عضو')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('العضو المراد إزالة إذن الإعدادات منه').setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('عرض كل المخوّلين باستخدام الإعدادات'))
    .addSubcommand((sub) => sub.setName('reset').setDescription('مسح كل المخوّلين دفعة واحدة (المالك فقط يبقى)')),

  guildOnly: true,
  cooldown: 2,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await requireServerOwner(interaction))) return;

    const guild = interaction.guild!;
    const sub = interaction.options.getSubcommand(true);
    await interaction.deferReply({ ephemeral: true });

    const settings: any = await getGuildSettings(guild.id);
    const allowlist: string[] = Array.isArray(settings?.settingsAllowlist)
      ? settings.settingsAllowlist.map(String)
      : [];

    const persist = async () => {
      settings.settingsAllowlist = allowlist;
      if (typeof settings.markModified === 'function') {
        settings.markModified('settingsAllowlist');
      }
      await settings.save();
      invalidateGuildSettings(guild.id);
    };

    if (sub === 'add') {
      const target = interaction.options.getUser('user', true);
      const note = interaction.options.getString('note') || '';

      if (target.id === guild.ownerId) {
        await interaction.editReply({ content: '👑 مالك السيرفر يملك استخدام الإعدادات أصلاً — لا يحتاج إذن.' });
        return;
      }
      if (target.bot) {
        await interaction.editReply({ content: '⛔ البوتات لا تزود بإذن الإعدادات — المستخدم وحده.' });
        return;
      }
      if (allowlist.includes(target.id)) {
        await interaction.editReply({ content: `ℹ️ ${target} يملك استخدام الإعدادات بالفعل.` });
        return;
      }
      allowlist.push(target.id);
      await persist();

      const embed = new EmbedBuilder()
        .setTitle('🔐 أُضيف مخول جديد للإعدادات')
        .setColor(Colors.success)
        .setDescription(
          `✅ ${target} (\`${target.id}\`) صار يقدر يفتح ويستخدم لوحة الإعدادات.\n\n` +
            `⚠️ **لا تعطي هذا الإذن إلا لمن تثق فيه بالكامل** — الإعدادات تتحكم بكل شيء في السيرفر.` +
            (note ? `\n📝 ملاحظة: ${note.slice(0, 200)}` : '')
        )
        .setFooter({ text: `${guild.name} • Settings Access` })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'remove') {
      const target = interaction.options.getUser('user', true);
      const idx = allowlist.indexOf(target.id);
      if (idx < 0) {
        await interaction.editReply({ content: `ℹ️ ${target} مو مخول لاستخدام الإعدادات.` });
        return;
      }
      allowlist.splice(idx, 1);
      await persist();
      await interaction.editReply({
        content: `🗑️ سُحبت صلاحية إعدادات ${target} — عاد محظوراً من فتح اللوحة، حتى لو كان عنده أعلى رول.`,
      });
      return;
    }

    if (sub === 'list') {
      const members = await Promise.all(
        allowlist.map(async (id) => {
          const user = await interaction.client.users.fetch(id).catch(() => null);
          return user ? `${user} (\`${id}\`)` : `\`${id}\` (مستخدم غير موجود)`;
        })
      );

      const embed = new EmbedBuilder()
        .setTitle('🔐 المخوّلون باستخدام الإعدادات')
        .setColor(Colors.primary)
        .setDescription(
          `👑 **المالك:** <@${guild.ownerId}> (صاحب التاج — دائماً مسموح)\n\n` +
            (members.length
              ? members.map((m, i) => `${i + 1}. ${m}`).join('\n')
              : '📭 لا يوجد أحد غير المالك — الإعدادات مقفلة على المالك فقط.')
        )
        .setFooter({ text: `إجمالي المخوّلين: ${members.length} • ${guild.name}` })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (sub === 'reset') {
      settings.settingsAllowlist = [];
      if (typeof settings.markModified === 'function') {
        settings.markModified('settingsAllowlist');
      }
      await settings.save();
      invalidateGuildSettings(guild.id);
      await interaction.editReply({
        content: '♻️ مُسح كل المخوّلين — الإعدادات الآن مقفلة على **مالك السيرفر ومالك/مطوّر البوت فقط** (عداهم ما أحد يقدر، حتى لا أعلى رول).',
      });
      return;
    }
  },
};

export default command;
