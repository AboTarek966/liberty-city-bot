"use strict";
// ============================================
// Liberty City Bot - Thread Create Logging
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const event = {
    name: 'threadCreate',
    async execute(thread, newlyCreated) {
        // التلقائية (منشورات المنتجات / متابعة الإعلانات) ليست قرار إنساني → لا نسجّلها
        if (!newlyCreated)
            return;
        const client = thread.client;
        // ⚡ لا ننتظر الإرسال — السجلات تمرّ عبر طابور مستقل (لا بطء ولا ضياع)
        client.loggingHandler.handleThreadCreate(thread).catch((err) => client.loggingHandler.reportFailure('threadCreate', err));
    },
};
exports.default = event;
//# sourceMappingURL=threadCreate.js.map