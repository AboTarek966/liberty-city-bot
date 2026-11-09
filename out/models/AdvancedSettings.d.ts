import mongoose, { Document } from 'mongoose';
export interface IModuleSetting extends Document {
    guildId: string;
    module: string;
    enabled: boolean;
    config: Record<string, any>;
    updatedAt: Date;
}
export interface IAutoModRule extends Document {
    guildId: string;
    name: string;
    type: 'link' | 'invite' | 'word' | 'spam' | 'caps' | 'emoji' | 'mention' | 'attachment';
    action: 'delete' | 'warn' | 'timeout' | 'mute' | 'kick' | 'ban' | 'log';
    config: {
        words?: string[];
        threshold?: number;
        timeWindow?: number;
        whitelist?: string[];
        roles?: string[];
        channels?: string[];
        duration?: number;
        reason?: string;
    };
    enabled: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface ILevelingConfig extends Document {
    guildId: string;
    enabled: boolean;
    xpPerMessage: {
        min: number;
        max: number;
    };
    xpCooldown: number;
    voiceXpPerMinute: number;
    ignoredChannels: string[];
    ignoredRoles: string[];
    levelUpChannel?: string;
    levelUpMessage: string;
    roles: Array<{
        level: number;
        roleId: string;
    }>;
    blacklistedUsers: string[];
}
export interface IWelcomeConfig extends Document {
    guildId: string;
    enabled: boolean;
    channelId?: string;
    message: string;
    embed: {
        enabled: boolean;
        title: string;
        description: string;
        color: string;
        thumbnail: boolean;
        image?: string;
        footer?: string;
    };
    dmEnabled: boolean;
    dmMessage: string;
    roles: string[];
}
export interface ILeaveConfig extends Document {
    guildId: string;
    enabled: boolean;
    channelId?: string;
    message: string;
    embed: {
        enabled: boolean;
        title: string;
        description: string;
        color: string;
    };
}
export interface ILoggingConfig extends Document {
    guildId: string;
    enabled: boolean;
    channelId?: string;
    events: {
        messageDelete: boolean;
        messageEdit: boolean;
        memberJoin: boolean;
        memberLeave: boolean;
        memberBan: boolean;
        memberUnban: boolean;
        memberUpdate: boolean;
        roleCreate: boolean;
        roleDelete: boolean;
        roleUpdate: boolean;
        channelCreate: boolean;
        channelDelete: boolean;
        channelUpdate: boolean;
        voiceStateUpdate: boolean;
        inviteCreate: boolean;
        inviteDelete: boolean;
        webhookUpdate: boolean;
        integrationUpdate: boolean;
        threadCreate: boolean;
        threadDelete: boolean;
        threadUpdate: boolean;
    };
}
export interface IBackupConfig extends Document {
    guildId: string;
    enabled: boolean;
    interval: 'daily' | 'weekly' | 'monthly';
    channelId?: string;
    include: {
        roles: boolean;
        channels: boolean;
        permissions: boolean;
        settings: boolean;
        bans: boolean;
    };
    lastBackup?: Date;
    backups: Array<{
        date: Date;
        data: any;
        size: number;
    }>;
}
export declare const ModuleSetting: mongoose.Model<IModuleSetting, {}, {}, {}, mongoose.Document<unknown, {}, IModuleSetting, {}, {}> & IModuleSetting & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const AutoModRule: mongoose.Model<IAutoModRule, {}, {}, {}, mongoose.Document<unknown, {}, IAutoModRule, {}, {}> & IAutoModRule & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const LevelingConfig: mongoose.Model<ILevelingConfig, {}, {}, {}, mongoose.Document<unknown, {}, ILevelingConfig, {}, {}> & ILevelingConfig & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const WelcomeConfig: mongoose.Model<IWelcomeConfig, {}, {}, {}, mongoose.Document<unknown, {}, IWelcomeConfig, {}, {}> & IWelcomeConfig & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const LeaveConfig: mongoose.Model<ILeaveConfig, {}, {}, {}, mongoose.Document<unknown, {}, ILeaveConfig, {}, {}> & ILeaveConfig & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const LoggingConfig: mongoose.Model<ILoggingConfig, {}, {}, {}, mongoose.Document<unknown, {}, ILoggingConfig, {}, {}> & ILoggingConfig & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const BackupConfig: mongoose.Model<IBackupConfig, {}, {}, {}, mongoose.Document<unknown, {}, IBackupConfig, {}, {}> & IBackupConfig & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
declare const _default: {
    ModuleSetting: mongoose.Model<IModuleSetting, {}, {}, {}, mongoose.Document<unknown, {}, IModuleSetting, {}, {}> & IModuleSetting & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    AutoModRule: mongoose.Model<IAutoModRule, {}, {}, {}, mongoose.Document<unknown, {}, IAutoModRule, {}, {}> & IAutoModRule & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    LevelingConfig: mongoose.Model<ILevelingConfig, {}, {}, {}, mongoose.Document<unknown, {}, ILevelingConfig, {}, {}> & ILevelingConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    WelcomeConfig: mongoose.Model<IWelcomeConfig, {}, {}, {}, mongoose.Document<unknown, {}, IWelcomeConfig, {}, {}> & IWelcomeConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    LeaveConfig: mongoose.Model<ILeaveConfig, {}, {}, {}, mongoose.Document<unknown, {}, ILeaveConfig, {}, {}> & ILeaveConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    LoggingConfig: mongoose.Model<ILoggingConfig, {}, {}, {}, mongoose.Document<unknown, {}, ILoggingConfig, {}, {}> & ILoggingConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
    BackupConfig: mongoose.Model<IBackupConfig, {}, {}, {}, mongoose.Document<unknown, {}, IBackupConfig, {}, {}> & IBackupConfig & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }, any>;
};
export default _default;
//# sourceMappingURL=AdvancedSettings.d.ts.map