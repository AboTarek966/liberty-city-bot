"use strict";
// ============================================
// Omni Bot - Member Return Record
// سجل مغادرة/عودة العضو — لكشف تجاوز العقوبات:
// يخزّن حالة العضو قبل مغادرته (سجن/كتم/تحذيرات/رولات)
// وعند عودته تُعاد العقوبات النشطة ويُنبَّه الفريق.
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
exports.MemberReturnRecord = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const JailSnapshotSchema = new mongoose_1.Schema({
    roleId: { type: String, required: true },
    channelId: { type: String, required: true },
    reason: { type: String },
    expiresAt: { type: Date, default: null },
}, { _id: false });
const MemberReturnRecordSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, default: '' },
    displayName: { type: String, default: '' },
    firstJoinAt: { type: Date },
    lastJoinAt: { type: Date },
    lastLeaveAt: { type: Date },
    leaveCount: { type: Number, default: 0, min: 0 },
    rejoinCount: { type: Number, default: 0, min: 0 },
    lastRoles: [{ type: String }],
    warnings30d: { type: Number, default: 0, min: 0 },
    cases14d: { type: Number, default: 0, min: 0 },
    lastCaseLabel: { type: String },
    evasionSuspicion: { type: Boolean, default: false },
    jailSnapshot: { type: JailSnapshotSchema, default: null },
    mutedRoleId: { type: String, default: null },
}, { timestamps: true });
MemberReturnRecordSchema.index({ guildId: 1, userId: 1 }, { unique: true });
exports.MemberReturnRecord = mongoose_1.default.model('MemberReturnRecord', MemberReturnRecordSchema);
exports.default = exports.MemberReturnRecord;
//# sourceMappingURL=MemberReturnRecord.js.map