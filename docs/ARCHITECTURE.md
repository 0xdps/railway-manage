# Railway-Manage — Build Plan

## What We're Building

Internal disaster-recovery and operations control plane for Railway-hosted projects.
Single Railway service: Node.js backend (Fastify) + React Vite dashboard, served together
via Caddy. All infrastructure data comes from the Railway GraphQL API.

---

## Decisions Made

| Concern | Decision |
|---|---|
| Auth | `ADMIN_KEY` env var as password; `SESSION_SECRET` signs a JWT stored in an httpOnly cookie (7-day expiry) |
| Frontend | React + Vite in `dashboard/` sub-folder; Caddy routes `/api/*` → backend, everything else → SPA |
| Infrastructure data | Railway GraphQL API (`https://backboard.railway.app/graphql/v2`) for services, CPU, RAM, deployments, restarts |
| Metrics | Railway API metrics (per-service CPU & memory usage) |
| Backup storage | Service volume (`/data/backups/`) for now; adapter abstraction allows R2/S3 later |
| Database (metadata) | SQLite (`better-sqlite3`) at `/data/db/railway-manage.sqlite` |
| Scheduler | `node-cron` for periodic backup and cleanup jobs |
| Logging | `pino` |

---

## Repository Structure

```
railway-manage/
├── service/                        # Backend — Node.js 20+ / Fastify
│   ├── index.js                    # Entry point: starts server + scheduler
│   ├── core/
│   │   ├── config.js               # All env var reads (ADMIN_KEY, SESSION_SECRET, RAILWAY_TOKEN, …)
│   │   ├── db.js                   # better-sqlite3 singleton + schema init
│   │   └── logger.js               # pino instance
│   ├── railway/
│   │   └── client.js               # Railway GraphQL client (services, metrics, restart, deploy)
│   ├── backup/
│   │   ├── workers/
│   │   │   ├── postgres.js         # pg_dump → gzip → volume
│   │   │   ├── mysql.js            # mysqldump → gzip → volume
│   │   │   └── redis.js            # redis-cli BGSAVE → copy → gzip → volume
│   │   ├── storage.js              # VolumeStorage adapter (write/read/delete on /data/backups/)
│   │   ├── scheduler.js            # node-cron: hourly/daily/weekly/monthly jobs
│   │   └── retention.js            # Cleanup: enforce hourly-24 / daily-7 / weekly-4 / monthly-12
│   └── http/
│       ├── server.js               # Fastify instance, register plugins + routes
│       ├── middleware/
│       │   └── auth.js             # requireAuth hook: verify JWT cookie; createSession; clearSession
│       └── routes/
│           ├── auth.js             # POST /api/auth/login  •  DELETE /api/auth/logout  •  GET /api/auth/me
│           ├── services.js         # GET  /api/services  (Railway GQL)
│           ├── metrics.js          # GET  /api/metrics/:serviceId  (Railway GQL CPU/RAM)
│           ├── deployments.js      # GET  /api/deployments/:serviceId  •  POST /api/deployments/:serviceId/restart
│           ├── backups.js          # GET  /api/backups  •  POST /api/backups/trigger
│           ├── restore.js          # POST /api/restore
│           ├── jobs.js             # GET  /api/jobs  •  PUT /api/jobs/:id  (enable/disable/reschedule)
│           └── audit.js            # GET  /api/audit
│
├── dashboard/                      # Frontend — React 18 + Vite + Tailwind CSS
│   ├── index.html
│   ├── vite.config.js              # dev proxy: /api → localhost:3000
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 # Router: public /login, protected /*
│       ├── api.js                  # fetch wrapper (credentials: include)
│       ├── components/
│       │   ├── Layout.jsx          # Shell: sidebar nav + topbar
│       │   ├── ServiceCard.jsx
│       │   ├── MetricBar.jsx
│       │   ├── BackupRow.jsx
│       │   └── ConfirmDialog.jsx
│       └── pages/
│           ├── Login.jsx           # Admin key form → POST /api/auth/login
│           ├── Dashboard.jsx       # Overview: services summary + recent backups + alerts
│           ├── Services.jsx        # Per-service status, CPU/RAM, restart/redeploy buttons
│           ├── Backups.jsx         # Backup list, manual trigger, restore button
│           ├── Jobs.jsx            # Cron job schedule management
│           └── Audit.jsx           # Audit log table
│
├── Dockerfile                      # Multi-stage: node builder → caddy:2-alpine prod
├── start.sh                        # Starts backend on $BACKEND_PORT, waits for health, then Caddy
├── railway.json                    # builder: DOCKERFILE; volume mount /data
├── .env.example
├── .gitignore
├── package.json                    # Root: dev scripts with concurrently
└── PLAN.md                         # ← this file
```

---

## SQLite Schema

```sql
-- Registered database services to back up
CREATE TABLE services (
  id          TEXT PRIMARY KEY,         -- UUID
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,            -- 'postgres' | 'mysql' | 'redis'
  conn_string TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

-- Individual backup files
CREATE TABLE backups (
  id          TEXT PRIMARY KEY,         -- UUID
  service_id  TEXT NOT NULL,
  schedule    TEXT NOT NULL,            -- 'hourly' | 'daily' | 'weekly' | 'monthly'
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  size_bytes  INTEGER,
  location    TEXT,                     -- relative path on volume: backups/<svc>/<name>.sql.gz
  status      TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'failed'
  error       TEXT
);

-- Restore operations
CREATE TABLE restores (
  id          TEXT PRIMARY KEY,
  backup_id   TEXT NOT NULL,
  started_at  INTEGER NOT NULL,
  finished_at INTEGER,
  status      TEXT NOT NULL DEFAULT 'running',
  error       TEXT
);

-- Cron job definitions
CREATE TABLE jobs (
  id          TEXT PRIMARY KEY,
  job_type    TEXT NOT NULL,            -- 'backup_hourly' | 'backup_daily' | etc.
  schedule    TEXT NOT NULL,            -- cron expression
  enabled     INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,
  next_run_at INTEGER
);

-- Audit log
CREATE TABLE audit_log (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,            -- 'backup.trigger' | 'restore.start' | 'service.restart' | …
  actor       TEXT NOT NULL DEFAULT 'admin',
  target      TEXT,                     -- service name or backup ID
  meta        TEXT,                     -- JSON blob for extra context
  created_at  INTEGER NOT NULL
);
```

---

## Environment Variables

```env
# Required
ADMIN_KEY=                   # Dashboard password
SESSION_SECRET=              # JWT / cookie signing secret (min 32 chars)
RAILWAY_TOKEN=               # Railway API token (Bearer or pt_ project token)
RAILWAY_PROJECT_ID=          # Railway project ID
RAILWAY_ENVIRONMENT_ID=      # Railway environment ID (e.g. production)

# Optional
PORT=3000                    # Backend port (Caddy proxies to this)
DATA_DIR=/data               # Root for SQLite + backup files
LOG_LEVEL=info
NODE_ENV=production
```

---

## Authentication Flow

1. User POSTs `{ key }` to `POST /api/auth/login`
2. Server does `timingSafeEqual(key, ADMIN_KEY)`
3. On success: create `{ admin: true }` JWT signed with `SESSION_SECRET`, set httpOnly cookie `rm_session` (7 days)
4. All `/api/*` routes (except `/api/auth/login` and `/api/health`) require the cookie
5. `DELETE /api/auth/logout` clears the cookie

---

## Railway GraphQL Queries Needed

```graphql
# Services list
query GetServices($projectId: String!) { ... }

# Service metrics (CPU + memory usages)
query GetServiceMetrics($serviceId: String!, $environmentId: String!) { ... }

# Latest deployment per service
query GetDeployments($serviceId: String!, $environmentId: String!) { ... }

# Restart (redeploy latest)
mutation ServiceInstanceRedeploy($serviceId: String!, $environmentId: String!) { ... }
```

Source: `https://backboard.railway.app/graphql/v2`
Token header: `Authorization: Bearer <RAILWAY_TOKEN>` or `Project-Access-Token: pt_...`

---

## Backup Workflow

```
node-cron fires
  → scheduler.js picks up affected backup jobs
    → worker (postgres/mysql/redis) runs dump command
      → output piped through gzip
        → written to /data/backups/<service_id>/<schedule>/<timestamp>.sql.gz
          → SQLite row inserted (status = running → success/failed)
            → retention.js deletes old files + DB rows per policy
```

Retention:
- `hourly` → keep last 24
- `daily` → keep last 7
- `weekly` → keep last 4
- `monthly` → keep last 12

---

## Caddy Routing (generated in start.sh)

```
:$PORT {
  handle /api/*  { reverse_proxy localhost:$BACKEND_PORT }
  handle /health { reverse_proxy localhost:$BACKEND_PORT }
  handle {
    try_files {path} /index.html
    file_server
  }
}
```

---

## Dockerfile Strategy (same as post-pigeon)

```
Stage 1 — builder (node:20-alpine)
  Install all deps, build dashboard (vite build → dashboard/dist/)

Stage 2 — prod (caddy:2-alpine)
  Install nodejs + npm
  Copy service/ + node_modules + dashboard/dist → /usr/share/caddy
  Copy start.sh
  CMD start.sh  (starts node backend → waits for /health → starts Caddy)
```

---

## railway.json

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  },
  "volumes": [{ "mountPath": "/data" }]
}
```

---

## Build Phases

### Phase 1 — Project Foundation
- [ ] Root `package.json` (scripts: dev with concurrently, build, start)
- [ ] `service/core/config.js` — reads and validates env vars
- [ ] `service/core/logger.js` — pino instance
- [ ] `service/core/db.js` — better-sqlite3 singleton + schema migration
- [ ] `.env.example`, `.gitignore`

### Phase 2 — Auth
- [ ] `service/http/middleware/auth.js` — JWT cookie helpers (jose)
- [ ] `service/http/routes/auth.js` — login / logout / me endpoints
- [ ] `service/http/server.js` — Fastify setup, cookie plugin, register routes

### Phase 3 — Railway GraphQL Client
- [ ] `service/railway/client.js` — wrapper with typed methods: `getServices`, `getMetrics`, `getDeployments`, `restartService`
- [ ] `service/http/routes/services.js`
- [ ] `service/http/routes/metrics.js`
- [ ] `service/http/routes/deployments.js`

### Phase 4 — Backup Engine
- [ ] `service/backup/storage.js` — VolumeStorage (mkdir, write stream, list, delete)
- [ ] `service/backup/workers/postgres.js`
- [ ] `service/backup/workers/mysql.js`
- [ ] `service/backup/workers/redis.js`
- [ ] `service/backup/retention.js`
- [ ] `service/backup/scheduler.js` — node-cron integration
- [ ] `service/http/routes/backups.js`
- [ ] `service/http/routes/restore.js`
- [ ] `service/http/routes/jobs.js`
- [ ] `service/http/routes/audit.js`

### Phase 5 — React Dashboard
- [ ] `dashboard/` scaffold (Vite + React + Tailwind + react-router-dom + lucide-react)
- [ ] `dashboard/src/api.js` — typed fetch helpers
- [ ] `Login.jsx` page
- [ ] `Layout.jsx` shell (sidebar with nav links)
- [ ] `Dashboard.jsx` — overview cards
- [ ] `Services.jsx` — service list + metrics + restart
- [ ] `Backups.jsx` — list, trigger manual backup, restore
- [ ] `Jobs.jsx` — cron schedule controls
- [ ] `Audit.jsx` — log table

### Phase 6 — Deployment
- [ ] `Dockerfile` (multi-stage: builder → caddy:2-alpine)
- [ ] `start.sh` (start node, healthcheck loop, generate Caddyfile inline, run caddy)
- [ ] `railway.json`
- [ ] `service/index.js` — top-level entry wires config + db + scheduler + server

---

## Key Design Notes

- **No ORM** — raw `better-sqlite3` with explicit SQL (same approach as railway-sercets)
- **No external queue** — cron fires synchronously in-process; only one backup runs per service at a time (lock via `status = 'running'` check)
- **Storage abstraction** — `storage.js` exports a class with `write(stream)`, `read(path)`, `list(prefix)`, `remove(path)` so swapping to R2 later only requires a new adapter
- **Railway client caching** — cache service list in SQLite (15-min TTL) to avoid hammering the API; metrics are always live
- **Timing-safe key comparison** — `crypto.timingSafeEqual` for ADMIN_KEY check (same as post-pigeon)
- **CSRF** — not needed for cookie+SameSite=Lax setup (API is same-origin via Caddy); HTTPS enforced in prod
