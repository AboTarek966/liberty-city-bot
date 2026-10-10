# 🏙️ Liberty City Bot

<div align="center">

![Liberty City Banner](https://img.shields.io/badge/Liberty%20City-Bot-blue?style=for-the-badge&logo=discord)

**بوت ديسكورد شامل ومتكامل مع حماية متقدمة، نظام تكتات، ذكاء اصطناعي، وإعدادات متقدمة**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14-blue?style=flat-square&logo=discord)](https://discord.js.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.x-green?style=flat-square&logo=mongodb)](https://mongodb.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## ✨ المميزات الرئيسية

### 🛡️ نظام الحماية المتقدم
- **Anti-Raid** - حماية ضد الغارات والهجمات المفاجئة
- **Anti-Spam** - منع الرسائل المزعجة
- **Anti-Link** - منع الروابط غير المصرح بها
- **Anti-Invite** - منع دعوات ديسكورد
- **Anti-Mention** - منع المنشنز الجماعي
- **Anti-Caps** - منع الأحرف الكبيرة
- **Anti-Emoji** - منع سبام الإيموجي
- **Zalgo Protection** - حماية من نصوص Zalgo
- **AutoMod** - كلمات محظورة تلقائية

### 🎫 نظام التذاكر الشامل
- إنشاء تكتات بضغطة زر
- لوحات تكتات قابلة للتخصيص
- نظام استلام التكتات
- نسخ محادثات التكتات
- إحصائيات التكتات
- فئات ورولات دعم مخصصة

### 🤖 الذكاء الاصطناعي (AI)
- محادثة مع GPT-4 و Claude
- استجابة فورية وذكية
- سجل محادثات كامل
- إعدادات متقدمة لكل سيرفر
- كولداون لمنع الإساءة

### ⚙️ الإعدادات المتقدمة
- إعدادات ترحيب مخصصة
- إعدادات مغادرة
- نظام سجلات شامل
- نظام مستويات (Leveling)
- أوامر مخصصة
- تاقات (Tags)
- رولات تفاعلية

### 🛠️ أوامر الموديريشن
- حظر/طرد/كتم/تحذير
- نظام قضايا (Cases)
- تحذيرات تلقائية
- مهلات زمنية
- مسح الرسائل
- سجل تدقيق كامل

---

## 📦 التثبيت

### المتطلبات
- Node.js 18 أو أعلى
- MongoDB 7 أو أعلى
- Discord Bot Token
- مفتاح OpenAI أو Anthropic (اختياري)

### الخطوات

1. **استنساخ المشروع**
```bash
git clone https://github.com/yourusername/liberty-city-bot.git
cd liberty-city-bot
```

2. **تثبيت التبعيات**
```bash
npm install
```

3. **إعداد المتغيرات البيئية**
```bash
cp .env.example .env
```

ثم افتح ملف `.env` واملأ القيم المطلوبة:
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
MONGODB_URI=mongodb://localhost:27017/liberty-city
OPENAI_API_KEY=your_openai_key  # اختياري
```

4. **بناء المشروع**
```bash
npm run build
```

5. **تسجيل الأوامر**
```bash
npm run register:commands
```

6. **تشغيل البوت**
```bash
npm start
```

---

## 🚀 التطوير

### وضع التطوير
```bash
npm run dev
```

### إعادة تسجيل الأوامر
```bash
npm run register:commands
```

### بناء وتشغيل
```bash
npm run deploy
```

---

## 📁 هيكل المشروع

```
liberty-city-bot/
├── src/
│   ├── commands/           # الأوامر
│   │   ├── ai/            # أوامر الذكاء الاصطناعي
│   │   ├── info/          # أوامر المعلومات
│   │   ├── moderation/    # أوامر الموديريشن
│   │   ├── protection/    # أوامر الحماية
│   │   ├── settings/      # أوامر الإعدادات
│   │   ├── tickets/       # أوامر التكتات
│   │   └── utility/       # أوامر مساعدة
│   ├── config/            # إعدادات البوت
│   ├── events/            # أحداث ديسكورد
│   ├── handlers/          # معالجات
│   ├── locales/           # ملفات الترجمة
│   ├── models/            # نماذج قاعدة البيانات
│   ├── types/             # تعريفات TypeScript
│   ├── utils/             # أدوات مساعدة
│   ├── LibertyClient.ts   # العميل الرئيسي
│   └── index.ts           # نقطة البداية
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 📚 الأوامر

### 🔒 الحماية
| الأمر | الوصف |
|-------|-------|
| `/protection status` | عرض حالة الحماية |
| `/protection antiraid` | إعداد مضاد الغارات |
| `/protection antispam` | إعداد مضاد السبام |
| `/protection antilink` | إعداد مضاد الروابط |
| `/protection antiinvite` | إعداد مضاد الدعوات |

### 🛡️ الموديريشن
| الأمر | الوصف |
|-------|-------|
| `/ban` | حظر عضو |
| `/kick` | طرد عضو |
| `/timeout` | كتم مؤقت |
| `/warn` | تحذير عضو |
| `/purge` | مسح رسائل |

### 🎫 التكتات
| الأمر | الوصف |
|-------|-------|
| `/ticket setup` | إعداد نظام التكتات |
| `/ticket panel` | إنشاء لوحة تكتات |
| `/ticket close` | إغلاق التذكرة |
| `/ticket claim` | استلام التذكرة |
| `/ticket stats` | إحصائيات التكتات |

### ⚙️ الإعدادات
| الأمر | الوصف |
|-------|-------|
| `/settings view` | عرض الإعدادات |
| `/settings prefix` | تغيير البادئة |
| `/settings language` | تغيير اللغة |
| `/settings welcome` | إعدادات الترحيب |
| `/settings leave` | إعدادات المغادرة |
| `/settings logging` | إعدادات السجلات |

### 🤖 الذكاء الاصطناعي
| الأمر | الوصف |
|-------|-------|
| `/ai chat` | محادثة مع AI |
| `/ai ask` | طرح سؤال |
| `/ai clear` | مسح السجل |
| `/ai info` | معلومات النظام |
| `/ai config` | إعدادات AI |

### ℹ️ المعلومات
| الأمر | الوصف |
|-------|-------|
| `/help` | عرض جميع الأوامر |
| `/userinfo` | معلومات عضو |
| `/serverinfo` | معلومات السيرفر |
| `/ping` | سرعة الاستجابة |
| `/avatar` | صورة الأفاتار |

---

## 🌐 الترجمة

يدعم البوت لغتين:
- 🇸🇦 **العربية** (افتراضية)
- 🇺🇸 **English**

يمكن تغيير اللغة من `/settings language`

---

## 🔧 الإعداد المتقدم

### إعداد MongoDB Atlas
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/liberty-city
```

### إعداد OpenAI
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_TEMPERATURE=0.7
```

### إعداد Anthropic (Claude)
```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-opus-20240229
```

---

## 📊 قاعدة البيانات

يستخدم البوت MongoDB مع Mongoose لتخزين:
- إعدادات السيرفرات
- سجل التكتات
- سجل الموديريشن
- تحذيرات الأعضاء
- ملفات المستخدمين
- سجل محادثات AI

---

## 🤝 المساهمة

نرحّب بالمساهمات! يرجى:
1. فتح Issue
2. إنشاء Pull Request
3. وصف التغييرات بوضوح

---

## 📄 الرخصة

هذا المشروع مرخص تحت رخصة MIT - انظر ملف LICENSE للتفاصيل.

---

## 🙏 شكراً

بواسطة **Liberty City Team**

---

<div align="center">

**⭐ إذا أعجبك المشروع، يرجى إعطائه نجمة! ⭐**

</div>