import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import logger from '../../core/logger.js';
import storage from '../storage.js';

/**
 * Parse a database/cache URL into its components.
 * Supports postgres://, postgresql://, mysql://, redis://
 */
function parseUrl(connString) {
  const url = new URL(connString);
  return {
    host: url.hostname,
    port: url.port,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database: url.pathname ? url.pathname.replace(/^\//, '') : undefined,
  };
}

/**
 * Postgres backup worker.
 * Credentials are passed via PGPASSWORD env var — not visible in `ps aux`.
 */
export async function backupPostgres(serviceId, connString, schedule) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${serviceId}/${schedule}/${timestamp}.sql.gz`;
    const { host, port, user, password, database } = parseUrl(connString);

    logger.info({ serviceId, schedule }, 'Starting Postgres backup');

    return new Promise((resolve, reject) => {
      const args = [
        '-h', host,
        '-p', port || '5432',
        '-U', user,
        '--no-password',
        database,
      ];

      const pgDump = spawn('pg_dump', args, {
        env: { ...process.env, PGPASSWORD: password || '' },
      });

      const gzip = createGzip();

      pgDump.stderr.on('data', (data) => logger.debug(`pg_dump: ${data}`));
      pgDump.on('error', (err) => { logger.error(err, 'pg_dump error'); reject(err); });
      pgDump.on('close', (code) => {
        if (code !== 0) reject(new Error(`pg_dump exited with code ${code}`));
      });
      gzip.on('error', (err) => { logger.error(err, 'gzip error'); reject(err); });

      storage.write(gzip, filename)
        .then((result) => {
          logger.info({ serviceId, schedule, filename, size: result.size }, 'Postgres backup completed');
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
 * MySQL backup worker.
 * Credentials passed via MYSQL_PWD env var — not visible in `ps aux`.
 */
export async function backupMySQL(serviceId, connString, schedule) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${serviceId}/${schedule}/${timestamp}.sql.gz`;
    const { host, port, user, password, database } = parseUrl(connString);

    logger.info({ serviceId, schedule }, 'Starting MySQL backup');

    return new Promise((resolve, reject) => {
      const args = [
        '--single-transaction',
        '--quick',
        '--lock-tables=false',
        '-h', host,
        '-P', port || '3306',
        '-u', user,
        database,
      ];

      const mysqldump = spawn('mysqldump', args, {
        env: { ...process.env, MYSQL_PWD: password || '' },
      });

      const gzip = createGzip();

      mysqldump.stderr.on('data', (data) => logger.debug(`mysqldump: ${data}`));
      mysqldump.on('error', (err) => { logger.error(err, 'mysqldump error'); reject(err); });
      mysqldump.on('close', (code) => {
        if (code !== 0) reject(new Error(`mysqldump exited with code ${code}`));
      });
      gzip.on('error', (err) => { logger.error(err, 'gzip error'); reject(err); });

      storage.write(gzip, filename)
        .then((result) => {
          logger.info({ serviceId, schedule, filename, size: result.size }, 'MySQL backup completed');
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
 * Redis backup worker.
 * Uses `redis-cli --rdb -` to stream an RDB snapshot.
 * Password is passed via REDISCLI_AUTH env var — not visible in `ps aux`.
 */
export async function backupRedis(serviceId, connString, schedule) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${serviceId}/${schedule}/${timestamp}.rdb.gz`;
    const { host, port, password } = parseUrl(connString);

    logger.info({ serviceId, schedule }, 'Starting Redis backup');

    return new Promise((resolve, reject) => {
      const args = ['-h', host, '-p', port || '6379', '--rdb', '-'];

      const redisCli = spawn('redis-cli', args, {
        env: { ...process.env, ...(password ? { REDISCLI_AUTH: password } : {}) },
      });

      const gzip = createGzip();

      redisCli.stderr.on('data', (data) => logger.debug(`redis-cli: ${data}`));
      redisCli.on('error', (err) => { logger.error(err, 'redis-cli error'); reject(err); });
      redisCli.on('close', (code) => {
        if (code !== 0) reject(new Error(`redis-cli exited with code ${code}`));
      });
      gzip.on('error', (err) => { logger.error(err, 'gzip error'); reject(err); });

      storage.write(gzip, filename)
        .then((result) => {
          logger.info({ serviceId, schedule, filename, size: result.size }, 'Redis backup completed');
          resolve({ filename, size: result.size });
        })
        .catch(reject);

      redisCli.stdout.pipe(gzip);
    });
  } catch (error) {
    logger.error(error, 'Redis backup failed');
    throw error;
  }
}
