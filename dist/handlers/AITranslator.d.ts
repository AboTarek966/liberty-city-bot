import { Message } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
export declare const SUPPORTED_LANGUAGES: Record<string, {
    name: string;
    flag: string;
    nativeName: string;
}>;
export interface TranslationResult {
    originalText: string;
    translatedText: string;
    sourceLang: string;
    targetLang: string;
    confidence: number;
}
export interface TranslatorConfig {
    enabled: boolean;
    defaultTargetLang: string;
    autoTranslateChannels: string[];
    ignoredChannels: string[];
    ignoredRoles: string[];
    showOriginal: boolean;
    maxLength: number;
    logChannel?: string;
}
export declare class AITranslator {
    private client;
    private aiHandler;
    private translationCache;
    private readonly CACHE_TTL;
    constructor(client: LibertyClient);
    translate(text: string, targetLang: string, sourceLang?: string, guildId?: string): Promise<TranslationResult | null>;
    private buildTranslationPrompt;
    private extractTranslation;
    private detectLanguage;
    translateMessage(message: Message, targetLang?: string, guildId?: string): Promise<TranslationResult | null>;
    autoTranslateIfNeeded(message: Message): Promise<void>;
    handleTranslateCommand(interaction: any, text: string, targetLang?: string, sourceLang?: string): Promise<void>;
    private getConfig;
    private getConfigFromSettings;
    private getSettings;
    updateConfig(guildId: string, updates: Partial<TranslatorConfig>): Promise<void>;
    getConfigForGuild(guildId: string): Promise<TranslatorConfig>;
}
export default AITranslator;
//# sourceMappingURL=AITranslator.d.ts.map