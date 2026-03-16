import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyCompress from '@fastify/compress';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../core/config.js';
import logger from '../core/logger.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerInfrastructureRoutes } from './routes/infrastructure.js';
import { registerBackupRoutes } from './routes/backups.js';
import { registerJobsAndAuditRoutes } from './routes/jobs.js';
import { registerManagedServiceRoutes } from './routes/managed-services.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = Fastify({
  trustProxy: true,
});

// Security headers
await server.register(fastifyHelmet, {
  contentSecurityPolicy: false, // Caddy handles CSP in prod; disable to not break SPA in dev
});

// CORS — restrict origins from env; open in development
await server.register(fastifyCors, {
  origin:
    config.corsOrigins.length > 0
      ? config.corsOrigins
      : config.isDevelopment()
        ? true
        : false,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Global rate limit (generous default; tighter limit applied per-route where needed)
await server.register(fastifyRateLimit, {
  max: 200,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,
  errorResponseBuilder: () => ({
    error: 'Too many requests — please slow down',
  }),
});

// Register plugins
await server.register(fastifyCookie, { secret: config.sessionSecret });
await server.register(fastifyCompress);

// Health check endpoint (no auth required)
server.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register auth routes
await registerAuthRoutes(server);
await registerInfrastructureRoutes(server);
await registerBackupRoutes(server);
await registerJobsAndAuditRoutes(server);
await registerManagedServiceRoutes(server);
// - POST   /api/auth/login
// - DELETE /api/auth/logout
// - GET    /api/auth/me
// - GET    /api/services                       (Railway infrastructure services)
// - GET    /api/services/:serviceId/variable-keys
// - GET    /api/metrics/:serviceId
// - GET    /api/deployments/:serviceId
// - POST   /api/deployments/:serviceId/restart
// - GET    /api/backups
// - POST   /api/backups/trigger
// - POST   /api/restore
// - GET    /api/jobs
// - PUT    /api/jobs/:id
// - GET    /api/audit
// - GET    /api/managed-services
// - POST   /api/managed-services
// - PUT    /api/managed-services/:id
// - DELETE /api/managed-services/:id

// Serve React dashboard (SPA)
const dashboardPath = path.join(__dirname, '../../dashboard/dist');
await server.register(fastifyStatic, {
  root: dashboardPath,
  prefix: '/',
  constraints: {},
});

// SPA fallback: redirect all non-API routes to index.html
server.setNotFoundHandler((request, reply) => {
  if (!request.url.startsWith('/api') && !request.url.startsWith('/health')) {
    reply.sendFile('index.html');
  } else {
    reply.status(404).send({ error: 'Not Found' });
  }
});

export default server;
