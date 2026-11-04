// ============================================
// Omni Bot - AI Knowledge Base Command
// ============================================
// /knowledge add | remove | list | search
// يدير قاعدة المعرفة التي تُحقن في سياق AI (الدردشة + التذاكر).

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ApplicationCommandOptionChoiceData,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { KnowledgeEntry } from '../../models';
import { Colors } from '../../utils/embeds';
import { normalizeArabic, searchKnowledge, invalidateKnowledgeCache } from '../../utils/knowledge';

const PAGE_SIZE = 8;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('knowledge')
    .setDescription('📚 قاعدة معرفة الذكاء الاصطناعي — أضف معلومات موثوقة يستخدمها AI')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('إضافة أو تحديث معلومة')
        .addStringOption(o =>
          o.setName('title').setDescription('عنوان المعلومة').setRequired(true).setMaxLength(200)
        )
        .addStringOption(o =>
          o.setName('content').setDescription('المحتوى الكامل').setRequired(true).setMaxLength(4000)
        )
        .addStringOption(o =>
          o.setName('tags').setDescription('وسوم مفصولة بفاصلة (مثال: تذاكر، رولات)').setMaxLength(300)
        )
        .addStringOption(o =>
          o.setName('category').setDescription('التصنيف (مثال: تذاكر، حماية، عام)').setMaxLength(50)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('حذف معلومة')
        .addStringOption(o =>
          o.setName('id').setDescription('اختر المعلومة').setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('عرض معلومات القاعدة')
        .addIntegerOption(o =>
          o.setName('page').setDescription('رقم الصفحة').setMinValue(1).setMaxValue(100)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('search')
        .setDescription('بحث في قاعدة المعرفة')
        .addStringOption(o => o.setName('query').setDescription('كلمة البحث').setRequired(true))
    ),

  cooldown: 3,
  permissions: [PermissionFlagsBits.ManageGuild],

  async autocomplete(interaction: AutocompleteInteraction) {
    if (!interaction.guildId) {
      await interaction.respond([]);
      return;
    }
    if (interaction.options.getSubcommand() !== 'remove') {
      await interaction.respond([]);
      return;
    }

    const focused = interaction.options.getFocused(true);
    const needle = normalizeArabic(String(focused.value || ''));
    const entries = await KnowledgeEntry.find({ guildId: interaction.guildId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    const choices: ApplicationCommandOptionChoiceData[] = entries
      .filter(entry => !needle || normalizeArabic(`${entry.title} ${entry.category}`).includes(needle))
      .slice(0, 25)
      .map(entry => ({
        name: `${entry.title}`.slice(0, 100),
        value: entry._id.toString(),
      }));

    await interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      await handleAdd(interaction);
      return;
    }
    if (sub === 'remove') {
      await handleRemove(interaction);
      return;
    }
    if (sub === 'list') {
      await handleList(interaction);
      return;
    }
    if (sub === 'search') {
      await handleSearch(interaction);
    }
  },
};

// --------------------------------------------
// Add / update
// --------------------------------------------
async function handleAdd(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;
  const title = interaction.options.getString('title', true).trim();
  const content = interaction.options.getString('content', true).trim();
  const tags = (interaction.options.getString('tags') || '')
    .split(/[,،]/)
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
  const category = interaction.options.getString('category')?.trim() || 'عام';

  if (title.length < 2 || content.length < 5) {
    await interaction.editReply({ content: '❌ العنوان أو المحتوى قصير جداً' });
    return;
  }

  const existing = await KnowledgeEntry.findOne({ guildId, title });
  if (existing) {
    existing.content = content;
    existing.tags = tags;
    existing.category = category;
    existing.createdBy = interaction.user.id;
    existing.enabled = true;
    await existing.save();
    invalidateKnowledgeCache(guildId);

    await interaction.editReply({
      content:
        `♻️ **تم تحديث المعلومة الموجودة**\n` +
        `> 📝 ${title}\n` +
        `> 🆔 \`${existing._id.toString()}\``,
    });
    return;
  }

  const entry = await KnowledgeEntry.create({
    guildId,
    title,
    content,
    tags,
    category,
    createdBy: interaction.user.id,
    enabled: true,
  });
  invalidateKnowledgeCache(guildId);

  await interaction.editReply({
    content:
      `✅ **تمت إضافة المعلومة إلى قاعدة المعرفة**\n` +
      `> 📝 ${title}\n` +
      `> 🏷️ التصنيف: ${category}\n` +
      `> 📌 الوسوم: ${tags.length ? tags.join('، ') : '—'}\n` +
      `> 🆔 \`${entry._id.toString()}\`\n\n` +
      `🤖 سيستخدمها AI تلقائياً في الدردشة والتذاكر عند relevancy.`,
  });
}

// --------------------------------------------
// Remove
// --------------------------------------------
async function handleRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const id = interaction.options.getString('id', true);
  const entry = /^[a-f\d]{24}$/i.test(id)
    ? await KnowledgeEntry.findOneAndDelete({ _id: id, guildId: interaction.guildId! })
    : null;

  if (!entry) {
    await interaction.editReply({ content: '❌ لم أجد هذه المعلومة' });
    return;
  }

  invalidateKnowledgeCache(interaction.guildId!);
  await interaction.editReply({ content: `🗑️ **تم حذف المعلومة:** ${entry.title}` });
}

// --------------------------------------------
// List
// --------------------------------------------
async function handleList(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guildId!;
  const page = interaction.options.getInteger('page') || 1;

  const total = await KnowledgeEntry.countDocuments({ guildId });
  if (!total) {
    await interaction.editReply({
      content: '📭 قاعدة المعرفة فارغة — أضف معلومة بـ `/knowledge add`',
    });
    return;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const entries = await KnowledgeEntry.find({ guildId })
    .sort({ updatedAt: -1 })
    .skip((safePage - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE);

  const embed = new EmbedBuilder()
    .setTitle('📚 قاعدة معرفة الذكاء الاصطناعي')
    .setColor(Colors.primary)
    .setDescription(
      entries
        .map(
          (entry, index) =>
            `**${(safePage - 1) * PAGE_SIZE + index + 1}. ${entry.title}**\n` +
            `> 🏷️ ${entry.category} • ${entry.enabled ? '🟢 مفعّلة' : '🔴 معطّلة'}\n` +
            `> 🆔 \`${entry._id.toString()}\`\n` +
            `> ${entry.content.replace(/\s+/g, ' ').slice(0, 110)}${entry.content.length > 110 ? '…' : ''}`
        )
        .join('\n\n')
    )
    .setFooter({ text: `صفحة ${safePage}/${pages} • ${total} معلومة • ${interaction.guild!.name} AI` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// --------------------------------------------
// Search
// --------------------------------------------
async function handleSearch(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const query = interaction.options.getString('query', true);
  const matches = await searchKnowledge(interaction.guildId!, query, 10);

  if (!matches.length) {
    await interaction.editReply({
      content: `🔎 لا توجد نتائج لـ **${query}** — جرّب كلمات أخرى أو أضف المعلومة.`,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔎 نتائج البحث: ${query}`)
    .setColor(Colors.info)
    .setDescription(
      matches
        .map(
          (match, index) =>
            `**${index + 1}. ${match.entry.title}** — \`${match.score}\` نقطة\n` +
            `> 🏷️ ${match.entry.category}\n` +
            `> ${match.entry.content.replace(/\s+/g, ' ').slice(0, 180)}${
              match.entry.content.length > 180 ? '…' : ''
            }\n` +
            `> 🆔 \`${match.entry._id.toString()}\``
        )
        .join('\n\n')
    )
    .setFooter({ text: `${matches.length} نتيجة • ${interaction.guild!.name} AI` })
    .setTimestamp();

  // عدّاد الاستخدام — في الخلفية
  void KnowledgeEntry.updateMany(
    { _id: { $in: matches.map(m => m.entry._id) } },
    { $inc: { uses: 1 } }
  ).catch(() => {});

  await interaction.editReply({ embeds: [embed] });
}

export default command;
