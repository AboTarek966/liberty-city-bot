"use strict";
// ============================================
// Liberty City Bot - Embed Builder Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embedBuilderState_1 = require("../../utils/embedBuilderState");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('embed')
        .setDescription('📝 أنشئ رسالة Embed جميلة عبر نموذج سهل')
        .addChannelOption(opt => opt
        .setName('channel')
        .setDescription('قناة الإرسال (الافتراضي: القناة الحالية)'))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageMessages)
        .setDMPermission(false),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageMessages],
    async execute(interaction) {
        if (!interaction.guild) {
            await interaction.reply({ content: '❌ يعمل في السيرفر فقط', ephemeral: true });
            return;
        }
        // 🧠 إنشاء جلسة جديدة للمستخدم (TTL = 10 دقائق)
        const target = interaction.options.getChannel('channel');
        const session = (0, embedBuilderState_1.createSession)(interaction.user.id, target?.id);
        // 👀 الرد بمعاينة حية + أزرار التحكم (رسالة مؤقتة خاصة)
        const view = (0, embedBuilderState_1.renderMain)(session.data);
        await interaction.reply({
            content: '👀 معاينة — ابدأ بالتعديل',
            embeds: view.embeds,
            components: view.components,
            ephemeral: true,
        });
    },
};
exports.default = command;
//# sourceMappingURL=embed.js.map