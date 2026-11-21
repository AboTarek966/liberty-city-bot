"use strict";
// ============================================
// Omni Bot — Trusted Whitelist Command
// 👑 مالك السيرفر فقط — لا رول عالٍ، ولا بوتات.
// الوايت ليست الموثوقة ليست حصانة: مساحة محدودة تحت الحماية.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const trustedWhitelist_1 = require("../../utils/trustedWhitelist");
const botOwner_1 = require("../../utils/botOwner");
const MAX_TRUSTED = 50;
function ensureTrustedWhitelist(settings) {
    if (!settings.protection)
        settings.protection = {};
    if (!settings.protection.trustedWhitelist) {
        settings.protection.trustedWhitelist = {
            ...trustedWhitelist_1.DEFAULT_TRUSTED_WHITELIST,
            entries: [],
        };
    }
    const tw = settings.protection.trustedWhitelist;
    tw.enabled = tw.enabled !== false;
    tw.userIds = Array.isArray(tw.userIds) ? tw.userIds.map(String) : [];
    tw.entries = Array.isArray(tw.entries) ? tw.entries : [];
    tw.minorActions = Number.isFinite(Number(tw.minorActions))
        ? Math.min(50, Math.max(0, Math.floor(Number(tw.minorActions))))
        : trustedWhitelist_1.DEFAULT_TRUSTED_WHITELIST.minorActions;
    tw.minorWindowSeconds = Number.isFinite(Number(tw.minorWindowSeconds))
        ? Math.min(86400, Math.max(10, Math.floor(Number(tw.minorWindowSeconds))))
        : trustedWhitelist_1.DEFAULT_TRUSTED_WHITELIST.minorWindowSeconds;
    tw.criticalActions = Number.isFinite(Number(tw.criticalActions))
        ? Math.min(10, Math.max(0, Math.floor(Number(tw.criticalActions))))
        : trustedWhitelist_1.DEFAULT_TRUSTED_WHITELIST.criticalActions;
    tw.criticalWindowSeconds = Number.isFinite(Number(tw.criticalWindowSeconds))
        ? Math.min(86400, Math.max(30, Math.floor(Number(tw.criticalWindowSeconds))))
        : trustedWhitelist_1.DEFAULT_TRUSTED_WHITELIST.criticalWindowSeconds;
    tw.allowDestructive = tw.allowDestructive === true;
    return tw;
}
async function requireServerOwner(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
            content: '❌ هذا الأمر يعمل داخل السيرفر فقط.',
            ephemeral: true,
        });
        return false;
    }
    if (interaction.guild.ownerId !== interaction.user.id &&
        !(await (0, botOwner_1.isBotOwner)(interaction.client, interaction.user.id))) {
        await interaction.reply({
            content: '❌ **هذا الأمر لمالك السيرفر أو مالك/مطوّر البوت فقط** (صاحب التاج 👑 أو 🛠️ مطوّر البوت).\n' +
                'لا يكفي أن تكون أدمن أو صاحب أعلى رول — إدارة الوايت ليست الموثوقة محصورة بهما.',
            ephemeral: true,
        });
        return false;
    }
    return true;
}
async function resolveMember(interaction, userId) {
    const guild = interaction.guild;
    return (guild.members.cache.get(userId) ||
        (await guild.members.fetch(userId).catch(() => null)));
}
function limitsLine(tw) {
    return (`🟢 **خفيف:** ${tw.minorActions} إجراء / ${tw.minorWindowSeconds} ثانية\n` +
        `🔴 **حساس:** ${tw.allowDestructive ? tw.criticalActions : 0} إجراء / ${tw.criticalWindowSeconds} ثانية` +
        (tw.allowDestructive ? '' : ' (معطّل)'));
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('trusted')
        .setDescription('👑 إدارة الوايت ليست الموثوقة — مالك السيرفر أو مالك/مطوّر البوت (مساحة محدودة تحت الحماية)')
        .setDefaultMemberPermissions(0)
        .setDMPermission(false)
        .addSubcommand((sub) => sub
        .setName('add')
        .setDescription('إضافة عضو إلى الوايت ليست الموثوقة (البوتات ممنوعة)')
        .addUserOption((opt) => opt.setName('user').setDescription('العضو المراد إضافته').setRequired(true))
        .addStringOption((opt) => opt
        .setName('note')
        .setDescription('ملاحظة اختيارية (سبب الإضافة)')
        .setRequired(false)
        .setMaxLength(200)))
        .addSubcommand((sub) => sub
        .setName('remove')
        .setDescription('إزالة عضو من الوايت ليست الموثوقة')
        .addUserOption((opt) => opt.setName('user').setDescription('العضو المراد إزالته').setRequired(true)))
        .addSubcommand((sub) => sub.setName('list').setDescription('عرض كل الأعضاء الموثوقين'))
        .addSubcommand((sub) => sub
        .setName('info')
        .setDescription('عرض حالة عضو داخل الوايت ليست الموثوقة')
        .addUserOption((opt) => opt.setName('user').setDescription('العضو المراد فحصه').setRequired(true)))
        .addSubcommand((sub) => sub
        .setName('toggle')
        .setDescription('تفعيل/تعطيل نظام الوايت ليست الموثوقة بالكامل')
        .addBooleanOption((opt) => opt.setName('enabled').setDescription('تفعيل أو تعطيل').setRequired(true)))
        .addSubcommand((sub) => sub
        .setName('limits')
        .setDescription('ضبط المساحة المسموحة للأعضاء الموثوقين')
        .addIntegerOption((opt) => opt
        .setName('minor_actions')
        .setDescription('عدد الإجراءات الخفيفة المسموحة (0-50)')
        .setMinValue(0)
        .setMaxValue(50)
        .setRequired(false))
        .addIntegerOption((opt) => opt
        .setName('minor_window')
        .setDescription('نافذة الإجراءات الخفيفة بالثواني (10-86400)')
        .setMinValue(10)
        .setMaxValue(86400)
        .setRequired(false))
        .addIntegerOption((opt) => opt
        .setName('critical_actions')
        .setDescription('عدد الإجراءات الحساسة المسموحة (0-10)')
        .setMinValue(0)
        .setMaxValue(10)
        .setRequired(false))
        .addIntegerOption((opt) => opt
        .setName('critical_window')
        .setDescription('نافذة الإجراءات الحساسة بالثواني (30-86400)')
        .setMinValue(30)
        .setMaxValue(86400)
        .setRequired(false))
        .addBooleanOption((opt) => opt
        .setName('allow_destructive')
        .setDescription('هل يُسمح بإجراء حساس واحد (حذف/حظر) داخل الحدود؟')
        .setRequired(false))
        .addChannelOption((opt) => opt
        .setName('log_channel')
        .setDescription('قناة تسجيل استخدام المساحة الموثوقة')
        .setRequired(false)))
        .addSubcommand((sub) => sub.setName('reset').setDescription('مسح كل الوايت ليست الموثوقة وإعادة الحدود الافتراضية')),
    guildOnly: true,
    cooldown: 2,
    async execute(interaction) {
        if (!(await requireServerOwner(interaction)))
            return;
        const guild = interaction.guild;
        const sub = interaction.options.getSubcommand(true);
        await interaction.deferReply({ ephemeral: true });
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        const tw = ensureTrustedWhitelist(settings);
        const persist = async () => {
            settings.markModified('protection.trustedWhitelist');
            await settings.save();
            (0, models_1.invalidateGuildSettings)(guild.id);
        };
        const log = async (content) => {
            const channelId = tw.logChannel || settings.protection?.logChannel;
            if (!channelId)
                return;
            const channel = guild.channels.cache.get(String(channelId));
            if (channel && 'send' in channel) {
                channel.send({ content }).catch(() => { });
            }
        };
        if (sub === 'add') {
            const target = interaction.options.getUser('user', true);
            const note = interaction.options.getString('note') || '';
            const member = await resolveMember(interaction, target.id);
            if (!member) {
                await interaction.editReply({
                    content: '❌ العضو غير موجود في السيرفر — لا يمكن إضافته.',
                });
                return;
            }
            if (member.user.bot || target.bot) {
                await interaction.editReply({
                    content: '⛔ **لا يمكن إضافة بوت إلى الوايت ليست الموثوقة** — البوتات تحت الحماية دائماً، مهما كانت رتبة من يحاول إضافتها.',
                });
                return;
            }
            if (target.id === guild.ownerId) {
                await interaction.editReply({
                    content: '👑 مالك السيرفر فوق الحماية أصلاً — لا حاجة لإضافته.',
                });
                return;
            }
            if (target.id === interaction.client.user?.id) {
                await interaction.editReply({ content: '⛔ لا يمكن إضافة البوت نفسه.' });
                return;
            }
            if (tw.userIds.includes(target.id)) {
                await interaction.editReply({
                    content: `ℹ️ ${target} موجود بالفعل في الوايت ليست الموثوقة.`,
                });
                return;
            }
            if (tw.userIds.length >= MAX_TRUSTED) {
                await interaction.editReply({
                    content: `❌ وصلت للحد الأقصى (${MAX_TRUSTED} عضو). أزل عضواً أولاً.`,
                });
                return;
            }
            tw.userIds.push(target.id);
            tw.entries.push({
                userId: target.id,
                addedBy: interaction.user.id,
                addedAt: new Date(),
            });
            await persist();
            const cfg = (0, trustedWhitelist_1.getTrustedWhitelistConfig)(settings);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('👑 تمت الإضافة إلى الوايت ليست الموثوقة')
                .setColor(embeds_1.Colors.success)
                .setDescription(`✅ أُضيف ${target} (\`${target.id}\`) بواسطة مالك السيرفر.\n\n` +
                `⚠️ **ليست حصانة:** الحماية ما زالت مفعّلة عليه. يُسمح له فقط بمساحة محدودة، وأي تجاوز يُعاقب كأي مخالف.`)
                .addFields({ name: '📊 المساحة المسموحة', value: limitsLine(cfg), inline: false }, ...(note ? [{ name: '📝 ملاحظة', value: note.slice(0, 200), inline: false }] : []))
                .setFooter({ text: `${guild.name} • Trusted Whitelist` })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            await log(`👑 **إضافة للوايت ليست الموثوقة**\n👤 العضو: ${target} (\`${target.id}\`)\n👑 بواسطة المالك: ${interaction.user} (\`${interaction.user.id}\`)${note ? `\n📝 ${note}` : ''}`);
            return;
        }
        if (sub === 'remove') {
            const target = interaction.options.getUser('user', true);
            if (!tw.userIds.includes(target.id)) {
                await interaction.editReply({ content: `ℹ️ ${target} غير موجود في الوايت ليست الموثوقة.` });
                return;
            }
            tw.userIds = tw.userIds.filter((id) => id !== target.id);
            tw.entries = tw.entries.filter((e) => String(e?.userId) !== target.id);
            await persist();
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('🗑️ تمت الإزالة من الوايت ليست الموثوقة')
                        .setColor(embeds_1.Colors.warning)
                        .setDescription(`أُزيل ${target} (\`${target.id}\`) — عاد تحت الحماية الكاملة بلا أي مساحة.`)
                        .setTimestamp(),
                ],
            });
            await log(`🗑️ **إزالة من الوايت ليست الموثوقة**\n👤 العضو: ${target} (\`${target.id}\`)\n👑 بواسطة المالك: ${interaction.user} (\`${interaction.user.id}\`)`);
            return;
        }
        if (sub === 'list') {
            const cfg = (0, trustedWhitelist_1.getTrustedWhitelistConfig)(settings);
            const lines = [];
            for (const userId of cfg.userIds.slice(0, 30)) {
                const entry = tw.entries.find((e) => String(e?.userId) === String(userId));
                const member = guild.members.cache.get(String(userId));
                const label = member ? `${member.user.tag}` : 'عضو غير موجود';
                const addedBy = entry?.addedBy ? `<@${entry.addedBy}>` : '—';
                const addedAt = entry?.addedAt
                    ? `<t:${Math.floor(new Date(entry.addedAt).getTime() / 1000)}:R>`
                    : '—';
                lines.push(`• <@${userId}> (\`${userId}\`) — ${label}\n  أضافه ${addedBy} ${addedAt}`);
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('👑 الوايت ليست الموثوقة')
                .setColor(cfg.enabled ? embeds_1.Colors.primary : embeds_1.Colors.warning)
                .setDescription((cfg.enabled ? '✅ **مفعّلة**\n\n' : '⛔ **معطّلة** — لا أحد يحصل على أي مساحة حالياً.\n\n') +
                (lines.length ? lines.join('\n') : '📭 القائمة فارغة.'))
                .addFields({ name: '📊 الحدود', value: limitsLine(cfg), inline: false }, {
                name: 'ℹ️ القاعدة',
                value: 'الحماية مفعّلة على الجميع. الإجراءات الخفيفة المسموحة محدودة، والإجراءات الحساسة (حذف/حظر/صلاحيات) لها حد أدنى. أي تجاوز = عقوبة عادية.',
                inline: false,
            })
                .setFooter({ text: `${guild.name} • ${cfg.userIds.length}/${MAX_TRUSTED}` })
                .setTimestamp();
            if (cfg.userIds.length > 30) {
                embed.addFields({
                    name: '…',
                    value: `و${cfg.userIds.length - 30} عضواً آخر — استخدم الأمر بعدد أقل أو راجع السجل.`,
                });
            }
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        if (sub === 'info') {
            const target = interaction.options.getUser('user', true);
            const cfg = (0, trustedWhitelist_1.getTrustedWhitelistConfig)(settings);
            const entry = tw.entries.find((e) => String(e?.userId) === target.id);
            const member = await resolveMember(interaction, target.id);
            const inList = cfg.userIds.includes(target.id);
            const isBot = target.bot || member?.user.bot;
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🔎 حالة العضو في الوايت ليست الموثوقة')
                .setColor(inList && !isBot ? embeds_1.Colors.success : embeds_1.Colors.warning)
                .setDescription(`👤 ${target} (\`${target.id}\`)\n\n` +
                (isBot
                    ? '⛔ **بوت:** البوتات لا يمكن أن تكون موثوقة أبداً — حتى لو وُجد معرّفها في القائمة، يُتجاهل.'
                    : inList
                        ? '✅ **موجود** — لديه مساحة محدودة تحت الحماية.'
                        : '❌ **غير موجود** — تحت الحماية الكاملة.'))
                .addFields({ name: '📊 الحدود', value: limitsLine(cfg), inline: false }, ...(entry
                ? [
                    {
                        name: '📝 بيانات الإضافة',
                        value: `أضافه: <@${entry.addedBy || '?'}>\n` +
                            `التاريخ: ${entry.addedAt ? `<t:${Math.floor(new Date(entry.addedAt).getTime() / 1000)}:F>` : '—'}`,
                        inline: false,
                    },
                ]
                : []))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            tw.enabled = enabled;
            await persist();
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle(enabled ? '✅ فُعّلت الوايت ليست الموثوقة' : '⛔ عُطّلت الوايت ليست الموثوقة')
                        .setColor(enabled ? embeds_1.Colors.success : embeds_1.Colors.warning)
                        .setDescription(enabled
                        ? 'الأعضاء الموجودون في القائمة سيحصلون على مساحة محدودة من جديد.'
                        : 'لا أحد سيحصل على أي مساحة — الجميع تحت الحماية الكاملة (القائمة محفوظة).')
                        .setTimestamp(),
                ],
            });
            return;
        }
        if (sub === 'limits') {
            const minorActions = interaction.options.getInteger('minor_actions');
            const minorWindow = interaction.options.getInteger('minor_window');
            const criticalActions = interaction.options.getInteger('critical_actions');
            const criticalWindow = interaction.options.getInteger('critical_window');
            const allowDestructive = interaction.options.getBoolean('allow_destructive');
            const logChannel = interaction.options.getChannel('log_channel');
            if (minorActions !== null)
                tw.minorActions = minorActions;
            if (minorWindow !== null)
                tw.minorWindowSeconds = minorWindow;
            if (criticalActions !== null)
                tw.criticalActions = criticalActions;
            if (criticalWindow !== null)
                tw.criticalWindowSeconds = criticalWindow;
            if (allowDestructive !== null)
                tw.allowDestructive = allowDestructive;
            if (logChannel)
                tw.logChannel = logChannel.id;
            await persist();
            const cfg = (0, trustedWhitelist_1.getTrustedWhitelistConfig)(settings);
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('⚙️ حُدّثت مساحة الوايت ليست الموثوقة')
                        .setColor(embeds_1.Colors.success)
                        .setDescription(limitsLine(cfg))
                        .addFields({
                        name: 'ℹ️ معنى ذلك',
                        value: `الأعضاء الموثوقون يستطيعون تنفيذ إجراءات خفيفة حتى ${cfg.minorActions} مرة كل ${cfg.minorWindowSeconds} ثانية، ` +
                            `و${cfg.allowDestructive ? cfg.criticalActions : 0} إجراء حساس كل ${cfg.criticalWindowSeconds} ثانية. ` +
                            `بعد ذلك تُطبَّق الحماية والعقوبة العادية.`,
                    })
                        .setTimestamp(),
                ],
            });
            await log(`⚙️ **تعديل حدود الوايت ليست الموثوقة** بواسطة المالك ${interaction.user} (\`${interaction.user.id}\`)\n${limitsLine(cfg)}`);
            return;
        }
        if (sub === 'reset') {
            settings.protection.trustedWhitelist = {
                ...trustedWhitelist_1.DEFAULT_TRUSTED_WHITELIST,
                userIds: [],
                entries: [],
            };
            await persist();
            await interaction.editReply({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('♻️ أُعيد ضبط الوايت ليست الموثوقة')
                        .setColor(embeds_1.Colors.success)
                        .setDescription('مُسحت كل الأسماء وأُعيدت الحدود الافتراضية:\n' +
                        limitsLine((0, trustedWhitelist_1.getTrustedWhitelistConfig)(settings)))
                        .setTimestamp(),
                ],
            });
            return;
        }
    },
};
exports.default = command;
//# sourceMappingURL=trusted.js.map