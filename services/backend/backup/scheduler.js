import cron from 'node-cron';
import { randomUUID } from 'crypto';
import logger from '../core/logger.js';
import db from '../core/db.js';
import config from '../core/config.js';
import railwayClient from '../railway/client.js';
import { backupPostgres, backupMySQL, backupRedis } from './workers/index.js';
import { enforceRetention, cleanupExpiredBackups } from './retention.js';

// Seconds from now until the next run for each job type
const JOB_INTERVALS = {
  backup_hourly: 3600,
  backup_daily: 86400,
  backup_weekly: 604800,
  backup_monthly: 30 * 86400,
  cleanup: 86400,
};

/**
 * Backup scheduler powered by node-cron.
 * Manages periodic backup jobs and cleanup.
 */
class BackupScheduler {
  constructor() {
    this.tasks = new Map();
  }

  /**
   * Initialize scheduler: register all jobs from database.
   */
  async initialize() {
    try {
      // Ensure default jobs exist
      await this._ensureDefaultJobs();

      // Load all enabled jobs and schedule them
      const jobs = await db.all('SELECT * FROM jobs WHERE enabled = 1');

      for (const job of jobs) {
        this.schedule(job.id, job.schedule, job.job_type);
      }

      logger.info({ count: jobs.length }, 'Backup scheduler initialized');
    } catch (error) {
      logger.error(error, 'Scheduler initialization failed');
      throw error;
    }
  }

  /**
   * Ensure default backup jobs exist in database.
   */
  async _ensureDefaultJobs() {
    const defaults = [
      { type: 'backup_hourly', schedule: '0 * * * *' }, // Every hour
      { type: 'backup_daily', schedule: '0 0 * * *' }, // Every day at midnight
      { type: 'backup_weekly', schedule: '0 0 * * 0' }, // Every Sunday at midnight
      { type: 'backup_monthly', schedule: '0 0 1 * *' }, // First of month at midnight
      { type: 'cleanup', schedule: '0 2 * * *' }, // Every day at 2 AM
    ];

    for (const def of defaults) {
      const existing = await db.get('SELECT id FROM jobs WHERE job_type = ?', [
        def.type,
      ]);

      if (!existing) {
        const jobId = randomUUID();
        await db.run(
          `INSERT INTO jobs (id, job_type, schedule, enabled) VALUES (?, ?, ?, 1)`,
          [jobId, def.type, def.schedule]
        );
        logger.info({ jobType: def.type }, 'Created default job');
      }
    }
  }

  /**
   * Schedule a job.
   */
  schedule(jobId, schedule, jobType) {
    try {
      // Cancel existing task if any
      if (this.tasks.has(jobId)) {
        const task = this.tasks.get(jobId);
        task.stop();
        this.tasks.delete(jobId);
      }

      // Schedule new task
      const task = cron.schedule(schedule, () => {
        this._executeJob(jobId, jobType).catch((err) => {
          logger.error(err, 'Job execution failed');
        });
      });

      this.tasks.set(jobId, task);
      logger.info({ jobId, jobType, schedule }, 'Job scheduled');
    } catch (error) {
      logger.error(error, 'Failed to schedule job');
      throw error;
    }
  }

  /**
   * Execute a scheduled job.
   */
  async _executeJob(jobId, jobType) {
    const startTime = Date.now();

    try {
      logger.info({ jobType }, 'Executing job');

      switch (jobType) {
        case 'backup_hourly':
          await this._runBackups('hourly');
          break;
        case 'backup_daily':
          await this._runBackups('daily');
          break;
        case 'backup_weekly':
          await this._runBackups('weekly');
          break;
        case 'backup_monthly':
          await this._runBackups('monthly');
          break;
        case 'cleanup':
          await cleanupExpiredBackups();
          break;
        default:
          logger.warn({ jobType }, 'Unknown job type');
      }

      const duration = Date.now() - startTime;
      const interval = JOB_INTERVALS[jobType] ?? 3600;
      await db.run(
        `UPDATE jobs SET last_run_at = ?, next_run_at = ? WHERE id = ?`,
        [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + interval, jobId]
      );

      logger.info({ jobType, duration }, 'Job completed');
    } catch (error) {
      logger.error(error, 'Job execution error');
      await db.run(
        `UPDATE jobs SET last_run_at = ? WHERE id = ?`,
        [Math.floor(Date.now() / 1000), jobId]
      );
    }
  }

  /**
   * Run backups for a specific schedule.
   */
  async _runBackups(schedule) {
    try {
      const services = await db.all('SELECT * FROM services WHERE enabled = 1');

      for (const service of services) {
        await this._backupService(service, schedule);
      }

      logger.info({ schedule, count: services.length }, 'Backup batch completed');
    } catch (error) {
      logger.error(error, 'Backup batch failed');
    }
  }

  /**
   * Backup a single service.
   */
  async _backupService(service, schedule) {
    const backupId = randomUUID();

    try {
      // Create backup record
      const startedAt = Math.floor(Date.now() / 1000);
      await db.run(
        `INSERT INTO backups (id, service_id, schedule, started_at, status) VALUES (?, ?, ?, ?, ?)`,
        [backupId, service.id, schedule, startedAt, 'running']
      );

      logger.info({ serviceId: service.id, schedule }, 'Starting backup');

      let result;

      // Fetch the live connection string from Railway — never stored locally
      const connString = await railwayClient.getServiceVariable(
        service.railway_service_id,
        service.env_var_key,
        config.railwayEnvironmentId,
        config.railwayProjectId
      );

      // Dispatch to appropriate worker
      if (service.type === 'postgres') {
        result = await backupPostgres(service.id, connString, schedule);
      } else if (service.type === 'mysql') {
        result = await backupMySQL(service.id, connString, schedule);
      } else if (service.type === 'redis') {
        result = await backupRedis(service.id, connString, schedule);
      } else {
        throw new Error(`Unsupported service type: ${service.type}`);
      }

      // Update backup record with success
      const finishedAt = Math.floor(Date.now() / 1000);
      await db.run(
        `UPDATE backups SET status = ?, finished_at = ?, size_bytes = ?, location = ? WHERE id = ?`,
        ['success', finishedAt, result.size, result.filename, backupId]
      );

      // Enforce retention policy
      await enforceRetention(service.id);

      // Audit log
      await db.run(
        `INSERT INTO audit_log (id, action, actor, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), 'backup.completed', 'scheduler', service.id, JSON.stringify({ schedule, size: result.size }), finishedAt]
      );

      logger.info(
        { serviceId: service.id, schedule, size: result.size },
        'Backup successful'
      );
    } catch (error) {
      logger.error(
        error,
        { serviceId: service.id, schedule },
        'Backup failed'
      );

      const finishedAt = Math.floor(Date.now() / 1000);
      await db.run(
        `UPDATE backups SET status = ?, finished_at = ?, error = ? WHERE id = ?`,
        ['failed', finishedAt, error.message, backupId]
      );

      // Audit log
      await db.run(
        `INSERT INTO audit_log (id, action, actor, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [randomUUID(), 'backup.failed', 'scheduler', service.id, JSON.stringify({ schedule, error: error.message }), finishedAt]
      );
    }
  }

  /**
   * Manually trigger a backup now.
   */
  async triggerBackup(serviceId, schedule) {
    try {
      const service = await db.get(
        'SELECT * FROM services WHERE id = ?',
        [serviceId]
      );

      if (!service) {
        throw new Error('Service not found');
      }

      await this._backupService(service, schedule);
      logger.info({ serviceId, schedule }, 'Manual backup triggered');
    } catch (error) {
      logger.error(error, 'Manual backup failed');
      throw error;
    }
  }

  /**
   * Stop all scheduled tasks.
   */
  stop() {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    logger.info('Scheduler stopped');
  }
}

export default new BackupScheduler();
