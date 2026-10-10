# 🚀 دليل النشر على Fly.io — استضافة مجانية 24/7

بهذا الدليل يشتغل البوت على سيرفرات مجانية **دوم** — حتى لو أغلقت لابتوبيك أو أطفأت الجهاز.

---

## ماذا تحتاج مرة واحدة فقط

1. **حساب Fly.io** — سجّل من: https://fly.io/app/signup (ببريدك أو GitHub)
2. **تثبيت أداة Fly** — افتح PowerShell ونفّذ:
   ```powershell
   iwr https://fly.io/install.ps1 -useb | iex
   ```
3. **تسجيل الدخول** (يفتح متصفح للتفويض):
   ```powershell
   fly auth login
   ```

---

## النشر (من داخل مجلد liberty-city-bot)

**الخطوة 1 — إنشاء التطبيق** (اختر أي منطقة قريبة منك، مثل `ams` أمستردام):
```powershell
cd "C:\Users\Ahmad\Documents\المشروع الافتراضي\liberty-city-bot"
fly launch --copy-config --no-deploy
```
- إذا سأل عن Dockerfile: اختر استخدام الموجود ✅
- إذا سأل عن HTTP: اختر **لا** (البوت ليس موقع ويب)

**الخطوة 2 — إدخال الأسرار** (كلمة الاتصال والتوكن — تُخزَّن مشفّرة):
```powershell
fly secrets set DISCORD_TOKEN=ضع_التوكن_هنا MONGODB_URI=ضع_الرابط_هنا
```
> الأسرار الموجودة في ملف `.env` هي نفسها — انسخ قيمها من هناك (لا تشاركها مع أحد).

**الخطوة 3 — النشر:**
```powershell
fly deploy
```
- أول نشر ياخذ 3-5 دقائق (يبني صورة Docker)
- النشرات بعدها أسرع (~1 دقيقة)

**الخطوة 4 — التأكد:**
```powershell
fly logs
```
- ابحث عن سطر: `🎉 Bot is ready!` = البوت شغّال ✅

---

## أوامر مفيدة بعد النشر

| الأمر | الوظيفة |
|---|---|
| `fly status` | حالة التطبيق والموارد |
| `fly logs` | سجل البوت المباشر |
| `fly ssh console` | دخول لجهاز البوت |
| `fly restart` | إعادة تشغيل البوت |
| `fly scale count app=1` | ضمان نسخة واحدة (المجانية) |

---

## بعد النشر — إيقاف البوت على جهازك

لا تشغّل نسختين في نفس الوقت (سجّلان مرتين + تعارضات):

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*dist*index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

---

## 🔄 النشر التلقائي بعد كل تطوير (موصى به)

بعد إعداده مرة واحدة — **أي تعديل تضيفه للبوت يذهب تلقائياً للستضافة**، مهما كانت (Fly الآن، وتنتقل لأي استضافة أخرى بنفس الطريقة):

### الإعداد مرة واحدة:
1. **أنشئ مستودعاً خاصاً على GitHub** من: https://github.com/new (اسم أي شيء — خاص Private ✅)
2. **ارفع المشروع** (Git مثبّت الآن — نفّذ في PowerShell):
   ```powershell
   cd "C:\Users\Ahmad\Documents\المشروع الافتراضي\liberty-city-bot"
   git init
   git add -A
   git commit -m "Liberty City Bot"
   git remote add origin https://github.com/اسمك/اسم-المستودع.git
   git branch -M main
   git push -u origin main
   ```
   (سيطلب GitHub اسم المستخدم وكلمة المرور أو رمز الوصول — أنشئ رمز من: https://github.com/settings/tokens)
3. **أخبر GitHub بمفتاح النشر** — أنشئ رمز Fly من: https://fly.io/user/tokens
   ثم في صفحة المستودع: **Settings → Secrets and variables → Actions → New repository secret**
   - الاسم: `FLY_API_TOKEN`
   - القيمة: الرمز الذي نسخته من Fly

### بعدها — النشر بضغطة واحدة:
```powershell
.\scripts\publish.ps1
```
أي تعديل في ملفات البوت → `publish.ps1` → GitHub يبني وينشر **تلقائياً** خلال دقيقة ⚡

---

## تحديث البوت يدوياً (بدون GitHub)

بعد أي تعديل على الكود على جهازك:
```powershell
npx tsc
fly deploy
```

---

## ملاحظات

- **المجانية**: الخطة Free = 3 VMs صغيرة (256MB RAM) — البوت يكفيه نسخة واحدة.
- إذا "نامت" النسخة: البوت يحتاج عمليات مستمرة — `fly scale count app=1` مع الخطة المجانية يبقى شغّالاً دائماً (VM مجاني ينام بعد فترة بدون نشاط... اضبط: `fly scale count app=1` + الخطة تتجدد شهرياً صفر ريال). إذا واجهت مشكلة نوم، أخبرني وسأضبط `fly.toml` مع `auto_start`.
- **الأسرار**: لا ترفع ملف `.env` لأي مكان عام — على Fly تُدخل بالأمر فقط.
- MongoDB Atlas: تأكد أن سلاسل الاتصال تسمح بالاتصال من أي عنوان (IP = `0.0.0.0/0`) لأن عنوان Fly يتغير — أو أضف `fly ips` لعناوين ثابتة (مدفوعة).
