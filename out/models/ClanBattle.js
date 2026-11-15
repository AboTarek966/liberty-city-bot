"use strict";
// ============================================
// Omni Bot - 🛡️ نموذج مسابقات العشائر
// ============================================
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
exports.ClanBattle = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ClanBattleSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    name: { type: String, default: 'مسابقة عشائرية', maxlength: 64 },
    clanIds: [{ type: String, required: true }],
    durationDays: { type: Number, default: 7, min: 1, max: 30 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    channelId: { type: String },
    status: { type: String, enum: ['active', 'ended', 'cancelled'], default: 'active', index: true },
    winnerClanId: { type: String },
    winnerMemberIds: [{ type: String }],
    endedAt: { type: Date },
}, { timestamps: true });
ClanBattleSchema.index({ guildId: 1, status: 1, endsAt: 1 });
exports.ClanBattle = mongoose_1.default.model('ClanBattle', ClanBattleSchema);
exports.default = exports.ClanBattle;
//# sourceMappingURL=ClanBattle.js.map