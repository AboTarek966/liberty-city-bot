"use strict";
// ============================================
// Liberty City Bot - Alias Command
// Custom shortcuts for commands (e.g., "b" -> /ban)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const models_1 = require("../../models");
const aliasCache_1 = require("../../utils/aliasCache");
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
        .setDescription('الاختصار الذي سكتبه في الشات (مثال: تايم)')
        .setRequired(true)
        .setMaxLength(15))
        .addStringOption(o => o
        .setName('command')
        .setDescription('🎯 اختر الأمر من القائمة')
        .setRequired(false)
        .addChoices(
    // ----- عقوبات (7) -----
    { name: '🔨 حظر', value: 'ban' }, { name: '👢 طرد', value: 'kick' }, { name: '⏱️ تايم أوت (كتم مؤقت)', value: 'timeout' }, { name: '⚠️ تحذير', value: 'warn' }, { name: '🔇 كتم دائم (رول)', value: 'mute' }, { name: '🔊 فك الكتم', value: 'unmute' }, { name: '🗑️ مسح الرسائل', value: 'purge' }, 
    // ----- أدوات (5) -----
    { name: '🏓 بينج', value: 'ping' }, { name: '💬 رسالة نصية', value: 'say' }, { name: '🖼️ صورة الأفاتار', value: 'avatar' }, { name: '📝 إنشاء إمبد', value: 'embed' }, { name: '🏆 متصدرين (لوحة)', value: 'leaderboard' }, 
    // ----- ترفيه ولعب (7) -----
    { name: '🎱 كرة السحر 8ball', value: '8ball' }, { name: '🔀 اختيار عشوائي', value: 'choose' }, { name: '🎲 نرد', value: 'dice' }, { name: '🪙 رمية عملة', value: 'flip' }, { name: '😂 نكتة', value: 'joke' }, { name: '📊 تصويت', value: 'poll' }, { name: '💯 تقييم', value: 'rate' }, 
    // ----- معلومات (4) -----
    { name: '👤 معلومات عضو', value: 'userinfo' }, { name: '🏰 معلومات السيرفر', value: 'serverinfo' }, { name: '❓ مساعدة / قائمة الأوامر', value: 'help' }, { name: '📈 نشاط السيرفر', value: 'activity' }, 
    // ----- تذاكر + ذكاء اصطناعي (2) -----
    { name: '🎫 نظام التذاكر', value: 'ticket' }, { name: '🤖 ذكاء اصطناعي (شات)', value: 'ai' }))
        .addStringOption(o => o
        .setName('extra')
        .setDescription('📦 أوامر إضافية (إعدادات وحماية ورولات)')
        .setRequired(false)
        .addChoices({ name: '⚙️ إعدادات السيرفر', value: 'settings' }, { name: '🛡️ أنظمة الحماية', value: 'protection' }, { name: '🕵️ استرجاع رسالة محذوفة (سنايب)', value: 'snipe' }, { name: '💾 نسخة احتياطية', value: 'backup' }, { name: '⌨️ إدارة الاختصارات نفسها', value: 'alias' }, { name: '🎭 قائمة رولات (روليميو)', value: 'rolemenu' }, { name: '➕ رول تلقائي للأعضاء الجدد', value: 'autorole' }, { name: '➕ إضافة رول لعضو', value: 'roleadd' }, { name: '➖ إزالة رول من عضو', value: 'roleremove' }, { name: '🔓 إلغاء تايم أوت', value: 'untimeout' }, { name: '🔓 إلغاء حظر', value: 'unban' }, { name: '✅ إزالة تحذير', value: 'unwarn' }, { name: '⬆️ ترقية', value: 'promote' }, { name: '🚨 وضع الطوارئ', value: 'lockdown' }, { name: '🔒 سجن', value: 'jail' }, { name: '🔓 إلغاء سجن (إفراج)', value: 'unjail' }, { name: '📊 تذاكري المستلمة', value: 'ticket_mystats' }, { name: '🏆 أعلى المستلمين (توب 10)', value: 'ticket_top' }, { name: '💤 AFK (وضع عدم الوجود)', value: 'afk' }, { name: '🎫 تذاكر', value: 'ticket' }, { name: '🤖 AI', value: 'ai' }, 
    // ----- ألعاب (25+) -----
    { name: '🎱 8ball', value: '8ball' }, { name: '🔀 اختر', value: 'choose' }, { name: '🎲 نرد', value: 'dice' }, { name: '🪙 عملة', value: 'flip' }, { name: '😂 نكتة', value: 'joke' }, { name: '📊 تصويت', value: 'poll' }, { name: '💯 تقييم', value: 'rate' }, { name: '🎰 سلوتس', value: 'slots' }, { name: '🃏 بلاك جاك', value: 'blackjack' }, { name: '💣 قنبلة', value: 'bomb' }, { name: '🎳 بولينغ', value: 'bowling' }, { name: '🐉 تنين', value: 'dragon' }, { name: '⚔️ مبارزة', value: 'duel' }, { name: '🎣 صيد', value: 'fish' }, { name: '🎯 سهام', value: 'darts' }, { name: '🔼 أعلى/أقل', value: 'highlow' }, { name: '🏁 سباق', value: 'race' }, { name: '🎯 روليت', value: 'roulette' }, { name: '✂️ RPS', value: 'rps' }, { name: '💪 قوة', value: 'power' }, { name: '🧩 لغز', value: 'riddle' }, { name: '🎰 سلوتس2', value: 'slots' }, { name: '💰 كنز', value: 'treasure' }, { name: '🧱 شد حبل', value: 'tug' }, { name: '🎡 عجلة', value: 'wheel' }, { name: '❌⭕ XO', value: 'xo' }, { name: '🎮 ألعاب', value: 'games' }, { name: '🎮 لعبة', value: 'game' }, 
    // ----- موسيقى (جميع الساب-كوماندز) -----
    { name: '🎵 موسيقى تشغيل', value: 'music' }, { name: '⏭️ تخطي', value: 'music' }, { name: '⏹️ إيقاف', value: 'music' }, { name: '⏸️ إيقاف مؤقت', value: 'music' }, { name: '▶️ استئناف', value: 'music' }, { name: '📋 قائمة الانتظار', value: 'music' }, { name: '🎵 التشغيل الحالي', value: 'music' }, { name: '🔊 صوت', value: 'music' }, { name: '🔁 تكرار', value: 'music' }, { name: '⏩ تقديم', value: 'music' }, { name: '🚪 مغادرة صوتية', value: 'music' }, { name: '🔀 خلط', value: 'music' }, { name: '🗑️ إزالة', value: 'music' }, { name: '🔀 خلط قائمة', value: 'music' }, 
    // ----- حماية -----
    { name: '🛡️ حماية', value: 'protection' }, { name: '🛑 لوكداون', value: 'lockdown' }, { name: '🔒 سجن', value: 'jail' }, { name: '🔓 إفراج', value: 'unjail' }, 
    // ----- أوامر إدارية مفقودة -----
    { name: '🔨 حظر', value: 'ban' }, { name: '👢 طرد', value: 'kick' }, { name: '⏱️ تايم أوت', value: 'timeout' }, { name: '⚠️ تحذير', value: 'warn' }, { name: '🔇 كتم', value: 'mute' }, { name: '🔊 فك كتم', value: 'unmute' }, { name: '🗑️ مسح', value: 'purge' }, { name: '🚫 إلغاء حظر', value: 'unban' }, { name: '🗑️ إلغاء تايم', value: 'untimeout' }, { name: '✅ إزالة تحذير', value: 'unwarn' }, { name: '🔒 سجن', value: 'jail' }, { name: '🔓 إفراج', value: 'unjail' }, { name: '⬆️ ترقية', value: 'promote' }, { name: '🚨 لوكداون', value: 'lockdown' }, 
    // ----- أدوات -----
    { name: '🏓 بينج', value: 'ping' }, { name: '💬 say', value: 'say' }, { name: '🖼️ أفاتار', value: 'avatar' }, { name: '📝 إمبد', value: 'embed' }, { name: '🏆 توب', value: 'top' }, { name: '👤 يوزر إنفو', value: 'userinfo' }, { name: '🏰 سيرفر إنفو', value: 'serverinfo' }, { name: '❓ مساعدة', value: 'help' }, { name: '📈 نشاط', value: 'activity' }, { name: '🕵️ سنايب', value: 'snipe' }, { name: '💾 باك أب', value: 'backup' }, { name: '⌨️ علياس', value: 'alias' }, { name: '🎭 رول منيو', value: 'rolemenu' }, { name: '➕ أوتو رول', value: 'autorole' }, { name: '➕ رول أدد', value: 'roleadd' }, { name: '➖ رول ريموف', value: 'roleremove' }, { name: '📊 توب تذاكر', value: 'ticket_top' }, { name: '📊 تذكرة ستات', value: 'ticket_mystats' }, { name: '💤 AFK', value: 'afk' }, { name: '🎫 تذاكر', value: 'ticket' }, { name: '🤖 AI', value: 'ai' })))
        .addSubcommand(sub => sub
        .setName('remove')
        .setDescription('حذف اختصار')
        .addStringOption(o => o.setName('shortcut').setDescription('الاختصار').setRequired(true)))
        .addSubcommand(sub => sub.setName('list').setDescription('عرض جميع الاختصارات')),
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
    const choice = interaction.options.getString('command');
    const extra = interaction.options.getString('extra');
    // 🎯 اختر من إحدى القائمتين (جميع أوامر البوت متاحة)
    if (!choice && !extra) {
        await interaction.reply({
            content: '❌ **اختر الأمر من القائمة** — جميع أوامر البوت متاحة في القائمتين (`command` و `extra`)',
            ephemeral: true,
        });
        return;
    }
    const commandName = (choice || extra || '').toLowerCase().trim();
    // Remove prefix if user typed it (e.g., "/ban" -> "ban")
    const cleanCommand = commandName.replace(/^\//, '');
    // Validate shortcut: no spaces, reasonable length, not a reserved word
    if (shortcut.includes(' ') || shortcut.length > 15) {
        await interaction.reply({
            content: '❌ الاختصار لا يمكن أن يحتوي على مسافات وألا يزيد عن 15 حرف',
            ephemeral: true,
        });
        return;
    }
    // Check if it starts with "/" (would conflict with slash commands)
    if (shortcut.startsWith('/'))
        shortcut = shortcut.slice(1);
    // Check if command exists
    const targetCommand = client.commandHandler.getCommand(cleanCommand);
    if (!targetCommand) {
        await interaction.reply({
            content: `❌ الأمر \`${cleanCommand}\` غير موجود. استخدم \`/help\` لعرض الأوامر`,
            ephemeral: true,
        });
        return;
    }
    // ⚡ السماح بنفس الاختصار لأكثر من أمر (نظام التبديل/Toggle)
    // مثال: `ت` → تحذير و `ت` → إزالة تحذير — البوت يحدد أيهما ينفّذ حسب الحالة
    const existingSame = await models_1.CommandAlias.findOne({
        guildId: interaction.guildId,
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
    const existingOther = await models_1.CommandAlias.findOne({
        guildId: interaction.guildId,
        alias: shortcut,
        command: { $ne: cleanCommand },
    });
    // ⚡ السماح باختصار يطابق اسم أمر مدمج (مثل `afk` أو `ping`):
    // لا يوجد تعارض تقني — الأوامر المدمجة تعمل عبر الشرائح فقط،
    // والشات لا ينفذ إلا الاختصارات. (كان يُرفض سابقاً بدون سبب حقيقي)
    const isBuiltinName = !!client.commandHandler.getCommand(shortcut);
    await models_1.CommandAlias.create({
        guildId: interaction.guildId,
        alias: shortcut,
        command: cleanCommand,
        createdBy: interaction.user.id,
    });
    // تحديث الذاكرة المؤقتة فوراً (سرعة فورية بدون انتظار انتهاء صلاحيتها)
    (0, aliasCache_1.invalidateAliasCache)(interaction.guildId);
    // مثال استخدام جاهز حسب نوع العقوبة/الأمر
    const usageExamples = {
        ban: `\`${shortcut} @عضو [السبب]\``,
        kick: `\`${shortcut} @عضو [السبب]\``,
        timeout: `\`${shortcut} @عضو 10m [السبب]\` • المدة: ` + '`10m` `1h` `1d`',
        promote: `\${shortcut} @عضو [@رول] [السبب]`,
        warn: `\`${shortcut} @عضو [السبب]\``,
        unwarn: `\`${shortcut} @عضو [السبب]\``,
        mute: `\`${shortcut} @عضو [السبب]\``,
        unmute: `\`${shortcut} @عضو [السبب]\``,
        purge: `\`${shortcut} 50\``,
        snipe: `\`${shortcut}\` أو \`${shortcut} 2\` (رسالة أقدم)`,
        untimeout: `\`${shortcut} @عضو\``,
        unban: `\`${shortcut} @عضو\``,
        ping: `\`${shortcut}\``,
        say: `\`${shortcut} نص الرسالة\``,
        avatar: `\`${shortcut}\` أو \`${shortcut} @عضو\``,
        userinfo: `\`${shortcut}\` أو \`${shortcut} @عضو\``,
        serverinfo: `\`${shortcut}\``,
        help: `\`${shortcut}\``,
        activity: `\`${shortcut}\` أو \`${shortcut} @عضو\``,
        leaderboard: `\`${shortcut}\``,
        embed: `\`${shortcut}\` (يفتح نافذة الإنشاء)`,
        dice: `\`${shortcut}\` أو \`${shortcut} 20\``,
        flip: `\`${shortcut}\``,
        joke: `\`${shortcut}\``,
        choose: `\`${shortcut} خيار1 خيار2\``,
        rate: `\`${shortcut} الموضوع\``,
        '8ball': `\`${shortcut} هل سأنجح؟\``,
        poll: `\`${shortcut} السؤال خيار1 خيار2\``,
        ai: `\`${shortcut} سؤالك هنا\``,
        ticket: `\`${shortcut} close\` • \`${shortcut} list\``,
        ticket_mystats: `\`${shortcut}\``,
        ticket_top: `\`${shortcut}\``,
        settings: `\`${shortcut}\` (يفتح لوحة الإعدادات)`,
        protection: `\`${shortcut}\` (يفتح أنظمة الحماية)`,
        afk: `\`${shortcut} [السبب]\` — أو \`${shortcut}\` مرة أخرى للإلغاء`,
        backup: `\`${shortcut} create\``,
        rolemenu: `\`${shortcut} create\``,
        autorole: `\`${shortcut} @رول\``,
        roleadd: `${shortcut} @عضو @رول1 [@رول2 ...] [السبب]`,
        roleremove: `${shortcut} @عضو @رول [السبب]`,
        jail: `\`${shortcut} @عضو [السبب]\``,
        unjail: `\`${shortcut} @عضو [السبب]\``
    };
    const example = usageExamples[cleanCommand] || `\`${shortcut}\``;
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('✅ تمت إضافة الاختصار')
        .setColor(embeds_1.Colors.success)
        .addFields({ name: 'الاختصار', value: `\`${shortcut}\``, inline: true }, { name: 'الأمر', value: `/${cleanCommand}`, inline: true }, { name: '🔎 جرّبه الآن في الشات', value: example, inline: false })
        .setDescription(`اكتب \`${shortcut}\` في الشات لتنفيذ \`/${cleanCommand}\`` +
        (existingOther
            ? `\n\n🔁 **الاختصار مرتبط أيضاً بـ \`/${existingOther.command}\`** — ` +
                `سيُطبَّق **تبديل تلقائي** حسب حالة الهدف (مثال: عضو عنده تحذير ⇐ يشيله، ما عنده ⇐ يضيفه)`
            : '') +
        (isBuiltinName
            ? shortcut === cleanCommand
                ? `\n\n✅ **يعمل الآن مباشرة في الشات:** \`${example}\``
                : `\n\nℹ️ **ملاحظة:** \`${shortcut}\` هو أيضاً اسم أمر سلاش — لا مشكلة، ` +
                    `لأن الشات يستخدم الاختصارات فقط والأوامر تعمل عبر الشرائح`
            : ''))
        .setFooter({ text: 'Liberty City Aliases' });
    await interaction.reply({ embeds: [embed] });
}
// --------------------------------------------
// Remove Alias (يحذف كل الأوامر المرتبطة بهذا الاختصار)
// --------------------------------------------
async function handleRemove(interaction) {
    const shortcut = interaction.options.getString('shortcut', true).toLowerCase().trim();
    const result = await models_1.CommandAlias.deleteMany({
        guildId: interaction.guildId,
        alias: shortcut,
    });
    if (!result.deletedCount) {
        await interaction.reply({
            content: `❌ الاختصار \`${shortcut}\` غير موجود`,
            ephemeral: true,
        });
        return;
    }
    (0, aliasCache_1.invalidateAliasCache)(interaction.guildId);
    await interaction.reply({
        content: `✅ تم حذف الاختصار \`${shortcut}\`` +
            (result.deletedCount > 1 ? ` (كل أوامره: **${result.deletedCount}**)` : ''),
        ephemeral: true,
    });
}
// --------------------------------------------
// List Aliases
// --------------------------------------------
async function handleList(interaction) {
    const aliases = await models_1.CommandAlias.find({ guildId: interaction.guildId }).sort({ alias: 1 });
    if (aliases.length === 0) {
        await interaction.reply({
            content: '📭 لا توجد اختصارات. أضف واحداً باستخدام `/alias add`',
            ephemeral: true,
        });
        return;
    }
    // أسماء ملونة للعقوبات المعروفة
    const LABELS = {
        ban: '🔨 حظر',
        kick: '👢 طرد',
        timeout: '⏱️ تايم أوت',
        warn: '⚠️ تحذير',
        unwarn: '✅ إزالة تحذير',
        mute: '🔇 كتم',
        unmute: '🔊 فك الكتم',
        purge: '🗑️ مسح',
        untimeout: '🔓 إلغاء تايم أوت',
        unban: '🔓 إلغاء حظر',
        snipe: '🕵️ سنايب',
        ping: '🏓 بينج',
        say: '💬 رسالة',
        avatar: '🖼️ أفاتار',
        userinfo: '👤 معلومات',
        serverinfo: '🏰 معلومات السيرفر',
        help: '❓ مساعدة',
        activity: '📈 نشاط',
        leaderboard: '🏆 متصدرين',
        embed: '📝 إمبد',
        dice: '🎲 نرد',
        flip: '🪙 عملة',
        joke: '😂 نكتة',
        choose: '🔀 اختيار',
        rate: '💯 تقييم',
        '8ball': '🎱 كرة السحر',
        poll: '📊 تصويت',
        ai: '🤖 ذكاء اصطناعي',
        ticket: '🎫 تذاكر',
        ticket_mystats: '📊 تذاكري المستلمة',
        ticket_top: '🏆 أعلى المستلمين',
        settings: '⚙️ إعدادات',
        protection: '🛡️ حماية',
        backup: '💾 نسخة احتياطية',
        alias: '⌨️ اختصارات',
        rolemenu: '🎭 روليميو',
        autorole: '➕ رول تلقائي',
        roleadd: '➕ إضافة رول',
        roleremove: '➖ إزالة رول',
        afk: '💤 AFK',
        jail: '🔒 سجن',
        unjail: '🔓 إلغاء سجن',
    };
    // تجميع الاختصارات المكررة (نظام التبديل 🔁)
    const grouped = new Map();
    for (const a of aliases) {
        const list = grouped.get(a.alias) || [];
        list.push(a.command);
        grouped.set(a.alias, list);
    }
    const lines = [...grouped.entries()].slice(0, 30).map(([alias, cmds]) => {
        const names = cmds
            .map(c => (LABELS[c] ? `${LABELS[c]} \`/${c}\`` : `\`/${c}\``))
            .join(' • ');
        return `\`${alias}\`${cmds.length > 1 ? ' 🔁' : ''} → ${names}`;
    });
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle(`⌨️ اختصارات الأوامر [${grouped.size}]`)
        .setDescription(lines.join('\n') +
        (grouped.size < aliases.length ? `\n\n🔁 = نفس الاختصار مرتبط بأكثر من أمر (تبديل تلقائي حسب الحالة)` : ''))
        .setColor(embeds_1.Colors.primary)
        .setFooter({ text: 'Liberty City Aliases' })
        .setTimestamp();
    if (grouped.size > 30) {
        embed.setFooter({ text: `Liberty City Aliases | عرض 30 من ${grouped.size}` });
    }
    await interaction.reply({ embeds: [embed] });
}
exports.default = command;
//# sourceMappingURL=alias.js.map