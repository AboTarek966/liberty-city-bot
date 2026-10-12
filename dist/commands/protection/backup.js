"use strict";
// ============================================
// Liberty City Bot - Backup Command
// النسخ الاحتياطي: إنشاء، عرض، استعادة بنية السيرفر
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('backup')
        .setDescription('النسخ الاحتياطي لسيرفرك — إنشاء وعرض واستعادة البنية')
        .addSubcommand(sub => sub.setName('create').setDescription('إنشاء نسخة احتياطية فورية (القنوات والرولات)'))
        .addSubcommand(sub => sub.setName('list').setDescription('عرض النسخ الاحتياطية المحفوظة'))
        .addSubcommand(sub => sub.setName('info').setDescription('تفاصيل آخر نسخة احتياطية'))
        .addSubcommand(sub => sub
        .setName('restore')
        .setDescription('استعادة البنية المفقودة (القنوات والرولات) من نسخة احتياطية')
        .addIntegerOption(opt => opt
        .setName('number')
        .setDescription('رقم النسخة (من /backup list) — اتركه فارغاً للأحدث')
        .setMinValue(1)))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),
    cooldown: 5,
    permissions: [discord_js_1.PermissionFlagsBits.ManageGuild],
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const lc = interaction.client;
        const guild = interaction.guild;
        await interaction.deferReply({ ephemeral: true });
        switch (subcommand) {
            // ------------------------------------------
            // إنشاء نسخة
            // ------------------------------------------
            case 'create': {
                const result = await lc.securityHandler.createBackup(guild);
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('💾 تم إنشاء نسخة احتياطية')
                    .setDescription('حُفظت بنية السيرفر كاملة — يمكنك استعادتها في أي وقت بعد أي هجوم.')
                    .setColor(embeds_1.Colors.success)
                    .addFields({ name: '📢 القنوات', value: `${result.channels}`, inline: true }, { name: '🎭 الرولات', value: `${result.roles}`, inline: true }, { name: '📦 الحجم', value: `${(result.size / 1024).toFixed(1)} KB`, inline: true }, {
                    name: 'الاستعادة',
                    value: '`/backup restore` — يعيد فقط ما حُذف، بدون هدم شيء موجود',
                    inline: false,
                })
                    .setFooter({ text: 'Liberty City Backup' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // ------------------------------------------
            // قائمة النسخ
            // ------------------------------------------
            case 'list': {
                const backups = await lc.securityHandler.listBackups(guild.id);
                if (!backups.length) {
                    await interaction.editReply({
                        embeds: [
                            new discord_js_1.EmbedBuilder()
                                .setTitle('📦 لا توجد نسخ احتياطية')
                                .setDescription('أنشئ أول نسخة بـ `/backup create` أو فعّل النسخ التلقائي من `/settings` → الحماية.')
                                .setColor(embeds_1.Colors.warning),
                        ],
                    });
                    return;
                }
                const lines = backups
                    .map(b => `**#${b.index}** — <t:${Math.floor(new Date(b.date).getTime() / 1000)}:R> • ${b.channels} قناة • ${b.roles} رول • ${(b.size / 1024).toFixed(1)} KB`)
                    .join('\n');
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('📦 النسخ الاحتياطية المحفوظة')
                    .setDescription(`${lines}\n\n*لاستعادة نسخة محددة: \`/backup restore number:<رقم>\`*`)
                    .setColor(embeds_1.Colors.primary)
                    .setFooter({ text: 'Liberty City Backup' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // ------------------------------------------
            // تفاصيل آخر نسخة
            // ------------------------------------------
            case 'info': {
                const backups = await lc.securityHandler.listBackups(guild.id);
                const last = backups[backups.length - 1];
                if (!last) {
                    await interaction.editReply({
                        embeds: [
                            new discord_js_1.EmbedBuilder()
                                .setTitle('📦 لا توجد نسخ احتياطية')
                                .setDescription('أنشئ نسخة بـ `/backup create`.')
                                .setColor(embeds_1.Colors.warning),
                        ],
                    });
                    return;
                }
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle(`💾 تفاصيل النسخة #${last.index}`)
                    .setColor(embeds_1.Colors.primary)
                    .addFields({ name: 'التاريخ', value: `<t:${Math.floor(new Date(last.date).getTime() / 1000)}:F>`, inline: true }, { name: 'القنوات', value: `${last.channels}`, inline: true }, { name: 'الرولات', value: `${last.roles}`, inline: true }, { name: 'الحجم', value: `${(last.size / 1024).toFixed(1)} KB`, inline: true }, {
                    name: 'عدد النسخ المحفوظة',
                    value: `${backups.length} / 5 (يُحذف الأقدم تلقائياً)`,
                    inline: true,
                })
                    .setFooter({ text: 'Liberty City Backup' })
                    .setTimestamp();
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // ------------------------------------------
            // الاستعادة
            // ------------------------------------------
            case 'restore': {
                const number = interaction.options.getInteger('number');
                const backupIndex = number !== null && number !== undefined ? number - 1 : undefined;
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('⏳ جارٍ الاستعادة...')
                    .setDescription('يتم إعادة إنشاء القنوات والرولات المفقودة فقط — قد يستغرق دقيقة حسب حجم السيرفر.')
                    .setColor(embeds_1.Colors.warning);
                await interaction.editReply({ embeds: [embed] });
                try {
                    const result = await lc.securityHandler.restoreBackup(guild, backupIndex);
                    const done = new discord_js_1.EmbedBuilder()
                        .setTitle('✅ تمت الاستعادة بنجاح')
                        .setDescription('أُعيد فقط ما كان مفقوداً — العناصر الموجودة لم تُمسّ. راجع ترتيب القنوات وتعديل الصلاحيات حسب الحاجة.')
                        .setColor(embeds_1.Colors.success)
                        .addFields({ name: '📢 قنوات أُعيدت', value: `${result.channels}`, inline: true }, { name: '🎭 رولات أُعيدت', value: `${result.roles}`, inline: true }, { name: '⏭️ تخطّي (موجود)', value: `${result.skipped}`, inline: true })
                        .setFooter({ text: 'Liberty City Backup' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [done] });
                }
                catch (err) {
                    await interaction.editReply({
                        embeds: [
                            new discord_js_1.EmbedBuilder()
                                .setTitle('❌ فشل الاستعادة')
                                .setDescription(err.message)
                                .setColor(embeds_1.Colors.error),
                        ],
                    });
                }
                return;
            }
        }
    },
};
exports.default = command;
//# sourceMappingURL=backup.js.map