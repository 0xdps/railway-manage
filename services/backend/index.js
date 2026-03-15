import config from './core/config.js';
import logger from './core/logger.js';
import db from './core/db.js';
import server from './http/server.js';
import scheduler from './backup/scheduler.js';

async function main() {
  try {
    // Initialize database
    db.initialize();
    logger.info('✓ Database initialized');

    // Initialize backup scheduler
    scheduler.initialize();
    logger.info('✓ Backup scheduler initialized');

    // Start HTTP server
    await server.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, '✓ Server listening');

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down gracefully...');
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
