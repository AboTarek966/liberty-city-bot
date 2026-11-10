/**
 * يحاول حجز هذا التفاعل — يعيد true إن كان أول من يحجزه، و false إن كان محجوزاً سلفاً.
 * عند فشل قاعدة البيانات لا نمنع المستخدم من التنفيذ (fail-open) حتى لا يتعطل التفاعل.
 */
export declare function claimInteractionOnce(interactionId: string): Promise<boolean>;
//# sourceMappingURL=interactionLocks.d.ts.map