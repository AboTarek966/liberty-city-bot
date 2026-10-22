import mongoose, { Document } from 'mongoose';
export interface IGuildSettings extends Document {
    guildId: string;
    prefix: string;
    language: string;
    timezone: string;
    settingsPassword?: string;
    protection: {
        /** 📢 قناة التنبيهات العامة للحماية — تُستخدم كافتراضي عند عدم تحديد قناة في الوحدات الفرعية */
        logChannel?: string;
        /** 👑 إطفاء أي حماية لا يُطبَّق إلا بموافقة مالك السيرفر (صاحب التاج) — مفعّل ما لم يُعطَّل صراحة */
        ownerApproval?: boolean;
        antiRaid: {
            enabled: boolean;
            threshold: number;
            timeWindow: number;
            action: 'kick' | 'ban' | 'lockdown';
            logChannel?: string;
        };
        antiSpam: {
            enabled: boolean;
            maxMessages: number;
            timeWindow: number;
            action: 'warn' | 'mute' | 'kick' | 'ban';
            muteDuration: number;
            logChannel?: string;
        };
        antiLink: {
            enabled: boolean;
            whitelist: string[];
            action: 'delete' | 'warn' | 'mute';
            ignoreRoles: string[];
            logChannel?: string;
        };
        antiInvite: {
            enabled: boolean;
            action: 'delete' | 'warn' | 'mute';
            ignoreRoles: string[];
            logChannel?: string;
        };
        antiMention: {
            enabled: boolean;
            max: number;
            action: 'delete' | 'warn' | 'mute';
            logChannel?: string;
        };
        antiCaps: {
            enabled: boolean;
            minLength: number;
            percentage: number;
            action: 'delete' | 'warn' | 'mute';
            logChannel?: string;
        };
        antiEmoji: {
            enabled: boolean;
            max: number;
            action: 'delete' | 'warn' | 'mute';
            logChannel?: string;
        };
        antiNuke: {
            enabled: boolean;
            threshold: number;
            timeWindow: number;
            action: 'alert' | 'kick' | 'ban' | 'strip';
            logChannel?: string;
            /** ♻️ إعادة بنية السيرفر تلقائياً بعد هجوم حذف مكثف */
            autoRestore?: boolean;
            /** 👢 ربط المطرودين تلقائياً برابط الدعوة (الطرد لا يُلغى في ديسكورد) */
            autoDmRecovery?: boolean;
        };
        antiBot: {
            enabled: boolean;
            whitelist: string[];
            logChannel?: string;
        };
        antiAdmin: {
            enabled: boolean;
            action: 'alert' | 'kick';
            logChannel?: string;
        };
        autoBackup: {
            enabled: boolean;
            interval: number;
            keep: number;
        };
        /** 🔍 فحص دوري كل N ساعات — يمسح رومات/رولات الهاكر ويرجّع الناقص من النسخة */
        autoScan?: {
            enabled: boolean;
            interval: number;
        };
        /** فلتر الروابط الاحتيالية (صيد النيترو والمشاريع المزيفة) */
        scamFilter: {
            enabled: boolean;
        };
        /** وضع الطوارئ — يقفل الكتابة والدخول في جميع القنوات */
        lockdown: boolean;
        /** 🕵️ Anti-Alt Detection — يكشف الحسابات البديلة */
        antiAlt?: {
            enabled: boolean;
            action: 'kick' | 'ban' | 'quarantine' | 'log';
            maxAccountsPerIP: number;
            checkCreationDays: number;
            quarantineRoleId?: string;
            logChannel?: string;
        };
        /** 📨 Invite Tracker — يتتبع الدعوات ويكشف المشبوهة */
        inviteTracker?: {
            enabled: boolean;
            trackJoins: boolean;
            trackLeaves: boolean;
            suspiciousInviteAction: 'delete' | 'warn' | 'kick' | 'ban';
            minInviteAgeHours: number;
            maxUsesPerInvite: number;
            logChannel?: string;
            rewardRoleId?: string;
            rewardInvites: number;
        };
        /** 🔍 Message Scanners — يفحص الرسائل (روابط/ملفات) عبر VirusTotal */
        messageScanner?: {
            enabled: boolean;
            scanLinks: boolean;
            scanAttachments: boolean;
            virusTotalApiKey?: string;
            action: 'delete' | 'warn' | 'mute' | 'ban';
            whitelistDomains: string[];
            logChannel?: string;
        };
        /** 🤖 AI Auto-Moderation — يقرأ كل رسالة ويقرر: سبام/سم/إباحي/احتيال/تهديد/تسريب */
        aiAutoMod?: {
            enabled: boolean;
            categories: {
                spam: boolean;
                toxicity: boolean;
                nsfw: boolean;
                scam: boolean;
                threat: boolean;
                pii: boolean;
                raid: boolean;
                selfharm: boolean;
            };
            sensitivity: number;
            actions: {
                spam: 'delete' | 'warn' | 'mute' | 'ban';
                toxicity: 'delete' | 'warn' | 'mute' | 'ban';
                nsfw: 'delete' | 'warn' | 'mute' | 'ban';
                scam: 'delete' | 'warn' | 'mute' | 'ban';
                threat: 'delete' | 'warn' | 'mute' | 'ban';
                pii: 'delete' | 'warn' | 'mute' | 'ban';
                raid: 'delete' | 'warn' | 'mute' | 'ban';
                selfharm: 'delete' | 'warn' | 'mute' | 'ban' | 'resources';
            };
            muteDuration: number;
            ignoredChannels: string[];
            ignoredRoles: string[];
            logChannel?: string;
            escalation: boolean;
            maxWarningsBeforeEscalation: number;
        };
        /** 🤖 AI Ticket Assistant — يستلم التذكرة، يحلل، يحل، يطلب موافقة أدمن للإجراءات الحساسة */
        aiTicketAssistant?: {
            enabled: boolean;
            autoClaim: boolean;
            analyzeOnCreate: boolean;
            requireAdminApprovalForRoles: boolean;
            requireAdminApprovalForPermissions: boolean;
            requireAdminApprovalForBans: boolean;
            maxAutoActionsPerTicket: number;
            confidenceThreshold: number;
            notifyAdminsOnFailure: boolean;
            logChannel?: string;
        };
        /** 🌐 AI Translator — ترجمة فورية مع كشف اللغة التلقائي */
        aiTranslator?: {
            enabled: boolean;
            defaultTargetLang: string;
            autoTranslateChannels: string[];
            ignoredChannels: string[];
            ignoredRoles: string[];
            showOriginal: boolean;
            maxLength: number;
            logChannel?: string;
        };
        /** 👑 Whitelist — مستخدمين موثوقين مستثنين من الحماية */
        whitelist?: {
            enabled: boolean;
            userIds: string[];
            logChannel?: string;
        };
        /** 📢 إعلانات جماعية (Broadcast) */
        announcements?: {
            history: Array<{
                type: 'dm' | 'channel';
                content: string;
                at: Date;
                sentBy: string;
                sent?: boolean;
            }>;
        };
    };
    music?: {
        enabled: boolean;
        defaultVolume: number;
        maxQueueSize: number;
        allowDJ: boolean;
        djRoleId?: string;
        autoplay: boolean;
        restrictToChannels: string[];
    };
    tickets: {
        categoryId?: string;
        logChannelId?: string;
        transcriptChannelId?: string;
        supportRoleIds: string[];
        maxPerUser: number;
        autoCloseHours: number;
        panels: ITicketPanel[];
        autoMessageEnabled: boolean;
        autoMessage: string;
        /** عداد التذاكر — للترقيم التسلسلي (1، 2، 3...) */
        counter: number;
        /** استبيان الرضا (نجوم) بعد إغلاق التذكرة */
        surveyEnabled: boolean;
        /** رولات الإدارة العليا — تُمنشن فقط عند زر استدعاء الإدارة */
        adminRoleIds: string[];
        /** 🔒 قفل التذكرة — لا يكتب صاحب التذكرة حتى يستلمها إداري */
        lockUntilClaim: boolean;
        /** 🎫 إرسال رسالة الترحيب داخل التذكرة (الزرار والخيارات) */
        welcomeEnabled: boolean;
        /** 📊 إحصائيات استلام التذاكر لكل إداري (userId → عدد التذاكر المستلمة) */
        claimStats: Map<string, number>;
    };
    logging: {
        enabled: boolean;
        channelId?: string;
        types: string[];
        /** 🔀 تقسيم: نوع الحدث → قناة مخصصة (وإلا يذهب للقناة الرئيسية) */
        channels: Record<string, string>;
        ignoredChannels: string[];
        ignoredRoles: string[];
    };
    snipe: {
        enabled: boolean;
    };
    welcome: {
        enabled: boolean;
        channelId?: string;
        message: string;
        dmEnabled: boolean;
        dmMessage: string;
        imageEnabled: boolean;
        imageBackground?: string;
        embedColor: string;
        embedTitle: string;
        embedThumbnail?: string;
        /** 🖼️ بطاقة ترحيب مخصصة على صورة (مثل ProBot) */
        card: {
            enabled: boolean;
            backgroundUrl?: string;
            avatarX: number;
            avatarY: number;
            avatarSize: number;
            nameX: number;
            nameY: number;
            nameSize: number;
            nameColor: string;
            countX: number;
            countY: number;
            countSize: number;
            countColor: string;
        };
    };
    leave: {
        enabled: boolean;
        channelId?: string;
        message: string;
        embedColor: string;
    };
    jail: {
        enabled: boolean;
        channelId?: string;
        jailRoleId?: string;
    };
    automod: {
        enabled: boolean;
        badWords: string[];
        badWordsAction: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
        badWordsDuration: number;
        zalgoEnabled: boolean;
        zalgoAction: 'delete' | 'warn' | 'mute';
        ignoredRoles: string[];
        ignoredChannels: string[];
    };
    economy: {
        enabled: boolean;
        currency: string;
        currencySymbol: string;
        dailyAmount: number;
        workAmount: {
            min: number;
            max: number;
        };
        begAmount: {
            min: number;
            max: number;
        };
        robEnabled: boolean;
        robCooldown: number;
        slotsEnabled: boolean;
        blackjackEnabled: boolean;
        bankEnabled: boolean;
        bankInterestRate: number;
        bankMaxDeposit: number;
        shopEnabled: boolean;
        shopItems: IShopItem[];
        transferEnabled: boolean;
        transferTax: number;
        transferCooldown: number;
        voiceRewardsEnabled: boolean;
        voiceRewardPerMinute: number;
        voiceRewardInterval: number;
        weeklyAmount: number;
        monthlyAmount: number;
        coinflipEnabled: boolean;
        diceEnabled: boolean;
        inventoryEnabled: boolean;
        leaderboardEnabled: boolean;
    };
    leveling: {
        enabled: boolean;
        xpPerMessage: number;
        xpCooldown: number;
        levelUpChannelId?: string;
        levelUpMessage: string;
        levelRoles: Map<number, string>;
        /** مكافآت الرولات عند المستويات — يمكن أكثر من رول بنفس المستوى */
        levelRewards: ILevelReward[];
        /** نمط رسالة الترقية: نص عادي أو إمبد احترافي */
        levelUpStyle: 'text' | 'embed';
        /** عنوان إمبد الترقية (يحول المتغيرات) */
        levelUpTitle: string;
        /** لون إمبد الترقية (HEX) */
        levelUpColor: string;
        xpGainMultiplier: number;
        voiceXpPerMinute: number;
        ignoredChannels: string[];
        ignoredRoles: string[];
    };
    ai: {
        enabled: boolean;
        provider: 'openai' | 'anthropic' | 'both';
        model: string;
        systemPrompt: string;
        temperature: number;
        maxTokens: number;
        cooldown: number;
        allowedChannels: string[];
        allowedRoles: string[];
        ignoredChannels: string[];
        ignoredRoles: string[];
        responseLanguage: string;
    };
    customCommands: ICustomCommand[];
    tags: ITag[];
    reactionRoles: IReactionRole[];
    autorole: {
        enabled: boolean;
        roleId?: string;
    };
    roleMenus: IRoleMenu[];
    verification: {
        enabled: boolean;
        channelId?: string;
        roleId?: string;
        title: string;
        description: string;
        buttonLabel: string;
        buttonEmoji: string;
    };
    shop: {
        enabled: boolean;
        items: IShopItem[];
    };
    warnRoles: {
        /** رولات تحذير الأعضاء (تظهر عند تحذير عضو عادي) */
        memberIds: string[];
        /** رولات تحذير الإداريين (تظهر عند تحذير إداري) — للتوافق القديم */
        adminIds: string[];
        /** نظام التحذيرات التسلسلي للإداريين (جديد) */
        adminSequential?: {
            /** رول التحذير الأول */
            role1Id?: string;
            /** رول التحذير الثاني */
            role2Id?: string;
            /** رول التحذير الثالث */
            role3Id?: string;
        };
    };
    updatedAt: Date;
}
export interface ITicketPanel {
    id: string;
    name: string;
    description: string;
    emoji: string;
    channelId: string;
    messageId?: string;
    type: 'button' | 'select';
    fields: ITicketField[];
    /** أنواع التذاكر المعروضة في قائمة اللوحة (تُستخدم كاسم لقناة التذكرة) */
    options?: ITicketOption[];
    supportRoleIds: string[];
    image?: string;
}
export interface ITicketOption {
    label: string;
    description?: string;
    emoji?: string;
}
export interface ITicketField {
    id: string;
    label: string;
    placeholder: string;
    style: 'short' | 'paragraph';
    required: boolean;
}
export interface ICustomCommand {
    name: string;
    content: string;
    embed: boolean;
    /** 🔒 'public' = للجميع · 'admin' = لحاملي Administrator فقط */
    scope?: 'public' | 'admin';
    createdBy: string;
    createdAt: Date;
    uses: number;
}
export interface ITag {
    name: string;
    content: string;
    createdBy: string;
    createdAt: Date;
    uses: number;
}
export interface IReactionRole {
    messageId: string;
    channelId: string;
    roles: IReactionRoleEntry[];
}
export interface IReactionRoleEntry {
    emoji: string;
    roleId: string;
    type: 'unique' | 'multiple';
}
export interface IRoleMenu {
    messageId: string;
    channelId: string;
    title: string;
    roleIds: string[];
}
export interface IModerationCase extends Document {
    guildId: string;
    caseId: number;
    type: 'ban' | 'kick' | 'mute' | 'unmute' | 'warn' | 'unwarn' | 'timeout' | 'untimeout' | 'softban' | 'note' | 'role_add' | 'role_remove';
    moderatorId: string;
    targetId: string;
    reason: string;
    duration?: number;
    expiresAt?: Date;
    proof?: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface IWarning extends Document {
    guildId: string;
    userId: string;
    moderatorId: string;
    reason: string;
    caseId: number;
    createdAt: Date;
}
/** بيانات السجن */
export interface IJailData extends Document {
    guildId: string;
    userId: string;
    previousRoles: string[];
    jailRoleId: string;
    jailedBy: string;
    reason: string;
    jailedAt: Date;
    duration?: number;
    jailChannelId: string;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface ITicket extends Document {
    guildId: string;
    channelId: string;
    userId: string;
    type: string;
    panelId?: string;
    status: 'open' | 'claimed' | 'waiting' | 'closed' | 'deleted';
    claimedBy?: string;
    /** سجل الإداريين الذين استلموا هذه التذكرة (لعدم احتساب نقاط مكررة) */
    claimHistory?: string[];
    priority: 'low' | 'medium' | 'high' | 'urgent';
    subject?: string;
    fields: ITicketFieldResponse[];
    transcript?: string;
    closedBy?: string;
    closeReason?: string;
    locked?: boolean;
    lockGrantedUsers?: string[];
    /** لقطة لحالة صلاحيات القناة قبل القفل — لإرجاعها كما كانت عند إلغاء القفل */
    lockSnapshots?: ITicketLockSnapshot[];
    /**
     * لقطة صلاحيات القناة قبل الإغلاق — تُطبَّق قاعدة الإغلاق الصارمة:
     * لا يكتب أحد أثناء الإغلاق (لا الإداريون ولا صاحب التذكرة)، ويُعاد فتحها
     * من قبل من أغلقها فقط، وعندها تُرجع الصلاحيات كما كانت تماماً.
     */
    closeSnapshots?: ITicketLockSnapshot[];
    /** آخر نشاط في التذكرة (رسالة) — للكشف عن الخمول والإغلاق التلقائي */
    lastActivityAt?: Date;
    /** تم إرسال تحذير الخمول لهذه التذكرة */
    idleWarned?: boolean;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
}
export interface ITicketFieldResponse {
    question: string;
    answer: string;
}
export interface ITicketLockSnapshot {
    /** معرف العضو أو الرول الذي طُبّق عليه القفل */
    id: string;
    /** bitfield الصلاحيات المسموحة قبل القفل */
    allow: string;
    /** bitfield الصلاحيات المرفوضة قبل القفل */
    deny: string;
    /** هل كان هناك overwrite أصلاً قبل القفل؟ */
    existed: boolean;
}
/** مكافأة رول عند مستوى معيّن (يمكن أكثر من رول في نفس المستوى) */
export interface ILevelReward {
    level: number;
    roleId: string;
}
/** عنصر متجر — يشتريه العضو بالرصيد ويحصل على رول */
export interface IShopItem {
    id: string;
    name: string;
    price: number;
    roleId: string;
    emoji?: string;
}
export interface IAISession extends Document {
    userId: string;
    guildId?: string;
    channelId?: string;
    messages: IAISessionMessage[];
    lastActivity: Date;
    tokenCount: number;
}
export interface IAISessionMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
    timestamp: Date;
}
export interface IUserProfile extends Document {
    userId: string;
    guildId: string;
    balance: number;
    bank: number;
    xp: number;
    level: number;
    totalXp: number;
    messagesSent: number;
    voiceTime: number;
    lastDaily?: Date;
    lastWork?: Date;
    lastBeg?: Date;
    lastRob?: Date;
    inventory: IInventoryItem[];
    badges: string[];
    reputation: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface IInventoryItem {
    itemId: string;
    name: string;
    description: string;
    quantity: number;
    price: number;
    usable: boolean;
    roleId?: string;
}
export interface IMuteRole extends Document {
    guildId: string;
    roleId: string;
    createdAt: Date;
}
export interface ILoggerSettings extends Document {
    guildId: string;
    channelId?: string;
    types: string[];
    ignoredChannels: string[];
    ignoredRoles: string[];
}
export interface IUserAFK extends Document {
    guildId: string;
    userId: string;
    reason: string;
    since: Date;
}
export declare const GuildSettings: mongoose.Model<IGuildSettings, {}, {}, {}, mongoose.Document<unknown, {}, IGuildSettings, {}, {}> & IGuildSettings & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const ModerationCase: mongoose.Model<IModerationCase, {}, {}, {}, mongoose.Document<unknown, {}, IModerationCase, {}, {}> & IModerationCase & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const Warning: mongoose.Model<IWarning, {}, {}, {}, mongoose.Document<unknown, {}, IWarning, {}, {}> & IWarning & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const JailData: mongoose.Model<IJailData, {}, {}, {}, mongoose.Document<unknown, {}, IJailData, {}, {}> & IJailData & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const Ticket: mongoose.Model<ITicket, {}, {}, {}, mongoose.Document<unknown, {}, ITicket, {}, {}> & ITicket & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const AISession: mongoose.Model<IAISession, {}, {}, {}, mongoose.Document<unknown, {}, IAISession, {}, {}> & IAISession & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const UserProfile: mongoose.Model<IUserProfile, {}, {}, {}, mongoose.Document<unknown, {}, IUserProfile, {}, {}> & IUserProfile & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const MuteRole: mongoose.Model<IMuteRole, {}, {}, {}, mongoose.Document<unknown, {}, IMuteRole, {}, {}> & IMuteRole & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const UserAFK: mongoose.Model<IUserAFK, {}, {}, {}, mongoose.Document<unknown, {}, IUserAFK, {}, {}> & IUserAFK & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export { CommandAlias } from './CommandAlias';
export { AIConfig, AIResponseRule } from './AIConfig';
export { GameStats } from './GameStats';
export { Poll, IPoll } from './Poll';
export { ModuleSetting, AutoModRule, LevelingConfig, WelcomeConfig, LeaveConfig, LoggingConfig, BackupConfig } from './AdvancedSettings';
export declare function getGuildSettings(guildId: string): Promise<IGuildSettings>;
/** إجبار إعادة الجلب من قاعدة البيانات (بعد تعديل خارجي مباشر) */
export declare function invalidateGuildSettings(guildId: string): void;
export declare function getOrCreateUserProfile(userId: string, guildId: string): Promise<IUserProfile>;
export declare function getNextCaseId(guildId: string): Promise<number>;
declare const _default: {
    GuildSettings: mongoose.Model<IGuildSettings, {}, {}, {}, mongoose.Document<unknown, {}, IGuildSettings, {}, {}> & IGuildSettings & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    ModerationCase: mongoose.Model<IModerationCase, {}, {}, {}, mongoose.Document<unknown, {}, IModerationCase, {}, {}> & IModerationCase & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    Warning: mongoose.Model<IWarning, {}, {}, {}, mongoose.Document<unknown, {}, IWarning, {}, {}> & IWarning & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    Ticket: mongoose.Model<ITicket, {}, {}, {}, mongoose.Document<unknown, {}, ITicket, {}, {}> & ITicket & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    AISession: mongoose.Model<IAISession, {}, {}, {}, mongoose.Document<unknown, {}, IAISession, {}, {}> & IAISession & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    UserProfile: mongoose.Model<IUserProfile, {}, {}, {}, mongoose.Document<unknown, {}, IUserProfile, {}, {}> & IUserProfile & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    MuteRole: mongoose.Model<IMuteRole, {}, {}, {}, mongoose.Document<unknown, {}, IMuteRole, {}, {}> & IMuteRole & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    CommandAlias: mongoose.Model<import("./CommandAlias").ICommandAlias, {}, {}, {}, mongoose.Document<unknown, {}, import("./CommandAlias").ICommandAlias, {}, {}> & import("./CommandAlias").ICommandAlias & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    AIConfig: mongoose.Model<import("./AIConfig").IAIConfig, {}, {}, {}, mongoose.Document<unknown, {}, import("./AIConfig").IAIConfig, {}, {}> & import("./AIConfig").IAIConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    AIResponseRule: mongoose.Model<import("./AIConfig").IAIResponseRule, {}, {}, {}, mongoose.Document<unknown, {}, import("./AIConfig").IAIResponseRule, {}, {}> & import("./AIConfig").IAIResponseRule & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    GameStats: mongoose.Model<import("./GameStats").IGameStats, {}, {}, {}, mongoose.Document<unknown, {}, import("./GameStats").IGameStats, {}, {}> & import("./GameStats").IGameStats & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    Poll: mongoose.Model<import("./Poll").IPoll, {}, {}, {}, mongoose.Document<unknown, {}, import("./Poll").IPoll, {}, {}> & import("./Poll").IPoll & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    ModuleSetting: mongoose.Model<import("./AdvancedSettings").IModuleSetting, {}, {}, {}, mongoose.Document<unknown, {}, import("./AdvancedSettings").IModuleSetting, {}, {}> & import("./AdvancedSettings").IModuleSetting & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    AutoModRule: mongoose.Model<import("./AdvancedSettings").IAutoModRule, {}, {}, {}, mongoose.Document<unknown, {}, import("./AdvancedSettings").IAutoModRule, {}, {}> & import("./AdvancedSettings").IAutoModRule & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    LevelingConfig: mongoose.Model<import("./AdvancedSettings").ILevelingConfig, {}, {}, {}, mongoose.Document<unknown, {}, import("./AdvancedSettings").ILevelingConfig, {}, {}> & import("./AdvancedSettings").ILevelingConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    WelcomeConfig: mongoose.Model<import("./AdvancedSettings").IWelcomeConfig, {}, {}, {}, mongoose.Document<unknown, {}, import("./AdvancedSettings").IWelcomeConfig, {}, {}> & import("./AdvancedSettings").IWelcomeConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    LeaveConfig: mongoose.Model<import("./AdvancedSettings").ILeaveConfig, {}, {}, {}, mongoose.Document<unknown, {}, import("./AdvancedSettings").ILeaveConfig, {}, {}> & import("./AdvancedSettings").ILeaveConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    LoggingConfig: mongoose.Model<import("./AdvancedSettings").ILoggingConfig, {}, {}, {}, mongoose.Document<unknown, {}, import("./AdvancedSettings").ILoggingConfig, {}, {}> & import("./AdvancedSettings").ILoggingConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    BackupConfig: mongoose.Model<import("./AdvancedSettings").IBackupConfig, {}, {}, {}, mongoose.Document<unknown, {}, import("./AdvancedSettings").IBackupConfig, {}, {}> & import("./AdvancedSettings").IBackupConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    getGuildSettings: typeof getGuildSettings;
    getOrCreateUserProfile: typeof getOrCreateUserProfile;
    getNextCaseId: typeof getNextCaseId;
};
export default _default;
//# sourceMappingURL=index.d.ts.map