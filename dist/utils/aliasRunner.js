"use strict";
// ============================================
// Liberty City Bot - Alias Runner
// تنفيذ أي أمر سلاش من رسالة عادية عبر الاختصار:
// يبني "تفاعل وهمي" (Mock Interaction) بنفس بنية أمر السلاش،
// ويحول نص الرسالة إلى خيارات الأمر تلقائياً.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCommandFromMessage = executeCommandFromMessage;
const discord_js_1 = require("discord.js");
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('AliasRunner');
const SubTypes = [
    discord_js_1.ApplicationCommandOptionType.Subcommand,
    discord_js_1.ApplicationCommandOptionType.SubcommandGroup,
];
// استخراج معرّف من منشن أو معرّف خام
function parseId(token) {
    if (!token)
        return null;
    const userMention = token.match(/^<@!?(\d{17,20})>$/);
    if (userMention)
        return userMention[1];
    const roleMention = token.match(/^<@&(\d{17,20})>$/);
    if (roleMention)
        return roleMention[1];
    if (/^\d{17,20}$/.test(token))
        return token;
    return null;
}
// اختيار حقول الرسالة المدعومة فقط (تجاهل ephemeral وحقول التفاعل)
function pickPayload(payload) {
    if (typeof payload === 'string')
        return { content: payload };
    if (!payload || typeof payload !== 'object')
        return { content: '✅' };
    const out = {};
    for (const key of ['content', 'embeds', 'components', 'files', 'allowedMentions', 'stickerIds']) {
        if (payload[key] !== undefined && payload[key] !== null)
            out[key] = payload[key];
    }
    if (!out.content &&
        !(out.embeds && out.embeds.length) &&
        !(out.components && out.components.length) &&
        !(out.files && out.files.length)) {
        out.content = '✅';
    }
    return out;
}
// رد مرن على الرسالة
async function respond(message, payload) {
    const body = pickPayload(payload);
    try {
        await message.reply(body);
        return;
    }
    catch {
        /* fallback below */
    }
    try {
        if (message.channel.isTextBased() && 'send' in message.channel) {
            await message.channel.send({ content: `<@${message.author.id}>`, ...body });
        }
    }
    catch (error) {
        logger.warn(`Alias respond failed: ${error.message}`);
    }
}
function buildUsage(commandName, optionDefs) {
    const parts = optionDefs.map(o => (o.required ? `<${o.name}>` : `[${o.name}]`));
    const suffix = parts.length ? ' ' + parts.join(' ') : '';
    return `\`/${commandName}${suffix}\``;
}
// --------------------------------------------
// تفاعل وهمي يحاكي ChatInputCommandInteraction
// --------------------------------------------
class AliasInteraction {
    message;
    commandName;
    subcommand;
    group;
    values;
    token = '';
    replied = false;
    deferred = false;
    lastMessage = null;
    constructor(message, commandName, subcommand, group, values) {
        this.message = message;
        this.commandName = commandName;
        this.subcommand = subcommand;
        this.group = group;
        this.values = values;
    }
    // ----- خصائص -----
    get client() { return this.message.client; }
    get user() { return this.message.author; }
    // عضو المنفذ — يجب أن يكون GuildMember حقيقياً بـ roles كاملة (لا نعيد Promise أبداً)
    get member() {
        return this.message.member;
    }
    get guild() { return this.message.guild; }
    get channel() { return this.message.channel; }
    get channelId() { return this.message.channel.id; }
    get guildId() { return this.message.guild?.id ?? null; }
    get applicationId() { return this.message.client.application?.id ?? ''; }
    get createdTimestamp() { return this.message.createdTimestamp; }
    get id() { return `alias-${this.message.id}`; }
    get locale() { return 'ar'; }
    // ----- كشف النوع -----
    isChatInputCommand() { return true; }
    isCommand() { return true; }
    isAutocomplete() { return false; }
    isButton() { return false; }
    isAnySelectMenu() { return false; }
    isStringSelectMenu() { return false; }
    isModalSubmit() { return false; }
    isRepliable() { return true; }
    inGuild() { return !!this.message.guild; }
    inCachedGuild() { return !!this.message.guild; }
    // ----- الخيارات -----
    read(name, required) {
        const value = this.values.get(name);
        if (value === undefined || value === null) {
            if (required)
                throw new Error(`الخيار "${name}" مطلوب لهذا الأمر`);
            return null;
        }
        return value;
    }
    options = {
        getSubcommand: (_name, _required) => this.subcommand,
        getSubcommandGroup: (_name, _required) => this.group,
        getString: (name, required) => this.read(name, required),
        getInteger: (name, required) => this.read(name, required),
        getNumber: (name, required) => this.read(name, required),
        getBoolean: (name, required) => this.read(name, required),
        getUser: (name, required) => {
            const value = this.read(name, required);
            // لو القيمة GuildMember نُرجع المستخدم بداخله، ولو User نُرجعه كما هو
            if (value && value.user && value.roles !== undefined)
                return value.user;
            return value;
        },
        getMember: (name, required) => {
            const value = this.read(name, required);
            // نُعيد العضو فقط إذا كان GuildMember حقيقياً يملك roles (وإلا فالمستخدم ليس في السيرفر)
            if (value && value.roles !== undefined)
                return value;
            if (required)
                throw new Error('العضو غير موجود في السيرفر');
            return null;
        },
        getRole: (name, required) => this.read(name, required),
        getChannel: (name, required) => this.read(name, required),
        getMentionable: (name, required) => this.read(name, required),
        get: (name) => this.values.get(name) ?? null,
    };
    // ----- الإرسال -----
    async send(payload) {
        const channel = this.message.channel;
        if (!this.message.channel.isTextBased() || !('send' in channel)) {
            throw new Error('لا يمكن الإرسال في هذا النوع من القنوات');
        }
        return channel.send(pickPayload(payload));
    }
    async reply(payload) {
        this.replied = true;
        this.lastMessage = await this.send(payload);
        return this.lastMessage;
    }
    async deferReply(_options) {
        this.deferred = true;
    }
    async editReply(payload) {
        const body = pickPayload(payload);
        if (this.lastMessage) {
            await this.lastMessage.edit(body).catch(() => { });
            return this.lastMessage;
        }
        this.lastMessage = await this.send(body);
        return this.lastMessage;
    }
    async followUp(payload) {
        return this.send(payload);
    }
    async fetchReply() {
        return this.lastMessage;
    }
    async deleteReply() {
        if (this.lastMessage) {
            await this.lastMessage.delete().catch(() => { });
            this.lastMessage = null;
        }
    }
    async update(payload) {
        return this.editReply(payload);
    }
    async deferUpdate() { }
    async showModal(modal) {
        // النوافذ (Modals) لا يمكن فتحها من رسالة عادية في ديسكورد.
        // نرسل رسالة إرشادية بلطف بدل رمي خطأ.
        const title = modal?.data?.title || 'هذه النافذة';
        await respond(this.message, `🔐 ${title} — لا يمكن فتح نافذة الإدخال من الاختصار.\n` +
            `استخدم أمر السلاش مباشرة: \`/${this.commandName}\`\n` +
            `> 💡 بعد إدخال كلمة المرور مرة واحدة، يصبح الاختصار متاحاً لمدة 30 دقيقة.`);
    }
}
// --------------------------------------------
// المدخل الرئيسي: تنفيذ أي أمر سلاش من رسالة
// يعيد true إذا تم التنفيذ (أو رُفض بسبب صلاحية/استخدام خاطئ)
// --------------------------------------------
async function executeCommandFromMessage(message, client, commandName, args) {
    try {
        const guild = message.guild;
        const member = message.member;
        if (!guild || !member)
            return false;
        const command = client.commandHandler.getCommand(commandName);
        if (!command)
            return false;
        // مخطط الأمر (SlashCommandBuilder → JSON)
        const json = typeof command.data?.toJSON === 'function' ? command.data.toJSON() : command.data;
        // فحص إضافي لصلاحيات السلاش (executeAliasCommand يفحص command.permissions مسبقاً)
        if (json?.default_member_permissions) {
            try {
                const required = BigInt(json.default_member_permissions);
                if (required > 0n && !member.permissions.has(required)) {
                    await respond(message, '❌ ليس لديك الصلاحيات الكافية لاستخدام هذا الأمر');
                    return true;
                }
            }
            catch {
                /* bitfield غير صالح — تجاهل */
            }
        }
        const defs = Array.isArray(json?.options) ? json.options : [];
        let optionDefs = defs;
        let remaining = [...args];
        let subcommand = null;
        let group = null;
        // ----- الأوامر الفرعية -----
        const subDefs = defs.filter(o => SubTypes.includes(o.type));
        if (subDefs.length > 0) {
            const first = remaining[0]?.toLowerCase();
            const match = first ? subDefs.find(s => s.name.toLowerCase() === first) : undefined;
            const applySub = (sub, groupName) => {
                if (groupName)
                    group = groupName;
                subcommand = sub.name;
                optionDefs = sub.options || [];
            };
            if (match && match.type === discord_js_1.ApplicationCommandOptionType.Subcommand) {
                applySub(match, null);
                remaining = remaining.slice(1);
            }
            else if (match && match.type === discord_js_1.ApplicationCommandOptionType.SubcommandGroup) {
                const nested = (match.options || []).filter((s) => s.type === discord_js_1.ApplicationCommandOptionType.Subcommand);
                const nFirst = remaining[1]?.toLowerCase();
                const nMatch = nFirst
                    ? nested.find(s => s.name.toLowerCase() === nFirst)
                    : nested.find(s => ['status', 'list', 'info', 'help'].includes(s.name)) || nested[0];
                if (nMatch) {
                    applySub(nMatch, match.name);
                    remaining = remaining.slice(2);
                }
                else {
                    await respond(message, `📋 الأوامر الفرعية: ${nested.map(s => `\`${s.name}\``).join('، ')}`);
                    return true;
                }
            }
            else if (remaining.length === 0) {
                // بدون نص: اختر أمراً آمناً (status/list/info/help)
                const fallback = subDefs.find(s => s.type === discord_js_1.ApplicationCommandOptionType.Subcommand &&
                    ['status', 'list', 'info', 'help'].includes(s.name));
                if (fallback) {
                    applySub(fallback, null);
                }
                else {
                    await respond(message, `📋 **الاستخدام:** \`${commandName} <${subDefs
                        .filter(s => s.type === discord_js_1.ApplicationCommandOptionType.Subcommand)
                        .map(s => s.name)
                        .join(' | ')}>\``);
                    return true;
                }
            }
            else {
                // النص ليس أمر فرعي → اعتبره للاحتمي الأول وأرسل الباقي كخيارات
                applySub(subDefs[0], null);
            }
        }
        // ----- تحويل النص → خيارات -----
        const values = new Map();
        const prefetch = new Map();
        const consumable = optionDefs.filter(o => !SubTypes.includes(o.type));
        const usageReply = async () => {
            await respond(message, `📋 **الاستخدام:** ${buildUsage(commandName, consumable)}`);
            return true;
        };
        for (let i = 0; i < consumable.length; i++) {
            const opt = consumable[i];
            const type = opt.type;
            // بوول: يقبل تلقائياً بدون نص
            if (type === discord_js_1.ApplicationCommandOptionType.Boolean) {
                const token = remaining.shift();
                if (token === undefined) {
                    if (opt.required)
                        return usageReply();
                    continue;
                }
                values.set(opt.name, ['true', '1', 'yes', 'y', 'نعم', 'اي', 'صح'].includes(token.toLowerCase()));
                continue;
            }
            // لا نص متبقٍ
            if (remaining.length === 0) {
                if (opt.required)
                    return usageReply();
                continue;
            }
            // أنواع تحتاج جلب مسبق (المتصل متزامن)
            if (type === discord_js_1.ApplicationCommandOptionType.User ||
                type === discord_js_1.ApplicationCommandOptionType.Role ||
                type === discord_js_1.ApplicationCommandOptionType.Channel ||
                type === discord_js_1.ApplicationCommandOptionType.Mentionable) {
                // 🔎 ابحث عن أول معرّف صالح — تجاهل الكلمات الزائدة قبله
                // مثال: "شيل تحذير @عضو" ← كلمة "تحذير" زائدة، المعرّف هو @عضو
                let id = null;
                const noise = [];
                while (remaining.length > 0) {
                    const parsed = parseId(remaining[0]);
                    if (parsed) {
                        remaining.shift();
                        id = parsed;
                        break;
                    }
                    noise.push(remaining.shift());
                }
                if (!id) {
                    // لم نجد معرّفًا ← نُعيد الكلمات حتى تستخدمها خيارات لاحقة (مثل السبب)
                    remaining.unshift(...noise);
                    if (opt.required)
                        return usageReply();
                    continue;
                }
                let kind = 'user';
                if (type === discord_js_1.ApplicationCommandOptionType.Role)
                    kind = 'role';
                else if (type === discord_js_1.ApplicationCommandOptionType.Channel)
                    kind = 'channel';
                else if (type === discord_js_1.ApplicationCommandOptionType.Mentionable)
                    kind = 'mentionable';
                prefetch.set(opt.name, { kind, id });
                continue;
            }
            // أرقام
            if (type === discord_js_1.ApplicationCommandOptionType.Integer ||
                type === discord_js_1.ApplicationCommandOptionType.Number) {
                const token = remaining.shift();
                const n = Number(token);
                if (Number.isNaN(n)) {
                    if (opt.required)
                        return usageReply();
                    continue;
                }
                values.set(opt.name, type === discord_js_1.ApplicationCommandOptionType.Integer ? Math.trunc(n) : n);
                continue;
            }
            // نص (والافتراضي لأي نوع آخر)
            const later = consumable.slice(i + 1);
            const laterRequired = later.some(o => o.required && o.type !== discord_js_1.ApplicationCommandOptionType.Boolean);
            const takeAll = later.length === 0 || (remaining.length === 1 && !laterRequired);
            values.set(opt.name, takeAll ? remaining.join(' ') : remaining.shift());
            if (takeAll)
                remaining = [];
        }
        // ----- جلب المستخدمين/الرولات/القنوات -----
        for (const [name, p] of prefetch) {
            if (p.kind === 'user' || p.kind === 'mentionable') {
                // نجلب GuildMember حقيقياً (يملك roles) أولاً — أوامر الإشراف (ترقية/حظر/كتم) تحتاج roles
                const member = await guild.members.fetch(p.id).catch(() => null);
                if (member) {
                    // GuildMember يحتوي .user و roles — يعمل مع getUser و getMember معاً
                    values.set(name, member);
                    continue;
                }
                const user = await client.users.fetch(p.id).catch(() => null);
                if (user) {
                    values.set(name, user);
                    continue;
                }
                if (p.kind === 'mentionable') {
                    const role = guild.roles.cache.get(p.id);
                    if (role) {
                        values.set(name, role);
                        continue;
                    }
                }
                await respond(message, '❌ لم يتم العثور على المستخدم');
                return true;
            }
            if (p.kind === 'member') {
                const m = await guild.members.fetch(p.id).catch(() => null);
                if (!m) {
                    await respond(message, '❌ العضو غير موجود في السيرفر');
                    return true;
                }
                values.set(name, m);
                continue;
            }
            if (p.kind === 'role') {
                const role = guild.roles.cache.get(p.id);
                if (!role) {
                    await respond(message, '❌ الرول غير موجود');
                    return true;
                }
                values.set(name, role);
                continue;
            }
            if (p.kind === 'channel') {
                const channel = guild.channels.cache.get(p.id);
                if (!channel) {
                    await respond(message, '❌ القناة غير موجودة');
                    return true;
                }
                values.set(name, channel);
                continue;
            }
        }
        // ----- التنفيذ -----
        const interaction = new AliasInteraction(message, commandName, subcommand, group, values);
        try {
            await command.execute(interaction);
            logger.info(`Alias generic executed: /${commandName} by ${message.author.tag}`);
        }
        catch (error) {
            logger.error(`Alias generic execution failed (${commandName}): ${error.message}`);
            await respond(message, `❌ تنفيذ \`/${commandName}\` عبر الاختصار فشل: ${error.message}`);
        }
        return true;
    }
    catch (error) {
        logger.error(`executeCommandFromMessage error (${commandName}): ${error.message}`);
        return false;
    }
}
//# sourceMappingURL=aliasRunner.js.map