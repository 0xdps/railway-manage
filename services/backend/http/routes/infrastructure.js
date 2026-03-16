import { authHook } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import railwayClient from '../../railway/client.js';
import config from '../../core/config.js';
import logger from '../../core/logger.js';
import db from '../../core/db.js';

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

        // Merge in tags from local DB
        const metaRows = db.all('SELECT service_id, tags FROM service_meta', []);
        const tagsMap = {};
        for (const row of metaRows) {
          try { tagsMap[row.service_id] = JSON.parse(row.tags); } catch { tagsMap[row.service_id] = []; }
        }

        const enriched = services.map((svc) => ({
          ...svc,
          tags: tagsMap[svc.id] || [],
        }));

        return { services: enriched };
      } catch (error) {
        logger.error(error, 'Failed to fetch services');
        return reply.status(500).send({ error: 'Failed to fetch services' });
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
}
