"use strict";
// ============================================
// Liberty City Bot - Economy Commands
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const helpers_1 = require("../../utils/helpers");
const logger = (0, helpers_1.createLogger)('EconomyCommand');
const economyCommand = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('economy')
        .setDescription('نظام الاقتصاد')
        .addSubcommand(subcommand => subcommand
        .setName('balance')
        .setDescription('عرض رصيدك')
        .addUserOption(option => option.setName('user').setDescription('المستخدم').setRequired(false)))
        .addSubcommand(subcommand => subcommand
        .setName('daily')
        .setDescription('استلام الجائزة اليومية'))
        .addSubcommand(subcommand => subcommand
        .setName('work')
        .setDescription('العمل لكسب المال'))
        .addSubcommand(subcommand => subcommand
        .setName('beg')
        .setDescription('التسول'))
        .addSubcommand(subcommand => subcommand
        .setName('weekly')
        .setDescription('الجائزة الأسبوعية'))
        .addSubcommand(subcommand => subcommand
        .setName('monthly')
        .setDescription('الجائزة الشهرية'))
        .addSubcommand(subcommand => subcommand
        .setName('deposit')
        .setDescription('إيداع في البنك')
        .addStringOption(option => option.setName('amount').setDescription('المبلغ (أو all)').setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('withdraw')
        .setDescription('سحب من البنك')
        .addStringOption(option => option.setName('amount').setDescription('المبلغ (أو all)').setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('bank')
        .setDescription('معلومات البنك')
        .addUserOption(option => option.setName('user').setDescription('المستخدم').setRequired(false)))
        .addSubcommand(subcommand => subcommand
        .setName('transfer')
        .setDescription('تحويل مال لعضو')
        .addUserOption(option => option.setName('user').setDescription('المستلم').setRequired(true))
        .addIntegerOption(option => option.setName('amount').setDescription('المبلغ').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand => subcommand
        .setName('rob')
        .setDescription('محاولة سرقة عضو')
        .addUserOption(option => option.setName('user').setDescription('الضحية').setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('coinflip')
        .setDescription('لعبة العملة')
        .addIntegerOption(option => option.setName('amount').setDescription('المبلغ').setRequired(true).setMinValue(1))
        .addStringOption(option => option.setName('choice').setDescription('الاختيار').setRequired(true)
        .addChoices({ name: '🦅 رأس', value: 'heads' }, { name: '🦁 ذيل', value: 'tails' })))
        .addSubcommand(subcommand => subcommand
        .setName('dice')
        .setDescription('لعبة النرد')
        .addIntegerOption(option => option.setName('amount').setDescription('المبلغ').setRequired(true).setMinValue(1))
        .addStringOption(option => option.setName('prediction').setDescription('التوقع').setRequired(true)
        .addChoices({ name: '🔼 عالي (8-12)', value: 'high' }, { name: '🔽 منخفض (2-6)', value: 'low' }, { name: '7️⃣ رقم 7', value: '7' })))
        .addSubcommand(subcommand => subcommand
        .setName('slots')
        .setDescription('آلة السلوتس')
        .addIntegerOption(option => option.setName('amount').setDescription('المبلغ').setRequired(true).setMinValue(1)))
        .addSubcommand(subcommand => subcommand
        .setName('shop')
        .setDescription('عرض المتجر'))
        .addSubcommand(subcommand => subcommand
        .setName('buy')
        .setDescription('شراء من المتجر')
        .addStringOption(option => option.setName('item').setDescription('العنصر').setRequired(true))
        .addIntegerOption(option => option.setName('quantity').setDescription('الكمية').setRequired(false).setMinValue(1)))
        .addSubcommand(subcommand => subcommand
        .setName('inventory')
        .setDescription('عرض مخزنك')
        .addUserOption(option => option.setName('user').setDescription('المستخدم').setRequired(false)))
        .addSubcommand(subcommand => subcommand
        .setName('use')
        .setDescription('استخدام عنصر من المخزن')
        .addStringOption(option => option.setName('item').setDescription('العنصر').setRequired(true)))
        .addSubcommand(subcommand => subcommand
        .setName('leaderboard')
        .setDescription('قائمة الأغنى')
        .addStringOption(option => option.setName('type').setDescription('النوع').setRequired(false)
        .addChoices({ name: 'الرصيد', value: 'balance' }, { name: 'البنك', value: 'bank' }, { name: 'الإجمالي', value: 'total' }, { name: 'المستوى', value: 'level' }))
        .addIntegerOption(option => option.setName('limit').setDescription('العدد').setRequired(false).setMinValue(1).setMaxValue(20)))
        .addSubcommand(subcommand => subcommand
        .setName('daily')
        .setDescription('استلام الجائزة اليومية'))
        .addSubcommand(subcommand => subcommand
        .setName('weekly')
        .setDescription('الجائزة الأسبوعية'))
        .addSubcommand(subcommand => subcommand
        .setName('monthly')
        .setDescription('الجائزة الشهرية'))
        .setDMPermission(false),
    async execute(interaction) {
        const client = interaction.client;
        const economy = client.economyHandler;
        const subcommand = interaction.options.getSubcommand();
        await interaction.deferReply({ ephemeral: false });
        try {
            const guild = interaction.guild;
            const member = interaction.member;
            switch (subcommand) {
                case 'balance': {
                    const targetUser = interaction.options.getUser('user') || interaction.user;
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
                    if (!targetMember) {
                        await interaction.editReply({ content: '❌ المستخدم غير موجود في السيرفر' });
                        return;
                    }
                    const profile = await client.economyHandler.getProfile(guild.id, targetUser.id);
                    const config = await client.economyHandler.getConfig(guild.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(`💰 رصيد ${targetUser.username}`)
                        .setColor(discord_js_1.Colors.Gold)
                        .addFields({ name: '💵 الرصيد', value: client.economyHandler.formatCurrency(profile.balance, config), inline: true }, { name: '🏦 البنك', value: client.economyHandler.formatCurrency(profile.bank, config), inline: true }, { name: '💎 الإجمالي', value: client.economyHandler.formatCurrency(profile.balance + profile.bank, config), inline: true })
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setFooter({ text: `Liberty City Economy • ${targetUser.tag}` })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'daily': {
                    const result = await client.economyHandler.daily(interaction.guild, member);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🎁 الجائزة اليومية')
                        .setColor(discord_js_1.Colors.Green)
                        .setDescription(`حصلت على **${client.economyHandler.formatCurrency(result.amount, config)}**!`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true }, { name: '🔥 السترياك', value: `${result.streak} يوم`, inline: true })
                        .setFooter({ text: 'عد غداً للجائزة التالية!' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'work': {
                    const result = await client.economyHandler.work(interaction.guild, member);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const jobs = [
                        'برمجة', 'تصميم', 'كتابة', 'تدريس', 'بناء', 'صيانة',
                        'تنظيف', 'طبخ', 'توصيل', 'مبيعات', 'تسويق', 'إدارة'
                    ];
                    const job = jobs[Math.floor(Math.random() * jobs.length)];
                    const earned = result.amount;
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('💼 عملت بجد!')
                        .setColor(discord_js_1.Colors.Blue)
                        .setDescription(`عملت كـ **${job}** وكسبت **${client.economyHandler.formatCurrency(earned, config)}**`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setFooter({ text: 'يمكنك العمل مرة أخرى بعد ساعة' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'beg': {
                    const result = await client.economyHandler.beg(interaction.guild, member);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const people = ['رجل أعمال', 'سيدة لطيفة', 'طفل صغير', 'رجل عجوز', 'قطة ضالة', 'بوت آخر'];
                    const person = people[Math.floor(Math.random() * people.length)];
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🙏 تسولت بنجاح!')
                        .setColor(discord_js_1.Colors.Gold)
                        .setDescription(`أعطاك **${person}** **${client.economyHandler.formatCurrency(result.amount, config)}**`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setFooter({ text: 'يمكنك التسول مرة أخرى بعد 30 دقيقة' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'weekly': {
                    const result = await client.economyHandler.weekly(interaction.guild, member);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('📦 الجائزة الأسبوعية')
                        .setColor(discord_js_1.Colors.Purple)
                        .setDescription(`حصلت على **${client.economyHandler.formatCurrency(result.amount, config)}**!`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setFooter({ text: 'الجائزة التالية بعد 7 أيام' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'monthly': {
                    const result = await client.economyHandler.monthly(interaction.guild, member);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('📅 الجائزة الشهرية')
                        .setColor(discord_js_1.Colors.Orange)
                        .setDescription(`حصلت على **${client.economyHandler.formatCurrency(result.amount, config)}**!`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setFooter({ text: 'الجائزة التالية بعد 30 يوم' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'deposit': {
                    const amountStr = interaction.options.getString('amount', true);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const amount = amountStr.toLowerCase() === 'all' ? 'all' : parseInt(amountStr);
                    if (typeof amount === 'number' && isNaN(amount)) {
                        await interaction.editReply({ content: '❌ مبلغ غير صحيح' });
                        return;
                    }
                    const result = await client.economyHandler.deposit(interaction.guild, member, amount);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🏦 تم الإيداع بنجاح')
                        .setColor(discord_js_1.Colors.Green)
                        .addFields({ name: '💵 الرصيد', value: client.economyHandler.formatCurrency(result.balance, config), inline: true }, { name: '🏦 البنك', value: client.economyHandler.formatCurrency(result.bank, config), inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'withdraw': {
                    const amountStr = interaction.options.getString('amount', true);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const amount = amountStr.toLowerCase() === 'all' ? 'all' : parseInt(amountStr);
                    if (typeof amount === 'number' && isNaN(amount)) {
                        await interaction.editReply({ content: '❌ مبلغ غير صحيح' });
                        return;
                    }
                    const result = await client.economyHandler.withdraw(interaction.guild, member, amount);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🏦 تم السحب بنجاح')
                        .setColor(discord_js_1.Colors.Green)
                        .addFields({ name: '💵 الرصيد', value: client.economyHandler.formatCurrency(result.balance, config), inline: true }, { name: '🏦 البنك', value: client.economyHandler.formatCurrency(result.bank, config), inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'bank': {
                    const targetUser = interaction.options.getUser('user') || interaction.user;
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
                    if (!targetMember) {
                        await interaction.editReply({ content: '❌ المستخدم غير موجود' });
                        return;
                    }
                    const info = await client.economyHandler.bankInfo(interaction.guild, targetMember);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(`🏦 بنك ${targetUser.username}`)
                        .setColor(discord_js_1.Colors.Blue)
                        .addFields({ name: '💵 الرصيد', value: client.economyHandler.formatCurrency(info.balance, config), inline: true }, { name: '🏦 البنك', value: client.economyHandler.formatCurrency(info.bank, config), inline: true }, { name: '📈 الفائدة اليومية', value: client.economyHandler.formatCurrency(info.interest, config), inline: true })
                        .setThumbnail(targetUser.displayAvatarURL())
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'transfer': {
                    const targetUser = interaction.options.getUser('user', true);
                    const amount = interaction.options.getInteger('amount', true);
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
                    if (!targetMember) {
                        await interaction.editReply({ content: '❌ المستخدم غير موجود في السيرفر' });
                        return;
                    }
                    if (targetUser.id === member.id) {
                        await interaction.editReply({ content: '❌ لا يمكنك تحويل المال لنفسك' });
                        return;
                    }
                    if (targetUser.bot) {
                        await interaction.editReply({ content: '❌ لا يمكنك تحويل المال للبوتات' });
                        return;
                    }
                    const result = await client.economyHandler.transfer(interaction.guild, member, targetUser, amount);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('💸 تم التحويل بنجاح')
                        .setColor(discord_js_1.Colors.Green)
                        .setDescription(`أرسلت ${client.economyHandler.formatCurrency(amount, config)} إلى ${targetUser}`)
                        .addFields({ name: '💰 صافي المبلغ المستلم', value: client.economyHandler.formatCurrency(amount - result.tax, config), inline: true }, { name: '💸 الضريبة', value: client.economyHandler.formatCurrency(result.tax, config), inline: true }, { name: '💵 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'rob': {
                    const targetUser = interaction.options.getUser('user', true);
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
                    if (!targetMember) {
                        await interaction.editReply({ content: '❌ المستخدم غير موجود' });
                        return;
                    }
                    if (targetUser.id === member.id) {
                        await interaction.editReply({ content: '❌ لا يمكنك سرقة نفسك' });
                        return;
                    }
                    if (targetUser.bot) {
                        await interaction.editReply({ content: '❌ لا يمكنك سرقة البوتات' });
                        return;
                    }
                    const result = await client.economyHandler.rob(interaction.guild, member, targetUser);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🦹 نجحت السرقة!')
                        .setColor(discord_js_1.Colors.Red)
                        .setDescription(`سرقت **${client.economyHandler.formatCurrency(result.amount, config)}** من ${targetUser}`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setFooter({ text: 'يمكنك المحاولة مرة أخرى بعد ساعة' })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'coinflip': {
                    const amount = interaction.options.getInteger('amount', true);
                    const choice = interaction.options.getString('choice', true);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const result = await client.economyHandler.coinflip(interaction.guild, member, amount, choice);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(result.won ? '🎉 فزت!' : '😢 خسرت!')
                        .setColor(result.won ? discord_js_1.Colors.Green : discord_js_1.Colors.Red)
                        .setDescription(`العملة أظهرت: **${choice === 'heads' ? '🦅 رأس' : '🦁 ذيل'}**\n${result.won ? 'فزت بـ' : 'خسرت'} **${client.economyHandler.formatCurrency(Math.abs(result.amount), config)}**`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'dice': {
                    const amount = interaction.options.getInteger('amount', true);
                    const prediction = interaction.options.getString('prediction', true);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const result = await client.economyHandler.dice(interaction.guild, member, amount, prediction);
                    const predictionLabels = { high: '🔼 عالي (8-12)', low: '🔽 منخفض (2-6)', '7': '7️⃣ رقم 7' };
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(result.won ? '🎲 فزت!' : '🎲 خسرت!')
                        .setColor(result.won ? discord_js_1.Colors.Green : discord_js_1.Colors.Red)
                        .setDescription(`النرد أظهر: **${result.roll}**\nتوقعت: **${predictionLabels[prediction]}**\n${result.won ? 'فزت بـ' : 'خسرت'} **${client.economyHandler.formatCurrency(Math.abs(result.amount), config)}**`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'slots': {
                    const amount = interaction.options.getInteger('amount', true);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const result = await client.economyHandler.slots(interaction.guild, member, amount);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(result.won ? '🎰 جاكبوت!' : '🎰 خسارة!')
                        .setColor(result.won ? discord_js_1.Colors.Gold : discord_js_1.Colors.Red)
                        .setDescription(`**${result.reels.join(' | ')}**\n${result.won ? 'فزت بـ' : 'خسرت'} **${client.economyHandler.formatCurrency(Math.abs(result.amount), config)}**`)
                        .addFields({ name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'shop': {
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const shopItems = config.shopItems || [];
                    if (!config.shopEnabled) {
                        await interaction.editReply({ content: '❌ المتجر معطل' });
                        return;
                    }
                    if (shopItems.length === 0) {
                        await interaction.editReply({ content: '🛒 المتجر فارغ' });
                        return;
                    }
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🛒 المتجر')
                        .setColor(discord_js_1.Colors.Blue)
                        .setDescription('استخدم `/economy buy <item>` للشراء')
                        .setTimestamp();
                    for (const item of shopItems.slice(0, 10)) {
                        const role = interaction.guild.roles.cache.get(item.roleId);
                        embed.addFields({
                            name: `${item.emoji || '📦'} ${item.name} - ${client.economyHandler.formatCurrency(item.price, config)}`,
                            value: `${item.description || 'بدون وصف'}${role ? ` | يعطي رول: ${role}` : ''}`,
                            inline: true
                        });
                    }
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'buy': {
                    const itemId = interaction.options.getString('item', true);
                    const quantity = interaction.options.getInteger('quantity') || 1;
                    const result = await client.economyHandler.buyItem(interaction.guild, member, itemId, quantity);
                    const config = await client.economyHandler.getConfig(interaction.guild.id);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('🛍️ تم الشراء!')
                        .setColor(discord_js_1.Colors.Green)
                        .setDescription(`اشترت **${quantity}x ${result.item.name}**`)
                        .addFields({ name: '💰 التكلفة', value: client.economyHandler.formatCurrency(result.item.price * quantity, config), inline: true }, { name: '💰 رصيدك الجديد', value: client.economyHandler.formatCurrency(result.newBalance, config), inline: true })
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'inventory': {
                    const targetUser = interaction.options.getUser('user') || interaction.user;
                    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
                    if (!targetMember) {
                        await interaction.editReply({ content: '❌ المستخدم غير موجود' });
                        return;
                    }
                    const profile = await client.economyHandler.getProfile(interaction.guild.id, targetUser.id);
                    if (profile.inventory.length === 0) {
                        await interaction.editReply({ content: '🎒 المخزن فارغ' });
                        return;
                    }
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(`🎒 مخزن ${targetUser.username}`)
                        .setColor(discord_js_1.Colors.Blue)
                        .setTimestamp();
                    for (const item of profile.inventory.slice(0, 10)) {
                        embed.addFields({
                            name: `${item.name} x${item.quantity}`,
                            value: `${item.description || 'بدون وصف'}\nالسعر: ${item.price} | ${item.usable ? '✅ قابل للاستخدام' : '❌ غير قابل'}`,
                            inline: true
                        });
                    }
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'use': {
                    const itemId = interaction.options.getString('item', true);
                    const result = await client.economyHandler.useItem(interaction.guild, member, itemId);
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle('✅ تم الاستخدام')
                        .setColor(discord_js_1.Colors.Green)
                        .setDescription(result)
                        .setTimestamp();
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                case 'leaderboard': {
                    const type = interaction.options.getString('type') || 'total';
                    const limit = interaction.options.getInteger('limit') || 10;
                    const leaderboard = await client.economyHandler.getLeaderboard(interaction.guild, type, limit);
                    const typeLabels = { balance: '💵 الرصيد', bank: '🏦 البنك', total: '💎 الإجمالي', level: '⭐ المستوى' };
                    const embed = new discord_js_1.EmbedBuilder()
                        .setTitle(`🏆 المتصدرين - ${typeLabels[type]}`)
                        .setColor(discord_js_1.Colors.Gold)
                        .setTimestamp();
                    const lines = leaderboard.map((entry, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
                        const value = type === 'level' ? `Lv.${entry.level}` :
                            type === 'balance' ? entry.balance.toLocaleString() :
                                type === 'bank' ? entry.bank.toLocaleString() :
                                    (entry.balance + entry.bank).toLocaleString();
                        return `${medal} <@${entry.userId}> - **${value}**`;
                    });
                    embed.setDescription(lines.join('\n') || 'لا توجد بيانات');
                    await interaction.editReply({ embeds: [embed] });
                    break;
                }
                default:
                    await interaction.editReply({ content: '❌ أمر غير معروف' });
            }
        }
        catch (error) {
            logger.error(`Economy command error: ${error.message}`);
            await interaction.editReply({ content: `❌ ${error.message}` });
        }
    },
};
exports.default = economyCommand;
//# sourceMappingURL=economy.js.map