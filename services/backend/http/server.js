import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifyCompress from '@fastify/compress';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../core/config.js';
import logger from '../core/logger.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerInfrastructureRoutes } from './routes/infrastructure.js';
import { registerBackupRoutes } from './routes/backups.js';
import { registerJobsAndAuditRoutes } from './routes/jobs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = Fastify({
  trustProxy: true,
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
// - POST   /api/auth/login
// - DELETE /api/auth/logout
// - GET    /api/auth/me
// - GET    /api/services
// - GET    /api/metrics/:serviceId
// - GET    /api/deployments/:serviceId
// - POST   /api/deployments/:serviceId/restart
// - GET    /api/backups
// - POST   /api/backups/trigger
// - POST   /api/restore
// - GET    /api/jobs
// - PUT    /api/jobs/:id
// - GET    /api/audit

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
