"use strict";
// ============================================
// Omni Bot - 🔫 روليت (لعبة جماعية تفاعلية)
// /roulette → رسالة دعوة فيها زر دخول + زر خروج + عد تنازلي 60 ثانية
// ثم عجَلة تدور كل جولة، واللي تقف عليه يختار يطرد مين (أو يُطرَد هو لو ما ختارش في 30 ثانية)
// حتى يتبقى واحد = الفائز 🎉
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROULETTE_DELAY_MS = exports.MIN_ROULETTE_PLAYERS = exports.MAX_ROULETTE_PLAYERS = exports.rouletteGames = void 0;
exports.lobbyEmbed = lobbyEmbed;
exports.lobbyRow = lobbyRow;
exports.startRouletteGame = startRouletteGame;
exports.runRouletteRound = runRouletteRound;
exports.resolveKick = resolveKick;
exports.eliminatePlayer = eliminatePlayer;
exports.cleanupStoppedGame = cleanupStoppedGame;
exports.inventPlayersForGame = inventPlayersForGame;
exports.addToRouletteLobby = addToRouletteLobby;
exports.removeFromRouletteLobby = removeFromRouletteLobby;
const discord_js_1 = require("discord.js");
const wheelOfFortune_1 = require("./wheelOfFortune");
const wheelWorker_1 = require("./wheelWorker");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('Roulette');
exports.rouletteGames = new Map();
exports.MAX_ROULETTE_PLAYERS = 25;
/** الحد الأدنى لعدد اللاعبين قبل بدأ اللعبة */
exports.MIN_ROULETTE_PLAYERS = 4;
const LOBBY_SECONDS = 60;
const CHOICE_SECONDS = 30;
/** فاصل ٥ ثوانٍ بين كل حدث ورسالة في اللعبة — أفضل للتسلسل الطبيعي */
exports.ROULETTE_DELAY_MS = 5000;
const COLOR = 0xed4245;
/** عرض آمن للاعب — المنشن للأعضاء الحقيقيين، وأسماء البوتات الوهمية بولد وإيموجي 🤖 */
function playerDisplay(p) {
    return p.isBot ? `**${(0, helpers_1.escapeMarkdown)(p.username)}** 🤖` : `<@${p.id}>`;
}
/** سطر مرقّم لكل لاعب — أوضح من خط واحد مليء بالفواصل */
function playerLine(p, i) {
    return `\`${String(i + 1).padStart(2, ' ')}·\` ${playerDisplay(p)}`;
}
function playerBlock(players) {
    return players.map(playerLine).join('\n');
}
/** 🖼️ تحميل الآفاتارات على دفعات (٦ في المرة) بدل كل اللاعبين دفعة واحدة — أقل ضغطاً على الاستضافة */
async function fetchAvatarsInBatches(players, batch = 6) {
    const out = new Array(players.length).fill(null);
    for (let i = 0; i < players.length; i += batch) {
        const slice = players.slice(i, i + batch);
        const results = await Promise.all(slice.map((p) => p.avatarUrl ? (0, wheelOfFortune_1.fetchAvatarBuffer)(p.avatarUrl).catch(() => null) : Promise.resolve(null)));
        for (let j = 0; j < results.length; j++)
            out[i + j] = results[j];
    }
    return out;
}
// ---------- واجهة اللوبي ----------
function lobbyEmbed(game, startText = 'تبدأ اللعبة خلال 60 ثانية') {
    const names = game.players.length
        ? game.players.map((p, i) => playerLine(p, i)).join('\n')
        : 'لا أحد انضم بعد — اضغط **دخول اللعبة**!';
    return new discord_js_1.EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🔫 لعبة الروليت')
        .setDescription('تدور العجلة كل جولة — ومن تتوقف عليه يجب أن **يطرد لاعباً من اللعبة**.\n' +
        'وتتكرر الجولات حتى يتبقى **آخر لاعب** وهو الفائز 👑\n\n' +
        '**القوانين:**\n' +
        '• 60 ثانية للانضمام، وبعدها تبدأ اللعبة تلقائياً\n' +
        '• الحد الأدنى **٤ لاعبين** للبدء — إن لم تكتمل العدد؟ اضغط **🤖 إضافة بوتات** واختر العدد\n' +
        '• بعد أن تتوقف العجلة على أحد اللاعبين — يمتلك **30 ثانية** ليختار من يطرده\n' +
        '• إن لم يختر خلال الوقت المحدد → هو نفسه يُطرد 💀\n' +
        '• يُمنع الخروج بعد بدء اللعبة — الطرد هو الفاصل الوحيد')
        .addFields({
        name: `👥 المشاركون (${game.players.length}/${exports.MAX_ROULETTE_PLAYERS})`,
        value: names.slice(0, 1024),
    })
        .setFooter({ text: `${LOBBY_SECONDS} ثانية • ${startText}` })
        .setTimestamp();
}
function lobbyRow(game) {
    const join = new discord_js_1.ButtonBuilder()
        .setCustomId(`roulette:join:${game.id}`)
        .setLabel('دخول اللعبة')
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setEmoji('➕');
    const leave = new discord_js_1.ButtonBuilder()
        .setCustomId(`roulette:leave:${game.id}`)
        .setLabel('خروج من اللعبة')
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setEmoji('🚪');
    const addBots = new discord_js_1.ButtonBuilder()
        .setCustomId(`roulette:addbots:${game.id}`)
        .setLabel('🤖 إضافة بوتات')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('🤖');
    return [new discord_js_1.ActionRowBuilder().addComponents(join, leave, addBots)];
}
// ---------- بدء اللعبة ----------
async function startRouletteGame(client, gameId) {
    const game = exports.rouletteGames.get(gameId);
    if (!game || game.phase !== 'lobby')
        return;
    // مسح زرار اللوبي — المشاركين النهائيين
    clearTimeout(game.startTimer);
    game.startTimer = undefined;
    const guild = client.guilds.cache.get(game.guildId);
    const channel = guild?.channels.cache.get(game.channelId);
    if (!guild || !channel) {
        cleanup(game);
        return;
    }
    if (game.players.length < exports.MIN_ROULETTE_PLAYERS) {
        game.phase = 'done';
        await disableLobbyMessage(client, game).catch(() => { });
        await channel
            .send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(COLOR)
                    .setTitle('❌ ألغيت لعبة الروليت')
                    .setDescription(`لم ينضم ${exports.MIN_ROULETTE_PLAYERS} لاعبين على الأقل خلال دقيقة (المنضم: ${game.players.length}).\n` +
                    'اضغط **🤖 إضافة بوتات** قبل بدء اللعبة لو العدد غير كافٍ، أو حاول مرة أخرى.')
                    .setTimestamp(),
            ],
        })
            .catch(() => { });
        cleanup(game);
        return;
    }
    game.phase = 'spinning';
    // إزالة زرار اللوبي من الرسالة الأصلية
    await disableLobbyMessage(client, game).catch(() => { });
    // 🎡 عجلة متحركة GIF كما كانت سابقاً — الرندر داخل Worker مشترك حتى لا يتجمّد البوت
    //    لتعطيل الصورة مؤقتاً في بيئة ضعيفة: ROULETTE_RENDER_WHEEL=false
    //    أو للتعطيل القسري: ROULETTE_DISABLE_WHEEL=true
    const WANT_WHEEL = (process.env.ROULETTE_DISABLE_WHEEL || '').toLowerCase() !== 'true' &&
        (process.env.ROULETTE_RENDER_WHEEL || 'true').toLowerCase() !== 'false';
    game.avatarBuffers = WANT_WHEEL
        ? await fetchAvatarsInBatches(game.players, 6)
        : [];
    // أعلن انطلاق اللعبة، ثم انتظر 5 ثوانٍ قبل أول دورة
    if (channel.isTextBased()) {
        await channel
            .send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(COLOR)
                    .setTitle('🎮 انطلقت اللعبة!')
                    .setDescription(`⚔️ **اللاعبون (${game.players.length})**\n${playerBlock(game.players).slice(0, 3500)}`)
                    .setFooter({ text: 'استعدّوا — العجلة تدور الآن' })
                    .setTimestamp(),
            ],
        })
            .catch(() => { });
    }
    await (0, helpers_1.sleep)(exports.ROULETTE_DELAY_MS);
    await runRouletteRound(client, game);
}
async function disableLobbyMessage(client, game) {
    if (!game.messageId)
        return;
    const guild = client.guilds.cache.get(game.guildId);
    const channel = guild?.channels.cache.get(game.channelId);
    if (!channel)
        return;
    try {
        const msg = await channel.messages.fetch(game.messageId);
        await msg.edit({ components: [] });
    }
    catch {
        /* الرسالة قد لا تكون قابلة للتعديل — تجاهل */
    }
}
// ---------- الدوران ----------
async function runRouletteRound(client, game) {
    if (game.phase === 'done')
        return;
    game.phase = 'spinning';
    const guild = client.guilds.cache.get(game.guildId);
    const channel = guild?.channels.cache.get(game.channelId);
    if (!guild || !channel) {
        cleanup(game);
        return;
    }
    const winnerIndex = Math.floor(Math.random() * game.players.length);
    const chosen = game.players[winnerIndex];
    // 🎡 نرسل إمبد العجلة فوراً — ثم تُبنى GIF داخل Worker وتُلحق بالرسالة حين تكتمل
    //    (اللاعب لا ينتظر الرندر، والبوت ما يتجمد أبداً)
    const WANT_WHEEL = (process.env.ROULETTE_DISABLE_WHEEL || '').toLowerCase() !== 'true' &&
        (process.env.ROULETTE_RENDER_WHEEL || 'true').toLowerCase() !== 'false';
    const spinEmbed = new discord_js_1.EmbedBuilder()
        .setColor(COLOR)
        .setTitle('🎡 العجلة تدور...')
        .setDescription(`👥 **المتبقون (${game.players.length})**\n${playerBlock(game.players).slice(0, 3500)}`)
        .setFooter({ text: 'جاري تحديد عليه الدور...' })
        .setTimestamp();
    game.choiceTimer && clearTimeout(game.choiceTimer);
    const spinMessage = await channel.send({ embeds: [spinEmbed] }).catch(() => null);
    if (WANT_WHEEL && spinMessage) {
        const segments = game.players.map((p, i) => ({
            label: (p.username || '?').slice(0, 12),
            image: game.avatarBuffers[i],
        }));
        // الرندر في الخلفية — الإمبد لا يعتمد على اكتمالها
        void (async () => {
            try {
                const gif = await (0, wheelWorker_1.renderWheelInWorker)({
                    title: 'روليت',
                    subtitle: 'دور — وادفع مين يُطرَد',
                    segments,
                    winnerIndex,
                    hubText: 'OMNI',
                    width: 640,
                    format: 'gif',
                    orientation: 'landscape',
                    resultLabel: 'عليه الدور',
                    frames: 12,
                    delayMs: 55,
                }, 90000);
                if (!gif) {
                    logger.warn('wheel GIF render skipped (worker/timeout/canvas)');
                    return;
                }
                if (game.phase === 'done')
                    return;
                const arrivedEmbed = new discord_js_1.EmbedBuilder()
                    .setColor(COLOR)
                    .setTitle('🎡 العجلة وصلت!')
                    .setDescription(`👥 **المتبقون (${game.players.length})**\n${playerBlock(game.players).slice(0, 3500)}`)
                    .setImage('attachment://roulette.gif')
                    .setFooter({ text: 'وقفت العجلة — الدور الجاي للّي اتشارد' })
                    .setTimestamp();
                try {
                    await spinMessage.edit({
                        embeds: [arrivedEmbed],
                        files: [new discord_js_1.AttachmentBuilder(gif, { name: 'roulette.gif' })],
                    });
                    logger.info(`🎡 wheel GIF attached to spin message (${gif.length} bytes)`);
                }
                catch (editErr) {
                    logger.warn(`🎡 wheel GIF edit failed: ${String(editErr?.message || editErr).slice(0, 200)}`);
                }
            }
            catch (err) {
                logger.warn(`wheel render failed: ${err?.message || err}`);
            }
        })();
    }
    // بعد اللف (لحد ما تقف العجلة) — انتظر ٥ ثوانٍ ثم نوقف على اللي اختارته
    setTimeout(() => void openKickMenu(client, game.id, chosen.id), exports.ROULETTE_DELAY_MS);
}
// ---------- اختيار الطرد ----------
function kickButtonRows(game, chooserId) {
    const targets = game.players.filter((p) => p.id !== chooserId);
    const rows = [];
    for (let i = 0; i < targets.length; i += 5) {
        const slice = targets.slice(i, i + 5);
        const row = new discord_js_1.ActionRowBuilder();
        for (const p of slice) {
            row.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`roulette:kick:${game.id}:${p.id}`)
                .setLabel((p.username || 'لاعب').slice(0, 24))
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setEmoji('🔫'));
        }
        rows.push(row);
    }
    return rows;
}
async function openKickMenu(client, gameId, chooserId) {
    const game = exports.rouletteGames.get(gameId);
    if (!game || game.phase === 'done')
        return;
    if (!game.players.some((p) => p.id === chooserId)) {
        // اختفى من اللعبة — لاعب تاني يشوف الدورة ببساطة
        return;
    }
    const guild = client.guilds.cache.get(game.guildId);
    const channel = guild?.channels.cache.get(game.channelId);
    if (!channel) {
        cleanup(game);
        return;
    }
    game.chooserId = chooserId;
    game.phase = 'choosing';
    const chooser = game.players.find((p) => p.id === chooserId);
    const chooserDisplay = chooser ? playerDisplay(chooser) : '**لاعب**';
    try {
        const embed = new discord_js_1.EmbedBuilder()
            .setColor(COLOR)
            .setTitle('🎯 وقعت على...')
            .setDescription(`${chooserDisplay} — العجلة اختارتك! 💫\n` +
            `اضغط زر أي لاعب من الباقين لطرده من اللعبة.\n` +
            `⏳ لديك **30 ثانية** — إن لم تختر، فأنت المطرود!`)
            .addFields({
            name: `👥 المتبقون (${game.players.length})`,
            value: game.players.map((p, i) => playerLine(p, i)).join('\n').slice(0, 1024),
        })
            .setFooter({ text: '30 ثانية فقط — من يختار بسرعة ينجو' })
            .setTimestamp();
        const msg = await channel.send({
            content: `🎮 ${chooserDisplay} — حان دورك!`,
            embeds: [embed],
            components: kickButtonRows(game, chooserId),
        });
        game.choiceMessageId = msg.id;
        game.choiceTimer = setTimeout(() => void onKickTimeout(client, game.id), CHOICE_SECONDS * 1000);
        // 🤖 لو العجلة وقفت على بوت — يختار فوراً بعد ٥ ثوانٍ
        if (chooser?.isBot) {
            clearTimeout(game.choiceTimer);
            const others = game.players.filter((p) => p.id !== chooserId);
            if (others.length) {
                const target = others[Math.floor(Math.random() * others.length)];
                game.choiceTimer = setTimeout(() => void eliminatePlayer(client, game, target.id, 'kick'), exports.ROULETTE_DELAY_MS);
            }
        }
    }
    catch (err) {
        logger.warn(`openKickMenu failed: ${err?.message || err}`);
        cleanup(game);
    }
}
async function onKickTimeout(client, gameId) {
    const game = exports.rouletteGames.get(gameId);
    if (!game || game.phase !== 'choosing' || !game.chooserId)
        return;
    await eliminatePlayer(client, game, game.chooserId, 'timeout');
}
async function resolveKick(client, game, targetId) {
    if (game.phase !== 'choosing')
        return { ok: false, reason: 'ليس وقت الاختيار الآن' };
    const target = game.players.find((p) => p.id === targetId);
    if (!target)
        return { ok: false, reason: 'اللاعب ده مابقاش في اللعبة' };
    await eliminatePlayer(client, game, targetId, 'kick');
    return { ok: true };
}
async function eliminatePlayer(client, game, targetId, reason) {
    if (game.phase !== 'choosing')
        return;
    const gameId = game.id;
    clearTimeout(game.choiceTimer);
    game.choiceTimer = undefined;
    const guild = client.guilds.cache.get(game.guildId);
    const channel = guild?.channels.cache.get(game.channelId);
    if (!guild || !channel) {
        cleanup(game);
        return;
    }
    const target = game.players.find((p) => p.id === targetId);
    if (!target) {
        // اللاعب خرج بالفعل — نكمل الدورة ببساطة
        game.phase = 'spinning';
        await runRouletteRound(client, game);
        return;
    }
    // عطّل أزرار الاختيار في الرسالة الأصلية
    if (game.choiceMessageId) {
        try {
            const msg = await channel.messages.fetch(game.choiceMessageId);
            await msg.edit({ components: [] });
        }
        catch {
            /* تجاهل */
        }
    }
    // انتظر خمس ثوانٍ قبل إعلان الطرد (يعطي شعوراً درامياً بالتسلسل)
    await (0, helpers_1.sleep)(exports.ROULETTE_DELAY_MS);
    // المنشن الآمن: الحقيقي يرى منشن، الوهمي يرى اسمه بولد — بدون `<@fake_...>` مشوّهة
    const chooserPlayer = game.chooserId ? game.players.find((p) => p.id === game.chooserId) : null;
    const chooserMention = chooserPlayer ? playerDisplay(chooserPlayer) : 'العجلة';
    const targetPlayer = game.players.find((p) => p.id === targetId);
    const targetMention = targetPlayer ? playerDisplay(targetPlayer) : 'العضو المطرود';
    const reasonText = reason === 'timeout'
        ? 'لم يختر أحداً خلال 30 ثانية 💀'
        : `${chooserMention} اختاره للطرد 🔫`;
    // DM للمطرود (اللاعبون الوهميون ليس لهم حسابات حقيقية — نتخطاهم)
    if (!targetId.startsWith('fake_')) {
        try {
            const user = await client.users.fetch(targetId);
            await user
                .send(`🎢 تم طردك من لعبة الروليت في **${guild.name}**.\n${reasonText}\n\nيمكنك الانضمام للعبة المقبلة من جديد!`)
                .catch(() => { });
        }
        catch {
            /* DM مغلق — تجاهل */
        }
    }
    const idx = game.players.findIndex((p) => p.id === targetId);
    game.players.splice(idx, 1);
    if (game.avatarBuffers && game.avatarBuffers.length === game.players.length + 1) {
        game.avatarBuffers.splice(idx, 1);
    }
    else {
        game.avatarBuffers = [];
    }
    const remaining = game.players.length;
    await channel
        .send({
        embeds: [
            new discord_js_1.EmbedBuilder()
                .setColor(COLOR)
                .setTitle('💀 طرد!')
                .setDescription(`${targetMention} تم طرده من اللعبة! ${reasonText}\n👥 المتبقون الآن: **${remaining}**`)
                .setTimestamp(),
        ],
    })
        .catch(() => { });
    if (remaining <= 1) {
        await (0, helpers_1.sleep)(exports.ROULETTE_DELAY_MS);
        await endRouletteGame(client, game);
        return;
    }
    // انتظر ٥ ثوانٍ أخرى قبل استئناف الجولة التالية — تسلسل طبيعي
    await (0, helpers_1.sleep)(exports.ROULETTE_DELAY_MS);
    game.phase = 'spinning';
    game.chooserId = undefined;
    game.choiceMessageId = undefined;
    await runRouletteRound(client, game);
}
// ---------- النهاية ----------
async function endRouletteGame(client, game) {
    game.phase = 'done';
    clearTimeout(game.choiceTimer);
    clearTimeout(game.startTimer);
    const guild = client.guilds.cache.get(game.guildId);
    const channel = guild?.channels.cache.get(game.channelId);
    const winner = game.players[0];
    if (!guild || !channel) {
        cleanup(game);
        return;
    }
    // انتظر خمس ثوانٍ قبل الإعلان عن البطل
    await (0, helpers_1.sleep)(exports.ROULETTE_DELAY_MS);
    try {
        await channel.send({
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setColor(0x57f287)
                    .setTitle('👑 الفائز في لعبة الروليت!')
                    .setDescription(`🎉 مبروك ${winner ? playerDisplay(winner) : 'لا أحد'} — الناجي الأخير من الروليت! 👑🥁`)
                    .setTimestamp(),
            ],
        });
    }
    catch {
        /* تجاهل */
    }
    cleanup(game);
}
function cleanup(game) {
    clearTimeout(game.choiceTimer);
    clearTimeout(game.startTimer);
    game.chooserId = undefined;
    game.choiceMessageId = undefined;
    game.choiceTimer = undefined;
    game.startTimer = undefined;
    exports.rouletteGames.delete(game.id);
}
/** ⏹️ يقطع اللعبة الحالية فوراً — يعلن عن نهاية اللعب ويحذف كل حالتها */
async function cleanupStoppedGame(client, game) {
    clearTimeout(game.choiceTimer);
    clearTimeout(game.startTimer);
    clearTimeout(game.choiceTimer);
    game.phase = 'done';
    const guild = client.guilds.cache.get(game.guildId);
    const channel = guild?.channels.cache.get(game.channelId);
    const winner = game.players[0];
    try {
        if (channel?.isTextBased?.()) {
            await channel.send({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setColor(COLOR)
                        .setTitle('🛑 تم إيقاف اللعبة')
                        .setDescription(`اللعبة أُوقفت بواسطة مدير السيرفر.\n` +
                        (winner
                            ? `كان متبقياً: ${playerDisplay(winner)} (${winner.username}) — اللعبة لا تُكمل بهذا الأمر.`
                            : 'لم يُحدد فائز.'))
                        .setTimestamp(),
                ],
            });
        }
    }
    catch {
        /* تجاهل */
    }
    cleanup(game);
}
// ---------- انضمام/خروج ----------
// ---------- 🎭 أسماء وهمية يخترعها البوت ----------
const FAKE_FIRST = ['أسد', 'نمر', 'ذئب', 'صقر', 'سيف', 'شبح', 'جبل', 'شهاب', 'فهد', 'حصان', 'عقاب', 'ثور', 'تنين', 'ليث', 'فرهد', 'قاهر', 'عاصف'];
const FAKE_LAST = ['الصحراء', 'الليل', 'الجبال', 'السماء', 'الرمال', 'الظل', 'البحر', 'اليوم', 'العاصفة', 'الصقور', 'النار', 'الحرية', 'البرق', 'الصبار', 'الفرسان'];
const FAKE_EMOJI = ['🦁', '🐯', '🐺', '🦅', '🔥', '⚡', '🌩️', '🌪️', '⚔️', '🛡️', '💀', '🌟', '☠️', '🦾', '🎯'];
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
/** 🎲 يخترع العدد المطلوب من اللاعبين الوهميين — اسم من بيت البوت + أفتار من dicebear */
function inventPlayersForGame(count, existing) {
    const free = Math.max(0, exports.MAX_ROULETTE_PLAYERS - existing.length);
    const n = Math.min(Math.max(0, count), free);
    const players = [];
    for (let i = 0; i < n; i++) {
        const first = pickOne(FAKE_FIRST);
        const last = pickOne(FAKE_LAST);
        const emoji = pickOne(FAKE_EMOJI);
        const name = `${first} ${last} ${emoji}`;
        const id = `fake_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}_${i}`;
        players.push({
            id,
            username: name.slice(0, 32),
            avatarUrl: `https://api.dicebear.com/9.x/adventurer-neutral/png?seed=${encodeURIComponent(name)}&size=64&backgroundColor=e3b6ff`,
            isBot: true,
        });
    }
    return players;
}
function addToRouletteLobby(gameId, player) {
    const game = exports.rouletteGames.get(gameId);
    if (!game)
        return { ok: false, reason: 'انتهت اللعبة أو لم تبدأ' };
    if (game.phase !== 'lobby')
        return { ok: false, reason: 'بدأت اللعبة بالفعل' };
    if (game.players.some((p) => p.id === player.id))
        return { ok: false, reason: 'أنت مشارك بالفعل!' };
    if (game.players.length >= exports.MAX_ROULETTE_PLAYERS)
        return { ok: false, reason: 'اللعبة ممتلئة (25 كحد أقصى)' };
    game.players.push(player);
    return { ok: true, game };
}
function removeFromRouletteLobby(gameId, userId) {
    const game = exports.rouletteGames.get(gameId);
    if (!game)
        return { ok: false, reason: 'انتهت اللعبة أو لم تبدأ' };
    if (game.phase !== 'lobby')
        return { ok: false, reason: 'بدأت اللعبة — مفيش خروج' };
    const idx = game.players.findIndex((p) => p.id === userId);
    if (idx === -1)
        return { ok: false, reason: 'لم تنضم للعبة أصلاً' };
    game.players.splice(idx, 1);
    return { ok: true, game };
}
//# sourceMappingURL=rouletteGame.js.map