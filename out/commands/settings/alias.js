"use strict";
// ============================================
// Omni Bot - Alias Command
// Custom shortcuts for commands (e.g., "b" -> /ban)
// ============================================
// قوائم اختيار ثابتة (Dropdowns) — كل قائمة ≤ 25 خياراً حسب حد ديسكورد.
// + تنظيف التكرارات الحرفية (نفس الاختصار + نفس الأمر) تلقائياً.
// + القفل والفتح أمران منفصلان: lock له اختصار، و unlock له اختصار مختلف.
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const models_1 = require("../../models");
const aliasCache_1 = require("../../utils/aliasCache");
const SPECIAL_COMMANDS = new Set(['ticket_top', 'ticket_mystats']);
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
        return { ok: false, command: '', reason: 'اختر الأمر من إحدى القوائم' };
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
        .setDescription('🎯 أوامر الإدارة والعقوبات')
        .setRequired(false)
        .addChoices({ name: '🔨 حظر', value: 'ban' }, { name: '👢 طرد', value: 'kick' }, { name: '⏱️ تايم أوت', value: 'timeout' }, { name: '⚠️ تحذير', value: 'warn' }, { name: '🔇 كتم', value: 'mute' }, { name: '🔊 فك كتم', value: 'unmute' }, { name: '🗣️ السماح بالكلام', value: 'speak' }, { name: '🗑️ مسح', value: 'purge' }, { name: '🚫 إلغاء حظر', value: 'unban' }, { name: '🗑️ إلغاء تايم', value: 'untimeout' }, { name: '✅ إزالة تحذير', value: 'unwarn' }, { name: '🔒 سجن', value: 'jail' }, { name: '🔓 إفراج', value: 'unjail' }, { name: '⬆️ ترقية', value: 'promote' }, { name: '🚨 لوكداون', value: 'lockdown' }, { name: '🔒 قفل الروم', value: 'lock' }, { name: '🔓 فتح الروم', value: 'unlock' }, { name: '🏷️ تغيير الاسم', value: 'nick' }, { name: '🏓 بينج', value: 'ping' }, { name: '💬 say', value: 'say' }, { name: '🖼️ أفاتار', value: 'avatar' }, { name: '📝 إمبد', value: 'embed' }, { name: '🏆 توب', value: 'top' }, { name: '👤 يوزر إنفو', value: 'userinfo' }))
        .addStringOption(o => o
        .setName('extra')
        .setDescription('🎮 ألعاب (25 لعبة)')
        .setRequired(false)
        .addChoices({ name: '🎱 8ball', value: '8ball' }, { name: '🔀 اختر', value: 'choose' }, { name: '🎲 نرد', value: 'dice' }, { name: '🪙 عملة', value: 'flip' }, { name: '😂 نكتة', value: 'joke' }, { name: '📊 تصويت', value: 'poll' }, { name: '💯 تقييم', value: 'rate' }, { name: '🎰 سلوتس', value: 'slots' }, { name: '🃏 بلاك جاك', value: 'blackjack' }, { name: '💣 قنبلة', value: 'bomb' }, { name: '🎳 بولينغ', value: 'bowling' }, { name: '🐉 تنين', value: 'dragon' }, { name: '⚔️ مبارزة', value: 'duel' }, { name: '🎣 صيد', value: 'fish' }, { name: '🎯 سهام', value: 'darts' }, { name: '🔼 أعلى/أقل', value: 'highlow' }, { name: '🏁 سباق', value: 'race' }, { name: '🎯 روليت', value: 'roulette' }, { name: '✂️ RPS', value: 'rps' }, { name: '💪 قوة', value: 'power' }, { name: '🧩 لغز', value: 'riddle' }, { name: '💰 كنز', value: 'treasure' }, { name: '🧱 شد حبل', value: 'tug' }, { name: '🎡 عجلة', value: 'wheel' }, { name: '❌⭕ XO', value: 'xo' }))
        .addStringOption(o => o
        .setName('extra2')
        .setDescription('🎵 موسيقى + حماية + معلومات')
        .setRequired(false)
        .addChoices(
    // 🎵 قيم فريدة لكل إجراء (music:<فعل>) — كانت كلها 'music' ولا تفرّق بينها
    { name: '🎵 تشغيل أغنية', value: 'music:play' }, { name: '⏭️ تخطي', value: 'music:skip' }, { name: '⏹️ إيقاف الموسيقى', value: 'music:stop' }, { name: '⏸️ إيقاف مؤقت', value: 'music:pause' }, { name: '▶️ استئناف', value: 'music:resume' }, { name: '📋 قائمة الانتظار', value: 'music:queue' }, { name: '🎵 الأغنية الحالية', value: 'music:nowplaying' }, { name: '🔊 الصوت', value: 'music:volume' }, { name: '🔁 التكرار', value: 'music:loop' }, { name: '⏩ تقديم 10 ثوانٍ', value: 'music:forward' }, { name: '⏪ إرجاع 10 ثوانٍ', value: 'music:back' }, { name: '🚪 مغادرة الصوتية', value: 'music:leave' }, { name: '🔀 خلط القائمة', value: 'music:shuffle' }, { name: '🗑️ إزالة أغنية', value: 'music:remove' }, { name: '🛡️ حماية', value: 'protection' }, { name: '🛑 لوكداون', value: 'lockdown' }, { name: '🔒 قفل الروم', value: 'lock' }, { name: '🔓 فتح الروم', value: 'unlock' }, { name: '🔒 سجن', value: 'jail' }, { name: '🔓 إفراج', value: 'unjail' }, { name: '🏰 سيرفر إنفو', value: 'serverinfo' }, { name: '👤 يوزر إنفو', value: 'userinfo' }, { name: '🏆 توب', value: 'top' }, { name: '📈 نشاط', value: 'activity' }))
        .addStringOption(o => o
        .setName('extra2b')
        .setDescription('🛠️ أدوات + تذاكر + AI')
        .setRequired(false)
        .addChoices({ name: '🏓 بينج', value: 'ping' }, { name: '💬 say', value: 'say' }, { name: '🖼️ أفاتار', value: 'avatar' }, { name: '📝 إمبد', value: 'embed' }, { name: '🕵️ سنايب', value: 'snipe' }, { name: '💾 باك أب', value: 'backup' }, { name: '🎫 تذاكر', value: 'ticket' }, { name: '🏆 توب التفاعل', value: 'leaderboard' }, { name: '🤖 AI', value: 'ai' }, { name: '🎮 ألعاب', value: 'games' }, { name: '🎮 لعبة', value: 'game' }, { name: '🗣️ السماح بالكلام', value: 'speak' }, { name: '🔒 قفل الروم', value: 'lock' }, { name: '🔓 فتح الروم', value: 'unlock' }))
        .addStringOption(o => o
        .setName('extra3')
        .setDescription('📦 أوامر إدارية + رولات + حماية متقدمة')
        .setRequired(false)
        .addChoices({ name: '⚙️ إعدادات', value: 'settings' }, { name: '🛡️ حماية', value: 'protection' }, { name: '🕵️ سنايب', value: 'snipe' }, { name: '💾 باك أب', value: 'backup' }, { name: '⌨️ علياس', value: 'alias' }, { name: '🎭 رول منيو', value: 'rolemenu' }, { name: '➕ أوتو رول', value: 'autorole' }, { name: '➕ رول أدد', value: 'roleadd' }, { name: '➖ رول ريموف', value: 'roleremove' }, { name: '🔓 إلغاء تايم', value: 'untimeout' }, { name: '🔓 إلغاء حظر', value: 'unban' }, { name: '✅ إزالة تحذير', value: 'unwarn' }, { name: '⬆️ ترقية', value: 'promote' }, { name: '🚨 لوكداون', value: 'lockdown' }, { name: '🔒 قفل الروم', value: 'lock' }, { name: '🔓 فتح الروم', value: 'unlock' }, { name: '🔒 سجن', value: 'jail' }, { name: '🔓 إفراج', value: 'unjail' }, { name: '📊 توب تذاكر', value: 'ticket_top' }, { name: '📊 تذكرة ستات', value: 'ticket_mystats' }, { name: '💤 AFK', value: 'afk' }, { name: '🎫 تذاكر', value: 'ticket' }, { name: '🤖 AI', value: 'ai' })))
        .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('حذف اختصار')
        .addStringOption(o => o.setName('shortcut').setDescription('الاختصار').setRequired(true).setMaxLength(30)))
        .addSubcommand(sub => sub.setName('clear').setDescription('🗑️ حذف جميع الاختصارات دفعة واحدة (مع تأكيد)'))
        .addSubcommand(sub => sub.setName('list').setDescription('عرض جميع الاختصارات (مع تنظيف التكرارات)')),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageGuild],
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
    // أي قائمة يختار منها المستخدم — كلها اختيارية، نأخذ أول قيمة موجودة
    const rawCommand = interaction.options.getString('command') ||
        interaction.options.getString('extra') ||
        interaction.options.getString('extra2') ||
        interaction.options.getString('extra2b') ||
        interaction.options.getString('extra3') ||
        '';
    if (!rawCommand) {
        await interaction.reply({
            content: '❌ **اختر الأمر من إحدى القوائم** — جميع أوامر البوت متاحة في القوائم',
            ephemeral: true,
        });
        return;
    }
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
    // 🔒/🔓 القفل والفتح أمران منفصلان — لكل واحد اختصار مستقل
    // لا نسمح بربط نفس الاختصار بـ lock و unlock معاً
    if (cleanCommand === 'lock' || cleanCommand === 'unlock') {
        const opposite = cleanCommand === 'lock' ? 'unlock' : 'lock';
        const conflict = await models_1.CommandAlias.findOne({
            guildId,
            alias: shortcut,
            command: opposite,
        });
        if (conflict) {
            await interaction.reply({
                content: `❌ الاختصار \`${shortcut}\` مستخدم بالفعل لأمر \`/${opposite}\`\n` +
                    `اجعل للقفل اختصاراً وللفتح اختصاراً مختلفاً — مثال: \`قفل\` → /lock و \`فتح\` → /unlock`,
                ephemeral: true,
            });
            return;
        }
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
    const matches = await models_1.CommandAlias.find({
        guildId: interaction.guildId,
        alias: shortcut,
    }).lean();
    if (!matches.length) {
        await interaction.reply({
            content: `❌ الاختصار \`${shortcut}\` غير موجود`,
            ephemeral: true,
        });
        return;
    }
    const result = await models_1.CommandAlias.deleteMany({
        guildId: interaction.guildId,
        alias: shortcut,
    });
    (0, aliasCache_1.invalidateAliasCache)(interaction.guildId);
    const detail = matches.map(m => `\`/${String(m.command).replace(':', ' ')}\``).join('، ');
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