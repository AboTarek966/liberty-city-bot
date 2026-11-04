import mongoose, { Document } from 'mongoose';
export interface IKnowledgeEntry extends Document {
    guildId: string;
    title: string;
    content: string;
    /** وسوم تساعد في البحث — مثال: تذاكر، رولات، حماية */
    tags: string[];
    /** تصنيف اختياري */
    category: string;
    createdBy: string;
    /** عدد المرات التي استُخدمت فيها هذه المعلومة في سياق AI */
    uses: number;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const KnowledgeEntry: mongoose.Model<IKnowledgeEntry, {}, {}, {}, mongoose.Document<unknown, {}, IKnowledgeEntry, {}, {}> & IKnowledgeEntry & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export default KnowledgeEntry;
//# sourceMappingURL=KnowledgeEntry.d.ts.map