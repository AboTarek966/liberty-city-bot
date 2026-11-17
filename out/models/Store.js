"use strict";
// ============================================
// Omni Bot - Store Models (متجر البروجيكتات)
// نظام بيع بروجيكتات للجميع — الدفع بالكريديت عبر ProBot
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
exports.StoreOrder = exports.Store = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const StoreProjectSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, min: 0, max: 99 },
    /** الرول اللي يتمنح تلقائياً للمشتري عند تأكيد استلام الدفع/التسليم */
    deliveryRoleId: { type: String },
    enabled: { type: Boolean, default: true },
    sales: { type: Number, default: 0, min: 0 },
    createdBy: { type: String },
}, { _id: false });
const StoreSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, default: 'main' },
    payeeId: { type: String },
    probotPrefix: { type: String, default: '!' },
    taxPercent: { type: Number, default: 5, min: 0, max: 25 },
    logChannelId: { type: String },
    managerIds: { type: [String], default: [] },
    projects: { type: [StoreProjectSchema], default: [] },
}, { timestamps: true });
exports.Store = mongoose_1.default.models.Store || mongoose_1.default.model('Store', StoreSchema);
const StoreOrderSchema = new mongoose_1.Schema({
    orderId: { type: String, required: true, unique: true, index: true },
    projectId: { type: String, required: true, index: true },
    projectName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    taxPercent: { type: Number, default: 5, min: 0, max: 25 },
    payeeId: { type: String },
    probotPrefix: { type: String },
    buyerId: { type: String, required: true, index: true },
    guildId: { type: String },
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending', index: true },
    paidBy: { type: String },
    paidAt: { type: Date },
}, { timestamps: true });
exports.StoreOrder = mongoose_1.default.models.StoreOrder || mongoose_1.default.model('StoreOrder', StoreOrderSchema);
//# sourceMappingURL=Store.js.map