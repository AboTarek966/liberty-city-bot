"use strict";
// ============================================
// Omni Bot - Say Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const aliasCache_1 = require("../../utils/aliasCache");
const messageCreate_1 = require("../../events/messageCreate");
const linkSummary_1 = require("../../utils/linkSummary");
/** خيارات الملفات المتاحة في الأمر (كل خيار يستوعب ملفاً واحداً) */
const FILE_OPTIONS = ['file', 'file2', 'file3'];
/** أقصى حجم يُقبل تحميله من رابط خارجي (نفس حد ديسكورد للملفات) */
const MAX_LINK_BYTES = 25 * 1024 * 1024;
const CONTENT_TYPE_EXT = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'text/plain': '.txt',
};
function fileNameFromLink(url, contentType, disposition) {
    let name = '';
    if (disposition) {
        const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
        if (match?.[1]) {
            try {
                name = decodeURIComponent(match[1]);
            }
            catch {
                name = match[1];
            }
        }
    }
    if (!name) {
        const last = url.pathname.split('/').filter(Boolean).pop();
        if (last) {
            try {
                name = decodeURIComponent(last);
            }
            catch {
                name = last;
            }
        }
    }
    name = name.replace(/[\\/:*?"<>|\r\n]/g, '_').trim().slice(0, 100) || 'file';
    if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
        const ext = CONTENT_TYPE_EXT[contentType.split(';')[0].trim().toLowerCase()] || '';
        if (ext)
            name += ext;
    }
    return name;
}
/**
 * 🔗 تحميل ملف من رابط مباشر — بديل رفع الملفات من الجهاز
 * (مفيد لو ديسكورد رفض رفع الملف من حساب المستخدم مؤقتاً).
 * يتحقق من الرابط ضد العناوين الداخلية ويحدّ الحجم والمهل.
 */
async function fetchLinkFile(raw) {
    const safe = (0, linkSummary_1.isSafePublicHttpUrl)(raw);
    if (!safe.ok || !safe.url)
        return { error: safe.reason || 'رابط غير مسموح' };
    let current = safe.url;
    let response = null;
    // نتّبع التحويلات يدوياً مع فحص كل عنوان (منع الوصول لعناوين داخلية)
    for (let hop = 0; hop < 4; hop++) {
        try {
            response = await fetch(current, {
                redirect: 'manual',
                signal: AbortSignal.timeout(20_000),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; OmniBot/2.0)',
                    Accept: 'image/*,video/*,audio/*,application/*;q=0.8,*/*;q=0.5',
                },
            });
        }
        catch {
            return { error: 'تعذّر الوصول للرابط — تأكد أنه يعمل' };
        }
        if (![301, 302, 303, 307, 308].includes(response.status))
            break;
        const location = response.headers.get('location');
        if (!location)
            return { error: 'الرابط يحوّل لمكان غير معروف' };
        const next = (0, linkSummary_1.isSafePublicHttpUrl)(new URL(location, current).toString());
        if (!next.ok || !next.url)
            return { error: 'الرابط يحوّل لعنوان غير مسموح' };
        current = next.url;
        response = null;
    }
    if (!response)
        return { error: 'الرابط يحوّل كثيراً — استخدم رابطاً مباشراً' };
    if (!response.ok)
        return { error: `تعذّر تحميل الرابط (HTTP ${response.status})` };
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.startsWith('text/html') || contentType.startsWith('application/xhtml')) {
        return { error: 'الرابط صفحة ويب مش ملف مباشر — استخدم رابط الصورة/الملف نفسه' };
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared && declared > MAX_LINK_BYTES) {
        return { error: 'حجم الملف أكبر من 25MB' };
    }
    let buffer;
    try {
        buffer = Buffer.from(await response.arrayBuffer());
    }
    catch {
        return { error: 'انقطع تحميل الرابط' };
    }
    if (!buffer.length)
        return { error: 'الملف فارغ' };
    if (buffer.length > MAX_LINK_BYTES)
        return { error: 'حجم الملف أكبر من 25MB' };
    return {
        buffer,
        name: fileNameFromLink(current, contentType, response.headers.get('content-disposition')),
    };
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('say')
        .setDescription('إرسال نص و/أو ملفات من جهازك باسم البوت (ويدعم تنفيذ اختصارات/أوامر الألياس)')
        .addStringOption(option => option
        .setName('text')
        .setDescription('النص المراد إرساله (اختياري إذا كنت سترفع ملفاً)')
        .setRequired(false)
        .setMaxLength(2000))
        .addAttachmentOption(option => option
        .setName('file')
        .setDescription('📎 ملف أو صورة من جهازك (اختياري)')
        .setRequired(false))
        .addAttachmentOption(option => option
        .setName('file2')
        .setDescription('📎 ملف أو صورة ثاني (اختياري)')
        .setRequired(false))
        .addAttachmentOption(option => option
        .setName('file3')
        .setDescription('📎 ملف أو صورة ثالث (اختياري)')
        .setRequired(false))
        .addStringOption(option => option
        .setName('link')
        .setDescription('🔗 رابط مباشر لصورة/ملف بدل الرفع من الجهاز (اختياري)')
        .setRequired(false)
        .setMaxLength(1000))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    cooldown: 3,
    permissions: [discord_js_1.PermissionFlagsBits.ManageMessages],
    async execute(interaction) {
        const rawText = interaction.options.getString('text') || '';
        const text = rawText.trim();
        const linkRaw = (interaction.options.getString('link') || '').trim();
        const attachments = FILE_OPTIONS
            .map(name => interaction.options.getAttachment(name))
            .filter((a) => !!a);
        if (!interaction.guild || !interaction.channel) {
            await interaction.reply({ content: '❌ هذا الأمر يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        if (!text && attachments.length === 0 && !linkRaw) {
            await interaction.reply({
                content: '❌ اكتب نصاً، أو ارفع ملفاً، أو الصق رابطاً مباشراً لملف',
                ephemeral: true,
            });
            return;
        }
        // تأجيل الرد حتى ننتهي من تحميل الرابط (قد يستغرق ثوانٍ) وإرسال الملفات
        await interaction.deferReply({ ephemeral: true }).catch(() => { });
        const files = attachments.map(a => new discord_js_1.AttachmentBuilder(a.url, { name: a.name, description: a.description || undefined }));
        let linkError = '';
        if (linkRaw) {
            const downloaded = await fetchLinkFile(linkRaw);
            if ('error' in downloaded)
                linkError = downloaded.error;
            else
                files.push(new discord_js_1.AttachmentBuilder(downloaded.buffer, { name: downloaded.name }));
        }
        if (!text && files.length === 0) {
            await interaction
                .editReply({ content: `❌ تعذّر تجهيز الملف: ${linkError || 'لا يوجد ما يُرسل'}` })
                .catch(() => { });
            return;
        }
        const channel = interaction.channel;
        let sent = false;
        if (channel && typeof channel.send === 'function') {
            try {
                await channel.send({
                    content: text || undefined,
                    files,
                    allowedMentions: { parse: ['everyone', 'roles', 'users'] },
                });
                sent = true;
            }
            catch {
                /* يُبلَّغ عن الفشل بالأسفل */
            }
        }
        if (!sent) {
            await interaction
                .editReply({ content: '❌ فشل إرسال الرسالة — تأكد من صلاحية **إرسال الرسائل/الملفات** في القناة' })
                .catch(() => { });
            return;
        }
        await interaction
            .editReply({
            content: linkError
                ? `⚠️ تم الإرسال، لكن تعذّر تحميل الرابط: ${linkError}`
                : '✅ تم الإرسال',
        })
            .catch(() => { });
        // محاولة تنفيذ النص كاختصار/أمر ألياس (مثل .روليت أو أمر إعطاء رول عبر alias)
        if (text) {
            try {
                await tryExecuteAliasFromSay(interaction, text, attachments);
            }
            catch {
                // لا نُفشل /say إذا فشل تنفيذ الأمر
            }
        }
    },
};
async function tryExecuteAliasFromSay(interaction, text, attachments = []) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const client = interaction.client;
    const settings = await (0, models_1.getGuildSettings)(guild.id);
    const prefix = settings.prefix || 'omni!';
    const allAliases = await (0, aliasCache_1.getAllGuildAliases)(guild.id);
    if (allAliases.size === 0)
        return;
    let matched;
    let args = [];
    let shortcut = '';
    // 1) أمر ببادئة (مثال: omni!...)
    if (text.startsWith(prefix)) {
        const words = text.slice(prefix.length).trim().split(/\s+/);
        const maxWords = Math.min(words.length, 5);
        for (let n = maxWords; n >= 1; n--) {
            const candidate = words.slice(0, n).join(' ').toLowerCase();
            if (!candidate || candidate.length > 30)
                continue;
            const m = allAliases.get(candidate);
            if (m && m.length > 0) {
                matched = m;
                args = words.slice(n);
                shortcut = candidate;
                break;
            }
        }
    }
    // 2) اختصار مستقل (مثال: .روليت / رول @user ...)
    if (!matched) {
        const words = text.trim().split(/\s+/);
        const maxWords = Math.min(words.length, 5);
        for (let n = maxWords; n >= 1; n--) {
            const candidate = words.slice(0, n).join(' ').toLowerCase();
            if (!candidate || candidate.length > 30)
                continue;
            const m = allAliases.get(candidate);
            if (m && m.length > 0) {
                matched = m;
                args = words.slice(n);
                shortcut = candidate;
                break;
            }
        }
    }
    if (!matched || matched.length === 0)
        return;
    const member = interaction.member instanceof discord_js_1.GuildMember
        ? interaction.member
        : await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member)
        return;
    // رسالة وهمية لتوافق منطق تنفيذ الألياس (الردود/الصلاحيات تعتمد على منفّذ الأمر)
    const fakeMessage = {
        id: `${interaction.id}-say`,
        guild,
        channel: interaction.channel,
        channelId: interaction.channelId,
        client,
        author: interaction.user,
        member,
        content: text,
        createdTimestamp: Date.now(),
        mentions: {
            users: new Map(),
            members: new Map(),
            roles: new Map(),
            channels: new Map(),
            repliedUser: null,
            everyone: /@everyone/.test(text),
        },
        attachments: new Map(attachments.map(a => [a.id, a])),
        reference: null,
        deletable: false,
        delete: async () => { },
        reply: async (payload) => {
            try {
                if (interaction.channel && 'send' in interaction.channel) {
                    return await interaction.channel.send(payload);
                }
            }
            catch { }
            return null;
        },
    };
    // تنفيذ مطابق واحد (الأبسط والأكثر أماناً عبر /say). لو فيه أكثر من أمر مرتبط
    // بنفس الاختصار (toggle/pick)، ننفذ المطابق الأول لتجنب تعقيد قوائم الاختيار هنا.
    await (0, messageCreate_1.executeAliasCommand)(fakeMessage, client, matched[0].command, args, shortcut);
}
exports.default = command;
//# sourceMappingURL=say.js.map