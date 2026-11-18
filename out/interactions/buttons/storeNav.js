"use strict";
// ============================================
// Omni Bot - 🛍️ متجر Omni (التنقل بين الأقسام والصفحات)
// customId: store:nav:<all|type>:<page>
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("../../utils/store");
const handler = {
    id: 'store:nav',
    async execute(interaction) {
        const parts = interaction.customId.split(':');
        const filter = (0, store_1.normalizeStoreFilter)(parts[2]);
        const page = Number(parts[3]) || 0;
        const store = await (0, store_1.getStore)();
        if (!store) {
            await interaction.reply({ content: '❌ تعذر فتح المتجر حالياً — حاول لاحقاً', ephemeral: true });
            return;
        }
        const view = { type: filter === 'all' ? 'all' : (0, store_1.normalizeStoreType)(filter), page };
        const components = (0, store_1.buildStoreComponents)(store, view);
        const embed = (0, store_1.buildStoreEmbed)(store, view);
        await interaction.update({ embeds: [embed], components });
    },
};
exports.default = handler;
//# sourceMappingURL=storeNav.js.map