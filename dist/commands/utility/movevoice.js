"use strict";
// Omni Bot - Move Voice Command
// ============================================
// نقل المستخدم (نفسه) إلى قناة صوتية داخل نفس السيرفر.
// - أي مستخدم يقدر يستخدم الأمر.
// - يتطلب: البوت عضو في السيرفر + صلاحية Move Members + Connect + View Channel.
// - المستخدم يجب أن يكون موجوداً في قناة صوتية في نفس السيرفر.
// - المستخدم لازم يملك صلاحية Connect في القناة الهدف (وإلا ما ينفع يتجاوز القفل).
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('movevoice')
        .setDescription('🔊 نقل نفسك إلى قناة صوتية داخل سيرفر (يتطلب Mobile/Connect)')
        .setDMPermission(true)
        .addStringOption(o => o.setName('guild_id').setDescription('معرّف السيرفر').setRequired(true))
        .addStringOption(o => o.setName('channel_id').setDescription('معرّف القناة الصوتية').setRequired(true)),
    cooldown: 5,
    async execute(interaction) {
        const client = interaction.client;
        await interaction.deferReply({ ephemeral: true });
        const guildId = interaction.options.getString('guild_id', true).trim();
        const channelId = interaction.options.getString('channel_id', true).trim();
        const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
        if (!guild) {
            await interaction.editReply({ content: '❌ البوت ليس عضواً في هذا السيرفر (أو ID غير صحيح)' });
            return;
        }
        const channel = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(() => null));
        if (!channel || !channel.isVoiceBased()) {
            await interaction.editReply({ content: '❌ القناة ليست صوتية أو غير موجودة' });
            return;
        }
        if (channel.guildId !== guild.id) {
            await interaction.editReply({ content: '❌ القناة لا تتبع هذا السيرفر' });
            return;
        }
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
            await interaction.editReply({ content: '❌ أنت لست عضواً في هذا السيرفر' });
            return;
        }
        const me = guild.members.me;
        if (!me) {
            await interaction.editReply({ content: '❌ البوت غير جاهز في هذا السيرفر' });
            return;
        }
        const botPerms = channel.permissionsFor(me);
        if (!botPerms?.has(discord_js_1.PermissionFlagsBits.ViewChannel) || !botPerms?.has(discord_js_1.PermissionFlagsBits.Connect)) {
            await interaction.editReply({ content: '❌ لا أملك صلاحية **View/Connect** في هذه القناة' });
            return;
        }
        if (!me.permissions.has(discord_js_1.PermissionFlagsBits.MoveMembers)) {
            await interaction.editReply({ content: '❌ لا أملك صلاحية **Move Members** في هذا السيرفر' });
            return;
        }
        const userPerms = channel.permissionsFor(member);
        if (!userPerms?.has(discord_js_1.PermissionFlagsBits.Connect)) {
            await interaction.editReply({ content: '❌ أنت لا تملك صلاحية **Connect** في هذه القناة' });
            return;
        }
        // حد المستخدمين في القناة
        if (channel.userLimit && channel.members.size >= channel.userLimit) {
            await interaction.editReply({ content: '❌ القناة ممتلئة (User Limit)' });
            return;
        }
        if (!member.voice.channel) {
            await interaction.editReply({ content: '❌ يجب أن تكون **داخل قناة صوتية** في نفس السيرفر أولاً' });
            return;
        }
        if (member.voice.channel.guildId !== guild.id) {
            await interaction.editReply({ content: '❌ يجب أن تكون في قناة صوتية **في نفس السيرفر**' });
            return;
        }
        if (member.voice.channelId === channel.id) {
            await interaction.editReply({ content: '✅ أنت بالفعل في هذه القناة' });
            return;
        }
        try {
            await member.voice.setChannel(channel, 'movevoice command');
            await interaction.editReply({ content: `✅ تم نقلك إلى ${channel}` });
        }
        catch (error) {
            await interaction.editReply({ content: `❌ فشل النقل: ${error.message}` });
        }
    },
};
exports.default = command;
//# sourceMappingURL=movevoice.js.map