"use strict";
// ============================================
// Omni Bot - Dashboard Session Audit Model
// ============================================
// يحتفظ بالكود الوثائقي فقط، ولا يخزن التوكن نفسه.
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
exports.DashboardSession = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const DashboardSessionSchema = new mongoose_1.Schema({
    tokenHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true },
    username: { type: String, default: 'المالك' },
    authMethod: { type: String, enum: ['password', 'code', 'oauth'], required: true, index: true },
    ip: { type: String, required: true, default: 'unknown' },
    countryCode: { type: String },
    countryName: { type: String },
    userAgent: { type: String, maxlength: 512 },
    deviceName: { type: String },
    deviceType: { type: String },
    browserName: { type: String },
    osName: { type: String },
    oauthVerified: { type: Boolean, default: false, index: true },
    lastPath: { type: String, index: true },
    requestCount: { type: Number, default: 0, min: 0 },
    revokedAt: { type: Date, index: true },
}, { timestamps: true });
DashboardSessionSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 777600 });
exports.DashboardSession = mongoose_1.default.models.DashboardSession || mongoose_1.default.model('DashboardSession', DashboardSessionSchema);
exports.default = exports.DashboardSession;
//# sourceMappingURL=DashboardSession.js.map