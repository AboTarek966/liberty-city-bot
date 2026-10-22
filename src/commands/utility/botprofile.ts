// ============================================
// Liberty City Bot - BotProfile Command
// تغيير مظهر البوت (الصورة/الاسم/البانر)
// قاعدة ديسكورد: الصورة والبانر عالميين للبوت،
// أما الاسم فيمكن أن يكون مختلف لكل سيرفر (كنية)
// ============================================

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  Attachment,
} from 'discord.js';
import { Command } from '../../handlers/CommandHandler';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('botprofile')
    .setDescription('🖼️ تغيير مظهر البوت — الصورة والاسم والبانر (من داخل السيرفر فقط)')
    .setDMPermission(false)
    .addAttachmentOption(opt =>
      opt.setName('avatar').setDescription('صورة البوت الجديدة (⚠️ تتغير في كل السيرفرات)')
    )
    .addAttachmentOption(opt =>
      opt.setName('banner').setDescription('بانر البوت الجديد (⚠️ يتغير في كل السيرفرات)')
    )
    .addStringOption(opt =>
      opt.setName('name').setDescription('اسم جديد للبوت')
    )
    .addStringOption(opt =>
      opt
        .setName('scope')
        .setDescription('نطاق تغيير الاسم — لكل سيرفر لحاله أو الكل')
        .addChoices(
          { name: '🖥️ هذا السيرفر فقط (كنية — يختلف لكل سيرفر)', value: 'server' },
          { name: '🌐 كل السيرفرات (الاسم الأساسي)', value: 'global' }
        )
    ),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    // الصلاحية: إدارة السيرفر أو مالك السيرفر (نفس منطق /settings)
    const member = interaction.member as any;
    const perms = member?.permissions;
    const hasAdminPerms = !!perms && (
      perms.has(PermissionFlagsBits.ManageGuild) ||
      perms.has(PermissionFlagsBits.Administrator)
    );
    const isOwner = interaction.user.id === interaction.guild?.ownerId;

    if (!hasAdminPerms && !isOwner) {
      await interaction.reply({
        content: '❌ تحتاج صلاحية **إدارة السيرفر** (أو تكون مالك السيرفر) لتغيير مظهر البوت',
        ephemeral: true,
      });
      return;
    }

    const avatar = interaction.options.getAttachment('avatar');
    const banner = interaction.options.getAttachment('banner');
    const name = interaction.options.getString('name');
    const scope = interaction.options.getString('scope') || 'server';

    if (!avatar && !banner && !name) {
      await interaction.reply({
        content: '❌ حدد واحدًا على الأقل: `avatar` (صورة) أو `banner` (بانر) أو `name` (اسم)',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const user = interaction.client.user;
    if (!user) {
      await interaction.editReply({ content: '❌ البوت غير جاهز حاليًا — جرّب بعد قليل' });
      return;
    }

    const ok: string[] = [];
    const fail: string[] = [];
    const notes: string[] = [];

    const fetchBuffer = async (att: Attachment): Promise<Buffer | null> => {
      if (!att.contentType?.startsWith('image/')) return null;
      const res = await fetch(att.url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    };

    // 🖼️ الصورة — عالمية (قيمة ديسكورد للبوتات)
    if (avatar) {
      const buf = await fetchBuffer(avatar).catch(() => null);
      if (!buf) {
        fail.push('🖼️ الصورة: فشل — تأكد إنها صورة (PNG/JPG/GIF)');
      } else {
        try {
          await user.edit({ avatar: buf });
          ok.push('🖼️ الصورة تغيّرت');
          notes.push('⚠️ الصورة **عالمية** — نفس الصورة تظهر في كل السيرفرات (قاعدة ديسكورد للبوتات)');
        } catch (err: any) {
          fail.push(`🖼️ الصورة: فشل — ${err?.message || 'خطأ غير معروف'}`);
        }
      }
    }

    // 🏔️ البانر — عالمي
    if (banner) {
      const buf = await fetchBuffer(banner).catch(() => null);
      if (!buf) {
        fail.push('🏔️ البانر: فشل — تأكد إنها صورة (PNG/JPG)');
      } else {
        try {
          await user.edit({ banner: buf });
          ok.push('🏔️ البانر تغيّر');
          notes.push('⚠️ البانر **عالمي** — نفس البانر يظهر في كل السيرفرات (قاعدة ديسكورد للبوتات)');
        } catch (err: any) {
          fail.push(`🏔️ البانر: فشل — ${err?.message || 'خطأ غير معروف'}`);
        }
      }
    }

    // 🌐/🖥️ الاسم — عالمي (username) أو خاص بالسيرفر (كنية)
    if (name) {
      if (scope === 'global') {
        try {
          await user.setUsername(name);
          ok.push(`🌐 الاسم الأساسي للبوت صار: **${name}**`);
          notes.push('⚠️ الاسم الأساسي **عالمي** — يتغير في كل السيرفرات');
        } catch (err: any) {
          fail.push(`🌐 الاسم: فشل — ${err?.message || 'خطأ غير معروف'}`);
        }
      } else {
        try {
          await interaction.guild!.members.me!.setNickname(name);
          ok.push(`🖥️ اسم البوت في **هذا السيرفر فقط** صار: **${name}**`);
          notes.push('✅ هذا الاسم خاص بهذا السيرفر — باقي السيرفرات ما تغيّرت');
        } catch (err: any) {
          fail.push(`🖥️ اسم السيرفر: فشل — ${err?.message || 'تأكد إن رتبة البوت فوق باقي الرتب'}`);
        }
      }
    }

    const lines: string[] = [];
    if (ok.length) lines.push(ok.map(o => `✅ ${o}`).join('\n'));
    if (fail.length) lines.push(fail.map(f => `❌ ${f}`).join('\n'));
    if (notes.length) lines.push(notes.map(n => `> ${n}`).join('\n'));

    await interaction.editReply({ content: lines.join('\n\n') || 'لم يتغير شيء' });
  },
};

export default command;
