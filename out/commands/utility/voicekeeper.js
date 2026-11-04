"use strict";
// Omni Bot - Voice Keeper Command
// ============================================
// مالك البوت فقط: دخول قناة صوتية والبقاء فيها حتى إيقاف
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('voicekeeper')
        .setDescription('🔊 دخول قناة صوتية والبقاء فيها (للمالك فقط)')
        .setDMPermission(true)
        .addSubcommand(sub => sub
        .setName('join')
        .setDescription('دخول قناة صوتية')
        .addStringOption(o => o.setName('guild_id').setDescription('معرّف السيرفر').setRequired(true))
        .addStringOption(o => o.setName('channel_id').setDescription('معرّف القناة الصوتية').setRequired(true))
        .addIntegerOption(o => o.setName('hours').setDescription('المدة بالساعات (افتراضي 24)').setMinValue(1).setMaxValue(168)))
        .addSubcommand(sub => sub
        .setName('leave')
        .setDescription('إيقاف اتصال صوتي')
        .addStringOption(o => o.setName('guild_id').setDescription('معرّف السيرفر').setRequired(true))
        .addStringOption(o => o.setName('channel_id').setDescription('معرّف القناة (اختياري)').setRequired(false)))
        .addSubcommand(sub => sub.setName('status').setDescription('عرض الاتصالات النشطة')),
    cooldown: 3,
    permissions: [],
    async execute(interaction) {
        const client = interaction.client;
        if (!(await client.voiceKeeperHandler.ensureOwner(interaction.user.id))) {
            await interaction.reply({ content: '❌ هذا الأمر للمالك فقط', ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: true });
        if (sub === 'join') {
            const guildId = interaction.options.getString('guild_id', true).trim();
            const channelId = interaction.options.getString('channel_id', true).trim();
            const hours = interaction.options.getInteger('hours') || 24;
            const result = await client.voiceKeeperHandler.join(guildId, channelId, hours * 60 * 60 * 1000);
            await interaction.editReply({ content: result.message });
            return;
        }
        if (sub === 'leave') {
            const guildId = interaction.options.getString('guild_id', true).trim();
            const channelId = interaction.options.getString('channel_id')?.trim();
            const result = await client.voiceKeeperHandler.leave(guildId, channelId);
            await interaction.editReply({ content: result.message });
            return;
        }
        if (sub === 'status') {
            await interaction.editReply({ content: client.voiceKeeperHandler.status() });
            return;
        }
    },
};
exports.default = command;
//# sourceMappingURL=voicekeeper.js.map