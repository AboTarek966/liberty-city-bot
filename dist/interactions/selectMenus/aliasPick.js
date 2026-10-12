"use strict";
// ============================================
// Liberty City Bot - Alias Pick (قائمة اختيار الاختصار المتعدد)
// تظهر عندما يكون الاختصار مرتبطاً بأكثر من أمر غير متكامل
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const messageCreate_1 = require("../../events/messageCreate");
const handler = {
    id: 'alias_pick',
    async execute(interaction) {
        const sel = interaction;
        if (!sel.guild) {
            await sel.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true }).catch(() => { });
            return;
        }
        const sid = sel.customId.split(':')[1];
        await (0, messageCreate_1.handleAliasPickSelect)(sel, sid);
    },
};
exports.default = handler;
//# sourceMappingURL=aliasPick.js.map