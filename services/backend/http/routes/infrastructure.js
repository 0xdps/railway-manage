import { authHook } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import railwayClient from '../../railway/client.js';
import config from '../../core/config.js';
import logger from '../../core/logger.js';
import db from '../../core/db.js';

/**
 * Infrastructure routes: services, metrics, deployments
 */
export async function registerInfrastructureRoutes(server) {
  /**
   * GET /api/services
   * Returns list of services available in the project/environment.
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
        return { services };
      } catch (error) {
        logger.error(error, 'Failed to fetch services');
        return reply.status(500).send({ error: 'Failed to fetch services' });
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
        const metrics = await railwayClient.getServiceMetrics(
          serviceId,
          config.railwayEnvironmentId
        );
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
        const deployments = await railwayClient.getDeployments(
          serviceId,
          config.railwayEnvironmentId
        );
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
