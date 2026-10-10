// ============================================
// Liberty City Bot - Alias Runner
// تنفيذ أي أمر سلاش من رسالة عادية عبر الاختصار:
// يبني "تفاعل وهمي" (Mock Interaction) بنفس بنية أمر السلاش،
// ويحول نص الرسالة إلى خيارات الأمر تلقائياً.
// ============================================

import {
  Message,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
} from 'discord.js';
import { LibertyClient } from '../LibertyClient';
import { createLogger } from './helpers';

const logger = createLogger('AliasRunner');

const SubTypes = [
  ApplicationCommandOptionType.Subcommand,
  ApplicationCommandOptionType.SubcommandGroup,
];

interface Prefetch {
  kind: 'user' | 'member' | 'role' | 'channel' | 'mentionable';
  id: string;
}

// استخراج معرّف من منشن أو معرّف خام
function parseId(token?: string): string | null {
  if (!token) return null;
  const userMention = token.match(/^<@!?(\d{17,20})>$/);
  if (userMention) return userMention[1];
  const roleMention = token.match(/^<@&(\d{17,20})>$/);
  if (roleMention) return roleMention[1];
  if (/^\d{17,20}$/.test(token)) return token;
  return null;
}

// اختيار حقول الرسالة المدعومة فقط (تجاهل ephemeral وحقول التفاعل)
function pickPayload(payload: any): any {
  if (typeof payload === 'string') return { content: payload };
  if (!payload || typeof payload !== 'object') return { content: '✅' };

  const out: any = {};
  for (const key of ['content', 'embeds', 'components', 'files', 'allowedMentions', 'stickerIds']) {
    if (payload[key] !== undefined && payload[key] !== null) out[key] = payload[key];
  }
  if (
    !out.content &&
    !(out.embeds && out.embeds.length) &&
    !(out.components && out.components.length) &&
    !(out.files && out.files.length)
  ) {
    out.content = '✅';
  }
  return out;
}

// رد مرن على الرسالة
async function respond(message: Message, payload: any): Promise<void> {
  const body = pickPayload(payload);
  try {
    await message.reply(body);
    return;
  } catch {
    /* fallback below */
  }
  try {
    if (message.channel.isTextBased() && 'send' in message.channel) {
      await (message.channel as any).send({ content: `<@${message.author.id}>`, ...body });
    }
  } catch (error: any) {
    logger.warn(`Alias respond failed: ${error.message}`);
  }
}

function buildUsage(commandName: string, optionDefs: any[]): string {
  const parts = optionDefs.map(o => (o.required ? `<${o.name}>` : `[${o.name}]`));
  const suffix = parts.length ? ' ' + parts.join(' ') : '';
  return `\`/${commandName}${suffix}\``;
}

// --------------------------------------------
// تفاعل وهمي يحاكي ChatInputCommandInteraction
// --------------------------------------------
class AliasInteraction {
  public token = '';
  public replied = false;
  public deferred = false;
  private lastMessage: Message | null = null;

  constructor(
    private message: Message,
    public commandName: string,
    private subcommand: string | null,
    private group: string | null,
    private values: Map<string, any>
  ) {}

  // ----- خصائص -----
  get client() { return this.message.client; }
  get user() { return this.message.author; }
  get member() { return this.message.member; }
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
  private read(name: string, required?: boolean): any {
    const value = this.values.get(name);
    if (value === undefined || value === null) {
      if (required) throw new Error(`الخيار "${name}" مطلوب لهذا الأمر`);
      return null;
    }
    return value;
  }

  options = {
    getSubcommand: (_name?: string, _required?: boolean) => this.subcommand,
    getSubcommandGroup: (_name?: string, _required?: boolean) => this.group,
    getString: (name: string, required?: boolean) => this.read(name, required),
    getInteger: (name: string, required?: boolean) => this.read(name, required),
    getNumber: (name: string, required?: boolean) => this.read(name, required),
    getBoolean: (name: string, required?: boolean) => this.read(name, required),
    getUser: (name: string, required?: boolean) => this.read(name, required),
    getMember: (name: string, required?: boolean) => this.read(name, required),
    getRole: (name: string, required?: boolean) => this.read(name, required),
    getChannel: (name: string, required?: boolean) => this.read(name, required),
    getMentionable: (name: string, required?: boolean) => this.read(name, required),
    get: (name: string) => this.values.get(name) ?? null,
  };

  // ----- الإرسال -----
  private async send(payload: any): Promise<Message> {
    const channel: any = this.message.channel;
    if (!this.message.channel.isTextBased() || !('send' in channel)) {
      throw new Error('لا يمكن الإرسال في هذا النوع من القنوات');
    }
    return channel.send(pickPayload(payload));
  }

  async reply(payload: any) {
    this.replied = true;
    this.lastMessage = await this.send(payload);
    return this.lastMessage;
  }

  async deferReply(_options?: any) {
    this.deferred = true;
  }

  async editReply(payload: any) {
    const body = pickPayload(payload);
    if (this.lastMessage) {
      await this.lastMessage.edit(body).catch(() => {});
      return this.lastMessage;
    }
    this.lastMessage = await this.send(body);
    return this.lastMessage;
  }

  async followUp(payload: any) {
    return this.send(payload);
  }

  async fetchReply() {
    return this.lastMessage;
  }

  async deleteReply() {
    if (this.lastMessage) {
      await this.lastMessage.delete().catch(() => {});
      this.lastMessage = null;
    }
  }

  async update(payload: any) {
    return this.editReply(payload);
  }

  async deferUpdate() {}

  async showModal() {
    throw new Error('هذا الأمر يحتاج نافذة إدخال ولا يمكن تنفيذه من الاختصار');
  }
}

// --------------------------------------------
// المدخل الرئيسي: تنفيذ أي أمر سلاش من رسالة
// يعيد true إذا تم التنفيذ (أو رُفض بسبب صلاحية/استخدام خاطئ)
// --------------------------------------------
export async function executeCommandFromMessage(
  message: Message,
  client: LibertyClient,
  commandName: string,
  args: string[]
): Promise<boolean> {
  try {
    const guild = message.guild;
    const member = message.member;
    if (!guild || !member) return false;

    const command = client.commandHandler.getCommand(commandName);
    if (!command) return false;

    // مخطط الأمر (SlashCommandBuilder → JSON)
    const json =
      typeof command.data?.toJSON === 'function' ? command.data.toJSON() : command.data;

    // فحص إضافي لصلاحيات السلاش (executeAliasCommand يفحص command.permissions مسبقاً)
    if (json?.default_member_permissions) {
      try {
        const required = BigInt(json.default_member_permissions);
        if (required > 0n && !member.permissions.has(required)) {
          await respond(message, '❌ ليس لديك الصلاحيات الكافية لاستخدام هذا الأمر');
          return true;
        }
      } catch {
        /* bitfield غير صالح — تجاهل */
      }
    }

    const defs: any[] = Array.isArray(json?.options) ? json.options : [];
    let optionDefs = defs;
    let remaining = [...args];
    let subcommand: string | null = null;
    let group: string | null = null;

    // ----- الأوامر الفرعية -----
    const subDefs = defs.filter(o => SubTypes.includes(o.type));

    if (subDefs.length > 0) {
      const first = remaining[0]?.toLowerCase();
      const match = first ? subDefs.find(s => s.name.toLowerCase() === first) : undefined;

      const applySub = (sub: any, groupName: string | null) => {
        if (groupName) group = groupName;
        subcommand = sub.name;
        optionDefs = sub.options || [];
      };

      if (match && match.type === ApplicationCommandOptionType.Subcommand) {
        applySub(match, null);
        remaining = remaining.slice(1);
      } else if (match && match.type === ApplicationCommandOptionType.SubcommandGroup) {
        const nested: any[] = (match.options || []).filter(
          (s: any) => s.type === ApplicationCommandOptionType.Subcommand
        );
        const nFirst = remaining[1]?.toLowerCase();
        const nMatch = nFirst
          ? nested.find(s => s.name.toLowerCase() === nFirst)
          : nested.find(s => ['status', 'list', 'info', 'help'].includes(s.name)) || nested[0];
        if (nMatch) {
          applySub(nMatch, match.name);
          remaining = remaining.slice(2);
        } else {
          await respond(
            message,
            `📋 الأوامر الفرعية: ${nested.map(s => `\`${s.name}\``).join('، ')}`
          );
          return true;
        }
      } else if (remaining.length === 0) {
        // بدون نص: اختر أمراً آمناً (status/list/info/help)
        const fallback = subDefs.find(
          s => s.type === ApplicationCommandOptionType.Subcommand &&
               ['status', 'list', 'info', 'help'].includes(s.name)
        );
        if (fallback) {
          applySub(fallback, null);
        } else {
          await respond(
            message,
            `📋 **الاستخدام:** \`${commandName} <${subDefs
              .filter(s => s.type === ApplicationCommandOptionType.Subcommand)
              .map(s => s.name)
              .join(' | ')}>\``
          );
          return true;
        }
      } else {
        // النص ليس أمر فرعي → اعتبره للاحتمي الأول وأرسل الباقي كخيارات
        applySub(subDefs[0], null);
      }
    }

    // ----- تحويل النص → خيارات -----
    const values = new Map<string, any>();
    const prefetch = new Map<string, Prefetch>();
    const consumable = optionDefs.filter(o => !SubTypes.includes(o.type));

    const usageReply = async (): Promise<true> => {
      await respond(message, `📋 **الاستخدام:** ${buildUsage(commandName, consumable)}`);
      return true;
    };

    for (let i = 0; i < consumable.length; i++) {
      const opt = consumable[i];
      const type: number = opt.type;

      // بوول: يقبل تلقائياً بدون نص
      if (type === ApplicationCommandOptionType.Boolean) {
        const token = remaining.shift();
        if (token === undefined) {
          if (opt.required) return usageReply();
          continue;
        }
        values.set(
          opt.name,
          ['true', '1', 'yes', 'y', 'نعم', 'اي', 'صح'].includes(token.toLowerCase())
        );
        continue;
      }

      // لا نص متبقٍ
      if (remaining.length === 0) {
        if (opt.required) return usageReply();
        continue;
      }

      // أنواع تحتاج جلب مسبق (المتصل متزامن)
      if (
        type === ApplicationCommandOptionType.User ||
        type === ApplicationCommandOptionType.Role ||
        type === ApplicationCommandOptionType.Channel ||
        type === ApplicationCommandOptionType.Mentionable
      ) {
        const token = remaining.shift()!;
        const id = parseId(token);
        if (!id) {
          if (opt.required) return usageReply();
          continue;
        }
        let kind: Prefetch['kind'] = 'user';
        if (type === ApplicationCommandOptionType.Role) kind = 'role';
        else if (type === ApplicationCommandOptionType.Channel) kind = 'channel';
        else if (type === ApplicationCommandOptionType.Mentionable) kind = 'mentionable';
        prefetch.set(opt.name, { kind, id });
        continue;
      }

      // أرقام
      if (
        type === ApplicationCommandOptionType.Integer ||
        type === ApplicationCommandOptionType.Number
      ) {
        const token = remaining.shift()!;
        const n = Number(token);
        if (Number.isNaN(n)) {
          if (opt.required) return usageReply();
          continue;
        }
        values.set(opt.name, type === ApplicationCommandOptionType.Integer ? Math.trunc(n) : n);
        continue;
      }

      // نص (والافتراضي لأي نوع آخر)
      const later = consumable.slice(i + 1);
      const laterRequired = later.some(
        o => o.required && o.type !== ApplicationCommandOptionType.Boolean
      );
      const takeAll = later.length === 0 || (remaining.length === 1 && !laterRequired);
      values.set(opt.name, takeAll ? remaining.join(' ') : remaining.shift()!);
      if (takeAll) remaining = [];
    }

    // ----- جلب المستخدمين/الرولات/القنوات -----
    for (const [name, p] of prefetch) {
      if (p.kind === 'user' || p.kind === 'mentionable') {
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
      await command.execute(interaction as unknown as ChatInputCommandInteraction);
      logger.info(`Alias generic executed: /${commandName} by ${message.author.tag}`);
    } catch (error: any) {
      logger.error(`Alias generic execution failed (${commandName}): ${error.message}`);
      await respond(message, `❌ تنفيذ \`/${commandName}\` عبر الاختصار فشل: ${error.message}`);
    }

    return true;
  } catch (error: any) {
    logger.error(`executeCommandFromMessage error (${commandName}): ${error.message}`);
    return false;
  }
}
