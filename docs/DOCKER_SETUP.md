# Docker Local Development Setup

This document explains how to develop Railway-Manage using Docker for feature parity with production.

## ✨ What's New

This project now uses a **clean microservices structure** with Docker:

- **services/backend/** - Node.js Fastify API
- **services/frontend/** - React Vite Dashboard
- **caddy/** - Reverse proxy configuration
- **docker-compose.yaml** - Local development orchestration
- **Justfile** - Task runner for all operations
- **Root directory** - Clean and organized

## 🚀 Getting Started

### Prerequisites

```bash
# Check Node.js version
node --version  # Must be >= 20.0.0

# Check Docker
docker --version
docker-compose --version

# Install Just (macOS)
brew install just

# Or download from: https://github.com/casey/just
```

### First Time Setup

```bash
# 1. Setup .env configuration
just env-setup

# 2. Edit .env if needed (credentials, secrets)
nano .env

# 3. Choose your development method:

# Option A: Local development (fastest iteration, no Docker)
just dev:local

# Option B: Docker development (production-like, reproducible)
just docker-dev
```

## 📂 Project Structure Explained

### services/backend
Node.js application with structured modules:
```
services/backend/
├── core/              # Configuration, logging, database
├── http/              # API routes and middleware
│   ├── routes/       # /api/auth, /api/services, etc.
│   ├── middleware/   # Authentication
│   └── server.js     # Fastify server setup
├── backup/           # Backup engine
│   ├── storage.js    # Volume storage adapter
│   ├── scheduler.js  # Cron job scheduler
│   ├── workers/      # Backup workers (postgres, mysql)
│   └── retention.js  # Retention policies
├── railway/          # Railway API client
├── index.js          # Entry point
└── package.json      # Dependencies
```

### services/frontend
React application with routing:
```
services/frontend/
├── src/
│   ├── pages/       # Login, Dashboard, Services, Backups, Jobs, Audit
│   ├── components/  # Shared UI components
│   ├── api.js       # API client wrapper
│   └── main.jsx     # React entry point
├── vite.config.js   # Vite build configuration
└── package.json     # Dependencies
```

### caddy/
Reverse proxy routing configuration:
```
caddy/
└── Caddyfile        # Routes /api/* → backend, /* → frontend
```

## 🛠️ Justfile Recipes

All development tasks use `just`:

```bash
# Show all available recipes
just --list

# Show development guide
just info
```

### Development

```bash
# Local development (no Docker)
just dev                    # Start backend + frontend
just backend-dev           # Backend only (port 3000)
just frontend-dev          # Frontend only (port 5173)

# Install only
just install               # Both services
just backend-install       # Backend only
just frontend-install      # Frontend only
```

### Docker Development

```bash
# Full Docker setup (recommended for testing production setup)
just docker-dev            # Build images & start all services
just docker-build          # Build images only
just docker-up             # Start services (images must exist)
just docker-down           # Stop all services
just docker-logs           # View all logs (streaming)
just docker-logs-service backend  # Backend logs only
just docker-restart        # Restart all services
just docker-reset          # Full reset (remove volumes + containers)
```

### Build & Production

```bash
# Production image for Railway
just build-prod            # Build to docker image

# Maintenance
just fmt                   # Format code (prettier)
just lint                  # Lint code (eslint)
just clean-all             # Remove dependencies and data
just clean-cache           # Remove node_modules
just clean-data            # Remove local data directory
```

## 🐳 Docker Compose Services

### Local Development (docker-compose.yaml)

Three services are orchestrated:

#### **backend** service
- **Image**: Multi-stage build from services/backend/Dockerfile
- **Target**: `development` stage (with --watch)
- **Port**: 3000
- **Volumes**: `./services/backend` (live reload), `./data` (persistent)
- **Health Check**: `curl http://localhost:3000/health`
- **Environment**: All variables from .env

#### **frontend** service
- **Image**: Multi-stage build from services/frontend/Dockerfile
- **Target**: `development` stage (Vite dev server)
- **Port**: 5173
- **Volumes**: `./services/frontend` (live reload)
- **Depends On**: backend (waits for health check)
- **Environment**: `VITE_API_URL=http://backend:3000`

#### **caddy** service
- **Image**: caddy:2-alpine (4MB image)
- **Port**: 80 (reverse proxy)
- **Config**: caddy/Caddyfile
- **Routing**:
  - `/api/*` → backend:3000
  - `/health` → backend:3000
  - `/*` → frontend:5173 (SPA routing with fallback to /index.html)

## 🔄 Development Workflows

### Workflow 1: Local Development (Fastest)

```bash
# Terminal 1: Backend
just backend-dev
# → Running on http://localhost:3000

# Terminal 2: Frontend
just frontend-dev
# → Running on http://localhost:5173
# → Proxy to http://localhost:3000/api

# Edit files and see changes instantly
```

**Pros**: Fastest iteration, no Docker overhead
**Cons**: Requires Node.js 20+, manual service management

### Workflow 2: Docker Development (Recommended)

```bash
# Single command setup
just docker-dev
# → Backend on localhost:3000
# → Frontend on localhost (via Caddy)
# → Caddy reverse proxy on localhost:80

# View logs
just docker-logs

# Edit files in `services/*/` and see changes via volume mounts
```

**Pros**: Production-like, isolated environment, same setup as production
**Cons**: Slower than local dev, Docker required

### Workflow 3: Production Build Testing

```bash
# Build production image (combines backend + frontend + Caddy)
just build-prod

# Run production image locally
docker run -p 3000:80 -e ADMIN_KEY=test railway-manage:latest

# Access on http://localhost:3000
```

**Pros**: Exact production simulation
**Cons**: Slowest to iterate

## 📝 Key Files Reference

| File | Purpose |
|------|---------|
| `Justfile` | All task recipes (replaces npm scripts) |
| `docker-compose.yaml` | Local dev environment orchestration |
| `Dockerfile` | Production multi-stage build |
| `services/backend/Dockerfile` | Backend service build (dev + prod targets) |
| `services/frontend/Dockerfile` | Frontend service build (dev + prod targets) |
| `caddy/Caddyfile` | Reverse proxy routing configuration |
| `.env` | Environment variables (create from .env.example) |
| `services/backend/package.json` | Backend dependencies |
| `services/frontend/package.json` | Frontend dependencies |
| `package.json` | Root orchestration scripts |
| `start.sh` | Production service startup script |

## 🔍 Debugging

### Check Service Status

```bash
# View all running containers
docker ps

# View service-specific logs
just docker-logs-service backend
just docker-logs-service frontend
just docker-logs-service caddy

# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh
```

### Common Issues

#### Ports Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>

# Or use different port
PORT=3001 just docker:up
```

#### Docker Daemon Not Running

```bash
# macOS with Docker Desktop
open /Applications/Docker.app

# Linux
sudo systemctl start docker
```

#### Frontend Can't Connect to Backend

```bash
# Verify network connectivity in Docker
docker-compose exec frontend ping backend

# Check backend is healthy
just docker-logs-service backend | tail -20
```

#### Data Not Persisting

```bash
# Check volume is mounted
docker-compose exec backend ls -la /data

# Ensure local directory exists
mkdir -p data
chmod 777 data
```

## 🚢 Deployment

### Build for Production

```bash
# Create production image
just build-prod

# Tag for registry
docker tag railway-manage:latest <registry>/railway-manage:latest

# Push to Railway
docker push <registry>/railway-manage:latest
```

### Deploy to Railway

```bash
# Configure in railway.json
# Deploy via CLI
railway up

# Or use web dashboard
# https://railway.app
```

## 📚 Further Reading

- [Main README](../README.md)
- [Architecture Documentation](../docs/ARCHITECTURE.md)
- [Backend Setup](../services/backend/README.md)
- [Frontend Setup](../services/frontend/README.md)

## 💡 Tips

1. **Use `just` for everything** - It's easier than remembering docker-compose commands
2. **Check logs early** - `just docker-logs` shows issues immediately
3. **Keep .env secure** - Never commit to git (it's in .gitignore)
4. **Data persists locally** - `./data/` directory contains SQLite database
5. **Volumes are fast** - Docker volume mounts preserve live reload
6. **Health checks ensure readiness** - docker-compose waits for services to be healthy

## 🆘 Support Checklist

- [ ] Node.js 20+ installed
- [ ] Docker and Docker Compose installed
- [ ] Just installed
- [ ] `.env` file created with valid values
- [ ] Can run `just --list` without errors
- [ ] Can run `just backend-dev` successfully
- [ ] Docker daemon running (for `just docker-dev`)
- [ ] No port conflicts (3000, 5173, 80)
