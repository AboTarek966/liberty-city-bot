# ============================================
# نشر تعديلات البوت بضغطة واحدة
# يرفع كل التعديلات إلى GitHub — ثم ينشرها تلقائياً
# (يعمل من مجلد المشروع أو من أي مكان)
# ============================================

$projectDir = Split-Path $PSScriptRoot -Parent
Set-Location $projectDir

Write-Host "📦 جاري رفع التعديلات..." -ForegroundColor Cyan
git add -A

$msg = "update: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
git commit -m $msg

git push

Write-Host ""
Write-Host "✅ تم رفع التعديلات إلى GitHub" -ForegroundColor Green
Write-Host "🚀 النشر التلقائي على الاستضافة بدأ الآن (GitHub Actions → Fly.io)" -ForegroundColor Green
Write-Host "   تابع التقدم: https://github.com/<اسمك>/<اسم-المستودع>/actions" -ForegroundColor Yellow
