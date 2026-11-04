"use strict";
// ============================================
// Omni Bot - Giveaway Command
// ============================================
// /giveaway start | end | reroll | list
// السحب محفوظ في MongoDB ويُستأنف بعد إعادة تشغيل البوت.
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const helpers_1 = require("../../utils/helpers");
const giveaway_1 = require("../../utils/giveaway");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('🎉 نظام السحوبات — أنشئ سحباً، أنهِه، وأعد السحب')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
        .setName('start')
        .setDescription('بدء سحب جديد')
        .addStringOption(o => o.setName('prize').setDescription('الجائزة (مثال: Nitro شهر)').setRequired(true).setMaxLength(200))
        .addStringOption(o => o
        .setName('duration')
        .setDescription('المدة (مثال: 1h، 30m، 2d، 1w) — افتراضي: من الإعدادات')
        .setRequired(false)
        .setMaxLength(20))
        .addIntegerOption(o => o.setName('winners').setDescription('عدد الفائزين (1-20)').setMinValue(1).setMaxValue(20))
        .addChannelOption(o => o
        .setName('channel')
        .setDescription('قناة السحب (افتراضي: القناة الحالية)')
        .addChannelTypes(discord_js_1.ChannelType.GuildText))
        .addStringOption(o => o.setName('description').setDescription('وصف إضافي للسحب').setMaxLength(1000))
        .addRoleOption(o => o.setName('required_role').setDescription('رول مطلوب للمشاركة'))
        .addIntegerOption(o => o.setName('min_level').setDescription('أقل مستوى مطلوب').setMinValue(0).setMaxValue(1000))
        .addIntegerOption(o => o
        .setName('min_account_age_days')
        .setDescription('أقل عمر للحساب بالأيام')
        .setMinValue(0)
        .setMaxValue(365))
        .addIntegerOption(o => o.setName('min_invites').setDescription('أقل عدد دعوات مطلوب').setMinValue(0).setMaxValue(10000)))
        .addSubcommand(sub => sub
        .setName('end')
        .setDescription('إنهاء سحب الآن وسحب الفائز')
        .addStringOption(o => o
        .setName('id')
        .setDescription('معرّف السحب')
        .setRequired(true)
        .setAutocomplete(true)))
        .addSubcommand(sub => sub
        .setName('reroll')
        .setDescription('إعادة سحب الفائزين في سحب منتهٍ')
        .addStringOption(o => o
        .setName('id')
        .setDescription('معرّف السحب')
        .setRequired(true)
        .setAutocomplete(true))
        .addIntegerOption(o => o.setName('winners').setDescription('عدد الفائزين الجدد').setMinValue(1).setMaxValue(20)))
        .addSubcommand(sub => sub.setName('list').setDescription('عرض السحوبات النشطة والمنتهية')),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageGuild],
    async autocomplete(interaction) {
        if (!interaction.guildId) {
            await interaction.respond([]);
            return;
        }
        const sub = interaction.options.getSubcommand();
        const focused = interaction.options.getFocused(true);
        if (focused.name !== 'id') {
            await interaction.respond([]);
            return;
        }
        const filter = { guildId: interaction.guildId };
        if (sub === 'end')
            filter.ended = false;
        if (sub === 'reroll')
            filter.ended = true;
        const giveaways = await models_1.Giveaway.find(filter).sort({ createdAt: -1 }).limit(25);
        const needle = String(focused.value || '').toLowerCase();
        const choices = giveaways
            .filter(g => {
            if (!needle)
                return true;
            return (g.shortId.toLowerCase().includes(needle) ||
                g.prize.toLowerCase().includes(needle));
        })
            .map(g => ({
            name: `#${g.shortId} — ${g.prize} (${g.entries.length} مشارك)`,
            value: g.shortId,
        }));
        await interaction.respond(choices.slice(0, 25));
    },
    async execute(interaction) {
        const client = interaction.client;
        const sub = interaction.options.getSubcommand();
        if (sub === 'start') {
            await handleStart(interaction, client);
            return;
        }
        if (sub === 'end') {
            await interaction.deferReply({ ephemeral: true });
            const id = interaction.options.getString('id', true);
            const result = await (0, giveaway_1.endGiveaway)(client, interaction.guildId, id);
            if (!result.ok) {
                await interaction.editReply({ content: `❌ ${result.reason}` });
                return;
            }
            await interaction.editReply({
                content: result.winners?.length
                    ? `✅ تم إنهاء السحب — الفائزون: ${result.winners.map(w => `<@${w}>`).join('، ')}`
                    : '✅ تم إنهاء السحب — لا يوجد فائز مؤهل',
            });
            return;
        }
        if (sub === 'reroll') {
            await interaction.deferReply({ ephemeral: true });
            const id = interaction.options.getString('id', true);
            const winners = interaction.options.getInteger('winners') || undefined;
            const result = await (0, giveaway_1.rerollGiveaway)(client, interaction.guildId, id, winners);
            if (!result.ok) {
                await interaction.editReply({ content: `❌ ${result.reason}` });
                return;
            }
            await interaction.editReply({
                content: `🔄 تمت إعادة السحب — الفائزون الجدد: ${result.winners.map(w => `<@${w}>`).join('، ')}`,
            });
            return;
        }
        if (sub === 'list') {
            await interaction.deferReply({ ephemeral: true });
            await handleList(interaction);
        }
    },
};
// --------------------------------------------
// Start
// --------------------------------------------
async function handleStart(interaction, client) {
    const guild = interaction.guild;
    const settings = await (0, models_1.getGuildSettings)(guild.id).catch(() => null);
    const cfg = settings?.giveaways;
    if (cfg && cfg.enabled === false) {
        await interaction.reply({
            content: '⚠️ نظام السحوبات معطّل حالياً — فعّله من **الإعدادات ← السحوبات**',
            ephemeral: true,
        });
        return;
    }
    const prize = interaction.options.getString('prize', true);
    const durationRaw = interaction.options.getString('duration');
    let durationMs = null;
    if (durationRaw) {
        durationMs = (0, helpers_1.parseDuration)(durationRaw);
        if (!durationMs || durationMs < 10_000) {
            await interaction.reply({
                content: '❌ مدة غير صالحة — استخدم مثلاً `30m` أو `1h` أو `2d` (الحد الأدنى 10 ثوانٍ)',
                ephemeral: true,
            });
            return;
        }
    }
    else {
        const minutes = Math.min(43_200, Math.max(1, cfg?.defaultDurationMinutes || 60));
        durationMs = minutes * 60_000;
    }
    const configuredChannel = cfg?.defaultChannelId
        ? guild.channels.cache.get(cfg.defaultChannelId)
        : null;
    const channel = interaction.options.getChannel('channel') ||
        configuredChannel ||
        interaction.channel;
    if (!channel || channel.type !== discord_js_1.ChannelType.GuildText) {
        await interaction.reply({ content: '❌ اختر قناة نصية صالحة للسحب', ephemeral: true });
        return;
    }
    const me = guild.members.me;
    if (me &&
        !channel.permissionsFor(me)?.has([
            discord_js_1.PermissionFlagsBits.SendMessages,
            discord_js_1.PermissionFlagsBits.EmbedLinks,
        ])) {
        await interaction.reply({
            content: `❌ لا أستطيع الإرسال في ${channel} — تأكد من صلاحيات **إرسال الرسائل** و**تضمين الروابط**`,
            ephemeral: true,
        });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    const requiredRole = interaction.options.getRole('required_role');
    const defaultRoles = (cfg?.defaultRoleIds || []).filter(id => guild.roles.cache.has(id));
    const giveaway = await (0, giveaway_1.createGiveaway)({
        guildId: guild.id,
        channelId: channel.id,
        hostId: interaction.user.id,
        prize,
        description: interaction.options.getString('description') || '',
        winnersCount: interaction.options.getInteger('winners') ??
            Math.min(20, Math.max(1, cfg?.defaultWinners || 1)),
        durationMs,
        requirements: {
            roleIds: requiredRole ? [requiredRole.id] : defaultRoles,
            minLevel: interaction.options.getInteger('min_level') ?? Math.max(0, cfg?.defaultMinLevel || 0),
            minAccountAgeDays: interaction.options.getInteger('min_account_age_days') ??
                Math.max(0, cfg?.defaultMinAccountAgeDays || 0),
            minInvites: interaction.options.getInteger('min_invites') ?? Math.max(0, cfg?.defaultMinInvites || 0),
        },
    });
    try {
        const payload = (0, giveaway_1.buildGiveawayPayload)(giveaway, {}, interaction.guild.name);
        const message = await channel.send({
            embeds: payload.embeds,
            components: payload.components,
        });
        giveaway.messageId = message.id;
        await giveaway.save();
        (0, giveaway_1.scheduleGiveaway)(client, giveaway);
        await interaction.editReply({
            content: `✅ **تم إنشاء السحب!**\n` +
                `> 🎁 الجائزة: **${giveaway.prize}**\n` +
                `> 🆔 المعرّف: \`${giveaway.shortId}\`\n` +
                `> 📍 القناة: ${channel}\n` +
                `> 🔗 [انتقل إلى السحب](${message.url})`,
        });
    }
    catch (error) {
        await giveaway.deleteOne().catch(() => { });
        await interaction.editReply({ content: `❌ فشل إرسال رسالة السحب: \`${error.message}\`` });
    }
}
// --------------------------------------------
// List
// --------------------------------------------
async function handleList(interaction) {
    const guildId = interaction.guildId;
    const [active, ended] = await Promise.all([
        models_1.Giveaway.find({ guildId, ended: false }).sort({ endsAt: 1 }).limit(10),
        models_1.Giveaway.find({ guildId, ended: true }).sort({ endedAt: -1 }).limit(10),
    ]);
    if (!active.length && !ended.length) {
        await interaction.editReply({ content: '📭 لا توجد سحوبات في هذا السيرفر بعد' });
        return;
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('🎉 السحوبات')
        .setColor(embeds_1.Colors.primary)
        .setFooter({ text: `${interaction.guild.name} • Giveaways` })
        .setTimestamp();
    if (active.length) {
        embed.addFields({
            name: `⏳ نشطة (${active.length})`,
            value: active
                .map(g => `> \`#${g.shortId}\` **${g.prize}** — ${g.entries.length} مشارك — ينتهي <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>`)
                .join('\n'),
            inline: false,
        });
    }
    if (ended.length) {
        embed.addFields({
            name: `🏁 منتهية (${ended.length})`,
            value: ended
                .map(g => `> \`#${g.shortId}\` **${g.prize}** — ${g.winnerIds.length ? `الفائز: ${g.winnerIds.map(id => `<@${id}>`).join('، ')}` : 'بدون فائز'}`)
                .join('\n'),
            inline: false,
        });
    }
    await interaction.editReply({ embeds: [embed] });
}
exports.default = command;
//# sourceMappingURL=giveaway.js.map