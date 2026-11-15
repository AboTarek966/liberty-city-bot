"use strict";
// ============================================
// Omni Bot - 🏆 رسم لوحة أفضل العشائر (PNG)
// ============================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderClanLeaderboard = renderClanLeaderboard;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const helpers_1 = require("./helpers");
const logger = (0, helpers_1.createLogger)('ClanImage');
let fontsChecked = false;
let useBundledFonts = false;
function ensureFonts() {
    if (fontsChecked)
        return useBundledFonts;
    fontsChecked = true;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { GlobalFonts } = require('@napi-rs/canvas');
        const dir = path_1.default.join(__dirname, '..', '..', 'assets', 'fonts');
        const needed = ['NotoSansArabic-Regular.ttf', 'NotoSansArabic-Bold.ttf', 'NotoSans-Regular.ttf', 'NotoSans-Bold.ttf'];
        if (needed.every((f) => fs_1.default.existsSync(path_1.default.join(dir, f)))) {
            GlobalFonts.registerFromPath(path_1.default.join(dir, 'NotoSansArabic-Regular.ttf'), 'OmniArabic');
            GlobalFonts.registerFromPath(path_1.default.join(dir, 'NotoSansArabic-Bold.ttf'), 'OmniArabic');
            GlobalFonts.registerFromPath(path_1.default.join(dir, 'NotoSans-Regular.ttf'), 'OmniSans');
            GlobalFonts.registerFromPath(path_1.default.join(dir, 'NotoSans-Bold.ttf'), 'OmniSans');
            useBundledFonts = true;
            return true;
        }
    }
    catch (err) {
        logger.warn(`registerFont failed — ${err?.message || err}`);
    }
    useBundledFonts = false;
    return false;
}
function formatNum(n) {
    if (n >= 1_000_000)
        return (n / 1_000_000).toFixed(1) + ' م';
    if (n >= 1_000)
        return (n / 1_000).toFixed(1) + ' ألف';
    return String(n);
}
function formatVoice(mins) {
    if (mins >= 60) {
        const hours = mins / 60;
        return hours >= 10 ? `${Math.floor(hours)} ساعة` : `${hours.toFixed(1)} ساعة`;
    }
    return `${mins} دقيقة`;
}
async function renderClanLeaderboard(guildName, entries) {
    ensureFonts();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createCanvas } = require('@napi-rs/canvas');
    const width = 1100;
    const headerH = 180;
    const rowH = 128;
    const footerH = 60;
    const totalRows = entries.length;
    const height = headerH + (totalRows > 0 ? 12 + totalRows * rowH : 120) + footerH + 20;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    // ===== خلفية =====
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#0b1020');
    bgGrad.addColorStop(0.5, '#141b2d');
    bgGrad.addColorStop(1, '#0b1020');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    // أشكال زخرفية (دوائر شفافة)
    const deco = [
        { x: 60, y: 60, r: 90, a: 0.06 },
        { x: width - 80, y: 100, r: 140, a: 0.05 },
        { x: width - 200, y: height - 120, r: 110, a: 0.05 },
        { x: 140, y: height - 60, r: 80, a: 0.06 },
    ];
    for (const d of deco) {
        ctx.fillStyle = `rgba(241, 196, 15, ${d.a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
    }
    // ===== العنوان =====
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (useBundledFonts)
        ctx.font = 'Bold 54px OmniArabic';
    else
        ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = '#f1c40f';
    ctx.fillText('أفضل العشائر', width / 2, 56);
    if (useBundledFonts)
        ctx.font = 'Regular 26px OmniSans';
    else
        ctx.font = '26px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${guildName}`, width / 2, 114);
    const counts = `${totalRows} عشيرة ، تُحسب تلقائياً من نشاط الأعضاء`;
    if (useBundledFonts)
        ctx.font = 'Regular 18px OmniArabic';
    else
        ctx.font = '18px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(counts, width / 2, 148);
    // ===== الصفوف =====
    if (totalRows === 0) {
        if (useBundledFonts)
            ctx.font = 'Bold 30px OmniArabic';
        else
            ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('لم تُسجّل أي عشيرة بعد', width / 2, headerH + 60);
    }
    const maxScore = Math.max(...entries.map((e) => e.messages * 1 + e.voiceMinutes * 10), 1);
    for (let i = 0; i < totalRows; i++) {
        const entry = entries[i];
        const y = headerH + 6 + i * rowH;
        const cellH = 112;
        const x = 60;
        const w = width - 120;
        // خلفية الصف
        const rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.025)';
        ctx.fillStyle = rowBg;
        roundRect(ctx, x, y, w, cellH, 26);
        ctx.fill();
        // شريط اللون على اليمين (RTL)
        ctx.fillStyle = `#${entry.color.toString(16).padStart(6, '0')}`;
        roundRect(ctx, width - x - 10, y + 16, 10, cellH - 32, 5);
        ctx.fill();
        // رقم المرتبة
        const medalColor = i === 0 ? '#f1c40f' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#475569';
        ctx.fillStyle = medalColor;
        ctx.beginPath();
        ctx.arc(x + 44, y + cellH / 2, 28, 0, Math.PI * 2);
        ctx.fill();
        if (useBundledFonts)
            ctx.font = 'Bold 26px OmniArabic';
        else
            ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#0b1020';
        ctx.fillText(String(i + 1), x + 44, y + cellH / 2);
        // اسم العشيرة + الإحصائيات
        const nameX = x + 96;
        ctx.textAlign = 'right';
        const name = entry.name.slice(0, 26);
        if (useBundledFonts)
            ctx.font = 'Bold 34px OmniArabic';
        else
            ctx.font = 'bold 34px sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(name, width - x - 30, y + 34);
        if (useBundledFonts)
            ctx.font = 'Regular 20px OmniArabic';
        else
            ctx.font = '20px sans-serif';
        ctx.fillStyle = '#cbd5e1';
        const statsLine = `رسائل ${formatNum(entry.messages)}  ،  صوت ${formatVoice(entry.voiceMinutes)}  ،  أعضاء ${entry.memberCount}`;
        ctx.fillText(statsLine, width - x - 30, y + 74);
        // شريط التقدم
        const score = entry.messages + entry.voiceMinutes * 10;
        const barMaxW = 240;
        const barW = Math.max(6, Math.round((score / maxScore) * barMaxW));
        const barX = nameX;
        const barY = y + cellH - 16;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        roundRect(ctx, barX, barY, barMaxW, 6, 3);
        ctx.fill();
        ctx.fillStyle = medalColor;
        roundRect(ctx, barX, barY, barW, 6, 3);
        ctx.fill();
    }
    // ===== التذييل =====
    if (useBundledFonts)
        ctx.font = 'Regular 18px OmniArabic';
    else
        ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.fillText('تفاعل أكثر  ،  صدارة أعلى  ،  فلنُشعل السيرفر', width / 2, height - footerH / 2 - 4);
    return canvas.toBuffer('image/png');
}
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}
//# sourceMappingURL=clanImage.js.map