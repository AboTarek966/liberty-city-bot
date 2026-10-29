# 🆓 استضافة مجانية 24/7 بدون بطاقة بنكية

> البوت يحتاج ~210MB مساحة (dist + node_modules) و~256–512MB RAM.

## الخيار 1 (موصى به): HeavenCloud — 512MB / 24/7 / بدون بطاقة
- الموقع: https://heavencloud.in/service/free-discord-bot-hosting
- المواصفات: **512MB RAM، 712MB disk، 25% CPU، 24/7 بلا نوم، بدون بطاقة**.
- الخطوات:
  1. انضم لديسكوردهم: https://discord.gg/getvps
  2. نفّذ `! user new` ثم `! server create` (أو من الموقع).
  3. افتح لوحة **Pterodactyl**: `control.heavencloud.in`.
  4. ارفع ملفات المشروع (ZIP بدون `node_modules`) أو استخدم Git.
  5. في Console:
     ```bash
     npm ci --omit=dev
     ```
  6. Startup Command: `node dist/index.js`
  7. أضف متغيرات البيئة من تبويب **Startup** أو ارفع `.env`.
  8. Start.

## الخيار 2: Discloud — 24/7 / بدون بطاقة
- الموقع: https://discloud.com
- الخطوات:
  1. أنشئ حساباً.
  2. ارفع ZIP للمشروع (بدون `node_modules`) مع ملف `discloud.config` في الجذر:
     ```ini
     NAME=liberty-city
     TYPE=bot
     MAIN=out/index.js
     START=node out/index.js
     RAM=512
     VERSION=latest
     ```
  3. **مهم:** Discloud يحجز مجلد `dist` — لذلك نستخدم `out`:
     ```powershell
     npm run build:discloud
     ```
  4. ارفع من لوحة Discloud → سيثبّت الحزم ويشغّل البوت.
  5. أضف متغيرات البيئة (DISCORD_TOKEN, MONGODB_URI, ...) من لوحة الإدارة.

## الخيار 3: bot-hosting.net — بدون بطاقة
- الموقع: https://bot-hosting.net
- خطة Free: 24/7 لكن **تجديد يدوي كل 4 أيام**.
- Pterodactyl panel → نفس خطوات HeavenCloud.

## الخيار 4: Wispbyte / NexCloud / Daki / FPS.ms
كلها خطط مجانية بدون بطاقة، لكن تحقق من حدود RAM (بعضها 128–315MB فقط — قد لا تكفي البوت).

---

## تجهيز ZIP للرفع (Windows PowerShell)
```powershell
cd C:\Users\Ahmad\Documents\1\liberty-city-bot
Copy-Item deploy\discloud\discloud.config .\discloud.config
# استثناء node_modules و .git و .env
Compress-Archive -Path dist,assets,package.json,package-lock.json,discloud.config,src -DestinationPath liberty-city.zip -Force
```
> ⚠️ لا تضع `.env` داخل ZIP إذا كانت المنصة تسمح بمتغيرات بيئة. إن لم تسمح، أضف `.env` إلى الـ ZIP واحتفظ به خاصاً.

## بعد التشغيل
- السجلات: ابحث عن `✅ Logged in as`.
- أوقف أي نسخة أخرى (FadeHost/الجهاز).
- ارفع رول البوت فوق ShareBot.
- `DEVELOPER_USER_ID=1342238662368296980`.
