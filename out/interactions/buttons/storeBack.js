"use strict";
// ============================================
// Omni Bot - متجر البروجيكتات (زر رجوع للمتجر)
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("../../utils/store");
const handler = {
    id: 'store:back',
    async execute(interaction) {
        const store = await (0, store_1.getStore)();
        if (!store) {
            await interaction.reply({
                content: '❌ تعذر فتح المتجر حالياً — حاول لاحقاً',
                ephemeral: true,
            });
            return;
        }
        const components = (0, store_1.buildStoreSelect)(store) ?? [];
        const embed = (0, store_1.buildStoreEmbed)(store);
        await interaction.update({ embeds: [embed], components });
    },
};
exports.default = handler;
//# sourceMappingURL=storeBack.js.map