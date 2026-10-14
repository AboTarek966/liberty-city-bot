export declare const config: {
    discord: {
        token: string;
        clientId: string;
        guildId: string | undefined;
        prefix: string;
        defaultLanguage: string;
        timezone: string;
        colors: {
            primary: string;
            success: string;
            warning: string;
            error: string;
            info: string;
        };
    };
    database: {
        uri: string;
    };
    ai: {
        provider: "auto" | "openai" | "anthropic" | "groq" | "gemini" | "both";
        openai: {
            apiKey: string;
            model: string;
            maxTokens: number;
            temperature: number;
        };
        groq: {
            apiKey: string;
            model: string;
            maxTokens: number;
            temperature: number;
        };
        gemini: {
            apiKey: string;
            model: string;
            visionModel: string;
            maxTokens: number;
            temperature: number;
        };
        openrouter: {
            apiKey: string;
            model: string;
            visionModel: string;
            maxTokens: number;
            temperature: number;
        };
        hf: {
            token: string;
            musicSpace: string;
            musicFnIndex: number;
            videoSpace: string;
            videoFnIndex: number;
            musicTimeoutMs: number;
            videoTimeoutMs: number;
            songSpace: string;
            songFnIndex: number;
            songTimeoutMs: number;
            songMinIntervalMs: number;
        };
        anthropic: {
            apiKey: string;
            model: string;
            maxTokens: number;
        };
        systemPrompt: string;
        enabled: boolean;
        cooldown: number;
    };
    protection: {
        antiRaid: {
            enabled: boolean;
            threshold: number;
            timeWindow: number;
            action: "kick" | "ban" | "lockdown";
        };
        antiSpam: {
            enabled: boolean;
            maxMessages: number;
            timeWindow: number;
            action: "kick" | "ban" | "mute" | "warn";
            muteDuration: number;
        };
        antiLink: {
            enabled: boolean;
            whitelist: string[];
            action: "mute" | "warn" | "delete";
            ignoreRoles: string[];
        };
        antiInvite: {
            enabled: boolean;
            action: "mute" | "warn" | "delete";
            ignoreRoles: string[];
        };
        antiMention: {
            enabled: boolean;
            max: number;
            action: "mute" | "warn" | "delete";
        };
        antiCaps: {
            enabled: boolean;
            minLength: number;
            percentage: number;
            action: "mute" | "warn" | "delete";
        };
        antiEmoji: {
            enabled: boolean;
            max: number;
            action: "mute" | "warn" | "delete";
        };
    };
    tickets: {
        categoryName: string;
        logChannelName: string;
        transcriptChannelName: string;
        maxPerUser: number;
        autoCloseHours: number;
        supportRoles: string[];
    };
    logging: {
        level: string;
        channelId: string | undefined;
        types: string[];
    };
    welcome: {
        enabled: boolean;
        channelName: string;
        message: string;
        dmEnabled: boolean;
        dmMessage: string;
        imageEnabled: boolean;
        imageBackground: string | undefined;
    };
    leave: {
        enabled: boolean;
        channelName: string;
        message: string;
    };
    automod: {
        enabled: boolean;
        badWords: string[];
        badWordsAction: "kick" | "ban" | "mute" | "warn" | "delete";
        badWordsDuration: number;
        zalgoEnabled: boolean;
        zalgoAction: "mute" | "warn" | "delete";
    };
    economy: {
        enabled: boolean;
    };
    leveling: {
        enabled: boolean;
        xpPerMessage: number;
        xpCooldown: number;
        levelUpChannelName: string;
        levelRoles: Record<string, string>;
    };
    dashboard: {
        enabled: boolean;
        port: number;
        secret: string;
        callbackUrl: string;
        oauth2Secret: string;
    };
    apis: {
        weather: string | undefined;
        youtube: string | undefined;
        tenor: string | undefined;
    };
};
export declare function validateConfig(): void;
export default config;
//# sourceMappingURL=index.d.ts.map