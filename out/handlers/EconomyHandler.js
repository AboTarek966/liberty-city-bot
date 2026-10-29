"use strict";
// ============================================
// Liberty City Bot - Economy Handler
// ============================================
// نظام الاقتصاد الكامل: رصيد، بنك، متجر، تحويلات، صوت، مقامرة
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EconomyHandler = void 0;
const models_1 = require("../models");
const helpers_1 = require("../utils/helpers");
const logger = (0, helpers_1.createLogger)('EconomyHandler');
class EconomyHandler {
    client;
    cooldowns = new Map();
    constructor(client) {
        this.client = client;
    }
    // ============================================
    // Helpers
    // ============================================
    getConfig(guildId) {
        return (0, models_1.getGuildSettings)(guildId).then(s => s.economy);
    }
    async getProfile(guildId, userId) {
        const { UserProfile } = await Promise.resolve().then(() => __importStar(require('../models')));
        let profile = await UserProfile.findOne({ guildId, userId });
        if (!profile) {
            const config = await this.getConfig(guildId);
            profile = new UserProfile({
                guildId,
                userId,
                balance: config.dailyAmount || 500,
                bank: 0,
                xp: 0,
                level: 1,
                totalXp: 0,
                messagesSent: 0,
                voiceTime: 0,
                inventory: [],
                badges: [],
                reputation: 0,
            });
            await profile.save();
        }
        return profile;
    }
    checkCooldown(guildId, userId, type, cooldownMs) {
        const guildCooldowns = this.cooldowns.get(guildId) || new Map();
        const key = `${userId}:${type}`;
        const lastUsed = guildCooldowns.get(key) || 0;
        const now = Date.now();
        if (now - lastUsed < cooldownMs)
            return false;
        guildCooldowns.set(key, now);
        this.cooldowns.set(guildId, guildCooldowns);
        return true;
    }
    getCooldownRemaining(guildId, userId, type, cooldownMs) {
        const guildCooldowns = this.cooldowns.get(guildId) || new Map();
        const key = `${userId}:${type}`;
        const lastUsed = guildCooldowns.get(key) || 0;
        const remaining = Math.max(0, lastUsed + cooldownMs - Date.now());
        return remaining;
    }
    formatCurrency(amount, config) {
        return `${config.currencySymbol} ${amount.toLocaleString()}`;
    }
    // ============================================
    // Core Economy Operations
    // ============================================
    async addBalance(guildId, userId, amount, type = 'balance') {
        const profile = await this.getProfile(guildId, userId);
        if (type === 'balance') {
            profile.balance += amount;
        }
        else {
            profile.bank += amount;
        }
        await profile.save();
        return type === 'balance' ? profile.balance : profile.bank;
    }
    async removeBalance(guildId, userId, amount, type = 'balance') {
        const profile = await this.getProfile(guildId, userId);
        if (type === 'balance') {
            if (profile.balance < amount)
                throw new Error('رصيد غير كافي');
            profile.balance -= amount;
        }
        else {
            if (profile.bank < amount)
                throw new Error('رصيد البنك غير كافي');
            profile.bank -= amount;
        }
        await profile.save();
        return type === 'balance' ? profile.balance : profile.bank;
    }
    // ============================================
    // Daily / Work / Beg / Weekly / Monthly
    // ============================================
    async daily(guild, member) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        const now = new Date();
        const lastDaily = profile.lastDaily ? new Date(profile.lastDaily) : null;
        const isNewDay = !lastDaily || now.toDateString() !== lastDaily.toDateString();
        if (!isNewDay) {
            const nextDaily = new Date(lastDaily);
            nextDaily.setDate(nextDaily.getDate() + 1);
            nextDaily.setHours(0, 0, 0, 0);
            const remaining = nextDaily.getTime() - now.getTime();
            throw new Error(`يجب الانتظار ${this.formatTime(remaining)} لاستلام الجائزة اليومية التالية`);
        }
        const amount = config.dailyAmount;
        profile.balance += amount;
        profile.lastDaily = now;
        await profile.save();
        return { amount, newBalance: profile.balance, streak: 1 };
    }
    async work(guild, member) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        if (!this.checkCooldown(guild.id, member.id, 'work', config.workCooldown || 3600000)) {
            const remaining = this.getCooldownRemaining(guild.id, member.id, 'work', config.workCooldown || 3600000);
            throw new Error(`يجب الانتظار ${this.formatTime(remaining)} قبل العمل مرة أخرى`);
        }
        const amount = Math.floor(Math.random() * (config.workAmount.max - config.workAmount.min + 1)) + config.workAmount.min;
        profile.balance += amount;
        profile.lastWork = new Date();
        await profile.save();
        return { amount, newBalance: profile.balance };
    }
    async beg(guild, member) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        if (!this.checkCooldown(guild.id, member.id, 'beg', config.begCooldown || 1800000)) {
            const remaining = this.getCooldownRemaining(guild.id, member.id, 'beg', config.begCooldown || 1800000);
            throw new Error(`يجب الانتظار ${this.formatTime(remaining)} قبل التسول مرة أخرى`);
        }
        const success = Math.random() < 0.7;
        if (!success) {
            throw new Error('لم يعطك أحد شيئاً! حاول مرة أخرى لاحقاً');
        }
        const amount = Math.floor(Math.random() * (config.begAmount.max - config.begAmount.min + 1)) + config.begAmount.min;
        profile.balance += amount;
        profile.lastBeg = new Date();
        await profile.save();
        return { amount, newBalance: profile.balance };
    }
    async weekly(guild, member) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        const lastWeekly = profile.lastWeekly ? new Date(profile.lastWeekly) : null;
        const now = new Date();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (lastWeekly && now.getTime() - lastWeekly.getTime() < weekMs) {
            const remaining = lastWeekly.getTime() + weekMs - now.getTime();
            throw new Error(`يجب الانتظار ${this.formatTime(remaining)} للجائزة الأسبوعية التالية`);
        }
        const amount = config.weeklyAmount || 2000;
        profile.balance += amount;
        profile.lastWeekly = now;
        await profile.save();
        return { amount, newBalance: profile.balance };
    }
    async monthly(guild, member) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        const lastMonthly = profile.lastMonthly ? new Date(profile.lastMonthly) : null;
        const now = new Date();
        const monthMs = 30 * 24 * 60 * 60 * 1000;
        if (lastMonthly && now.getTime() - lastMonthly.getTime() < monthMs) {
            const remaining = lastMonthly.getTime() + monthMs - now.getTime();
            throw new Error(`يجب الانتظار ${this.formatTime(remaining)} للجائزة الشهرية التالية`);
        }
        const amount = config.monthlyAmount || 10000;
        profile.balance += amount;
        profile.lastMonthly = now;
        await profile.save();
        return { amount, newBalance: profile.balance };
    }
    // ============================================
    // Bank System
    // ============================================
    async deposit(guild, member, amount) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        if (!config.bankEnabled)
            throw new Error('نظام البنك معطل');
        const depositAmount = amount === 'all' ? profile.balance : amount;
        if (typeof amount === 'number' && amount <= 0)
            throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        if (profile.balance < depositAmount)
            throw new Error('رصيد غير كافي');
        if (profile.bank + depositAmount > config.bankMaxDeposit)
            throw new Error(`الحد الأقصى للبنك: ${config.bankMaxDeposit.toLocaleString()}`);
        profile.balance -= depositAmount;
        profile.bank += depositAmount;
        await profile.save();
        return { balance: profile.balance, bank: profile.bank };
    }
    async withdraw(guild, member, amount) {
        const profile = await this.getProfile(guild.id, member.id);
        const withdrawAmount = amount === 'all' ? profile.bank : amount;
        if (typeof amount === 'number' && amount <= 0)
            throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        if (profile.bank < withdrawAmount)
            throw new Error('رصيد البنك غير كافي');
        profile.bank -= withdrawAmount;
        profile.balance += withdrawAmount;
        await profile.save();
        return { balance: profile.balance, bank: profile.bank };
    }
    async bankInfo(guild, member) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        const interest = Math.floor(profile.bank * (config.bankInterestRate / 100));
        return { balance: profile.balance, bank: profile.bank, interest };
    }
    // ============================================
    // Transfers
    // ============================================
    async transfer(guild, from, to, amount) {
        const config = await this.getConfig(guild.id);
        const fromProfile = await this.getProfile(guild.id, from.id);
        const toProfile = await this.getProfile(guild.id, to.id);
        if (!config.transferEnabled)
            throw new Error('التحويلات معطلة');
        if (from.id === to.id)
            throw new Error('لا يمكنك تحويل المال لنفسك');
        if (amount <= 0)
            throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        if (fromProfile.balance < amount)
            throw new Error('رصيد غير كافي');
        const tax = Math.floor(amount * (config.transferTax / 100));
        const netAmount = amount - tax;
        fromProfile.balance -= amount;
        toProfile.balance += netAmount;
        await fromProfile.save();
        await toProfile.save();
        return { tax, newBalance: fromProfile.balance };
    }
    // ============================================
    // Rob / Crime
    // ============================================
    async rob(guild, robber, target) {
        const config = await this.getConfig(guild.id);
        const robberProfile = await this.getProfile(guild.id, robber.id);
        const targetProfile = await this.getProfile(guild.id, target.id);
        if (!config.robEnabled)
            throw new Error('السرقة معطلة');
        if (robber.id === target.id)
            throw new Error('لا يمكنك سرقة نفسك');
        if (target.bot)
            throw new Error('لا يمكنك سرقة البوتات');
        if (targetProfile.balance < 100)
            throw new Error('الهدف لا يملك ما يكفي للسرقة');
        if (!this.checkCooldown(guild.id, robber.id, 'rob', config.robCooldown)) {
            const remaining = this.getCooldownRemaining(guild.id, robber.id, 'rob', config.robCooldown);
            throw new Error(`يجب الانتظار ${this.formatTime(remaining)} قبل السرقة مرة أخرى`);
        }
        const success = Math.random() < 0.4;
        if (!success) {
            const fine = Math.floor(robberProfile.balance * 0.1);
            robberProfile.balance -= fine;
            await robberProfile.save();
            throw new Error(`فشلت السرقة! تم تغريمك ${fine.toLocaleString()}`);
        }
        const maxSteal = Math.min(targetProfile.balance, Math.floor(targetProfile.balance * 0.3));
        const stolen = Math.floor(Math.random() * maxSteal) + 1;
        targetProfile.balance -= stolen;
        robberProfile.balance += stolen;
        robberProfile.lastRob = new Date();
        await targetProfile.save();
        await robberProfile.save();
        return { amount: stolen, newBalance: robberProfile.balance };
    }
    // ============================================
    // Gambling
    // ============================================
    async coinflip(guild, member, amount, choice) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        if (!config.coinflipEnabled)
            throw new Error('العملة معطلة');
        if (amount <= 0)
            throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        if (profile.balance < amount)
            throw new Error('رصيد غير كافي');
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = result === choice;
        if (won) {
            profile.balance += amount;
        }
        else {
            profile.balance -= amount;
        }
        await profile.save();
        return { won, amount: won ? amount : -amount, newBalance: profile.balance };
    }
    async dice(guild, member, amount, prediction) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        if (!config.diceEnabled)
            throw new Error('النرد معطل');
        if (amount <= 0)
            throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        if (profile.balance < amount)
            throw new Error('رصيد غير كافي');
        const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
        let won = false;
        let multiplier = 0;
        if (prediction === '7' && roll === 7) {
            won = true;
            multiplier = 4;
        }
        else if (prediction === 'high' && roll > 7) {
            won = true;
            multiplier = 2;
        }
        else if (prediction === 'low' && roll < 7) {
            won = true;
            multiplier = 2;
        }
        if (won) {
            profile.balance += amount * multiplier;
        }
        else {
            profile.balance -= amount;
        }
        await profile.save();
        return { won, amount: won ? amount * multiplier : -amount, newBalance: profile.balance, roll };
    }
    async slots(guild, member, amount) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        if (!config.slotsEnabled)
            throw new Error('السلوتس معطلة');
        if (amount <= 0)
            throw new Error('المبلغ يجب أن يكون أكبر من صفر');
        if (profile.balance < amount)
            throw new Error('رصيد غير كافي');
        const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];
        const reels = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
        ];
        const won = reels[0] === reels[1] && reels[1] === reels[2];
        let multiplier = 0;
        if (won) {
            if (reels[0] === '7️⃣')
                multiplier = 10;
            else if (reels[0] === '💎')
                multiplier = 5;
            else if (reels[0] === '⭐')
                multiplier = 3;
            else
                multiplier = 2;
        }
        if (won) {
            profile.balance += amount * multiplier;
        }
        else {
            profile.balance -= amount;
        }
        await profile.save();
        return { won, amount: won ? amount * multiplier : -amount, newBalance: profile.balance, reels };
    }
    // ============================================
    // Shop / Inventory
    // ============================================
    async buyItem(guild, member, itemId, quantity = 1) {
        const config = await this.getConfig(guild.id);
        const profile = await this.getProfile(guild.id, member.id);
        if (!config.shopEnabled)
            throw new Error('المتجر معطل');
        if (!config.inventoryEnabled)
            throw new Error('نظام المخزن معطل');
        const item = config.shopItems.find((i) => i.id === itemId);
        if (!item)
            throw new Error('العنصر غير موجود');
        const totalPrice = item.price * quantity;
        if (profile.balance < totalPrice)
            throw new Error('رصيد غير كافي');
        profile.balance -= totalPrice;
        // Add to inventory
        const existingItem = profile.inventory.find((i) => i.itemId === itemId);
        if (existingItem) {
            existingItem.quantity += quantity;
        }
        else {
            profile.inventory.push({
                itemId: item.id,
                name: item.name,
                description: item.description || '',
                quantity,
                price: item.price,
                usable: true,
                roleId: item.roleId,
            });
        }
        await profile.save();
        // Give role if item has roleId
        if (item.roleId) {
            const memberGuild = guild.members.cache.get(member.id);
            const role = guild.roles.cache.get(item.roleId);
            if (memberGuild && role) {
                await memberGuild.roles.add(role, 'Shop purchase').catch(() => { });
            }
        }
        return { item, newBalance: profile.balance };
    }
    async useItem(guild, member, itemId) {
        const profile = await this.getProfile(guild.id, member.id);
        const item = profile.inventory.find((i) => i.itemId === itemId);
        if (!item)
            throw new Error('العنصر غير موجود في المخزن');
        if (!item.usable)
            throw new Error('هذا العنصر غير قابل للاستخدام');
        if (item.roleId) {
            const role = member.guild.roles.cache.get(item.roleId);
            if (role) {
                await member.roles.add(role, 'Item usage').catch(() => { });
                return `تم منحك رول ${role.name}!`;
            }
        }
        item.quantity--;
        if (item.quantity <= 0) {
            profile.inventory = profile.inventory.filter((i) => i.itemId !== itemId);
        }
        await profile.save();
        return `تم استخدام ${item.name}!`;
    }
    // ============================================
    // Voice Rewards
    // ============================================
    async processVoiceRewards(guild, member, minutes) {
        const config = await this.getConfig(guild.id);
        if (!config.voiceRewardsEnabled)
            return;
        if (member.user.bot)
            return;
        const profile = await this.getProfile(guild.id, member.id);
        const reward = config.voiceRewardPerMinute * minutes;
        profile.balance += reward;
        profile.voiceTime += minutes;
        await profile.save();
    }
    // ============================================
    // Bank Interest (Daily Task)
    // ============================================
    async applyBankInterest(guild) {
        const config = await this.getConfig(guild.id);
        if (!config.bankEnabled)
            return;
        const { UserProfile } = await Promise.resolve().then(() => __importStar(require('../models')));
        const profiles = await UserProfile.find({ guildId: guild.id, bank: { $gt: 0 } });
        for (const profile of profiles) {
            const interest = Math.floor(profile.bank * (config.bankInterestRate / 100));
            if (interest > 0) {
                profile.bank += interest;
                await profile.save();
            }
        }
    }
    // ============================================
    // Leaderboard
    // ============================================
    async getLeaderboard(guild, type, limit = 10) {
        const { UserProfile } = await Promise.resolve().then(() => __importStar(require('../models')));
        let sortField;
        if (type === 'total') {
            // For total, we need to sort by (balance + bank) descending
            // We'll fetch all and sort in memory since we can't easily sort by computed field
            const profiles = await UserProfile.find({ guildId: guild.id }).lean();
            profiles.sort((a, b) => (b.balance + b.bank) - (a.balance + a.bank));
            return profiles.slice(0, limit).map((p, i) => ({
                rank: i + 1,
                userId: p.userId,
                balance: p.balance,
                bank: p.bank,
                total: p.balance + p.bank,
                level: p.level,
                xp: p.xp,
            }));
        }
        else {
            sortField = { [type]: -1 };
            const profiles = await UserProfile.find({ guildId: guild.id })
                .sort(sortField)
                .limit(limit)
                .lean();
            return profiles.map((p, i) => ({
                rank: i + 1,
                userId: p.userId,
                balance: p.balance,
                bank: p.bank,
                total: p.balance + p.bank,
                level: p.level,
                xp: p.xp,
            }));
        }
    }
    // ============================================
    // Utils
    // ============================================
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0)
            return `${days} يوم ${hours % 24} ساعة`;
        if (hours > 0)
            return `${hours} ساعة ${minutes % 60} دقيقة`;
        if (minutes > 0)
            return `${minutes} دقيقة ${seconds % 60} ثانية`;
        return `${seconds} ثانية`;
    }
}
exports.EconomyHandler = EconomyHandler;
exports.default = EconomyHandler;
//# sourceMappingURL=EconomyHandler.js.map