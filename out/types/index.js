"use strict";
// ============================================
// Liberty City Bot - Type Definitions
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseEvent = exports.BaseCommand = void 0;
// --------------------------------------------
// Base Classes
// --------------------------------------------
class BaseCommand {
    options;
    constructor(options) {
        this.options = options;
    }
    async checkPermissions(context) {
        const { botPermissions, userPermissions, ownerOnly, guildOnly } = this.options;
        if (ownerOnly && context.user.id !== context.client.user?.id) {
            return false;
        }
        if (guildOnly && !context.guild) {
            return false;
        }
        if (userPermissions && userPermissions.length > 0) {
            if (!context.member.permissions.has(userPermissions)) {
                return false;
            }
        }
        if (botPermissions && botPermissions.length > 0) {
            const me = context.guild.members.me;
            if (!me || !me.permissions.has(botPermissions)) {
                return false;
            }
        }
        return true;
    }
    checkCooldown(context, userId) {
        const now = Date.now();
        const cooldown = this.options.cooldown || 3000;
        const userCooldowns = context.client.cooldowns.get(this.options.name) || new Map();
        const lastUsed = userCooldowns.get(userId) || 0;
        if (now - lastUsed < cooldown) {
            return false;
        }
        userCooldowns.set(userId, now);
        context.client.cooldowns.set(this.options.name, userCooldowns);
        return true;
    }
}
exports.BaseCommand = BaseCommand;
class BaseEvent {
    options;
    constructor(options) {
        this.options = options;
    }
}
exports.BaseEvent = BaseEvent;
//# sourceMappingURL=index.js.map