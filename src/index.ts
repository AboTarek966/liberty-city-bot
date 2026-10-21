// ============================================
// Liberty City Bot - Main Entry Point
// ============================================

import { LibertyClient } from './LibertyClient';
import { createLogger } from './utils/helpers';
import fs from 'fs';
import path from 'path';

const logger = createLogger('Main');

// --------------------------------------------
// سجل دائم يصمد بعد موت السيرفر (الكونسول يُمسح معه — الملف لا)
// نسجّل فيه الذاكرة والأخطاء حتى بعد إعادة التشغيل لمعرفة سبب القتل
// --------------------------------------------
const PERSIST_FILE = path.join(process.cwd(), 'bot-persist.log');
function persist(line: string): void {
  try {
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const entry = `[${ts}] ${line}\n`;
    // ⚠️ existsSync قبل statSync — وإلا ENOENT في أول استدعاء يُلغي الكتابة كلها
    if (fs.existsSync(PERSIST_FILE) && fs.statSync(PERSIST_FILE).size > 400_000) {
      fs.writeFileSync(PERSIST_FILE + '.old', fs.readFileSync(PERSIST_FILE));
      fs.writeFileSync(PERSIST_FILE, '');
    }
    fs.appendFileSync(PERSIST_FILE, entry);
  } catch { /* لا نعطل البوت بسبب السجل */ }
}

// --------------------------------------------
// ASCII Art Banner
// --------------------------------------------
const banner = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██████╗ ██╗     ██╗   ██╗███████╗████████╗ ██████╗        ║
║   ██╔══██╗██║     ██║   ██║██╔════╝╚══██╔══╝██╔═══██╗       ║
║   ██████╔╝██║     ██║   ██║███████╗   ██║   ██║   ██║       ║
║   ██╔══██╗██║     ██║   ██║╚════██║   ██║   ██║   ██║       ║
║   ██████╔╝███████╗╚██████╔╝███████║   ██║   ╚██████╔╝       ║
║   ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝   ╚═╝    ╚═════╝        ║
║                                                              ║
║                  ██████╗ ██████╗ ██████╗ ███████╗██████╗     ║
║                  ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗    ║
║                  ██████╔╝██████╔╝██║  ██║█████╗  ██████╔╝    ║
║                  ██╔═══╝ ██╔══██╗██║  ██║██╔══╝  ██╔══██╗    ║
║                  ██║     ██║  ██║██████╔╝███████╗██║  ██║    ║
║                  ╚═╝     ╚═╝  ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝    ║
║                                                              ║
║          🛡️  Comprehensive Discord Bot  🎫  Tickets           ║
║          🤖  AI Integration  ⚙️  Advanced Settings           ║
║                                                              ║
║                     Version 2.0.0                            ║
╚══════════════════════════════════════════════════════════════╝
`;

// --------------------------------------------
// Main Function
// --------------------------------------------
async function main(): Promise<void> {
  console.log(banner);
  logger.info('🎆 Welcome to Liberty City Bot!');
  
  const startTime = Date.now();
  
  // Create client
  const client = new LibertyClient();

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    logger.info(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);
    persist(`SIGNAL ${signal} — graceful shutdown`);
    try {
      await client.cleanup();
      logger.info('✅ Graceful shutdown complete');
      persist('EXIT 0 (graceful)');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      persist(`EXIT 1 (shutdown error): ${String(error).slice(0, 200)}`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    const mu = process.memoryUsage();
    persist(`UNHANDLED_REJECTION rss=${Math.round(mu.rss / 1048576)}MB reason=${String(reason).slice(0, 300)}`);
  });
  // ⚠️ لا نُنهي العملية عند خطأ غير متوقع — الخطأ الصغير لا يجب أن يقتل البوت كله
  // (سابقاً أي uncaughtException كان يوقف البوت بالكامل في منتصف تشغيل موسيقى!)
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception (bot keeps running):', error);
    const mu = process.memoryUsage();
    persist(`UNCAUGHT_EXCEPTION rss=${Math.round(mu.rss / 1048576)}MB ${String(error?.stack || error).slice(0, 500)}`);
  });
  // تسجيل دوري للاستهلاك — يكشف ارتفاع الذاكرة قبل أن تقتلها الاستضافة (OOM kill)
  setInterval(() => {
    const mu = process.memoryUsage();
    const mb = (n: number) => Math.round(n / 1024 / 1024);
    logger.debug(`MEM rss=${mb(mu.rss)}MB heap=${mb(mu.heapUsed)}/${mb(mu.heapTotal)}MB external=${mb(mu.external)}`);
    persist(`MEM rss=${mb(mu.rss)}MB heap=${mb(mu.heapUsed)}MB external=${mb(mu.external)}`);
  }, 60_000);
  // علامات حياة/موت في الملف الدائم
  persist(`BOOT pid=${process.pid} argv=${process.execArgv.join(' ') || '-'}`);
  // 📜 نعرض ذيل السجل الدائم من الجلسة السابقة في الكونسول — الكونسول يُمسح مع كل قتل،
  // وهذا يبقي آخر لحظات الموت (MEM/SIGNAL/UNCAUGHT) ظاهرة في أول إقلاع بعده
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const tailLines = fs.readFileSync(PERSIST_FILE, 'utf8').split('\n').filter(Boolean).slice(-14);
      if (tailLines.length) {
        logger.info('📜 persist tail (previous session):');
        for (const l of tailLines) console.log('   ' + l);
      }
    }
  } catch { /* تجاهل */ }

  // Initialize the bot
  try {
    await client.initialize();

    // Register slash commands
    await client.registerCommands();

    // Set initial status
    client.setStatus();

    // Set interval to change status every 5 minutes
    setInterval(() => client.setStatus(), 5 * 60 * 1000);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`🎉 Bot is ready! Took ${elapsed}s`);
    persist(`READY in ${elapsed}s guilds=${client.guilds.cache.size}`);
    logger.info(`📊 Logged in as: ${client.user?.tag}`);
    logger.info(`🏠 Serving ${client.guilds.cache.size} guilds`);
    logger.info(`👥 Serving ${client.users.cache.size} users`);

    // Start Express server for Dashboard API (replaces simple HTTP server)
    const PORT = parseInt(process.env.PORT || '3000', 10);
    client.expressApp.listen(PORT, () => {
      logger.info(`🌐 Express server (Dashboard API) running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

// --------------------------------------------
// Start Bot
// --------------------------------------------
main().catch((error) => {
  logger.error('❌ Fatal error:', error);
  process.exit(1);
});