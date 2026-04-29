import config from './core/config.js';
import logger from './core/logger.js';
import db from './core/db.js';
import server from './http/server.js';
import scheduler from './backup/scheduler.js';
import metricsPoller from './metrics/poller.js';
import restartMonitor from './restart/monitor.js';

async function main() {
  try {
    // Initialize database
    await db.initialize();
    logger.info('✓ Database initialized');

    // Initialize backup scheduler
    await scheduler.initialize();
    logger.info('✓ Backup scheduler initialized');

    // Initialize metrics poller (per-minute samples → SQLite 3h window)
    metricsPoller.initialize();
    logger.info('✓ Metrics poller initialized');

    // Initialize restart policy monitor
    restartMonitor.initialize();
    logger.info('✓ Restart monitor initialized');

    // Start HTTP server
    await server.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, '✓ Server listening');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down gracefully...');
      metricsPoller.stop();
      restartMonitor.stop();
      scheduler.stop();
      await server.close();
      db.close();
      process.exit(0);
    });
  } catch (error) {
    logger.fatal(error, 'Fatal error during startup');
    process.exit(1);
  }
}

main();
