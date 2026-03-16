import { randomUUID } from 'crypto';
import cron from 'node-cron';
import { authHook } from '../middleware/auth.js';
import logger from '../../core/logger.js';
import db from '../../core/db.js';

/**
 * Jobs and audit log routes.
 */
export async function registerJobsAndAuditRoutes(server) {
  /**
   * GET /api/jobs
   * Returns list of scheduled backup jobs.
   */
  server.get('/api/jobs', { onRequest: authHook }, async (request, reply) => {
    try {
      const jobs = db.all('SELECT * FROM jobs ORDER BY job_type');
      return { jobs };
    } catch (error) {
      logger.error(error, 'Failed to fetch jobs');
      return reply.status(500).send({ error: 'Failed to fetch jobs' });
    }
  });

  /**
   * PUT /api/jobs/:id
   * Update a job (enable/disable/reschedule).
   */
  server.put(
    '/api/jobs/:id',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { enabled, schedule } = request.body || {};

        const updates = [];
        const params = [];

        if (typeof enabled === 'boolean') {
          updates.push('enabled = ?');
          params.push(enabled ? 1 : 0);
        }

        if (schedule) {
          if (!cron.validate(schedule)) {
            return reply.status(400).send({ error: 'Invalid cron expression' });
          }
          updates.push('schedule = ?');
          params.push(schedule);
        }

        if (updates.length === 0) {
          return reply.status(400).send({ error: 'Nothing to update' });
        }

        params.push(id); // id goes last for WHERE clause

        const sql = `UPDATE jobs SET ${updates.join(', ')} WHERE id = ?`;
        db.run(sql, params);

        logger.info({ jobId: id }, 'Job updated');

        db.run(
          'INSERT INTO audit_log (id, action, actor, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            randomUUID(),
            'job.update',
            'admin',
            id,
            JSON.stringify({ enabled, schedule }),
            Math.floor(Date.now() / 1000),
          ]
        );

        return { message: 'Job updated', jobId: id };
      } catch (error) {
        logger.error(error, 'Failed to update job');
        return reply.status(500).send({ error: 'Failed to update job' });
      }
    }
  );

  /**
   * GET /api/audit
   * Returns audit log entries.
   */
  server.get(
    '/api/audit',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { limit = 100, offset = 0 } = request.query || {};
        const cappedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
        const cappedOffset = Math.max(parseInt(offset, 10) || 0, 0);
        const auditLog = db.all(
          'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?',
          [cappedLimit, cappedOffset]
        );
        return { auditLog };
      } catch (error) {
        logger.error(error, 'Failed to fetch audit log');
        return reply.status(500).send({ error: 'Failed to fetch audit log' });
      }
    }
  );
}
