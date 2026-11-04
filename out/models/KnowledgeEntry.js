"use strict";
// ============================================
// Liberty City Bot - AI Knowledge Base Model
// ============================================
// قاعدة معرفة لكل سيرفر — تُحقن في سياق الذكاء الاصطناعي
// (الدردشة العامة + مساعد التذاكر) لتقليل الاعتماد على التخمين.
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
exports.KnowledgeEntry = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const KnowledgeEntrySchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 8000 },
    tags: [{ type: String, trim: true, lowercase: true }],
    category: { type: String, default: 'عام', trim: true, maxlength: 50 },
    createdBy: { type: String, required: true },
    uses: { type: Number, default: 0, min: 0 },
    enabled: { type: Boolean, default: true },
}, { timestamps: true });
KnowledgeEntrySchema.index({ guildId: 1, enabled: 1 });
KnowledgeEntrySchema.index({ guildId: 1, title: 1 });
KnowledgeEntrySchema.index({ title: 'text', content: 'text', tags: 'text' }, { default_language: 'none', name: 'knowledge_text' });
exports.KnowledgeEntry = mongoose_1.default.model('KnowledgeEntry', KnowledgeEntrySchema);
exports.default = exports.KnowledgeEntry;
//# sourceMappingURL=KnowledgeEntry.js.map