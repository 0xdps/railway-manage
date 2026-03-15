import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import logger from '../../core/logger.js';
import storage from '../storage.js';

/**
 * Postgres backup worker - uses pg_dump.
 */
export async function backupPostgres(serviceId, connString, schedule) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${serviceId}/${schedule}/${timestamp}.sql.gz`;

    logger.info({ serviceId, schedule }, 'Starting Postgres backup');

    return new Promise((resolve, reject) => {
      // Parse connection string (postgres://user:pass@host:port/db)
      const pgDump = spawn('pg_dump', [connString, '--verbose']);
      const gzip = createGzip();

      pgDump.stderr.on('data', (data) => {
        logger.debug(`pg_dump: ${data}`);
      });

      pgDump.on('error', (err) => {
        logger.error(err, 'pg_dump error');
        reject(err);
      });

      pgDump.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`pg_dump exited with code ${code}`));
        }
      });

      gzip.on('error', (err) => {
        logger.error(err, 'gzip error');
        reject(err);
      });

      storage
        .write(gzip, filename)
        .then((result) => {
          logger.info(
            { serviceId, schedule, filename, size: result.size },
            'Postgres backup completed'
          );
          resolve({ filename, size: result.size });
        })
        .catch(reject);

      pgDump.stdout.pipe(gzip);
    });
  } catch (error) {
    logger.error(error, 'Postgres backup failed');
    throw error;
  }
}

/**
 * MySQL backup worker - uses mysqldump.
 */
export async function backupMySQL(serviceId, connString, schedule) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${serviceId}/${schedule}/${timestamp}.sql.gz`;

    logger.info({ serviceId, schedule }, 'Starting MySQL backup');

    return new Promise((resolve, reject) => {
      // Parse connection string format or MySQL URL
      // Supports: mysql://user:pass@host:port/db
      const args = [
        '--single-transaction',
        '--quick',
        '--lock-tables=false',
        connString,
      ];

      const mysqldump = spawn('mysqldump', args);
      const gzip = createGzip();

      mysqldump.stderr.on('data', (data) => {
        logger.debug(`mysqldump: ${data}`);
      });

      mysqldump.on('error', (err) => {
        logger.error(err, 'mysqldump error');
        reject(err);
      });

      mysqldump.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`mysqldump exited with code ${code}`));
        }
      });

      gzip.on('error', (err) => {
        logger.error(err, 'gzip error');
        reject(err);
      });

      storage
        .write(gzip, filename)
        .then((result) => {
          logger.info(
            { serviceId, schedule, filename, size: result.size },
            'MySQL backup completed'
          );
          resolve({ filename, size: result.size });
        })
        .catch(reject);

      mysqldump.stdout.pipe(gzip);
    });
  } catch (error) {
    logger.error(error, 'MySQL backup failed');
    throw error;
  }
}

/**
 * Redis backup worker - uses BGSAVE and copies the dump.
 */
export async function backupRedis(serviceId, connString, schedule) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${serviceId}/${schedule}/${timestamp}.rdb.gz`;

    logger.info({ serviceId, schedule }, 'Starting Redis backup');

    // Parse Redis URL (redis://:[password]@host:port/db)
    // For now, we'd need redis client library - stub for now
    logger.warn(
      'Redis backup not yet fully implemented - requires redis client library'
    );

    throw new Error('Redis backup not yet implemented');
  } catch (error) {
    logger.error(error, 'Redis backup failed');
    throw error;
  }
}
