"use strict";
// ============================================
// Liberty City Bot - Main Entry Point
// ============================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const LibertyClient_1 = require("./LibertyClient");
const helpers_1 = require("./utils/helpers");
const logger = (0, helpers_1.createLogger)('Main');
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
async function main() {
    console.log(banner);
    logger.info('🎆 Welcome to Liberty City Bot!');
    const startTime = Date.now();
    // Create client
    const client = new LibertyClient_1.LibertyClient();
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
        logger.info(`\n⚠️ Received ${signal}. Starting graceful shutdown...`);
        try {
            await client.cleanup();
            logger.info('✅ Graceful shutdown complete');
            process.exit(0);
        }
        catch (error) {
            logger.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    };
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        gracefulShutdown('uncaughtException');
    });
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
        // 🌐 خادم HTTP للتحقق من الحالة (مطلوب للاستضافة السحابية المجانية)
        const http = await Promise.resolve().then(() => __importStar(require('http')));
        const PORT = parseInt(process.env.PORT || '3000', 10);
        const healthServer = http.createServer((req, res) => {
            if (req.url === '/health' || req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'online',
                    bot: client.user?.tag || 'Liberty City',
                    guilds: client.guilds.cache.size,
                    uptime: process.uptime(),
                }));
            }
            else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });
        healthServer.listen(PORT, () => {
            logger.info(`🌐 Health check server running on port ${PORT}`);
        });
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map