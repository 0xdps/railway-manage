import { randomUUID } from 'crypto';
import { authHook } from '../middleware/auth.js';
import logger from '../../core/logger.js';
import db from '../../core/db.js';
import railwayClient from '../../railway/client.js';
import config from '../../core/config.js';

/**
 * Managed services CRUD routes.
 *
 * A "managed service" is a Railway service that this app will back up.
 * Credentials are NEVER stored — we store only the env var key name.
 * At backup time the actual value is fetched live from the Railway API.
 */
export async function registerManagedServiceRoutes(server) {
  /**
   * GET /api/managed-services
   * List all managed services (no credential values exposed).
   */
  server.get(
    '/api/managed-services',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const services = db.all(
          'SELECT id, name, type, railway_service_id, env_var_key, enabled, created_at FROM services ORDER BY created_at DESC'
        );
        return { services };
      } catch (error) {
        logger.error(error, 'Failed to fetch managed services');
        return reply.status(500).send({ error: 'Failed to fetch managed services' });
      }
    }
  );

  /**
   * POST /api/managed-services
   * Register a new service to back up.
   * Body: { name, type, railway_service_id, env_var_key }
   */
  server.post(
    '/api/managed-services',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { name, type, railway_service_id, env_var_key } = request.body || {};

        if (!name || !type || !railway_service_id || !env_var_key) {
          return reply
            .status(400)
            .send({ error: 'Missing required fields: name, type, railway_service_id, env_var_key' });
        }

        const validTypes = ['postgres', 'mysql', 'redis'];
        if (!validTypes.includes(type)) {
          return reply
            .status(400)
            .send({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
        }

        const id = randomUUID();
        const createdAt = Math.floor(Date.now() / 1000);

        db.run(
          `INSERT INTO services (id, name, type, railway_service_id, env_var_key, enabled, created_at)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [id, name.trim(), type, railway_service_id, env_var_key.trim(), createdAt]
        );

        db.run(
          'INSERT INTO audit_log (id, action, actor, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            randomUUID(),
            'managed_service.create',
            'admin',
            id,
            JSON.stringify({ name, type }),
            createdAt,
          ]
        );

        logger.info({ serviceId: id, name, type }, 'Managed service created');
        return reply.status(201).send({ service: { id, name, type, railway_service_id, env_var_key, enabled: 1, created_at: createdAt } });
      } catch (error) {
        logger.error(error, 'Failed to create managed service');
        return reply.status(500).send({ error: 'Failed to create managed service' });
      }
    }
  );

  /**
   * PUT /api/managed-services/:id
   * Update name, type, env_var_key, or enabled state.
   */
  server.put(
    '/api/managed-services/:id',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { name, type, railway_service_id, env_var_key, enabled } = request.body || {};

        const existing = db.get('SELECT id FROM services WHERE id = ?', [id]);
        if (!existing) {
          return reply.status(404).send({ error: 'Service not found' });
        }

        const updates = [];
        const params = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
        if (type !== undefined) {
          const validTypes = ['postgres', 'mysql', 'redis'];
          if (!validTypes.includes(type)) {
            return reply.status(400).send({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
          }
          updates.push('type = ?'); params.push(type);
        }
        if (railway_service_id !== undefined) { updates.push('railway_service_id = ?'); params.push(railway_service_id); }
        if (env_var_key !== undefined) { updates.push('env_var_key = ?'); params.push(env_var_key.trim()); }
        if (typeof enabled === 'boolean') { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }

        if (updates.length === 0) {
          return reply.status(400).send({ error: 'Nothing to update' });
        }

        params.push(id);
        db.run(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`, params);

        db.run(
          'INSERT INTO audit_log (id, action, actor, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [
            randomUUID(),
            'managed_service.update',
            'admin',
            id,
            JSON.stringify({ name, type, enabled }),
            Math.floor(Date.now() / 1000),
          ]
        );

        return { message: 'Service updated', serviceId: id };
      } catch (error) {
        logger.error(error, 'Failed to update managed service');
        return reply.status(500).send({ error: 'Failed to update managed service' });
      }
    }
  );

  /**
   * DELETE /api/managed-services/:id
   * Remove a managed service (does not delete existing backup files).
   */
  server.delete(
    '/api/managed-services/:id',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const existing = db.get('SELECT id, name FROM services WHERE id = ?', [id]);
        if (!existing) {
          return reply.status(404).send({ error: 'Service not found' });
        }

        // Remove dependent rows to satisfy FK constraints before deleting the service
        db.run('DELETE FROM restores WHERE backup_id IN (SELECT id FROM backups WHERE service_id = ?)', [id]);
        db.run('DELETE FROM backups WHERE service_id = ?', [id]);
        db.run('DELETE FROM services WHERE id = ?', [id]);

        db.run(
          'INSERT INTO audit_log (id, action, actor, target, created_at) VALUES (?, ?, ?, ?, ?)',
          [randomUUID(), 'managed_service.delete', 'admin', id, Math.floor(Date.now() / 1000)]
        );

        logger.info({ serviceId: id }, 'Managed service deleted');
        return { message: 'Service deleted' };
      } catch (error) {
        logger.error(error, 'Failed to delete managed service');
        return reply.status(500).send({ error: 'Failed to delete managed service' });
      }
    }
  );

  /**
   * GET /api/services/:serviceId/variable-keys
   * Returns only the ENV VAR KEY NAMES for a Railway service — no values!
   * Used in the UI to let users pick which variable holds the connection string.
   */
  server.get(
    '/api/services/:serviceId/variable-keys',
    { onRequest: authHook },
    async (request, reply) => {
      try {
        const { serviceId } = request.params;
        const keys = await railwayClient.getServiceVariableKeys(
          serviceId,
          config.railwayEnvironmentId,
          config.railwayProjectId
        );
        return { keys };
      } catch (error) {
        logger.error(error, 'Failed to fetch variable keys');
        return reply.status(500).send({ error: 'Failed to fetch variable keys for service' });
      }
    }
  );
}
