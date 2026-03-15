# Railway-Manage

Internal disaster-recovery and operations control plane for Railway-hosted projects.

## 🏗️ Project Structure

```
railway-manage/
├── services/                 # Microservices
│   ├── backend/             # Node.js Fastify API
│   │   ├── package.json
│   │   ├── core/           # Config, logger, database
│   │   ├── http/           # API routes and middleware
│   │   ├── backup/         # Backup engine
│   │   ├── railway/        # Railway API client
│   │   └── index.js
│   └── frontend/            # React + Vite dashboard
│       ├── package.json
│       ├── Dockerfile.dev   # Development image only
│       ├── src/
│       ├── vite.config.js
│       └── index.html
├── docs/                     # Documentation
│   └── ARCHITECTURE.md
├── Justfile                  # Task runner recipes
├── docker-compose.yaml       # Local development environment
├── Dockerfile               # Single source for all builds (dev, builder, prod)
├── start.sh                 # Service orchestration script
├── package.json             # Root orchestration
├── .env.example             # Environment template
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+** (for local development)
- **Docker & Docker Compose** (for containerized development)
- **Just** task runner (install via `brew install just` on macOS)

### Environment Setup

```bash
# Copy environment template
just env-setup

# Edit .env with your configuration
nano .env
```

Required environment variables:
```env
ADMIN_KEY=your-admin-key
SESSION_SECRET=32-char-minimum-secret-key
RAILWAY_TOKEN=your-railway-api-token
RAILWAY_PROJECT_ID=your-project-id
RAILWAY_ENVIRONMENT_ID=production
```

### Local Development (Without Docker)

```bash
# Install all dependencies
just install

# Start backend + frontend dev servers
just dev
```

This starts:
- **Backend**: `http://localhost:3000` (Node.js with --watch)
- **Frontend**: `http://localhost:5173` (Vite dev server)

### Docker Development (Recommended)

```bash
# Build images and start services
just docker-dev

# View logs
just docker:logs

# Stop services
just docker:down
```

This starts:
- **Backend**: `http://localhost:3000` (in container)
- **Reverse Proxy**: `http://localhost` (routes /api to backend, /* to frontend)
- **Frontend**: `http://localhost` (Vite in container)

## 📝 Task Runner (Just)

All common tasks are available through the `Justfile`. Use `just --list` to see all recipes.

### Development
```bash
just dev                       # Local dev (no Docker)
just docker-dev              # Docker dev (all services)
just backend-dev             # Backend only
just frontend-dev            # Frontend only
```

### Docker Management
```bash
just docker-build            # Build images
just docker-up               # Start services
just docker-down             # Stop services
just docker-logs             # View all logs
just docker-logs-service backend  # Backend logs only
just docker-restart          # Restart all services
just docker-reset            # Full reset (destructive)
```

### Build & Production
```bash
just build-prod              # Build production image
just install                 # Install all dependencies
just fmt                     # Format code
just lint                    # Lint code
just clean-all               # Remove deps + data
```

## 🐳 Docker Architecture

### Single Dockerfile, Three Stages

Railway-Manage uses a **single `Dockerfile`** with three build stages (inspired by post-pigeon):

1. **dev stage**: Backend development with `node --watch` for hot reload
2. **builder stage**: Builds both backend and frontend assets
3. **prod stage**: Final production image (Caddy 2 on Alpine + Node.js runtime)

### Local Development (docker-compose.yaml)
- **backend** service: Builds from root `Dockerfile` with `target: dev`
- **frontend** service: Builds from `services/frontend/Dockerfile.dev` (Vite only)
- **caddy** service: Reverse proxy with dynamic Caddyfile configuration
- **health checks**: Automatic service health monitoring
- **volume mounts**: Enable hot reload during development

### Production Build
```bash
docker build -f Dockerfile --target prod -t railway-manage:latest .
```

This creates:
- Single image combining Node.js backend + Caddy proxy + static frontend
- Minimal final size (based on `caddy:2-alpine`)
- No separate service dependencies
- Ready for Railway deployment

## 🔧 Service Configuration

### Backend Service
- **Port**: 3000 (internal), 80 (external via proxy)
- **Database**: SQLite at `./data/railway-manage.sqlite`
- **Backup Storage**: `./data/backups/`
- **Config**: `services/backend/core/config.js`

### Frontend Service
- **Port**: 5173 (dev), 80 (production)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: react-router-dom v6

### Reverse Proxy (Caddy)
- Routes `/api/*` → Backend
- Routes `/health` → Backend
- Routes `/*` → Frontend
- Automatic HTTPS (in production)
- Compression & security headers

## 📦 Dependencies

### Backend
- **fastify**: Web framework
- **better-sqlite3**: Database
- **jose**: JWT authentication
- **node-cron**: Job scheduling
- **pino**: Structured logging

### Frontend
- **react**: UI framework
- **vite**: Build tool
- **tailwindcss**: CSS utility framework
- **react-router-dom**: Client-side routing
- **lucide-react**: Icon library

## 🧪 Testing

### Local Testing
```bash
# Terminal 1: Backend
just backend:dev

# Terminal 2: Frontend
just frontend:dev

# Terminal 3: Test API
curl http://localhost:3000/api/auth/me -H "Cookie: rm_session=..."
```

### Docker Testing
```bash
just docker-dev

# Test from host
curl http://localhost/api/auth/me
curl http://localhost/  # Frontend
```

## 🚢 Deployment to Railway

```bash
# Build production image
just build:prod

# Push to Railway registry (configured in railway.json)
docker tag railway-manage:latest <registry>/railway-manage:latest
docker push <registry>/railway-manage:latest
```

Or use Railway CLI:
```bash
railway up
```

Configuration is in `railway.json`:
- Dockerfile: Multi-stage build
- Health check: `/health` endpoint
- Volume: `/var/data` for persistent storage
- Port: 80

## 🔐 Authentication

- **Admin Password**: `ADMIN_KEY` environment variable
- **Session Cookie**: JWT (`rm_session`)
- **Expiry**: 7 days
- **Timing-safe validation**: Prevents timing attacks

## 📊 Database Schema

SQLite database with 5 tables:
1. **services**: Service configurations
2. **backups**: Backup records
3. **restores**: Restore operations
4. **jobs**: Scheduled backup jobs
5. **audit_log**: Operation audit trail

## 🔄 Backup Scheduler

Automated backup jobs:
- **hourly**: Every hour
- **daily**: Every day at midnight
- **weekly**: Every Sunday at midnight
- **monthly**: First of month at midnight
- **cleanup**: Daily at 2 AM (retention enforcement)

Retention policies:
- Hourly: Keep 24 latest
- Daily: Keep 7 latest
- Weekly: Keep 4 latest
- Monthly: Keep 12 latest

## 📖 Documentation

- [Architecture & Design](docs/ARCHITECTURE.md)
- [API Documentation](./API.md) (generated from routes)
- [Backup System](./BACKUP.md)
- [Development Guide](./CONTRIBUTING.md)

## 🐛 Troubleshooting

### Docker containers won't start
```bash
# Check logs
just docker:logs

# Reset everything
just docker:reset
just docker-dev
```

### Backend not connecting in Docker
```bash
# Verify network connectivity
docker-compose exec frontend ping backend

# Check backend is running
just docker:logs-service backend
```

### Port already in use
```bash
# Find and kill process using port 3000
lsof -i :3000
kill -9 <PID>

# Try different port
PORT=3001 just docker:up
```

### Data not persisting
```bash
# Check volume mounted
docker-compose exec backend ls -la /data

# Ensure ./data directory exists locally
mkdir -p ./data
chmod 777 ./data
```

## 📝 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ADMIN_KEY` | Yes | - | Admin password for authentication |
| `SESSION_SECRET` | Yes | - | JWT secret (min 32 chars) |
| `RAILWAY_TOKEN` | Yes | - | Railway API token |
| `RAILWAY_PROJECT_ID` | Yes | - | Railway project ID |
| `RAILWAY_ENVIRONMENT_ID` | Yes | - | Railway environment (prod/staging) |
| `PORT` | No | 80 | External port (container) |
| `BACKEND_PORT` | No | 3000 | Internal backend port |
| `DATA_DIR` | No | /var/data | Persistent data directory |
| `LOG_LEVEL` | No | info | Logging level (debug/info/warn/error) |
| `NODE_ENV` | No | production | Environment (development/production) |

## 💡 Best Practices

1. **Always use `just` commands** instead of raw docker/npm
2. **Keep services stateless** (all state in /data)
3. **Use health checks** for production reliability
4. **Pin image tags** in production deployments
5. **Rotate secrets regularly** (ADMIN_KEY, SESSION_SECRET)
6. **Monitor logs** for errors and performance issues
7. **Test database backups** regularly
8. **Keep dependencies updated** (security patches)

## 📄 License

ISC

## 👤 Author

Devendra Pratap <dps.manit@gmail.com>
