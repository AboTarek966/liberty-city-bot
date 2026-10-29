"use strict";
// ============================================
// Liberty City Bot - Ticket Transcript Button
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const handler = {
    id: 'ticket_transcript',
    async execute(interaction) {
        const client = interaction.client;
        if (!interaction.guild)
            return;
        await interaction.deferReply({ ephemeral: true });
        try {
            const transcript = await client.ticketHandler.getTranscript(interaction.channelId);
            const attachment = new discord_js_1.AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript-${interaction.channelId.slice(-6)}.txt` });
            await interaction.editReply({
                content: '📄 نسخة المحادثة:',
                files: [attachment],
            });
        }
        catch (error) {
            await interaction.editReply({
                content: `❌ ${error.message || 'حدث خطأ'}`,
            });
        }
    },
};
exports.default = handler;
//# sourceMappingURL=ticketTranscript.js.map