# 🚀 دليل النشر على Oracle Cloud Always Free (24/7، مجاني)

هذا الدليل ينقل البوت من FadeHost/الجهاز المحلي إلى **Oracle Cloud Always Free** (VM مجانية "إلى الأبد"، تعمل 24/7 بدون نوم).

---

## 1) إنشاء حساب و VM (مرة واحدة)

1. سجّل في: https://www.oracle.com/cloud/free/
2. **Create VM Instance**:
   - Image: **Ubuntu 22.04** (أو 24.04)
   - Shape: **VM.Standard.A1.Flex** (ARM, Always Free: 4 OCPU + 24GB — اختر 2 OCPU / 8GB أو 1/4)
   - Networking: افتح منفذ **22 (SSH)** (البوت لا يحتاج منافذ HTTP).
   - أضف **SSH Key** (أو استخدم password).
3. انسخ **Public IP**.

> 💡 Always Free = "إلى الأبد" (لا يُخصم). تأكد من اختيار Shape موسوم بـ "Always Free".

## 2) الاتصال وتجهيز VM

```bash
ssh ubuntu@<PUBLIC_IP>
```

ثم:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl
```

## 3) تثبيت Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# أعد تسجيل الدخول (exit ثم ssh) لتفعيل مجموعة docker
```

## 4) استنساخ المشروع + .env

```bash
sudo mkdir -p /opt && sudo chown $USER:$USER /opt
cd /opt
git clone https://github.com/AboTarek966/liberty-city-bot.git
cd liberty-city-bot
cp deploy/oracle/.env.example .env
nano .env   # املأ DISCORD_TOKEN, MONGODB_URI, DEVELOPER_USER_ID, ...
```

> 🔑 **مهم:** استخدم **توكن Discord صحيح** (المحلي currently invalid). MONGODB_URI من Atlas M0 (مجاني) — IP allowlist = `0.0.0.0/0`.

## 5) تشغيل البوت

```bash
docker compose -f deploy/oracle/docker-compose.yml up -d --build
docker compose -f deploy/oracle/docker-compose.yml logs -f bot
```

ابحث عن `✅ Logged in as ...` = شغّال.

## 6) إعادة تشغيل تلقائي (Auto-restart)

Docker Compose مُعدّ `restart: unless-stopped` + `deploy.resources.limits.memory: 512M`. عند إعادة تشغيل VM، شغّل:
```bash
sudo systemctl enable docker
# (اختياري) auto-start compose on boot:
sudo tee /etc/systemd/system/liberty-city.service >/dev/null <<'EOF'
[Unit]
Description=Liberty City Bot
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/liberty-city-bot
ExecStart=/usr/bin/docker compose -f deploy/oracle/docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f deploy/oracle/docker-compose.yml down
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now liberty-city
```

## 7) تحديث البوت (بعد تعديلات على GitHub)

```bash
cd /opt/liberty-city-bot
git pull
docker compose -f deploy/oracle/docker-compose.yml up -d --build
```

## 8) (اختياري) GitHub Actions — نشر تلقائي

أضف secrets في repo: `ORACLE_HOST`, `ORACLE_USER`, `ORACLE_SSH_KEY`. Workflow `.github/workflows/deploy-oracle.yml` (إن وُجد) يسحب ويبني تلقائياً عند push.

## 9) إيقاف النسخة على FadeHost/الجهاز

لا تشغّل نسختين (تعارضات Discord Gateway). أوقف FadeHost أو process المحلي:
```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*dist*index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

## 10) تحقق الهرمية (مهم!)

ShareBot (`#22`) فوق Liberty City (`#21`) → الحظر يفشل. ارفع رول Liberty City فوق ShareBot في إعدادات السيرفر، أو أزل صلاحيات ShareBot الخطرة.

## ملاحظات
- **MongoDB Atlas M0** (مجاني): allowlist IP = `0.0.0.0/0` (IP VM يتغير عند إعادة الإنشاء).
- **الذاكرة**: 512M limit — إذا OOM، ارفع إلى 768M أو خفّض `max-old-space-size`.
- **النسخ الاحتياطي**: `autoBackup` (في البوت) يحفظ بنية السيرفر في Mongo.
- **المراقبة**: `docker logs -f liberty-city-bot` أو `docker stats`.
- **DEVELOPER_USER_ID**: اضبطه في `.env` (المستخدم `1342238662368296980` ظهر في تقرير المحقق).
