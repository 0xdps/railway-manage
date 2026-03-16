import { createSession, clearSession, verifyAdminKey, authHook } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import logger from '../../core/logger.js';
import db from '../../core/db.js';

/**
 * Auth routes: login, logout, me
 */
export async function registerAuthRoutes(server) {
  /**
   * POST /api/auth/login
   * Body: { key: string }
   * Returns: { admin: bool, message: string }
   */
  server.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({
          error: 'Too many login attempts — try again in 15 minutes',
        }),
      },
    },
  }, async (request, reply) => {
    const { key } = request.body || {};
    if (!key || typeof key !== 'string') {
      return reply.status(400).send({ error: 'Missing or invalid key' });
    }

    if (!verifyAdminKey(key)) {
      logger.warn('Failed login attempt');
      // Audit log
      db.run(
        'INSERT INTO audit_log (id, action, actor, created_at) VALUES (?, ?, ?, ?)',
        [
          randomUUID(),
          'auth.login_failed',
          'unknown',
          Math.floor(Date.now() / 1000),
        ]
      );
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    await createSession(reply);
    logger.info('User logged in');

    // Audit log
    db.run(
      'INSERT INTO audit_log (id, action, actor, created_at) VALUES (?, ?, ?, ?)',
      [
        randomUUID(),
        'auth.login_success',
        'admin',
        Math.floor(Date.now() / 1000),
      ]
    );

    return { admin: true, message: 'Logged in successfully' };
  });

  /**
   * DELETE /api/auth/logout
   */
  server.delete(
    '/api/auth/logout',
    { onRequest: authHook },
    async (request, reply) => {
      clearSession(reply);
      logger.info('User logged out');

      db.run(
        'INSERT INTO audit_log (id, action, actor, created_at) VALUES (?, ?, ?, ?)',
        [
          randomUUID(),
          'auth.logout',
          'admin',
          Math.floor(Date.now() / 1000),
        ]
      );

      return { message: 'Logged out successfully' };
    }
  );

  /**
   * GET /api/auth/me
   */
  server.get('/api/auth/me', { onRequest: authHook }, async (request, reply) => {
    return { admin: true };
  });
}
