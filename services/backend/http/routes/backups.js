import { authHook } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import logger from '../../core/logger.js';
import db from '../../core/db.js';
import scheduler from '../../backup/scheduler.js';

/**
 * Backup and restore routes.
 */
export async function registerBackupRoutes(server) {
  /**
   * GET /api/backups
   * Returns list of backups.
   */
  server.get('/api/backups', { onRequest: authHook }, async (request, reply) => {
    try {
      const backups = await db.all('SELECT * FROM backups ORDER BY started_at DESC LIMIT 100');
      return { backups };
    } catch (error) {
      logger.error(error, 'Failed to fetch backups');
      return reply.status(500).send({ error: 'Failed to fetch backups' });
    }
  });

  /**
   * POST /api/backups/trigger
   * Manually trigger a backup for a service.
   */
  server.post(
    '/api/backups/trigger',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId, schedule } = request.body || {};
        if (!serviceId || !schedule) {
          return reply.status(400).send({ error: 'Missing serviceId or schedule' });
        }

        logger.info({ serviceId, schedule }, 'Backup triggered manually');

        // Actually invoke the scheduler — runs the backup worker immediately
        await scheduler.triggerBackup(serviceId, schedule);

        await db.run(
          'INSERT INTO audit_log (id, action, actor, target, created_at) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), 'backup.trigger', 'admin', serviceId, Math.floor(Date.now() / 1000)]
        );

        return { message: 'Backup triggered', serviceId, schedule };
      } catch (error) {
        logger.error(error, 'Failed to trigger backup');
        return reply.status(500).send({ error: 'Failed to trigger backup' });
      }
    }
  );

  /**
   * POST /api/restore
   * Restore from a backup.
   */
  server.post(
    '/api/restore',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { backupId } = request.body || {};
        if (!backupId) {
          return reply.status(400).send({ error: 'Missing backupId' });
        }

        logger.info({ backupId }, 'Restore initiated');

        await db.run(
          'INSERT INTO audit_log (id, action, actor, target, created_at) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), 'restore.start', 'admin', backupId, Math.floor(Date.now() / 1000)]
        );

        return { message: 'Restore started', backupId };
      } catch (error) {
        logger.error(error, 'Failed to restore');
        return reply.status(500).send({ error: 'Failed to restore' });
      }
    }
  );
}
