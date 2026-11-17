"use strict";
// ============================================
// Omni Bot - /project (إدارة متجر البروجيكتات)
// للمالك أو من يخوّله للإدارة — أوامر الإضافة/التعديل/الحذف/الصلاحيات
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const botOwner_1 = require("../../utils/botOwner");
const store_1 = require("../../utils/store");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('project')
        .setDescription('🛠️ إدارة متجر البروجيكتات (للمالك والمخولين فقط)')
        .setDMPermission(false)
        .addSubcommand((s) => s
        .setName('add')
        .setDescription('إضافة بروجيكت جديد للمتجر')
        .addStringOption((o) => o.setName('name').setDescription('اسم البروجيكت').setRequired(true).setMaxLength(80))
        .addStringOption((o) => o
        .setName('price')
        .setDescription('السعر الصافي (مثال: 10m أو 10000000 أو 500k)')
        .setRequired(true)
        .setMaxLength(30))
        .addStringOption((o) => o.setName('description').setDescription('وصف مختصر (اختياري)').setRequired(false).setMaxLength(120)))
        .addSubcommand((s) => s
        .setName('setprice')
        .setDescription('تعديل سعر بروجيكت')
        .addStringOption((o) => o.setName('name').setDescription('البروجيكت').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('price').setDescription('السعر الصافي الجديد (مثال: 10m)').setRequired(true).setMaxLength(30)))
        .addSubcommand((s) => s
        .setName('edit')
        .setDescription('تعديل بروجيكت (الاسم/السعر/الخصم/الوصف/التفعيل)')
        .addStringOption((o) => o.setName('name').setDescription('البروجيكت').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('new-name').setDescription('اسم جديد (اختياري)').setRequired(false).setMaxLength(80))
        .addStringOption((o) => o
        .setName('price')
        .setDescription('تعديل السعر الأساسي الصافي (مثال: 10m أو 10000000)')
        .setRequired(false)
        .setMaxLength(30))
        .addStringOption((o) => o
        .setName('discount')
        .setDescription('نسبة خصم على البروجيكت (مثال: 25 أو 25% — 0 لإزالة الخصم)')
        .setRequired(false)
        .setMaxLength(10))
        .addStringOption((o) => o.setName('description').setDescription('وصف جديد (اختياري)').setRequired(false).setMaxLength(120))
        .addBooleanOption((o) => o.setName('clear-description').setDescription('مسح الوصف الحالي').setRequired(false))
        .addBooleanOption((o) => o.setName('enabled').setDescription('صحيح = تفعيل • خطأ = إيقاف مؤقت').setRequired(false)))
        .addSubcommand((s) => s
        .setName('remove')
        .setDescription('حذف بروجيكت من المتجر نهائياً')
        .addStringOption((o) => o.setName('name').setDescription('البروجيكت').setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s
        .setName('list')
        .setDescription('عرض كل البروجيكتات (حتى المعطلة) مع الإحصائيات'))
        .addSubcommand((s) => s
        .setName('stats')
        .setDescription('إحصائيات المبيعات والإيرادات'))
        .addSubcommand((s) => s
        .setName('config')
        .setDescription('إعدادات المتجر — المستلم/البادئة/الخصم/قناة السجل')
        .addUserOption((o) => o.setName('payee').setDescription('المستلم للتحويلات (عادة أنت)').setRequired(false))
        .addStringOption((o) => o.setName('probot-prefix').setDescription('بادئة ProBot (الافتراضي !)').setRequired(false).setMaxLength(8))
        .addNumberOption((o) => o
        .setName('tax-percent')
        .setDescription('نسبة خصم ProBot (0–25، الافتراضي 5)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(25))
        .addChannelOption((o) => o.setName('log-channel').setDescription('قناة سجل الطلبات (اختياري — وإلا تصل للبائع خاص)').setRequired(false)))
        .addSubcommand((s) => s
        .setName('buy-role')
        .setDescription('ربط رول يتمنح تلقائياً للمشتري عند تأكيد استلام الدفع/التسليم (اتركه فارغاً لمسح الربط)')
        .addStringOption((o) => o
        .setName('name')
        .setDescription('البروجيكت')
        .setRequired(true)
        .setAutocomplete(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرول الذي يتمنح للمشتري — فارغ = مسح الربط').setRequired(false))
        .addBooleanOption((o) => o.setName('clear').setDescription('صح = مسح ربط الرول من البروجيكت').setRequired(false)))
        .addSubcommand((s) => s
        .setName('manager-add')
        .setDescription('إضافة عضو يدير المتجر نيابةً عنك')
        .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true)))
        .addSubcommand((s) => s
        .setName('manager-remove')
        .setDescription('إزالة عضو من إدارة المتجر')
        .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true)))
        .addSubcommand((s) => s
        .setName('manager-list')
        .setDescription('عرض المخولين بإدارة المتجر')),
    cooldown: 5,
    // 🚦 لا يُسجل عالمياً: حد ديسكورد 100 أمر — مثل /dismiss يُسجل لكل سيرفر على حدة
    guildOnly: true,
    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused(true);
            if (focused.name !== 'name')
                return;
            const store = await (0, store_1.getStore)(false);
            if (!store)
                return interaction.respond([]);
            const q = String(focused.value || '').toLowerCase();
            const matches = (store.projects || [])
                .filter((p) => !q || p.name.toLowerCase().includes(q))
                .slice(0, 25)
                .map((p) => {
                const discount = (0, store_1.normalizeDiscountPercent)(p.discountPercent);
                const effective = (0, store_1.getEffectivePrice)(p);
                return {
                    name: `${p.name} — ${(0, store_1.formatShort)(effective)}${discount ? ` (-${discount}%)` : ''} كريديت`.slice(0, 100),
                    value: p.name,
                };
            });
            await interaction.respond(matches);
        }
        catch {
            try {
                await interaction.respond([]);
            }
            catch {
                /* تجاهل */
            }
        }
    },
    async execute(interaction) {
        const client = interaction.client;
        const isOwner = await (0, botOwner_1.isBotOwner)(client, interaction.user.id);
        const store = await (0, store_1.getStore)();
        if (!store) {
            await interaction.reply({ content: '❌ تعذر فتح المتجر حالياً', ephemeral: true });
            return;
        }
        const isManager = (store.managerIds || []).includes(interaction.user.id);
        if (!isOwner && !isManager) {
            await interaction.reply({
                content: '⛔ هذا الأمر لمالك البوت أو من يخوّله إدارة المتجر فقط.\n' +
                    '> لو تبي أحد يدير المتجر معك: `/project manager-add @العضو`',
                ephemeral: true,
            });
            return;
        }
        const sub = interaction.options.getSubcommand();
        // ---------- إضافة بروجيكت ----------
        if (sub === 'add') {
            const name = interaction.options.getString('name', true).trim();
            const priceText = interaction.options.getString('price', true);
            const description = interaction.options.getString('description')?.trim() || undefined;
            const price = (0, store_1.parsePrice)(priceText);
            if (!price) {
                await interaction.reply({
                    content: '❌ السعر غير مفهوم. أمثلة صحيحة: `10m` • `500k` • `10000000` • `2 مليون`',
                    ephemeral: true,
                });
                return;
            }
            const exists = (store.projects || []).some((p) => p.name.toLowerCase() === name.toLowerCase());
            if (exists) {
                await interaction.reply({ content: '❌ في بروجيكت بنفس الاسم مسبقاً — غيّر الاسم أو عدّل السعر عبر `/project setprice`', ephemeral: true });
                return;
            }
            const id = (0, store_1.shortId)(6);
            store.projects.push({
                id,
                name,
                description,
                price,
                discountPercent: 0,
                enabled: true,
                sales: 0,
                createdBy: interaction.user.id,
            });
            await store.save();
            const transferPreview = store.payeeId
                ? (0, store_1.buildTransferCommand)(store.payeeId, (0, store_1.computeTransferAmount)(price, store.taxPercent ?? 5))
                : `#credit <payee_id> ${(0, store_1.computeTransferAmount)(price, store.taxPercent ?? 5)}`;
            await interaction.reply({
                content: `✅ تمت إضافة **${name}** إلى المتجر\n` +
                    `> 💰 السعر الصافي: ${(0, store_1.priceLine)(price)} كريديت\n` +
                    `> 🧾 أمر التحويل الذي سيظهر للمشتري: \`${transferPreview}\` (بعد خصم ProBot ${store.taxPercent ?? 5}% يصلك الصافي كامل)\n` +
                    '> 🏷️ لإضافة خصم لاحقاً: `/project edit name:... discount:25`\n' +
                    'الظهور للمشترين: `/store` أو اختصار علياس.',
                ephemeral: true,
            });
            return;
        }
        // ---------- تعديل السعر ----------
        if (sub === 'setprice') {
            const name = interaction.options.getString('name', true);
            const price = (0, store_1.parsePrice)(interaction.options.getString('price', true));
            const project = (store.projects || []).find((p) => p.name.toLowerCase() === name.toLowerCase());
            if (!project) {
                await interaction.reply({ content: '❌ لا يوجد بروجيكت بهذا الاسم — راجع `/project list`', ephemeral: true });
                return;
            }
            if (!price) {
                await interaction.reply({ content: '❌ السعر غير مفهوم. أمثلة: `10m` • `500k` • `10000000`', ephemeral: true });
                return;
            }
            const oldPrice = project.price;
            project.price = price;
            await store.save();
            const discount = (0, store_1.normalizeDiscountPercent)(project.discountPercent);
            const effective = (0, store_1.getEffectivePrice)(project);
            await interaction.reply({
                content: `✅ السعر الأساسي لـ **${project.name}** صار ${(0, store_1.priceLine)(price)} (كان ${(0, store_1.priceLine)(oldPrice)})` +
                    (discount ? `\n> 🏷️ خصم قائم: ${discount}% — السعر الفعلي الآن ${(0, store_1.priceLine)(effective)}` : ''),
                ephemeral: true,
            });
            return;
        }
        // ---------- تعديل عام ----------
        if (sub === 'edit') {
            const name = interaction.options.getString('name', true);
            const newName = interaction.options.getString('new-name')?.trim();
            const priceText = interaction.options.getString('price');
            const discountText = interaction.options.getString('discount');
            const description = interaction.options.getString('description')?.trim();
            const clearDescription = interaction.options.getBoolean('clear-description') ?? false;
            const enabled = interaction.options.getBoolean('enabled');
            const project = (store.projects || []).find((p) => p.name.toLowerCase() === name.toLowerCase());
            if (!project) {
                await interaction.reply({ content: '❌ لا يوجد بروجيكت بهذا الاسم — راجع `/project list`', ephemeral: true });
                return;
            }
            const changes = [];
            if (newName && newName !== project.name) {
                const clash = (store.projects || []).some((p) => p.id !== project.id && p.name.toLowerCase() === newName.toLowerCase());
                if (clash) {
                    await interaction.reply({ content: '❌ في بروجيكت آخر بنفس الاسم الجديد', ephemeral: true });
                    return;
                }
                changes.push(`الاسم: \`${project.name}\` ← \`${newName}\``);
                project.name = newName;
            }
            if (priceText !== null) {
                const parsed = (0, store_1.parsePrice)(priceText);
                if (!parsed) {
                    await interaction.reply({
                        content: '❌ السعر غير مفهوم. أمثلة: `10m` • `500k` • `10000000` • `2 مليون`',
                        ephemeral: true,
                    });
                    return;
                }
                const old = project.price;
                project.price = parsed;
                changes.push(`السعر الأساسي: ${(0, store_1.priceLine)(old)} ← ${(0, store_1.priceLine)(parsed)}`);
            }
            if (discountText !== null) {
                const parsedDiscount = (0, store_1.parseDiscountPercent)(discountText);
                if (parsedDiscount === null) {
                    await interaction.reply({
                        content: '❌ نسبة الخصم غير مفهومة. أمثلة: `25` • `25%` • `%25` • `0` لإزالة الخصم',
                        ephemeral: true,
                    });
                    return;
                }
                const oldDiscount = (0, store_1.normalizeDiscountPercent)(project.discountPercent);
                project.discountPercent = parsedDiscount;
                if (parsedDiscount === 0) {
                    changes.push(oldDiscount ? `الخصم: ${oldDiscount}% ← بدون خصم` : 'الخصم: بدون خصم');
                }
                else {
                    changes.push(`الخصم: ${oldDiscount ? `${oldDiscount}%` : 'بدون'} ← ${parsedDiscount}%`);
                }
            }
            if (clearDescription) {
                project.description = undefined;
                changes.push('الوصف: مُسح');
            }
            else if (description !== undefined) {
                project.description = description;
                changes.push('الوصف: حُسّن');
            }
            if (enabled !== null) {
                project.enabled = enabled;
                changes.push(`الحالة: ${enabled ? 'مفعّل ✅' : 'موقوف ⏸️'}`);
            }
            if (!changes.length) {
                await interaction.reply({ content: 'ℹ️ لم تعطِ أي تعديل — استخدم الخيارات المتاحة', ephemeral: true });
                return;
            }
            await store.save();
            const effective = (0, store_1.getEffectivePrice)(project);
            const discount = (0, store_1.normalizeDiscountPercent)(project.discountPercent);
            const priceSummary = discount
                ? `> 💰 السعر الآن: ${(0, store_1.projectPriceLine)(project)} (صافي فعلي: ${(0, store_1.priceLine)(effective)})`
                : `> 💰 السعر الآن: ${(0, store_1.priceLine)(effective)}`;
            await interaction.reply({
                content: `✅ تم تعديل **${project.name}**\n> ${changes.join('\n> ')}\n${priceSummary}`,
                ephemeral: true,
            });
            return;
        }
        // ---------- حذف ----------
        if (sub === 'remove') {
            const name = interaction.options.getString('name', true);
            const idx = (store.projects || []).findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
            if (idx === -1) {
                await interaction.reply({ content: '❌ لا يوجد بروجيكت بهذا الاسم — راجع `/project list`', ephemeral: true });
                return;
            }
            const [removed] = store.projects.splice(idx, 1);
            await store.save();
            await interaction.reply({
                content: `🗑️ تم حذف **${removed.name}** من المتجر\n` +
                    `> 📊 مبيعاته السابقة: **${removed.sales || 0}** — المعرفات لم تعد صالحة للطلبات الجديدة`,
                ephemeral: true,
            });
            return;
        }
        // ---------- القائمة ----------
        if (sub === 'list' || sub === 'stats') {
            const projects = store.projects || [];
            const enabled = projects.filter((p) => p.enabled).length;
            const disabled = projects.length - enabled;
            const totalSales = projects.reduce((sum, p) => sum + (p.sales || 0), 0);
            const revenue = projects.reduce((sum, p) => sum + (p.sales || 0) * (0, store_1.getEffectivePrice)(p), 0);
            const lines = projects.length
                ? projects
                    .map((p, i) => {
                    const discount = (0, store_1.normalizeDiscountPercent)(p.discountPercent);
                    const priceText = discount
                        ? `${(0, store_1.projectPriceLine)(p)}`
                        : (0, store_1.priceLine)((0, store_1.getEffectivePrice)(p));
                    return `**${i + 1}.** ${p.enabled ? '🟢' : '⏸️'} **${p.name}** — 💰 ${priceText} | 📊 ${p.sales || 0} مبيعة | 🔑 \`${p.id}\`${p.deliveryRoleId ? ` | 🏷️ <@&${p.deliveryRoleId}>` : ''}`;
                })
                    .join('\n')
                : 'لا توجد بروجيكتات بعد.';
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xf59e0b)
                .setTitle('📋 قائمة البروجيكتات — Omni Store')
                .setDescription(lines)
                .addFields({ name: '📦 الإجمالي', value: `${projects.length} (مفعّل: ${enabled} • موقوف: ${disabled})`, inline: true }, { name: '🛒 المبيعات', value: `${totalSales} عملية`, inline: true }, { name: '💵 الإيرادات (صافي)', value: `${(0, store_1.formatCredits)(revenue)} كريديت`, inline: true }, {
                name: '⚙️ الإعدادات',
                value: `> المستلم: ${store.payeeId ? `<@${store.payeeId}>` : 'غير محدد'} • البادئة: \`${store.probotPrefix || '!'}\` • خصم ProBot: ${store.taxPercent ?? 5}%\n` +
                    `> قناة السجل: ${store.logChannelId ? `<#${store.logChannelId}>` : 'غير محددة (الطلبات تروح للبائع خاص)'}\n` +
                    `> المدراء: ${(store.managerIds || []).length ? (store.managerIds || []).map((id) => `<@${id}>`).join('، ') : 'لا أحد'}`,
                inline: false,
            })
                .setTimestamp()
                .setFooter({ text: 'Omni Store • Admin' });
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        // ---------- الإعدادات ----------
        if (sub === 'config') {
            const payee = interaction.options.getUser('payee');
            const prefix = interaction.options.getString('probot-prefix')?.trim();
            const tax = interaction.options.getNumber('tax-percent');
            const logChannel = interaction.options.getChannel('log-channel');
            const changes = [];
            if (payee) {
                store.payeeId = payee.id;
                changes.push(`المستلم ← <@${payee.id}>`);
            }
            if (prefix) {
                store.probotPrefix = prefix.slice(0, 8);
                changes.push(`البادئة ← \`${store.probotPrefix}\``);
            }
            if (tax !== null && tax !== undefined) {
                store.taxPercent = tax;
                changes.push(`نسبة خصم ProBot ← ${tax}%`);
            }
            if (logChannel) {
                store.logChannelId = logChannel.id;
                changes.push(`قناة السجل ← <#${logChannel.id}>`);
            }
            if (!changes.length) {
                await interaction.reply({
                    content: 'ℹ️ ما اعطيت أي إعداد.\n' +
                        `المستلم الحالي: ${store.payeeId ? `<@${store.payeeId}>` : 'غير محدد'} • البادئة: \`${store.probotPrefix || '!'}\` • الخصم: ${store.taxPercent ?? 5}%\n` +
                        `قناة السجل: ${store.logChannelId ? `<#${store.logChannelId}>` : 'غير محددة'}`,
                    ephemeral: true,
                });
                return;
            }
            await store.save();
            await interaction.reply({ content: `✅ تم تحديث إعدادات المتجر\n> ${changes.join('\n> ')}`, ephemeral: true });
            return;
        }
        // ---------- ربط رول المشتري (تمنح تلقائياً عند تأكيد التسليم) ----------
        if (sub === 'buy-role') {
            const name = interaction.options.getString('name', true);
            const role = interaction.options.getRole('role');
            const clear = interaction.options.getBoolean('clear');
            const project = (store.projects || []).find((p) => p.name.toLowerCase() === name.toLowerCase());
            if (!project) {
                await interaction.reply({ content: '❌ لا يوجد بروجيكت بهذا الاسم — راجع `/project list`', ephemeral: true });
                return;
            }
            const current = project.deliveryRoleId;
            if (clear || !role) {
                if (project.deliveryRoleId)
                    project.deliveryRoleId = undefined;
                await store.save();
                await interaction.reply({
                    content: current
                        ? `✅ أُزيل ربط الرول عن **${project.name}** — لن يتمنح أي رول للمشترين الجدد تلقائياً.`
                        : 'ℹ️ لا يوجد ربط رول لهذا البروجيكت حالياً.',
                    ephemeral: true,
                });
                return;
            }
            if (role.id === interaction.guildId) {
                await interaction.reply({ content: '⛔ لا يمكن ربط رول @everyone كدور تسليم.', ephemeral: true });
                return;
            }
            project.deliveryRoleId = role.id;
            await store.save();
            await interaction.reply({
                content: `✅ ربطنا رول <@&${role.id}> بـ **${project.name}**\n` +
                    `> 🏷️ المشتري هيتاخد الرول تلقائياً لحظة تأكيدك استلام الدفع/التسليم من زر **تم التسليم والاستلام**.`,
                ephemeral: true,
            });
            return;
        }
        // ---------- المخولين ----------
        if (sub === 'manager-add' || sub === 'manager-remove' || sub === 'manager-list') {
            if (sub === 'manager-add') {
                const user = interaction.options.getUser('user', true);
                if (await (0, botOwner_1.isBotOwner)(client, user.id)) {
                    await interaction.reply({ content: 'ℹ️ هذا العضو مالك البوت أصلاً — عنده كل الصلاحيات', ephemeral: true });
                    return;
                }
                const list = store.managerIds || [];
                if (list.includes(user.id)) {
                    await interaction.reply({ content: 'ℹ️ هذا العضو مدير مسبقاً', ephemeral: true });
                    return;
                }
                list.push(user.id);
                store.managerIds = list;
                await store.save();
                await interaction.reply({
                    content: `✅ <@${user.id}> صار يدير المتجر — يقدر يضيف/يعدل/يحذف ويستلم الطلبات`,
                    ephemeral: true,
                });
                return;
            }
            if (sub === 'manager-remove') {
                const user = interaction.options.getUser('user', true);
                const list = (store.managerIds || []).filter((id) => id !== user.id);
                const changed = list.length !== (store.managerIds || []).length;
                store.managerIds = list;
                await store.save();
                await interaction.reply({
                    content: changed
                        ? `✅ <@${user.id}> لم يعد يدير المتجر`
                        : 'ℹ️ هذا العضو مو مدير أصلاً',
                    ephemeral: true,
                });
                return;
            }
            const list = store.managerIds || [];
            const owners = process.env.OWNER_ID
                ? [process.env.OWNER_ID]
                : process.env.DEVELOPER_USER_ID
                    ? [process.env.DEVELOPER_USER_ID]
                    : [];
            await interaction.reply({
                content: `👥 **مدراء المتجر**\n` +
                    `> 👑 المالك: ${owners.length ? owners.map((id) => `<@${id}>`).join('، ') : 'مش مضبوط'}\n` +
                    `> 🛡️ المخولون: ${list.length ? list.map((id) => `<@${id}>`).join('، ') : 'لا أحد'}\n` +
                    '> استخدم `/project manager-add @العضو` للإضافة و`manager-remove` للإزالة',
                ephemeral: true,
            });
            return;
        }
    },
};
exports.default = command;
//# sourceMappingURL=project.js.map