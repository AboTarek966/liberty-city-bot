"use strict";
// ============================================
// Liberty City Bot - Alias Command
// Custom shortcuts for commands (e.g., "b" -> /ban)
// ============================================
// واجهة واحدة باختيار ذكي (Autocomplete) بدل عدة قوائم ثابتة.
// + تنظيف التكرارات الحرفية (نفس الاختصار + نفس الأمر) تلقائياً.
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const models_1 = require("../../models");
const aliasCache_1 = require("../../utils/aliasCache");
const SPECIAL_COMMANDS = new Set(['ticket_top', 'ticket_mystats']);
function collectCommandChoices(client) {
    const choices = new Map();
    for (const [name, cmd] of client.commandHandler.getCommands()) {
        let description = '';
        try {
            description = String(cmd.data?.description || '');
        }
        catch {
            /* تجاهل */
        }
        choices.set(name, {
            label: `/${name}`,
            value: name,
            description,
        });
    }
    // 🎵 أوامر الموسيقى الفرعية — تُنفَّذ عبر منفّذ خاص في aliasRunner
    const music = client.commandHandler.getCommand('music');
    if (music) {
        try {
            const json = typeof music.data?.toJSON === 'function'
                ? music.data.toJSON()
                : music.data;
            const subs = Array.isArray(json?.options)
                ? json.options.filter((o) => o.type === 1)
                : [];
            for (const sub of subs) {
                const value = `music:${sub.name}`;
                choices.set(value, {
                    label: `🎵 /music ${sub.name}`,
                    value,
                    description: String(sub.description || ''),
                });
            }
        }
        catch {
            /* تجاهل */
        }
    }
    choices.set('ticket_top', {
        label: '📊 توب التذاكر',
        value: 'ticket_top',
        description: 'اختصار خاص — ترتيب الإداريين حسب التذاكر المستلمة',
    });
    choices.set('ticket_mystats', {
        label: '📊 إحصائيات التذاكر',
        value: 'ticket_mystats',
        description: 'اختصار خاص — عدد التذاكر التي استلمتها',
    });
    return [...choices.values()];
}
function filterChoices(choices, focused) {
    const needle = focused.toLowerCase().trim();
    const scored = choices
        .map(choice => {
        const value = choice.value.toLowerCase();
        const label = choice.label.toLowerCase();
        let score = -1;
        if (!needle)
            score = 1;
        else if (value === needle)
            score = 100;
        else if (value.startsWith(needle))
            score = 80;
        else if (label.includes(needle))
            score = 60;
        else if (value.includes(needle) || choice.description.toLowerCase().includes(needle))
            score = 30;
        return { choice, score };
    })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.choice.value.localeCompare(b.choice.value));
    return scored.slice(0, 25).map(({ choice }) => {
        const suffix = choice.description ? ` — ${choice.description}` : '';
        return {
            name: `${choice.label}${suffix}`.slice(0, 100),
            value: choice.value,
        };
    });
}
// --------------------------------------------
// تنظيف التكرارات الحرفية (alias + command)
// --------------------------------------------
async function removeExactDuplicates(guildId) {
    const duplicates = await models_1.CommandAlias.aggregate([
        { $match: { guildId } },
        { $sort: { createdAt: 1, _id: 1 } },
        {
            $group: {
                _id: { alias: '$alias', command: '$command' },
                ids: { $push: '$_id' },
                count: { $sum: 1 },
            },
        },
        { $match: { count: { $gt: 1 } } },
    ]).catch(() => []);
    let removed = 0;
    for (const duplicate of duplicates) {
        const extraIds = (duplicate.ids || []).slice(1);
        if (!extraIds.length)
            continue;
        const result = await models_1.CommandAlias.deleteMany({ _id: { $in: extraIds } }).catch(() => null);
        removed += result?.deletedCount || 0;
    }
    if (removed > 0)
        (0, aliasCache_1.invalidateAliasCache)(guildId);
    return removed;
}
// --------------------------------------------
// التحقق من صحة هدف الاختصار
// --------------------------------------------
function resolveTarget(client, raw) {
    const clean = raw.toLowerCase().trim().replace(/^\/+/, '');
    if (!clean)
        return { ok: false, command: '', reason: 'اكتب اسم الأمر' };
    if (SPECIAL_COMMANDS.has(clean)) {
        return { ok: true, command: clean };
    }
    if (clean.includes(':')) {
        const [base, sub] = clean.split(':');
        if (base === 'music') {
            const music = client.commandHandler.getCommand('music');
            if (!music)
                return { ok: false, command: clean, reason: 'أمر الموسيقى غير متاح' };
            try {
                const json = typeof music.data?.toJSON === 'function'
                    ? music.data.toJSON()
                    : music.data;
                const exists = (json?.options || []).some((o) => o.type === 1 && String(o.name).toLowerCase() === sub);
                if (!exists) {
                    return { ok: false, command: clean, reason: `إجراء الموسيقى \`${sub}\` غير موجود` };
                }
                return { ok: true, command: clean };
            }
            catch {
                return { ok: false, command: clean, reason: 'تعذّر قراءة أوامر الموسيقى' };
            }
        }
        // بقية الأوامر الفرعية تُمرَّر كوسائط وليست جزءاً من اسم الاختصار
        return {
            ok: false,
            command: clean,
            reason: 'الأوامر الفرعية غير المدعومة — اربط الاختصار بالأمر الأساسي واكتب الفرع بعده\n' +
                `> مثال: \`/${base} ...\``,
        };
    }
    if (!client.commandHandler.getCommand(clean)) {
        return { ok: false, command: clean, reason: `الأمر \`${clean}\` غير موجود` };
    }
    return { ok: true, command: clean };
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('alias')
        .setDescription('إدارة اختصارات الأوامر')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
        .setName('add')
        .setDescription('إضافة اختصار لأمر')
        .addStringOption(o => o
        .setName('shortcut')
        .setDescription('الاختصار الذي سكتبه في الشات (يمكن أن يحتوي مسافات)')
        .setRequired(true)
        .setMaxLength(30))
        .addStringOption(o => o
        .setName('command')
        .setDescription('🎯 اكتب اسم الأمر أو اختر من القائمة الذكية')
        .setRequired(true)
        .setAutocomplete(true)))
        .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('حذف اختصار')
        .addStringOption(o => o.setName('shortcut').setDescription('الاختصار').setRequired(true).setMaxLength(30))
        .addStringOption(o => o
        .setName('command')
        .setDescription('حدد الأمر إن كان الاختصار مرتبطاً بأكثر من أمر')
        .setRequired(false)
        .setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('clear').setDescription('🗑️ حذف جميع الاختصارات دفعة واحدة (مع تأكيد)'))
        .addSubcommand(sub => sub.setName('list').setDescription('عرض جميع الاختصارات (مع تنظيف التكرارات)')),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageGuild],
    // --------------------------------------------
    // Autocomplete
    // --------------------------------------------
    async autocomplete(interaction) {
        const client = interaction.client;
        const focused = interaction.options.getFocused(true);
        const query = String(focused.value || '');
        // عند حذف اختصار: اعرض أوامر هذا الاختصار فقط
        if (focused.name === 'command' && interaction.options.getSubcommand() === 'remove') {
            const shortcut = (interaction.options.getString('shortcut') || '').toLowerCase().trim();
            if (!shortcut) {
                await interaction.respond([]);
                return;
            }
            const aliases = await models_1.CommandAlias.find({
                guildId: interaction.guildId,
                alias: shortcut,
            })
                .lean()
                .catch(() => []);
            const needle = query.toLowerCase().trim();
            const choices = aliases
                .map(a => ({
                name: `/${String(a.command).replace(':', ' ')}`.slice(0, 100),
                value: String(a.command),
            }))
                .filter(choice => !needle || choice.value.toLowerCase().includes(needle))
                .slice(0, 25);
            await interaction.respond(choices);
            return;
        }
        await interaction.respond(filterChoices(collectCommandChoices(client), query));
    },
    async execute(interaction) {
        const client = interaction.client;
        const sub = interaction.options.getSubcommand();
        if (sub === 'add') {
            await handleAdd(interaction, client);
        }
        else if (sub === 'remove') {
            await handleRemove(interaction);
        }
        else if (sub === 'clear') {
            await handleClear(interaction);
        }
        else if (sub === 'list') {
            await handleList(interaction);
        }
    },
};
// --------------------------------------------
// Add Alias
// --------------------------------------------
async function handleAdd(interaction, client) {
    let shortcut = interaction.options.getString('shortcut', true).toLowerCase().trim();
    const rawCommand = interaction.options.getString('command', true);
    if (!shortcut.length || shortcut.length > 30) {
        await interaction.reply({
            content: '❌ الاختصار فارغ أو يزيد عن 30 حرف',
            ephemeral: true,
        });
        return;
    }
    if (shortcut.startsWith('/'))
        shortcut = shortcut.slice(1);
    const target = resolveTarget(client, rawCommand);
    if (!target.ok) {
        await interaction.reply({
            content: `❌ ${target.reason}`,
            ephemeral: true,
        });
        return;
    }
    const cleanCommand = target.command;
    const guildId = interaction.guildId;
    // 🧹 تنظيف أي تكرار حرفي قديم قبل الإضافة (إصلاح تلقائي)
    await removeExactDuplicates(guildId);
    const existingSame = await models_1.CommandAlias.findOne({
        guildId,
        alias: shortcut,
        command: cleanCommand,
    });
    if (existingSame) {
        await interaction.reply({
            content: `❌ الاختصار \`${shortcut}\` مرتبط بالفعل بالأمر \`/${cleanCommand}\``,
            ephemeral: true,
        });
        return;
    }
    // ⚡ السماح بنفس الاختصار لأكثر من أمر (نظام التبديل/Toggle)
    // مثال: `ت` → تحذير و `ت` → إزالة تحذير — البوت يحدد أيهما ينفّذ حسب الحالة
    const existingOther = await models_1.CommandAlias.findOne({
        guildId,
        alias: shortcut,
        command: { $ne: cleanCommand },
    });
    const isBuiltinName = !!client.commandHandler.getCommand(shortcut);
    await models_1.CommandAlias.create({
        guildId,
        alias: shortcut,
        command: cleanCommand,
        createdBy: interaction.user.id,
        isBuiltinOverride: isBuiltinName,
    }).catch((err) => {
        if (err.code === 11000) {
            throw new Error('هذا الاختصار مستخدم بالفعل لأمر آخر');
        }
        throw err;
    });
    (0, aliasCache_1.invalidateAliasCache)(guildId);
    await interaction.reply({
        content: `✅ تم إضافة الاختصار \`${shortcut}\` للأمر \`/${cleanCommand.replace(':', ' ')}\`` +
            (existingOther
                ? `\n> 🔁 الاختصار مرتبط الآن بأكثر من أمر — سيحدد البوت تلقائياً أو يعرض قائمة اختيار.`
                : ''),
        ephemeral: true,
    });
}
// --------------------------------------------
// Remove Alias
// --------------------------------------------
async function handleRemove(interaction) {
    const shortcut = interaction.options.getString('shortcut', true).toLowerCase().trim();
    const commandFilter = interaction.options.getString('command')?.toLowerCase().trim();
    const query = {
        guildId: interaction.guildId,
        alias: shortcut,
    };
    if (commandFilter)
        query.command = commandFilter;
    const matches = await models_1.CommandAlias.find(query).lean();
    if (!matches.length) {
        await interaction.reply({
            content: commandFilter
                ? `❌ الاختصار \`${shortcut}\` غير مرتبط بالأمر \`/${commandFilter}\``
                : `❌ الاختصار \`${shortcut}\` غير موجود`,
            ephemeral: true,
        });
        return;
    }
    const result = await models_1.CommandAlias.deleteMany(query);
    (0, aliasCache_1.invalidateAliasCache)(interaction.guildId);
    const detail = matches
        .map(m => `\`/${String(m.command).replace(':', ' ')}\``)
        .join('، ');
    await interaction.reply({
        content: `✅ تم حذف **${result.deletedCount || matches.length}** ارتباط للاختصار \`${shortcut}\`: ${detail}`,
        ephemeral: true,
    });
}
// --------------------------------------------
// Clear All Aliases (with confirmation button)
// --------------------------------------------
async function handleClear(interaction) {
    const count = await models_1.CommandAlias.countDocuments({ guildId: interaction.guildId });
    if (!count) {
        await interaction.reply({ content: '📭 لا توجد اختصارات لحذفها', ephemeral: true });
        return;
    }
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`alias:clear:confirm:${interaction.user.id}`)
        .setLabel(`🗑️ نعم، احذف الكل (${count})`)
        .setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder()
        .setCustomId(`alias:clear:cancel:${interaction.user.id}`)
        .setLabel('❌ إلغاء')
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    await interaction.reply({
        content: `⚠️ **تأكيد الحذف الكامل** — سيتم حذف **${count}** اختصار نهائياً من هذا السيرفر. هذا لا يمكن التراجع عنه.`,
        components: [row],
        ephemeral: true,
    });
}
// --------------------------------------------
// List Aliases (grouped + deduplicated)
// --------------------------------------------
async function handleList(interaction) {
    const guildId = interaction.guildId;
    // 🧹 إزالة التكرارات الحرفية أولاً
    const removed = await removeExactDuplicates(guildId);
    const aliases = await models_1.CommandAlias.find({ guildId }).sort({ alias: 1 }).lean();
    if (!aliases.length) {
        await interaction.reply({ content: '📭 لا توجد اختصارات مضافة بعد', ephemeral: true });
        return;
    }
    // تجميع: اختصار واحد → كل أوامره (Toggle)
    const grouped = new Map();
    for (const alias of aliases) {
        const list = grouped.get(alias.alias) || [];
        const target = `\`/${String(alias.command).replace(':', ' ')}\``;
        if (!list.includes(target))
            list.push(target);
        grouped.set(alias.alias, list);
    }
    const entries = [...grouped.entries()];
    const lines = [];
    let omitted = 0;
    for (const [alias, commands] of entries) {
        const line = `> \`${alias}\` ← ${commands.join('، ')}`;
        if (lines.join('\n').length + line.length > 3600) {
            omitted = entries.length - lines.length;
            break;
        }
        lines.push(line);
    }
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('📋 قائمة الاختصارات')
        .setColor(embeds_1.Colors.primary)
        .setDescription(lines.join('\n') +
        (omitted > 0 ? `\n\n> ➕ **${omitted}** اختصار آخر — استخدم \`/alias remove\` لإدارة البقية` : ''))
        .setFooter({
        text: `${grouped.size} اختصار فريد • ${aliases.length} ارتباط` +
            (removed > 0 ? ` • 🧹 حُذف ${removed} تكرار` : ''),
    })
        .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
}
exports.default = command;
//# sourceMappingURL=alias.js.map