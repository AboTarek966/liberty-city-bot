// ============================================
// Liberty City Bot - AI Command
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';
import { LibertyClient } from '../../LibertyClient';
import { Colors } from '../../utils/embeds';
import { getGuildSettings } from '../../models';
import { config } from '../../config';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('المحادثة مع الذكاء الاصطناعي')
    .addSubcommand(sub =>
      sub
        .setName('chat')
        .setDescription('الدردشة مع الذكاء الاصطناعي')
        .addStringOption(opt =>
          opt
            .setName('message')
            .setDescription('رسالتك للذكاء الاصطناعي')
            .setRequired(true)
            .setMaxLength(2000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('ask')
        .setDescription('اسأل سؤالاً محدداً')
        .addStringOption(opt =>
          opt
            .setName('question')
            .setDescription('سؤالك')
            .setRequired(true)
            .setMaxLength(2000)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('مسح سجل المحادثة')
    )
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('معلومات عن نظام الذكاء الاصطناعي')
    )
    .addSubcommand(sub =>
      sub
        .setName('config')
        .setDescription('إعدادات الذكاء الاصطناعي (للمشرفين)')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('تفعيل أو تعطيل')
        )
        .addStringOption(opt =>
          opt
            .setName('system_prompt')
            .setDescription('موجه النظام للبوت')
            .setMaxLength(1000)
        )
        .addNumberOption(opt =>
          opt
            .setName('temperature')
            .setDescription('درجة الإبداع (0.0 - 2.0)')
            .setMinValue(0)
            .setMaxValue(2)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(true),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as LibertyClient;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'chat':
      case 'ask':
        return handleChat(interaction, client, subcommand);
      case 'clear':
        return handleClear(interaction, client);
      case 'info':
        return handleInfo(interaction, client);
      case 'config':
        return handleConfig(interaction, client);
    }
  },
};

// --------------------------------------------
// Chat
// --------------------------------------------
async function handleChat(
  interaction: ChatInputCommandInteraction,
  client: LibertyClient,
  type: 'chat' | 'ask'
): Promise<void> {
  const message = interaction.options.getString(type === 'chat' ? 'message' : 'question', true);

  // Check if AI is available
  if (!client.aiHandler.isAvailable()) {
    await interaction.reply({
      content: '❌ الذكاء الاصطناعي غير متاح حالياً. تأكد من ضبط مفتاح API في الإعدادات',
      ephemeral: true,
    });
    return;
  }

  // Check guild settings
  if (interaction.guildId) {
    const settings = await getGuildSettings(interaction.guildId);
    if (!settings.ai.enabled) {
      await interaction.reply({
        content: '❌ الذكاء الاصطناعي معطل في هذا السيرفر',
        ephemeral: true,
      });
      return;
    }

    // Check if channel is allowed
    if (settings.ai.allowedChannels.length > 0 && !settings.ai.allowedChannels.includes(interaction.channelId!)) {
      await interaction.reply({
        content: '❌ الذكاء الاصطناعي غير مسموح في هذه القناة',
        ephemeral: true,
      });
      return;
    }

    // Check if channel is ignored
    if (settings.ai.ignoredChannels.includes(interaction.channelId!)) {
      await interaction.reply({
        content: '❌ الذكاء الاصطناعي معطل في هذه القناة',
        ephemeral: true,
      });
      return;
    }
  }

  // Check cooldown
  const cooldown = client.aiHandler.checkCooldown(interaction.user.id);
  if (cooldown.onCooldown) {
    await interaction.reply({
      content: `⏳ يرجى الانتظار **${Math.ceil(cooldown.remaining / 1000)} ثانية** قبل استخدام الذكاء الاصطناعي مجدداً`,
      ephemeral: true,
    });
    return;
  }

  // Defer reply
  await interaction.deferReply();

  try {
    // Set cooldown
    client.aiHandler.setCooldown(interaction.user.id, interaction.guildId || undefined);

    // 📡 بث مباشر — الرد يظهر تدريجياً أثناء التوليد
    let lastEditAt = 0;
    const preview = (text: string): string =>
      text.length > 1900 ? text.slice(0, 1900) + '\n…' : text;
    const stream = {
      onFirstChunk: async (text: string) => {
        lastEditAt = Date.now();
        await interaction.editReply({ content: preview(text) }).catch(() => {});
      },
      onUpdate: async (text: string) => {
        const now = Date.now();
        if (now - lastEditAt < 1200) return;
        lastEditAt = now;
        await interaction.editReply({ content: preview(text) }).catch(() => {});
      },
    };

    // Generate response (isMention=true for slash command usage)
    const response = await client.aiHandler.generateResponse(
      interaction.user.id,
      interaction.guildId || undefined,
      interaction.channelId,
      message,
      [],
      true,
      false,
      { stream }
    );

    if (!response) {
      await interaction.editReply({
        content: '❌ لم أتمكن من توليد رد. حاول مرة أخرى لاحقاً',
      });
      return;
    }

    // Split long responses
    const chunks = splitMessage(response.content, 4000);

    await interaction.editReply({
      content: chunks[0],
      allowedMentions: { parse: ['users', 'roles', 'everyone'] as const },
    });

    // Send remaining chunks
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ 
        content: chunks[i],
        allowedMentions: { parse: ['users', 'roles', 'everyone'] as const }
      });
    }
  } catch (error: any) {
    const errorMessage = error.message;

    if (errorMessage.startsWith('COOLDOWN:')) {
      const seconds = errorMessage.split(':')[1];
      await interaction.editReply({
        content: `⏳ يرجى الانتظار **${seconds} ثانية** قبل استخدام الذكاء الاصطناعي مجدداً`,
      });
    } else {
      await interaction.editReply({
        content: `❌ حدث خطأ: ${errorMessage}`,
      });
    }
  }
}

// --------------------------------------------
// Clear
// --------------------------------------------
async function handleClear(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  await client.aiHandler.clearHistory(
    interaction.user.id,
    interaction.guildId || 'dm',
    interaction.channelId
  );

  await interaction.editReply({
    content: '✅ تم مسح سجل المحادثة بنجاح',
  });
}

// --------------------------------------------
// Info
// --------------------------------------------
async function handleInfo(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const providerInfo = client.aiHandler.getProviderInfo();
  const sessionInfo = await client.aiHandler.getSessionInfo(
    interaction.user.id,
    interaction.guildId || 'dm',
    interaction.channelId
  );

  await interaction.editReply({
    content:
      `🤖 المزود: ${providerInfo.provider} • النموذج: ${providerInfo.model} • ${
        client.aiHandler.isAvailable() ? '✅ متاح' : '❌ غير متاح'
      } • رسائلك هنا: ${sessionInfo.messageCount} • الكولداون: ${config.ai.cooldown / 1000}ث`,
  });
}

// --------------------------------------------
// Config
// --------------------------------------------
async function handleConfig(interaction: ChatInputCommandInteraction, client: LibertyClient): Promise<void> {
  // Check permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ تحتاج صلاحية إدارة السيرفر لتغيير الإعدادات',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guildId) {
    await interaction.editReply({
      content: '❌ هذا الأمر يعمل في السيرفر فقط',
    });
    return;
  }

  const settings = await getGuildSettings(interaction.guildId);
  const enabled = interaction.options.getBoolean('enabled');
  const systemPrompt = interaction.options.getString('system_prompt');
  const temperature = interaction.options.getNumber('temperature');

  if (enabled !== null) settings.ai.enabled = enabled;
  if (systemPrompt) settings.ai.systemPrompt = systemPrompt;
  if (temperature !== null) settings.ai.temperature = temperature;

  await settings.save();

  await interaction.editReply({
    content: `✅ تم تحديث إعدادات AI — الحالة: ${settings.ai.enabled ? '✅ مفعل' : '❌ معطل'} • الإبداع: ${settings.ai.temperature}`,
  });
}

// --------------------------------------------
// Helper: Split Message
// --------------------------------------------
function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let current = '';

  for (const line of text.split('\n')) {
    if (current.length + line.length + 1 > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export default command;