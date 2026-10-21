// ============================================
// Liberty City Bot - Main Entry Point
// ============================================

import { LibertyClient } from './LibertyClient';
import { createLogger } from './utils/helpers';

const logger = createLogger('Main');

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
    try {
      await client.cleanup();
      logger.info('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  // ⚠️ لا نُنهي العملية عند خطأ غير متوقع — الخطأ الصغير لا يجب أن يقتل البوت كله
  // (سابقاً أي uncaughtException كان يوقف البوت بالكامل في منتصف تشغيل موسيقى!)
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception (bot keeps running):', error);
  });
  // تسجيل دوري للاستهلاك — يكشف ارتفاع الذاكرة قبل أن تقتلها الاستضافة (OOM kill)
  setInterval(() => {
    const mu = process.memoryUsage();
    const mb = (n: number) => Math.round(n / 1024 / 1024);
    logger.debug(`MEM rss=${mb(mu.rss)}MB heap=${mb(mu.heapUsed)}/${mb(mu.heapTotal)}MB external=${mb(mu.external)}`);
  }, 60_000);

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