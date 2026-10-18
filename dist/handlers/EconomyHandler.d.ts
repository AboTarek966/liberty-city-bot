import { Guild, GuildMember, User } from 'discord.js';
import { LibertyClient } from '../LibertyClient';
export interface EconomyConfig {
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
    shopItems: any[];
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
    workCooldown: number;
    begCooldown: number;
}
export declare class EconomyHandler {
    private client;
    private cooldowns;
    constructor(client: LibertyClient);
    getConfig(guildId: string): Promise<EconomyConfig>;
    getProfile(guildId: string, userId: string): Promise<any>;
    private checkCooldown;
    private getCooldownRemaining;
    formatCurrency(amount: number, config: EconomyConfig): string;
    addBalance(guildId: string, userId: string, amount: number, type?: 'balance' | 'bank'): Promise<number>;
    removeBalance(guildId: string, userId: string, amount: number, type?: 'balance' | 'bank'): Promise<number>;
    daily(guild: Guild, member: GuildMember): Promise<{
        amount: number;
        newBalance: number;
        streak: number;
    }>;
    work(guild: Guild, member: GuildMember): Promise<{
        amount: number;
        newBalance: number;
    }>;
    beg(guild: Guild, member: GuildMember): Promise<{
        amount: number;
        newBalance: number;
    }>;
    weekly(guild: Guild, member: GuildMember): Promise<{
        amount: number;
        newBalance: number;
    }>;
    monthly(guild: Guild, member: GuildMember): Promise<{
        amount: number;
        newBalance: number;
    }>;
    deposit(guild: Guild, member: GuildMember, amount: number | 'all'): Promise<{
        balance: number;
        bank: number;
    }>;
    withdraw(guild: Guild, member: GuildMember, amount: number | 'all'): Promise<{
        balance: number;
        bank: number;
    }>;
    bankInfo(guild: Guild, member: GuildMember): Promise<{
        balance: number;
        bank: number;
        interest: number;
    }>;
    transfer(guild: Guild, from: GuildMember, to: User, amount: number): Promise<{
        tax: number;
        newBalance: number;
    }>;
    rob(guild: Guild, robber: GuildMember, target: User): Promise<{
        amount: number;
        newBalance: number;
    }>;
    coinflip(guild: Guild, member: GuildMember, amount: number, choice: 'heads' | 'tails'): Promise<{
        won: boolean;
        amount: number;
        newBalance: number;
    }>;
    dice(guild: Guild, member: GuildMember, amount: number, prediction: 'high' | 'low' | '7'): Promise<{
        won: boolean;
        amount: number;
        newBalance: number;
        roll: number;
    }>;
    slots(guild: Guild, member: GuildMember, amount: number): Promise<{
        won: boolean;
        amount: number;
        newBalance: number;
        reels: string[];
    }>;
    buyItem(guild: Guild, member: GuildMember, itemId: string, quantity?: number): Promise<{
        item: any;
        newBalance: number;
    }>;
    useItem(guild: Guild, member: GuildMember, itemId: string): Promise<string>;
    processVoiceRewards(guild: Guild, member: GuildMember, minutes: number): Promise<void>;
    applyBankInterest(guild: Guild): Promise<void>;
    getLeaderboard(guild: Guild, type: 'balance' | 'bank' | 'total' | 'level' | 'xp', limit?: number): Promise<any[]>;
    private formatTime;
}
export default EconomyHandler;
//# sourceMappingURL=EconomyHandler.d.ts.map