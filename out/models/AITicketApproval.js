"use strict";
// ============================================
// Omni Bot - AI Ticket Approval Model
// ============================================
// طلبات موافقة الإدارة على إجراءات مساعد التذاكر — محفوظة في قاعدة
// البيانات حتى لا تضيع عند إعادة تشغيل البوت.
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
exports.AITicketApproval = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const AITicketApprovalSchema = new mongoose_1.Schema({
    approvalId: { type: String, required: true, unique: true, index: true },
    guildId: { type: String, required: true, index: true },
    ticketId: { type: String, required: true },
    ticketUserId: { type: String },
    channelId: { type: String, required: true },
    action: { type: mongoose_1.Schema.Types.Mixed, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'denied', 'expired'],
        default: 'pending',
        index: true,
    },
    requestedBy: { type: String, default: 'ai' },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    resultMessage: { type: String },
    requestedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });
AITicketApprovalSchema.index({ guildId: 1, status: 1, expiresAt: 1 });
exports.AITicketApproval = mongoose_1.default.model('AITicketApproval', AITicketApprovalSchema);
exports.default = exports.AITicketApproval;
//# sourceMappingURL=AITicketApproval.js.map