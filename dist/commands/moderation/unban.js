"use strict";
// ============================================
// Liberty City Bot - Unban Command
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('unban')
        .setDescription('إلغاء حظر عضو')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.BanMembers)
        .addUserOption(o => o.setName('user').setDescription('العضو المراد إلغاء حظره').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(false)),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.BanMembers],
    async execute(interaction) {
        const client = interaction.client;
        const guild = interaction.guild;
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason') || 'إلغاء حظر';
        try {
            await guild.members.unban(user.id, `${reason} | بواسطة ${interaction.user.tag}`);
            await interaction.reply({ content: `🔓 **${user.tag}** تم إلغاء حظره | ${reason}` });
            // Log
            try {
                const { getGuildSettings } = await Promise.resolve().then(() => __importStar(require('../../models')));
                const settings = await getGuildSettings(guild.id);
                if (settings.logging?.enabled && settings.logging.channelId) {
                    const logChannel = guild.channels.cache.get(settings.logging.channelId);
                    if (logChannel && logChannel.isTextBased()) {
                        const logEmbed = new discord_js_1.EmbedBuilder()
                            .setTitle('🔓 إلغاء حظر')
                            .setColor(embeds_1.Colors.success)
                            .addFields({ name: '👤 العضو', value: `${user} (\`${user.id}\`)`, inline: true }, { name: '🛡️ المنفذ', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: true }, { name: '📝 السبب', value: reason, inline: false })
                            .setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] }).catch(() => { });
                    }
                }
            }
            catch { }
        }
        catch (error) {
            await interaction.reply({ content: '❌ فشل إلغاء الحظر — المستخدم غير محظور أو صلاحيات البوت', ephemeral: true });
        }
    },
};
exports.default = command;
//# sourceMappingURL=unban.js.map