"use strict";
// ============================================
// Omni Bot - /project (إدارة متجر Omni)
// إدارة كاملة: بروجيكتات / بوتات / أدوات / رتب / خدمات / أخرى
// للمالك أو من يخوّله للإدارة
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const botOwner_1 = require("../../utils/botOwner");
const store_1 = require("../../utils/store");
/** سطر تعريف نوع العنصر */
function typeLine(type) {
    const meta = (0, store_1.storeTypeMeta)(type);
    return `${meta.emoji} ${meta.label}`;
}
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName('project')
        .setDescription('🛠️ إدارة متجر Omni — بروجيكتات وبوتات وأدوات ورتب وخدمات (للمالك والمخوّلين)')
        .setDMPermission(false)
        .addSubcommand((s) => s
        .setName('add')
        .setDescription('إضافة عنصر جديد للمتجر (بروجيكت / بوت / أداة / رتبة / خدمة / أخرى)')
        .addStringOption((o) => o.setName('name').setDescription('اسم العنصر').setRequired(true).setMaxLength(80))
        .addStringOption((o) => o
        .setName('price')
        .setDescription('السعر الصافي (مثال: 10m أو 10000000 أو 500k)')
        .setRequired(true)
        .setMaxLength(30))
        .addStringOption((o) => o
        .setName('type')
        .setDescription('نوع العنصر (الافتراضي: بروجيكت)')
        .setRequired(false)
        .addChoices(...store_1.STORE_TYPE_CHOICES))
        .addStringOption((o) => o.setName('description').setDescription('وصف مختصر يظهر في المتجر (اختياري)').setRequired(false).setMaxLength(120))
        .addStringOption((o) => o.setName('emoji').setDescription('إيموجي مخصص للعنصر (اختياري — مثال: 🤖)').setRequired(false).setMaxLength(60))
        .addStringOption((o) => o.setName('image').setDescription('رابط صورة/بانر للعنصر (اختياري)').setRequired(false).setMaxLength(400))
        .addIntegerOption((o) => o.setName('stock').setDescription('الكمية المتاحة (اتركها فارغة = غير محدود)').setRequired(false).setMinValue(0).setMaxValue(999999))
        .addRoleOption((o) => o.setName('role').setDescription('رول يتمنح للمشتري تلقائياً عند تأكيد التسليم (اختياري)').setRequired(false))
        .addStringOption((o) => o.setName('delivery-note').setDescription('ملاحظة تسليم تظهر للمشتري في الإيصال (اختياري)').setRequired(false).setMaxLength(200)))
        .addSubcommand((s) => s
        .setName('setprice')
        .setDescription('تعديل سعر عنصر')
        .addStringOption((o) => o.setName('name').setDescription('العنصر').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('price').setDescription('السعر الصافي الجديد (مثال: 10m)').setRequired(true).setMaxLength(30)))
        .addSubcommand((s) => s
        .setName('edit')
        .setDescription('تعديل عنصر (الاسم/النوع/السعر/الخصم/الإيموجي/الصورة/الكمية/الوصف)')
        .addStringOption((o) => o.setName('name').setDescription('العنصر').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('new-name').setDescription('اسم جديد (اختياري)').setRequired(false).setMaxLength(80))
        .addStringOption((o) => o
        .setName('type')
        .setDescription('تغيير نوع العنصر (اختياري)')
        .setRequired(false)
        .addChoices(...store_1.STORE_TYPE_CHOICES))
        .addStringOption((o) => o
        .setName('price')
        .setDescription('تعديل السعر الأساسي الصافي (مثال: 10m أو 10000000)')
        .setRequired(false)
        .setMaxLength(30))
        .addStringOption((o) => o
        .setName('discount')
        .setDescription('نسبة خصم (مثال: 25 أو 25% — 0 لإزالة الخصم)')
        .setRequired(false)
        .setMaxLength(10))
        .addStringOption((o) => o.setName('emoji').setDescription('إيموجي جديد للعنصر').setRequired(false).setMaxLength(60))
        .addBooleanOption((o) => o.setName('clear-emoji').setDescription('صح = مسح الإيموجي المخصص والرجوع لإيموجي النوع').setRequired(false))
        .addStringOption((o) => o.setName('image').setDescription('رابط صورة/بانر جديد').setRequired(false).setMaxLength(400))
        .addBooleanOption((o) => o.setName('clear-image').setDescription('صح = مسح صورة العنصر').setRequired(false))
        .addIntegerOption((o) => o.setName('stock').setDescription('الكمية المتاحة (0 = نفدت الكمية)').setRequired(false).setMinValue(0).setMaxValue(999999))
        .addBooleanOption((o) => o.setName('unlimited-stock').setDescription('صح = كمية غير محدودة').setRequired(false))
        .addStringOption((o) => o.setName('description').setDescription('وصف جديد (اختياري)').setRequired(false).setMaxLength(120))
        .addBooleanOption((o) => o.setName('clear-description').setDescription('مسح الوصف الحالي').setRequired(false))
        .addStringOption((o) => o.setName('delivery-note').setDescription('ملاحظة تسليم جديدة تظهر للمشتري').setRequired(false).setMaxLength(200))
        .addBooleanOption((o) => o.setName('clear-delivery-note').setDescription('مسح ملاحظة التسليم').setRequired(false))
        .addBooleanOption((o) => o.setName('enabled').setDescription('صحيح = تفعيل • خطأ = إيقاف مؤقت').setRequired(false)))
        .addSubcommand((s) => s
        .setName('duplicate')
        .setDescription('نسخ عنصر موجود باسم جديد (نفس النوع والسعر والوصف)')
        .addStringOption((o) => o.setName('name').setDescription('العنصر الأصلي').setRequired(true).setAutocomplete(true))
        .addStringOption((o) => o.setName('new-name').setDescription('اسم النسخة الجديدة').setRequired(true).setMaxLength(80)))
        .addSubcommand((s) => s
        .setName('remove')
        .setDescription('حذف عنصر من المتجر نهائياً')
        .addStringOption((o) => o.setName('name').setDescription('العنصر').setRequired(true).setAutocomplete(true)))
        .addSubcommand((s) => s
        .setName('list')
        .setDescription('عرض كل عناصر المتجر (حتى المعطلة) مع الإحصائيات'))
        .addSubcommand((s) => s
        .setName('stats')
        .setDescription('إحصائيات المبيعات والإيرادات حسب النوع'))
        .addSubcommand((s) => s
        .setName('config')
        .setDescription('إعدادات المتجر — الاسم/الوصف/المستلم/البادئة/الخصم/قناة السجل')
        .addStringOption((o) => o.setName('store-name').setDescription('اسم المتجر المعروض (مثال: متجر ليبرتي)').setRequired(false).setMaxLength(60))
        .addStringOption((o) => o.setName('store-description').setDescription('وصف/تعريف المتجر أعلى القائمة').setRequired(false).setMaxLength(400))
        .addBooleanOption((o) => o.setName('reset-branding').setDescription('صح = إرجاع اسم ووصف المتجر للافتراضي').setRequired(false))
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
        .setName('panel')
        .setDescription('نشر لوحة المتجر (واجهة الشراء الكاملة) في قناة بشكل عام')
        .addChannelOption((o) => o.setName('channel').setDescription('القناة (افتراضي: القناة الحالية)').setRequired(false))
        .addBooleanOption((o) => o.setName('preview').setDescription('صح = معاينة خاصة لك فقط بدون نشر في القناة').setRequired(false)))
        .addSubcommand((s) => s
        .setName('buy-role')
        .setDescription('ربط رول يتمنح تلقائياً للمشتري عند تأكيد استلام الدفع/التسليم (اتركه فارغاً لمسح الربط)')
        .addStringOption((o) => o.setName('name').setDescription('العنصر').setRequired(true).setAutocomplete(true))
        .addRoleOption((o) => o.setName('role').setDescription('الرول الذي يتمنح للمشتري — فارغ = مسح الربط').setRequired(false))
        .addBooleanOption((o) => o.setName('clear').setDescription('صح = مسح ربط الرول من العنصر').setRequired(false)))
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
                const meta = (0, store_1.storeTypeMeta)(p.type);
                return {
                    name: `${meta.emoji} ${p.name} — ${(0, store_1.formatShort)(effective)}${discount ? ` (-${discount}%)` : ''} كريديت`.slice(0, 100),
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
        // ---------- إضافة عنصر ----------
        if (sub === 'add') {
            const name = interaction.options.getString('name', true).trim();
            const priceText = interaction.options.getString('price', true);
            const type = (0, store_1.normalizeStoreType)(interaction.options.getString('type') || 'project');
            const description = interaction.options.getString('description')?.trim() || undefined;
            const emojiInput = interaction.options.getString('emoji')?.trim() || undefined;
            const imageInput = interaction.options.getString('image')?.trim() || undefined;
            const stock = (0, store_1.normalizeStock)(interaction.options.getInteger('stock') ?? undefined);
            const role = interaction.options.getRole('role');
            const deliveryNote = interaction.options.getString('delivery-note')?.trim() || undefined;
            const price = (0, store_1.parsePrice)(priceText);
            if (!price) {
                await interaction.reply({
                    content: '❌ السعر غير مفهوم. أمثلة صحيحة: `10m` • `500k` • `10000000` • `2 مليون`',
                    ephemeral: true,
                });
                return;
            }
            const emoji = emojiInput ? (0, store_1.normalizeItemEmoji)(emojiInput) : undefined;
            if (emojiInput && !emoji) {
                await interaction.reply({ content: '❌ الإيموجي غير صالح — استخدم إيموجي عادي أو `<:name:id>`.', ephemeral: true });
                return;
            }
            const imageUrl = imageInput ? (0, store_1.normalizeImageUrl)(imageInput) : undefined;
            if (imageInput && imageUrl === null) {
                await interaction.reply({ content: '❌ رابط الصورة غير صالح — لازم يبدأ بـ `http://` أو `https://`.', ephemeral: true });
                return;
            }
            if (role && role.id === interaction.guildId) {
                await interaction.reply({ content: '⛔ لا يمكن ربط رول @everyone كدور تسليم.', ephemeral: true });
                return;
            }
            const exists = (store.projects || []).some((p) => p.name.toLowerCase() === name.toLowerCase());
            if (exists) {
                await interaction.reply({
                    content: '❌ في عنصر بنفس الاسم مسبقاً — غيّر الاسم أو عدّل عبر `/project edit`',
                    ephemeral: true,
                });
                return;
            }
            const id = (0, store_1.shortId)(6);
            store.projects.push({
                id,
                name,
                type,
                description,
                price,
                discountPercent: 0,
                emoji,
                imageUrl: imageUrl || undefined,
                stock,
                deliveryRoleId: role?.id,
                deliveryNote,
                enabled: true,
                sales: 0,
                createdBy: interaction.user.id,
            });
            await store.save();
            const meta = (0, store_1.storeTypeMeta)(type);
            const transferPreview = store.payeeId
                ? (0, store_1.buildTransferCommand)(store.payeeId, (0, store_1.computeTransferAmount)(price, store.taxPercent ?? 5))
                : `#credit <payee_id> ${(0, store_1.computeTransferAmount)(price, store.taxPercent ?? 5)}`;
            await interaction.reply({
                content: `✅ تمت إضافة **${name}** إلى المتجر\n` +
                    `> ${meta.emoji} **النوع:** ${meta.label}\n` +
                    `> 💰 السعر الصافي: ${(0, store_1.priceLine)(price)} كريديت\n` +
                    (stock !== undefined ? `> 📦 الكمية: **${stock}**${stock === 0 ? ' (نفدت — المشترون مش هيقدروا يطلبوه)' : ''}\n` : '> 📦 الكمية: غير محدودة\n') +
                    (role ? `> 🏷️ رول التسليم: <@&${role.id}> (يتمنح تلقائياً عند تأكيد التسليم)\n` : '') +
                    `> 🧾 أمر التحويل الذي سيظهر للمشتري: \`${transferPreview}\` (بعد خصم ProBot ${store.taxPercent ?? 5}% يصلك الصافي كامل)\n` +
                    `> 🔑 المعرّف: \`${id}\`\n` +
                    '> 🏷️ لإضافة خصم لاحقاً: `/project edit name:... discount:25`\n' +
                    'العرض للمشترين: `/store` — أو انشر اللوحة بقناة عبر `/project panel`',
                ephemeral: true,
            });
            return;
        }
        // ---------- تعديل السعر ----------
        if (sub === 'setprice') {
            const name = interaction.options.getString('name', true);
            const price = (0, store_1.parsePrice)(interaction.options.getString('price', true));
            const project = (0, store_1.findProjectByName)(store, name);
            if (!project) {
                await interaction.reply({ content: '❌ لا يوجد عنصر بهذا الاسم — راجع `/project list`', ephemeral: true });
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
            const newType = interaction.options.getString('type');
            const priceText = interaction.options.getString('price');
            const discountText = interaction.options.getString('discount');
            const emojiInput = interaction.options.getString('emoji')?.trim();
            const clearEmoji = interaction.options.getBoolean('clear-emoji') ?? false;
            const imageInput = interaction.options.getString('image')?.trim();
            const clearImage = interaction.options.getBoolean('clear-image') ?? false;
            const stockInput = interaction.options.getInteger('stock');
            const unlimitedStock = interaction.options.getBoolean('unlimited-stock') ?? false;
            const description = interaction.options.getString('description')?.trim();
            const clearDescription = interaction.options.getBoolean('clear-description') ?? false;
            const deliveryNote = interaction.options.getString('delivery-note')?.trim();
            const clearDeliveryNote = interaction.options.getBoolean('clear-delivery-note') ?? false;
            const enabled = interaction.options.getBoolean('enabled');
            const project = (0, store_1.findProjectByName)(store, name);
            if (!project) {
                await interaction.reply({ content: '❌ لا يوجد عنصر بهذا الاسم — راجع `/project list`', ephemeral: true });
                return;
            }
            const changes = [];
            if (newName && newName !== project.name) {
                const clash = (store.projects || []).some((p) => p.id !== project.id && p.name.toLowerCase() === newName.toLowerCase());
                if (clash) {
                    await interaction.reply({ content: '❌ في عنصر آخر بنفس الاسم الجديد', ephemeral: true });
                    return;
                }
                changes.push(`الاسم: \`${project.name}\` ← \`${newName}\``);
                project.name = newName;
            }
            if (newType) {
                const normalized = (0, store_1.normalizeStoreType)(newType);
                const oldMeta = (0, store_1.storeTypeMeta)(project.type);
                project.type = normalized;
                changes.push(`النوع: ${oldMeta.label} ← ${(0, store_1.storeTypeMeta)(normalized).label}`);
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
            if (clearEmoji) {
                project.emoji = undefined;
                changes.push('الإيموجي: مُسح (إيموجي النوع)');
            }
            else if (emojiInput) {
                const emoji = (0, store_1.normalizeItemEmoji)(emojiInput);
                if (!emoji) {
                    await interaction.reply({ content: '❌ الإيموجي غير صالح — استخدم إيموجي عادي أو `<:name:id>`.', ephemeral: true });
                    return;
                }
                project.emoji = emoji;
                changes.push(`الإيموجي: ${emoji}`);
            }
            if (clearImage) {
                project.imageUrl = undefined;
                changes.push('الصورة: مُسحت');
            }
            else if (imageInput) {
                const imageUrl = (0, store_1.normalizeImageUrl)(imageInput);
                if (imageUrl === null) {
                    await interaction.reply({ content: '❌ رابط الصورة غير صالح — لازم يبدأ بـ `http://` أو `https://`.', ephemeral: true });
                    return;
                }
                project.imageUrl = imageUrl;
                changes.push('الصورة: حُدّثت 🖼️');
            }
            if (unlimitedStock) {
                project.stock = undefined;
                changes.push('الكمية: غير محدودة ♾️');
            }
            else if (stockInput !== null) {
                project.stock = (0, store_1.normalizeStock)(stockInput);
                changes.push(project.stock === 0
                    ? 'الكمية: 0 — نفدت الكمية ⛔'
                    : `الكمية: ${project.stock} 📦`);
            }
            if (clearDescription) {
                project.description = undefined;
                changes.push('الوصف: مُسح');
            }
            else if (description !== undefined) {
                project.description = description;
                changes.push('الوصف: حُدّث');
            }
            if (clearDeliveryNote) {
                project.deliveryNote = undefined;
                changes.push('ملاحظة التسليم: مُسحت');
            }
            else if (deliveryNote !== undefined) {
                project.deliveryNote = deliveryNote;
                changes.push('ملاحظة التسليم: حُدّثت');
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
                content: `✅ تم تعديل **${project.name}** (${typeLine(project.type)})\n` +
                    `> ${changes.join('\n> ')}\n${priceSummary}`,
                ephemeral: true,
            });
            return;
        }
        // ---------- نسخ عنصر ----------
        if (sub === 'duplicate') {
            const name = interaction.options.getString('name', true);
            const newName = interaction.options.getString('new-name', true).trim();
            const original = (0, store_1.findProjectByName)(store, name);
            if (!original) {
                await interaction.reply({ content: '❌ لا يوجد عنصر بهذا الاسم — راجع `/project list`', ephemeral: true });
                return;
            }
            if ((store.projects || []).some((p) => p.name.toLowerCase() === newName.toLowerCase())) {
                await interaction.reply({ content: '❌ في عنصر بنفس الاسم الجديد مسبقاً', ephemeral: true });
                return;
            }
            const copy = {
                id: (0, store_1.shortId)(6),
                name: newName,
                type: (0, store_1.normalizeStoreType)(original.type),
                description: original.description,
                price: original.price,
                discountPercent: original.discountPercent || 0,
                deliveryRoleId: original.deliveryRoleId,
                emoji: original.emoji,
                imageUrl: original.imageUrl,
                stock: original.stock,
                deliveryNote: original.deliveryNote,
                sales: 0,
                enabled: true,
                createdBy: interaction.user.id,
            };
            store.projects.push(copy);
            await store.save();
            await interaction.reply({
                content: `✅ تم نسخ **${original.name}** إلى **${newName}**\n` +
                    `> ${typeLine(copy.type)} • 💰 ${(0, store_1.priceLine)((0, store_1.getEffectivePrice)(copy))} • 🔑 \`${copy.id}\``,
                ephemeral: true,
            });
            return;
        }
        // ---------- حذف ----------
        if (sub === 'remove') {
            const name = interaction.options.getString('name', true);
            const idx = (store.projects || []).findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
            if (idx === -1) {
                await interaction.reply({ content: '❌ لا يوجد عنصر بهذا الاسم — راجع `/project list`', ephemeral: true });
                return;
            }
            const [removed] = store.projects.splice(idx, 1);
            await store.save();
            await interaction.reply({
                content: `🗑️ تم حذف **${removed.name}** من المتجر\n` +
                    `> ${typeLine(removed.type)} • 📊 مبيعاته السابقة: **${removed.sales || 0}** — المعرفات لم تعد صالحة للطلبات الجديدة`,
                ephemeral: true,
            });
            return;
        }
        // ---------- القائمة ----------
        if (sub === 'list') {
            const projects = store.projects || [];
            const enabled = projects.filter((p) => p.enabled).length;
            const disabled = projects.length - enabled;
            const totalSales = projects.reduce((sum, p) => sum + (p.sales || 0), 0);
            const revenue = projects.reduce((sum, p) => sum + (p.sales || 0) * (0, store_1.getEffectivePrice)(p), 0);
            const sections = [];
            for (const meta of store_1.STORE_TYPES) {
                const group = projects.filter((p) => (0, store_1.normalizeStoreType)(p.type) === meta.key);
                if (!group.length)
                    continue;
                sections.push(`**${meta.emoji} ${meta.plural}** — \`${group.length}\``);
                for (const p of group) {
                    const discount = (0, store_1.normalizeDiscountPercent)(p.discountPercent);
                    const priceText = discount ? (0, store_1.projectPriceLine)(p) : (0, store_1.priceLine)((0, store_1.getEffectivePrice)(p));
                    const stockText = p.stock === undefined ? '♾️' : p.stock === 0 ? '⛔ 0' : `📦 ${p.stock}`;
                    sections.push(`> ${p.enabled ? '🟢' : '⏸️'} ${(0, store_1.storeItemEmoji)(p)} **${p.name}** — 💰 ${priceText} | 📊 ${p.sales || 0} | ${stockText} | 🔑 \`${p.id}\`` +
                        (p.deliveryRoleId ? ` | 🏷️ <@&${p.deliveryRoleId}>` : ''));
                }
            }
            const perType = (0, store_1.storeTypeStats)(store)
                .map((s) => `${s.meta.emoji} ${s.meta.label}: **${s.total}** (مفعّل ${s.enabled})`)
                .join(' • ');
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xf59e0b)
                .setTitle(`📋 عناصر ${(0, store_1.getStoreName)(store)} — لوحة الإدارة`)
                .setDescription((sections.join('\n') || 'لا توجد عناصر بعد — أضف أول عنصر عبر `/project add`').slice(0, 4000))
                .addFields({ name: '📦 الإجمالي', value: `${projects.length} (مفعّل: ${enabled} • موقوف: ${disabled})`, inline: true }, { name: '🛒 المبيعات', value: `${totalSales} عملية`, inline: true }, { name: '💵 الإيرادات (صافي)', value: `${(0, store_1.formatCredits)(revenue)} كريديت`, inline: true }, { name: '🧩 الأنواع', value: perType || 'لا يوجد', inline: false }, {
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
        // ---------- الإحصائيات ----------
        if (sub === 'stats') {
            const projects = store.projects || [];
            const totalSales = projects.reduce((sum, p) => sum + (p.sales || 0), 0);
            const revenue = projects.reduce((sum, p) => sum + (p.sales || 0) * (0, store_1.getEffectivePrice)(p), 0);
            const typeLines = (0, store_1.storeTypeStats)(store)
                .map((s) => {
                const typeRevenue = (store.projects || [])
                    .filter((p) => (0, store_1.normalizeStoreType)(p.type) === s.meta.key)
                    .reduce((sum, p) => sum + (p.sales || 0) * (0, store_1.getEffectivePrice)(p), 0);
                return `> ${s.meta.emoji} **${s.meta.plural}:** ${s.sales} مبيعة • ${(0, store_1.formatCredits)(typeRevenue)} كريديت • ${s.enabled}/${s.total} مفعّل`;
            })
                .join('\n');
            const embed = new discord_js_1.EmbedBuilder()
                .setColor(0xf59e0b)
                .setTitle(`📊 إحصائيات ${(0, store_1.getStoreName)(store)}`)
                .setDescription(`> 🛒 إجمالي المبيعات: **${totalSales}** عملية\n` +
                `> 💵 إجمالي الإيرادات الصافية: **${(0, store_1.formatCredits)(revenue)}** كريديت\n\n` +
                (typeLines || '> لا توجد مبيعات بعد.'))
                .setTimestamp()
                .setFooter({ text: 'Omni Store • Stats' });
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }
        // ---------- الإعدادات ----------
        if (sub === 'config') {
            const storeName = interaction.options.getString('store-name')?.trim();
            const storeDescription = interaction.options.getString('store-description')?.trim();
            const resetBranding = interaction.options.getBoolean('reset-branding') ?? false;
            const payee = interaction.options.getUser('payee');
            const prefix = interaction.options.getString('probot-prefix')?.trim();
            const tax = interaction.options.getNumber('tax-percent');
            const logChannel = interaction.options.getChannel('log-channel');
            const changes = [];
            if (resetBranding) {
                store.name = undefined;
                store.description = undefined;
                changes.push('اسم ووصف المتجر ← الافتراضي');
            }
            else {
                if (storeName) {
                    store.name = storeName.slice(0, 60);
                    changes.push(`اسم المتجر ← **${store.name}**`);
                }
                if (storeDescription) {
                    store.description = storeDescription.slice(0, 400);
                    changes.push('وصف المتجر ← حُدّث');
                }
            }
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
                        `**الاسم:** ${(0, store_1.getStoreName)(store)}\n` +
                        `**الوصف:** ${(store.description || '').trim() || 'غير محدد'}\n` +
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
        // ---------- نشر لوحة المتجر ----------
        if (sub === 'panel') {
            const chosen = interaction.options.getChannel('channel');
            const preview = interaction.options.getBoolean('preview') ?? false;
            if (preview) {
                await interaction.reply({
                    embeds: [(0, store_1.buildStoreEmbed)(store)],
                    components: (0, store_1.buildStoreComponents)(store),
                    ephemeral: true,
                });
                return;
            }
            const target = chosen ?? interaction.channel;
            if (!target?.isTextBased?.()) {
                await interaction.reply({ content: '❌ القناة المحددة لا تدعم إرسال الرسائل.', ephemeral: true });
                return;
            }
            try {
                await target.send({
                    embeds: [(0, store_1.buildStoreEmbed)(store)],
                    components: (0, store_1.buildStoreComponents)(store),
                });
                await interaction.reply({
                    content: `✅ تم نشر لوحة المتجر في <#${target.id}> — الأعضاء يقدرون يشتروا منها مباشرة.`,
                    ephemeral: true,
                });
            }
            catch {
                await interaction.reply({
                    content: '❌ تعذر النشر — تأكد إن البوت عنده صلاحية إرسال الرسائل في القناة.',
                    ephemeral: true,
                });
            }
            return;
        }
        // ---------- ربط رول المشتري (تمنح تلقائياً عند تأكيد التسليم) ----------
        if (sub === 'buy-role') {
            const name = interaction.options.getString('name', true);
            const role = interaction.options.getRole('role');
            const clear = interaction.options.getBoolean('clear');
            const project = (0, store_1.findProjectByName)(store, name);
            if (!project) {
                await interaction.reply({ content: '❌ لا يوجد عنصر بهذا الاسم — راجع `/project list`', ephemeral: true });
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
                        : 'ℹ️ لا يوجد ربط رول لهذا العنصر حالياً.',
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