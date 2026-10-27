"use strict";
// ============================================
// Liberty City Bot - Whitelist Command
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const models_1 = require("../../models");
const embeds_1 = require("../../utils/embeds");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('القائمة البيضاء — استثناء من الحظر الوقائي فقط، والهجوم السريع يُعاقب')
        .addSubcommand(subcommand => subcommand
        .setName('add')
        .setDescription('إضافة مستخدم/بوت للقائمة البيضاء (استثناء وقائي فقط)')
        .addUserOption(option => option.setName('user').setDescription('المستخدم المراد إضافته').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('السبب').setRequired(false)))
        .addSubcommand(subcommand => subcommand
        .setName('remove')
        .setDescription('إزالة مستخدم من القائمة البيضاء')
        .addUserOption(option => option.setName('user').setDescription('المستخدم المراد إزالته').setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('list')
        .setDescription('عرض أعضاء القائمة البيضاء'))
        .addSubcommand(subcommand => subcommand
        .setName('toggle')
        .setDescription('تفعيل/تعطيل استثناء الحظر الوقائي')
        .addBooleanOption(option => option.setName('enabled').setDescription('حالة التفعيل').setRequired(true)))
        .setDefaultMemberPermissions(discord_js_1.PermissionFlagsBits.Administrator)
        .setDMPermission(false),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        await interaction.deferReply({ ephemeral: true });
        const settings = await (0, models_1.getGuildSettings)(guild.id);
        if (!settings.protection.whitelist) {
            settings.protection.whitelist = { enabled: false, userIds: [] };
        }
        const wl = settings.protection.whitelist;
        if (subcommand === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            wl.enabled = enabled;
            await settings.save();
            (0, models_1.invalidateGuildSettings)(guild.id);
            await interaction.editReply({
                content: `${enabled ? '✅ تم تفعيل' : '❌ تم تعطيل'} استثناء القائمة البيضاء\n` +
                    '🛡️ المفعّل: لا يُحظر البوت/العضو وقائياً عند الدخول أو الفحص التلقائي — لكن أي هجوم سريع (حذف/إنشاء/تعديل جماعي) يُعاقب فوراً.',
            });
            return;
        }
        if (subcommand === 'add') {
            const user = interaction.options.getUser('user', true);
            const reason = interaction.options.getString('reason') || 'لا يوجد سبب';
            if (wl.userIds.includes(user.id)) {
                if (!wl.enabled) {
                    wl.enabled = true;
                    await settings.save();
                    (0, models_1.invalidateGuildSettings)(guild.id);
                    await interaction.editReply({
                        content: `⚠️ ${user} موجود بالفعل — وتم **تفعيل** القائمة البيضاء تلقائياً.\n` +
                            '🛡️ استثناء وقائي فقط، وأي هجوم سريع يُعاقب.',
                    });
                    return;
                }
                await interaction.editReply({ content: `⚠️ ${user} موجود بالفعل في القائمة البيضاء` });
                return;
            }
            wl.userIds.push(user.id);
            wl.enabled = true; // الإضافة تعني الاستثناء الوقائي فوراً
            await settings.save();
            (0, models_1.invalidateGuildSettings)(guild.id);
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('✅ تم إضافة عضو للقائمة البيضاء')
                .setColor(embeds_1.Colors.success)
                .addFields({ name: '👤 المستخدم', value: `${user} (\`${user.id}\`)`, inline: true }, { name: '📝 السبب', value: reason, inline: true }, { name: '🛡️ بواسطة', value: `${interaction.user}`, inline: true }, {
                name: '✅ الحالة',
                value: 'تم تفعيل الاستثناء الوقائي تلقائياً.',
                inline: false,
            }, {
                name: '⚠️ تنبيه',
                value: 'هذا استثناء من الحظر الوقائي فقط (الدخول/الفحص التلقائي).\n' +
                    '🚨 أي هجوم سريع — حذف/إنشاء/تعديل جماعي أو سبام — يُعاقب فوراً كأي مخالف.',
                inline: false,
            })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
        if (subcommand === 'remove') {
            const user = interaction.options.getUser('user', true);
            if (!wl.userIds.includes(user.id)) {
                await interaction.editReply({ content: `⚠️ ${user} غير موجود في القائمة البيضاء` });
                return;
            }
            wl.userIds = wl.userIds.filter(id => id !== user.id);
            await settings.save();
            (0, models_1.invalidateGuildSettings)(guild.id);
            await interaction.editReply({ content: `✅ تم إزالة ${user} من القائمة البيضاء` });
            return;
        }
        if (subcommand === 'list') {
            if (wl.userIds.length === 0) {
                await interaction.editReply({ content: '📋 القائمة البيضاء فارغة' });
                return;
            }
            const members = await Promise.all(wl.userIds.map(async (id) => {
                const user = await interaction.client.users.fetch(id).catch(() => null);
                return user ? `${user} (\`${id}\`)` : `\`${id}\` (مستخدم غير موجود)`;
            }));
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('👑 أعضاء القائمة البيضاء')
                .setColor(embeds_1.Colors.info)
                .setDescription(`${wl.enabled ? '✅ الاستثناء الوقائي مفعّل' : '⚠️ الاستثناء الوقائي معطّل (toggle)'}\n` +
                '🛡️ لا يُحظرون وقائياً — لكن الهجوم السريع يُعاقب.\n\n' +
                members.map((m, i) => `${i + 1}. ${m}`).join('\n'))
                .setFooter({ text: `إجمالي: ${wl.userIds.length} عضو/بوت (استثناء وقائي فقط)` })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }
    },
};
exports.default = command;
//# sourceMappingURL=whitelist.js.map