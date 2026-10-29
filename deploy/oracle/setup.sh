#!/usr/bin/env bash
# ============================================
# Liberty City Bot — Oracle Cloud Always Free provisioning
# تشغيل على VM جديدة (Ubuntu 22.04) — idempotent
# ============================================
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/AboTarek966/liberty-city-bot.git}"
APP_DIR="${APP_DIR:-/opt/liberty-city-bot}"
BRANCH="${BRANCH:-main}"

echo "==> تحديث النظام"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> تثبيت المتطلبات"
sudo apt-get install -y ca-certificates curl gnupg git ufw

echo "==> تثبيت Docker"
if ! command -v docker >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
sudo usermod -aG docker "$USER" || true

echo "==> استنساخ/تحديث المستودع"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR" && git fetch origin && git reset --hard "origin/$BRANCH"
else
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER:$USER" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> تجهيز .env"
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/deploy/oracle/.env.example" "$APP_DIR/.env"
  echo "!!! عدّل $APP_DIR/.env (DISCORD_TOKEN, MONGODB_URI, ...) ثم أعد تشغيل setup.sh"
  exit 1
fi

echo "==> جدار الحماية (UFW)"
sudo ufw allow 22/tcp || true
sudo ufw --force enable || true

echo "==> بناء وتشغيل الحاوية"
cd "$APP_DIR"
docker compose -f deploy/oracle/docker-compose.yml up -d --build

echo "==> تم. تابع السجلات:"
echo "    docker compose -f deploy/oracle/docker-compose.yml logs -f bot"
