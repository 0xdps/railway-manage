import logger from '../core/logger.js';
import db from '../core/db.js';
import storage from './storage.js';

/**
 * Backup retention policy enforcer.
 *
 * Policies:
 * - hourly: keep last 24
 * - daily: keep last 7
 * - weekly: keep last 4
 * - monthly: keep last 12
 */
const RETENTION_POLICIES = {
  hourly: 24,
  daily: 7,
  weekly: 4,
  monthly: 12,
};

/**
 * Apply retention policies for a service.
 */
export async function enforceRetention(serviceId) {
  try {
    for (const [schedule, limit] of Object.entries(RETENTION_POLICIES)) {
      const backups = db.all(
        `SELECT id, location FROM backups 
         WHERE service_id = ? AND schedule = ? 
         ORDER BY started_at DESC`,
        [serviceId, schedule]
      );

      if (backups.length > limit) {
        const toDelete = backups.slice(limit);

        for (const backup of toDelete) {
          try {
            // Delete from storage
            if (backup.location) {
              await storage.remove(backup.location);
            }

            // Delete from database
            db.run('DELETE FROM backups WHERE id = ?', [backup.id]);

            logger.info(
              { serviceId, schedule, backupId: backup.id },
              'Backup deleted by retention policy'
            );
          } catch (error) {
            logger.error(
              error,
              'Failed to delete backup'
            );
          }
        }
      }
    }

    logger.info({ serviceId }, 'Retention policy enforced');
  } catch (error) {
    logger.error(error, 'Error enforcing retention policy');
    throw error;
  }
}

/**
 * Cleanup all expired backups across all services.
 */
export async function cleanupExpiredBackups() {
  try {
    const services = db.all('SELECT DISTINCT service_id FROM backups');

    for (const service of services) {
      await enforceRetention(service.service_id);
    }

    logger.info('Backup cleanup completed');
  } catch (error) {
    logger.error(error, 'Cleanup failed');
    throw error;
  }
}
