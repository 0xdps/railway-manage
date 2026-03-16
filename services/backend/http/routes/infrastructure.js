import { authHook } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import railwayClient from '../../railway/client.js';
import config from '../../core/config.js';
import logger from '../../core/logger.js';
import db from '../../core/db.js';
import restartMonitor from '../../restart/monitor.js';

/**
 * Infrastructure routes: services, metrics, deployments, tags
 */
export async function registerInfrastructureRoutes(server) {
  /**
   * GET /api/services
   * Returns enriched list of services: source, status, domains, volumes,
   * numReplicas + locally-stored tags.
   */
  server.get(
    '/api/services',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const services = await railwayClient.getServices(
          config.railwayProjectId,
          config.railwayEnvironmentId
        );

        // Merge in tags + type_override from local DB
        const metaRows = db.all('SELECT service_id, tags, type_override FROM service_meta', []);
        const metaMap = {};
        for (const row of metaRows) {
          metaMap[row.service_id] = {
            tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
            typeOverride: row.type_override || null,
          };
        }

        const enriched = services.map((svc) => ({
          ...svc,
          tags:         (metaMap[svc.id] || {}).tags         || [],
          typeOverride: (metaMap[svc.id] || {}).typeOverride || null,
        }));

        return { services: enriched };
      } catch (error) {
        logger.error(error, 'Failed to fetch services');
        return reply.status(500).send({ error: 'Failed to fetch services' });
      }
    }
  );

  /**
   * PUT /api/services/:serviceId/type-override
   * Body: { typeOverride: string | null }  — persists or clears a type label.
   */
  server.put(
    '/api/services/:serviceId/type-override',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const { typeOverride } = request.body || {};
        const VALID = ['PostgreSQL', 'MySQL', 'Redis', 'MongoDB', 'Nginx', 'GitHub', 'Docker', 'Service',
                       'Node.js', 'Python', 'Go', 'PHP', 'Ruby', 'Java', 'Rust', '.NET', 'Elixir', null];
        if (!VALID.includes(typeOverride ?? null)) {
          return reply.status(400).send({ error: 'Invalid typeOverride value' });
        }
        db.run(
          `INSERT INTO service_meta (service_id, tags, type_override, created_at)
           VALUES (?, '[]', ?, ?)
           ON CONFLICT(service_id) DO UPDATE SET type_override = excluded.type_override`,
          [serviceId, typeOverride || null, Math.floor(Date.now() / 1000)]
        );
        return { typeOverride: typeOverride || null };
      } catch (error) {
        logger.error(error, 'Failed to update type override');
        return reply.status(500).send({ error: 'Failed to update type override' });
      }
    }
  );

  /**
   * PUT /api/services/:serviceId/tags
   * Body: { tags: string[] }
   * Upserts the tag list for a service in local DB.
   */
  server.put(
    '/api/services/:serviceId/tags',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const { tags } = request.body;

        if (!Array.isArray(tags)) {
          return reply.status(400).send({ error: 'tags must be an array' });
        }

        // Sanitise: lowercase, alphanumeric + hyphen only, max 24 chars
        const clean = tags
          .map((t) => String(t).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24))
          .filter(Boolean)
          .slice(0, 10);

        db.run(
          `INSERT INTO service_meta (service_id, tags, created_at)
           VALUES (?, ?, ?)
           ON CONFLICT(service_id) DO UPDATE SET tags = excluded.tags`,
          [serviceId, JSON.stringify(clean), Math.floor(Date.now() / 1000)]
        );

        return { tags: clean };
      } catch (error) {
        logger.error(error, 'Failed to update service tags');
        return reply.status(500).send({ error: 'Failed to update tags' });
      }
    }
  );

  /**
   * GET /api/metrics/:serviceId
   * Returns CPU and memory metrics for a service.
   */
  server.get(
    '/api/metrics/:serviceId',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const metrics = await railwayClient.getServiceMetrics(serviceId);
        return { metrics };
      } catch (error) {
        logger.error(error, 'Failed to fetch metrics');
        return reply.status(500).send({ error: 'Failed to fetch metrics' });
      }
    }
  );

  /**
   * GET /api/deployments/:serviceId
   * Returns recent deployments for a service.
   */
  server.get(
    '/api/deployments/:serviceId',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const deployments = await railwayClient.getDeployments(serviceId);
        return { deployments };
      } catch (error) {
        logger.error(error, 'Failed to fetch deployments');
        return reply.status(500).send({ error: 'Failed to fetch deployments' });
      }
    }
  );

  /**
   * POST /api/deployments/:serviceId/restart
   * Restart (redeploy) a service.
   */
  server.post(
    '/api/deployments/:serviceId/restart',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const deployment = await railwayClient.redeployService(
          serviceId,
          config.railwayEnvironmentId
        );

        logger.info({ serviceId }, 'Service redeployed');

        // Audit log
        db.run(
          'INSERT INTO audit_log (id, action, actor, target, created_at) VALUES (?, ?, ?, ?, ?)',
          [
            randomUUID(),
            'service.restart',
            'admin',
            serviceId,
            Math.floor(Date.now() / 1000),
          ]
        );

        return { deployment };
      } catch (error) {
        logger.error(error, 'Failed to restart service');
        return reply
          .status(500)
          .send({ error: 'Failed to restart service' });
      }
    }
  );

  /**
   * GET /api/services/:serviceId/metrics/history?hours=3
   * Returns locally-stored metric_samples for CPU + memory (default 3 hours).
   */
  server.get(
    '/api/services/:serviceId/metrics/history',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const hours = Math.min(Number(request.query.hours) || 3, 3);
        const since = Math.floor(Date.now() / 1000) - hours * 3600;

        const rows = db.all(
          `SELECT measurement, ts, value FROM metric_samples
           WHERE service_id = ? AND ts >= ?
           ORDER BY measurement, ts ASC`,
          [serviceId, since]
        );

        const cpu = rows.filter((r) => r.measurement === 'CPU_USAGE').map((r) => ({ ts: r.ts, value: r.value }));
        const mem = rows.filter((r) => r.measurement === 'MEMORY_USAGE_GB').map((r) => ({ ts: r.ts, value: r.value }));

        return { cpu, mem };
      } catch (error) {
        logger.error(error, 'Failed to fetch metric history');
        return reply.status(500).send({ error: 'Failed to fetch metric history' });
      }
    }
  );

  /**
   * GET /api/services/:serviceId/restart-policy
   */
  server.get(
    '/api/services/:serviceId/restart-policy',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const policy = db.get(
          `SELECT * FROM restart_policies WHERE service_id = ?`,
          [serviceId]
        );
        return { policy: policy || null };
      } catch (error) {
        logger.error(error, 'Failed to fetch restart policy');
        return reply.status(500).send({ error: 'Failed to fetch restart policy' });
      }
    }
  );

  /**
   * PUT /api/services/:serviceId/restart-policy
   * Body: { enabled, cpu_threshold, mem_threshold_gb, window_minutes,
   *         violation_ratio, restart_cron, cooldown_minutes }
   */
  server.put(
    '/api/services/:serviceId/restart-policy',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const {
          enabled = 0,
          cpu_threshold = null,
          mem_threshold_gb = null,
          window_minutes = 5,
          violation_ratio = 0.8,
          restart_cron = null,
          cooldown_minutes = 30,
        } = request.body;

        // Input validation
        if (cpu_threshold != null && (cpu_threshold <= 0 || cpu_threshold > 1)) {
          return reply.status(400).send({ error: 'cpu_threshold must be between 0 and 1 (e.g. 0.9 for 90%)' });
        }
        if (mem_threshold_gb != null && mem_threshold_gb <= 0) {
          return reply.status(400).send({ error: 'mem_threshold_gb must be positive' });
        }
        if (violation_ratio <= 0 || violation_ratio > 1) {
          return reply.status(400).send({ error: 'violation_ratio must be between 0 and 1' });
        }
        if (window_minutes < 1 || window_minutes > 60) {
          return reply.status(400).send({ error: 'window_minutes must be between 1 and 60' });
        }

        const now = Math.floor(Date.now() / 1000);
        db.run(
          `INSERT INTO restart_policies
             (service_id, enabled, cpu_threshold, mem_threshold_gb, window_minutes,
              violation_ratio, restart_cron, cooldown_minutes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(service_id) DO UPDATE SET
             enabled          = excluded.enabled,
             cpu_threshold    = excluded.cpu_threshold,
             mem_threshold_gb = excluded.mem_threshold_gb,
             window_minutes   = excluded.window_minutes,
             violation_ratio  = excluded.violation_ratio,
             restart_cron     = excluded.restart_cron,
             cooldown_minutes = excluded.cooldown_minutes,
             updated_at       = excluded.updated_at`,
          [serviceId, enabled ? 1 : 0, cpu_threshold, mem_threshold_gb,
           window_minutes, violation_ratio, restart_cron || null, cooldown_minutes, now]
        );

        const saved = db.get(`SELECT * FROM restart_policies WHERE service_id = ?`, [serviceId]);

        // Reload cron tasks in the monitor with new policy
        restartMonitor.reloadPolicy(serviceId, saved);

        logger.info({ serviceId }, 'Restart policy updated');
        return { policy: saved };
      } catch (error) {
        logger.error(error, 'Failed to update restart policy');
        return reply.status(500).send({ error: 'Failed to update restart policy' });
      }
    }
  );

  /**
   * GET /api/restart-policies
   * Returns all configured restart policies (for the Manage page).
   */
  server.get(
    '/api/restart-policies',
    { onRequest: authHook },
    async (_, reply) => {
      try {
        const policies = db.all('SELECT * FROM restart_policies ORDER BY updated_at DESC');
        return reply.send({ policies });
      } catch (error) {
        logger.error(error, 'Failed to fetch restart policies');
        return reply.status(500).send({ error: 'Failed to fetch restart policies' });
      }
    }
  );

  /**
   * GET /api/services/:serviceId/variable?key=VAR_NAME
   * Returns the decrypted value of a single Railway variable (on-demand reveal).
   */
  server.get(
    '/api/services/:serviceId/variable',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const key = String(request.query.key || '').trim();
        if (!key) return reply.status(400).send({ error: 'key query param is required' });
        const value = await railwayClient.getServiceVariable(
          serviceId, key, config.railwayEnvironmentId, config.railwayProjectId
        );
        return { value };
      } catch (error) {
        logger.error(error, 'Failed to fetch variable value');
        return reply.status(500).send({ error: 'Failed to fetch variable value' });
      }
    }
  );

  /**
   * PUT /api/services/:serviceId/variable?key=VAR_NAME
   * Body: { value: string }  — updates the variable via Railway API.
   */
  server.put(
    '/api/services/:serviceId/variable',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const key = String(request.query.key || '').trim();
        const { value } = request.body || {};
        if (!key)           return reply.status(400).send({ error: 'key query param is required' });
        if (value == null)  return reply.status(400).send({ error: 'value is required' });
        await railwayClient.updateServiceVariable(
          serviceId, key, String(value), config.railwayEnvironmentId, config.railwayProjectId
        );
        db.run(
          'INSERT INTO audit_log (id, action, actor, target, created_at) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), 'variable.update', 'admin', `${serviceId}:${key}`, Math.floor(Date.now() / 1000)]
        );
        logger.info({ serviceId, key }, 'Variable updated');
        return { ok: true };
      } catch (error) {
        logger.error(error, 'Failed to update variable');
        return reply.status(500).send({ error: 'Failed to update variable' });
      }
    }
  );
}
