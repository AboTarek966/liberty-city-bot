import { ActionRowBuilder, StringSelectMenuBuilder, Guild, ModalBuilder } from 'discord.js';
/** صفوف قائمة اختيار الإيموجي (بترقيم صفحات — تُحدَّث على نفس الرسالة) */
export declare function buildEmojiSelectRows(guild: Guild, scope: string, userId: string): ActionRowBuilder<StringSelectMenuBuilder>[];
/** تبديل الصفحة (+1/-1) وإعادة الصفوف */
export declare function flipEmojiPage(guild: Guild, scope: string, userId: string, delta: number): ActionRowBuilder<StringSelectMenuBuilder>[];
/** تحويل قيمة الاختيار إلى نص جاهز داخل الرد */
export declare function resolveEmojiChoice(guild: Guild, value: string): string | null;
/** نافذة إضافة الأمر — الرد يبدأ بالإيموجي المختار (prefill) */
export declare function buildCommandAddModal(scope: 'public' | 'admin', prefill?: string): ModalBuilder;
//# sourceMappingURL=emojiPicker.d.ts.map