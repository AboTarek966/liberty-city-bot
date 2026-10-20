#!/bin/bash
set -e

echo "🧹 Cleaning old build..."
rm -rf .git node_modules package-lock.json dist

echo "📥 Cloning fresh repo..."
git clone https://github.com/AboTarek966/liberty-city-bot.git .

echo "📦 Installing dependencies..."
npm ci

echo "🔨 Building with 4GB heap..."
node --max-old-space-size=4096 node_modules/typescript/bin/tsc

echo "✅ Build completed!"