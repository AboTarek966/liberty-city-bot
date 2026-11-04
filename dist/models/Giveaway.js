"use strict";
// ============================================
// Liberty City Bot - Giveaway Model
// ============================================
// سحب محفوظ في قاعدة البيانات — يبقى شغّالاً بعد إعادة تشغيل البوت
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
exports.Giveaway = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const GiveawayRequirementsSchema = new mongoose_1.Schema({
    roleIds: [{ type: String }],
    minLevel: { type: Number, default: 0, min: 0 },
    minAccountAgeDays: { type: Number, default: 0, min: 0 },
    minInvites: { type: Number, default: 0, min: 0 },
}, { _id: false });
const GiveawaySchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    shortId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String },
    hostId: { type: String, required: true },
    prize: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    winnersCount: { type: Number, default: 1, min: 1, max: 20 },
    endsAt: { type: Date, required: true },
    ended: { type: Boolean, default: false },
    endedAt: { type: Date },
    winnerIds: [{ type: String }],
    entries: [{ type: String }],
    requirements: { type: GiveawayRequirementsSchema, default: () => ({}) },
}, { timestamps: true });
GiveawaySchema.index({ guildId: 1, shortId: 1 }, { unique: true });
GiveawaySchema.index({ ended: 1, endsAt: 1 });
exports.Giveaway = mongoose_1.default.model('Giveaway', GiveawaySchema);
exports.default = exports.Giveaway;
//# sourceMappingURL=Giveaway.js.map