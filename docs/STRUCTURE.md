# Project Structure

Railway-Manage uses a clean, organized microservices structure with Docker.

## Root Directory

```
railway-manage/
├── .env                 # Environment variables (create from .env.example)
├── .env.example         # Environment template
├── .dockerignore        # Docker build context exclusions
├── .gitignore          # Git exclusions (node_modules, data, etc.)
├── Dockerfile          # Production multi-service build
├── Justfile            # Task runner (replaces npm/shell scripts)
├── README.md           # Main documentation
├── docker-compose.yaml # Local development orchestration
├── package.json        # Root-level scripts only (simplified)
├── package-lock.json   # Generated
├── railway.json        # Railway deployment config
├── start.sh            # Production service startup
│
├── caddy/              # Reverse proxy configuration
│   └── Caddyfile      # Routes /api to backend, /* to frontend
│
├── docs/               # Documentation
│   ├── ARCHITECTURE.md # System design and components
│   └── DOCKER_SETUP.md # Docker development guide
│
├── services/           # Application services (microservices)
│   ├── backend/        # Node.js Fastify API
│   │   ├── Dockerfile # Multi-stage build (dev & prod)
│   │   ├── package.json
│   │   ├── index.js   # Entry point
│   │   │
│   │   ├── core/      # Foundation modules
│   │   │   ├── config.js      # Configuration management
│   │   │   ├── logger.js      # Pino logger
│   │   │   └── db.js          # SQLite database
│   │   │
│   │   ├── http/      # REST API layer
│   │   │   ├── server.js           # Fastify setup
│   │   │   ├── middleware/
│   │   │   │   └── auth.js        # JWT authentication
│   │   │   └── routes/
│   │   │       ├── auth.js        # /api/auth
│   │   │       ├── infrastructure.js # /api/services, /api/metrics
│   │   │       ├── backups.js     # /api/backups
│   │   │       └── jobs.js        # /api/jobs
│   │   │
│   │   ├── backup/    # Backup engine
│   │   │   ├── storage.js      # Volume storage adapter
│   │   │   ├── scheduler.js    # Cron job orchestration
│   │   │   ├── retention.js    # Backup retention policies
│   │   │   └── workers/
│   │   │       └── index.js   # Postgres/MySQL/Redis workers
│   │   │
│   │   └── railway/   # Railway.app integration
│   │       └── client.js       # GraphQL API client
│   │
│   └── frontend/       # React Vite Dashboard
│       ├── Dockerfile  # Multi-stage build (dev & prod)
│       ├── package.json
│       ├── index.html  # SPA entry point
│       ├── vite.config.js
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       │
│       └── src/
│           ├── main.jsx         # React entry
│           ├── App.jsx          # Router shell
│           ├── api.js           # API client wrapper
│           ├── index.css        # Global styles
│           │
│           ├── components/
│           │   └── Layout.jsx  # Sidebar, navbar
│           │
│           └── pages/
│               ├── Login.jsx    # Authentication page
│               ├── Dashboard.jsx # Overview
│               ├── Services.jsx  # Service management
│               ├── Backups.jsx   # Backup history
│               ├── Jobs.jsx      # Scheduled jobs
│               └── Audit.jsx     # Audit log
│
└── data/               # Persistent local data (gitignored)
    ├── railway-manage.sqlite  # SQLite database
    ├── backups/              # Backup storage
    └── logs/                 # Application logs
```

## Key Design Decisions

### 1. Microservices in Single Repo (`services/`)

Why together?
- **Same deployment cycle** - backend + frontend released together
- **Simple development** - Single dev environment for full stack
- **Easy routing** - Reverse proxy (Caddy) handles routing

When to split:
- Once backend APIs are stable (used by other teams)
- Once frontend becomes a separate product
- When scaling frontend independent of backend

### 2. Clean Root Directory

Only essential files at root:
- **Configuration files** (.env, docker-compose.yaml, Dockerfile, railway.json)
- **Task runner** (Justfile replaces package.json scripts)
- **Documentation** (README, docs/)
- **Git** (.gitignore, .git/)

All code is in `services/` ✓

### 3. Docker Multi-Stage Builds

Each service has a `Dockerfile` with:
- **builder stage**: Install dependencies, prepare code
- **development stage**: Dev server with hot reload (used in docker-compose)
- **production stage**: Optimized production image

Root `Dockerfile` combines both services for Railway deployment:
- Builds backend and frontend separately
- Combines into single image with Caddy
- Health checks included
- Data volume for persistence

### 4. Justfile Over npm Scripts

Why `just` instead of npm scripts?
- **Universal** - Works across backend/frontend/root
- **Human-readable** - Clear task dependencies
- **Flexible** - Mix shell, Node, and other tools
- **Organized** - Grouped by functionality
- **Documentation** - Built-in help (`just --list`)

### 5. docker-compose for Local, Railway for Production

**Local Development**:
- docker-compose.yaml with 3 services
- volume mounts for live reload
- networks for inter-service communication
- health checks for readiness

**Production**:
- Single Docker image (built from Dockerfile)
- Railway handles orchestration
- start.sh manages backend + frontend + Caddy
- Volume mounts for persistent data

## Database Schema

SQLite database at `data/railway-manage.sqlite`:

```sql
-- Services to backup
services (
  id UUID PRIMARY KEY,
  name VARCHAR,
  type VARCHAR,  -- 'postgres', 'mysql', 'redis'
  conn_string VARCHAR,
  enabled BOOLEAN
)

-- Backup records
backups (
  id UUID PRIMARY KEY,
  service_id UUID,
  schedule VARCHAR,  -- 'hourly', 'daily', 'weekly', 'monthly'
  started_at INTEGER,
  finished_at INTEGER,
  status VARCHAR,  -- 'running', 'success', 'failed'
  size_bytes INTEGER,
  location VARCHAR,  -- file path
  error VARCHAR
)

-- Restore operations
restores (
  id UUID PRIMARY KEY,
  backup_id UUID,
  started_at INTEGER,
  finished_at INTEGER,
  status VARCHAR
)

-- Scheduled jobs
jobs (
  id UUID PRIMARY KEY,
  job_type VARCHAR,  -- 'backup_hourly', 'backup_daily', etc.
  schedule VARCHAR,  -- cron expression
  enabled BOOLEAN,
  last_run_at INTEGER,
  next_run_at INTEGER
)

-- Audit trail
audit_log (
  id UUID PRIMARY KEY,
  action VARCHAR,  -- 'backup.start', 'restore.complete', etc.
  actor VARCHAR,   -- 'scheduler', 'admin', 'api'
  target VARCHAR,  -- resource ID
  meta JSON,       -- additional context
  created_at INTEGER
)
```

## Deployment Flow

```
Local Development
    ↓
    ├─ Option A: just dev (no Docker)
    └─ Option B: just docker-dev (Docker)
            ↓
   [Edit code] → [Live reload via volumes]
            ↓
Production Build
    │
    └─ just build-prod
            ↓
       docker build -f Dockerfile -t railway-manage:latest .
            ↓
       Multi-stage build combines:
       • services/backend/(code + deps)
       • services/frontend/dist/(built React)
       • caddy:2-alpine (reverse proxy)
            ↓
       Single image: ~500MB (Node + Caddy + assets)
            ↓
Railway Deployment
    │
    └─ docker push <registry>/railway-manage:latest
            ↓
       Railway pulls image
            ↓
       start.sh orchestrates:
       • Backend on :3000
       • Caddy health check
       • Caddy on :80 (reverse proxy)
            ↓
       Services available at:
       • http://railway-app.up.railway.app/
```

## File Ownership & Responsibilities

| Path | Responsibility | Technology |
|------|-----------------|------------|
| `services/backend/**` | Backend team | Node.js 20, Fastify |
| `services/frontend/**` | Frontend team | React 18, Vite, Tailwind |
| `caddy/**` | DevOps / Full-stack | Caddy 2 |
| `docs/**` | Documentation owner | Markdown |
| `Justfile` | Full-stack / DevOps | Just |
| `docker-compose.yaml` | Full-stack / DevOps | Docker Compose |
| `Dockerfile` | Full-stack / DevOps | Docker |
| `.env*` | DevOps / Security | Environment config |

## Dependency Tree

```
railway-manage/
├── Backend Dependencies
│   ├── fastify (web framework)
│   ├── better-sqlite3 (database)
│   ├── jose (JWT)
│   ├── node-cron (scheduling)
│   └── pino (logging)
│
├── Frontend Dependencies
│   ├── react
│   ├── vite (build)
│   ├── tailwindcss (styling)
│   └── react-router-dom (routing)
│
├── Infrastructure
│   ├── docker (containerization)
│   ├── docker-compose (orchestration)
│   ├── caddy (reverse proxy)
│   └── just (task runner)
│
└── DevOps
    ├── railway.json (deployment)
    ├── start.sh (service orchestration)
    └── .env (configuration)
```

## Next Steps

To extend this structure:

1. **Add new backend routes** → `services/backend/http/routes/[feature].js`
2. **Add new frontend pages** → `services/frontend/src/pages/[Feature].jsx`
3. **Add new tasks** → Add recipes to `Justfile`
4. **Add new services** → Create in `services/[service]/` with Dockerfile
5. **Add documentation** → Create in `docs/[topic].md`

All changes follow the same clean, organized structure.
