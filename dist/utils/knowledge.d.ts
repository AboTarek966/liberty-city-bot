import { IKnowledgeEntry } from '../models';
export declare function normalizeArabic(text: string): string;
export declare function tokenize(text: string): string[];
export declare function loadKnowledge(guildId: string): Promise<IKnowledgeEntry[]>;
export interface KnowledgeMatch {
    entry: IKnowledgeEntry;
    score: number;
}
export declare function searchKnowledge(guildId: string, query: string, limit?: number): Promise<KnowledgeMatch[]>;
export declare function buildKnowledgeContext(guildId: string, query: string, limit?: number, maxChars?: number): Promise<string>;
export declare function invalidateKnowledgeCache(guildId?: string): void;
//# sourceMappingURL=knowledge.d.ts.map