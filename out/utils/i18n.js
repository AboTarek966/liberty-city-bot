"use strict";
// ============================================
// Liberty City Bot - Internationalization (i18n)
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMON_TRANSLATIONS = exports.LOCALE_NAMES = exports.DEFAULT_LOCALE = exports.SUPPORTED_LOCALES = void 0;
exports.loadTranslations = loadTranslations;
exports.t = t;
exports.createTFunction = createTFunction;
exports.getLocaleFromSettings = getLocaleFromSettings;
exports.createLocaleSelectEmbed = createLocaleSelectEmbed;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// --------------------------------------------
// Supported Locales
// --------------------------------------------
exports.SUPPORTED_LOCALES = ['ar', 'en'];
exports.DEFAULT_LOCALE = 'ar';
// --------------------------------------------
// Translation Storage
// --------------------------------------------
const translations = new Map();
// --------------------------------------------
// Load Translations
// --------------------------------------------
function loadTranslations(localesDir = path_1.default.join(__dirname, '../locales')) {
    for (const locale of exports.SUPPORTED_LOCALES) {
        const filePath = path_1.default.join(localesDir, `${locale}.json`);
        if (fs_1.default.existsSync(filePath)) {
            try {
                const content = fs_1.default.readFileSync(filePath, 'utf-8');
                translations.set(locale, JSON.parse(content));
                console.log(`[i18n] Loaded ${locale} translations`);
            }
            catch (error) {
                console.error(`[i18n] Failed to load ${locale} translations:`, error);
            }
        }
        else {
            console.warn(`[i18n] Translation file not found: ${filePath}`);
        }
    }
}
// --------------------------------------------
// Get Translation
// --------------------------------------------
function t(locale, key, variables) {
    const dict = translations.get(locale) || translations.get(exports.DEFAULT_LOCALE);
    if (!dict)
        return key;
    const keys = key.split('.');
    let value = dict;
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        }
        else {
            return key;
        }
    }
    if (typeof value !== 'string')
        return key;
    // Replace variables
    if (variables) {
        return value.replace(/\{(\w+)\}/g, (match, varName) => {
            return variables[varName] !== undefined ? String(variables[varName]) : match;
        });
    }
    return value;
}
// --------------------------------------------
// Create T Function for Context
// --------------------------------------------
function createTFunction(locale) {
    return (key, variables) => t(locale, key, variables);
}
// --------------------------------------------
// Language Names
// --------------------------------------------
exports.LOCALE_NAMES = {
    ar: { native: 'العربية', english: 'Arabic', flag: '🇸🇦' },
    en: { native: 'English', english: 'English', flag: '🇺🇸' },
};
// --------------------------------------------
// Detect Locale from Guild Settings
// --------------------------------------------
function getLocaleFromSettings(settings) {
    if (settings.language && exports.SUPPORTED_LOCALES.includes(settings.language)) {
        return settings.language;
    }
    return exports.DEFAULT_LOCALE;
}
// --------------------------------------------
// Locale Selection Embed
// --------------------------------------------
function createLocaleSelectEmbed() {
    const fields = exports.SUPPORTED_LOCALES.map(locale => ({
        name: `${exports.LOCALE_NAMES[locale].flag} ${exports.LOCALE_NAMES[locale].native}`,
        value: exports.LOCALE_NAMES[locale].english,
        inline: true,
    }));
    return {
        title: '🌐 اختر اللغة / Select Language',
        description: 'اختر لغتك المفضلة للبوت\nChoose your preferred language for the bot',
        fields,
    };
}
// --------------------------------------------
// Common Translations (Fallback)
// --------------------------------------------
exports.COMMON_TRANSLATIONS = {
    ar: {
        common: {
            yes: 'نعم',
            no: 'لا',
            confirm: 'تأكيد',
            cancel: 'إلغاء',
            save: 'حفظ',
            delete: 'حذف',
            edit: 'تعديل',
            back: 'رجوع',
            next: 'التالي',
            previous: 'السابق',
            close: 'إغلاق',
            loading: 'جاري التحميل...',
            error: 'حدث خطأ',
            success: 'تم بنجاح',
            warning: 'تحذير',
            info: 'معلومات',
            enabled: 'مفعّل',
            disabled: 'معطّل',
            on: 'تشغيل',
            off: 'إيقاف',
            true: 'صحيح',
            false: 'خطأ',
            none: 'لا شيء',
            all: 'الكل',
            search: 'بحث',
            filter: 'تصفية',
            sort: 'ترتيب',
            page: 'صفحة',
            of: 'من',
            total: 'المجموع',
            count: 'العدد',
            time: 'الوقت',
            date: 'التاريخ',
            reason: 'السبب',
            duration: 'المدة',
            user: 'المستخدم',
            member: 'العضو',
            moderator: 'المشرف',
            admin: 'المدير',
            bot: 'البوت',
            server: 'السيرفر',
            channel: 'القناة',
            role: 'الرول',
            message: 'الرسالة',
            command: 'الأمر',
            permission: 'الصلاحية',
            settings: 'الإعدادات',
            configuration: 'التكوين',
            logs: 'السجلات',
            statistics: 'الإحصائيات',
        },
        errors: {
            noPermission: 'ليس لديك صلاحية لاستخدام هذا الأمر',
            botNoPermission: 'البوت لا يملك الصلاحيات الكافية',
            invalidInput: 'إدخال غير صحيح',
            notFound: 'غير موجود',
            alreadyExists: 'موجود بالفعل',
            cooldown: 'يرجى الانتظار قبل استخدام هذا الأمر مرة أخرى',
            generic: 'حدث خطأ غير متوقع',
            database: 'خطأ في قاعدة البيانات',
            api: 'خطأ في الاتصال بالخادم',
            timeout: 'انتهت مهلة الطلب',
            missingArgs: 'وسيطات مفقودة',
            invalidUser: 'مستخدم غير صالح',
            invalidChannel: 'قناة غير صالحة',
            invalidRole: 'رول غير صالح',
            invalidDuration: 'مدة غير صالحة',
            cannotModerateSelf: 'لا يمكنك إدارة نفسك',
            cannotModerateOwner: 'لا يمكنك إدارة مالك السيرفر',
            cannotModerateHigher: 'لا يمكنك إدارة شخص أعلى منك في الرتب',
            botCannotModerate: 'البوت لا يستطيع إدارة هذا العضو',
            hierarchyError: 'خطأ في التسلسل الهرمي للرتب',
        },
        time: {
            seconds: 'ثواني',
            minutes: 'دقائق',
            hours: 'ساعات',
            days: 'أيام',
            weeks: 'أسابيع',
            months: 'أشهر',
            years: 'سنوات',
            now: 'الآن',
            never: 'أبداً',
        },
    },
    en: {
        common: {
            yes: 'Yes',
            no: 'No',
            confirm: 'Confirm',
            cancel: 'Cancel',
            save: 'Save',
            delete: 'Delete',
            edit: 'Edit',
            back: 'Back',
            next: 'Next',
            previous: 'Previous',
            close: 'Close',
            loading: 'Loading...',
            error: 'Error',
            success: 'Success',
            warning: 'Warning',
            info: 'Info',
            enabled: 'Enabled',
            disabled: 'Disabled',
            on: 'On',
            off: 'Off',
            true: 'True',
            false: 'False',
            none: 'None',
            all: 'All',
            search: 'Search',
            filter: 'Filter',
            sort: 'Sort',
            page: 'Page',
            of: 'of',
            total: 'Total',
            count: 'Count',
            time: 'Time',
            date: 'Date',
            reason: 'Reason',
            duration: 'Duration',
            user: 'User',
            member: 'Member',
            moderator: 'Moderator',
            admin: 'Admin',
            bot: 'Bot',
            server: 'Server',
            channel: 'Channel',
            role: 'Role',
            message: 'Message',
            command: 'Command',
            permission: 'Permission',
            settings: 'Settings',
            configuration: 'Configuration',
            logs: 'Logs',
            statistics: 'Statistics',
        },
        errors: {
            noPermission: 'You do not have permission to use this command',
            botNoPermission: 'Bot does not have sufficient permissions',
            invalidInput: 'Invalid input',
            notFound: 'Not found',
            alreadyExists: 'Already exists',
            cooldown: 'Please wait before using this command again',
            generic: 'An unexpected error occurred',
            database: 'Database error',
            api: 'API connection error',
            timeout: 'Request timed out',
            missingArgs: 'Missing arguments',
            invalidUser: 'Invalid user',
            invalidChannel: 'Invalid channel',
            invalidRole: 'Invalid role',
            invalidDuration: 'Invalid duration',
            cannotModerateSelf: 'You cannot moderate yourself',
            cannotModerateOwner: 'You cannot moderate the server owner',
            cannotModerateHigher: 'You cannot moderate someone higher than you',
            botCannotModerate: 'Bot cannot moderate this member',
            hierarchyError: 'Role hierarchy error',
        },
        time: {
            seconds: 'seconds',
            minutes: 'minutes',
            hours: 'hours',
            days: 'days',
            weeks: 'weeks',
            months: 'months',
            years: 'years',
            now: 'now',
            never: 'never',
        },
    },
};
// --------------------------------------------
// Initialize with fallbacks if files not loaded
// --------------------------------------------
if (translations.size === 0) {
    translations.set('ar', exports.COMMON_TRANSLATIONS.ar);
    translations.set('en', exports.COMMON_TRANSLATIONS.en);
}
exports.default = {
    t,
    createTFunction,
    loadTranslations,
    getLocaleFromSettings,
    createLocaleSelectEmbed,
    SUPPORTED_LOCALES: exports.SUPPORTED_LOCALES,
    DEFAULT_LOCALE: exports.DEFAULT_LOCALE,
    LOCALE_NAMES: exports.LOCALE_NAMES,
    COMMON_TRANSLATIONS: exports.COMMON_TRANSLATIONS,
};
//# sourceMappingURL=i18n.js.map