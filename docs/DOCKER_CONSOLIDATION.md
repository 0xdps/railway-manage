# Docker Architecture Consolidation

## Summary

Refactored railway-manage to follow the post-pigeon pattern: **single Dockerfile with multiple build stages** instead of separate service-specific Dockerfiles.

## What Changed

### ✅ Updated Files

1. **Dockerfile** (root)
   - Now has three stages: `dev`, `builder`, `prod`
   - `dev`: Backend development with `node --watch` 
   - `builder`: Builds both backend + frontend
   - `prod`: Final production image (Caddy + Node.js)
   - Single source of truth for all builds

2. **docker-compose.yaml**
   - Uses `--profile dev` for development services
   - Backend: Targets the `dev` stage from root Dockerfile
   - Frontend: Targets `Dockerfile.dev` (development-only Vite)
   - Caddy: Uses dynamic inline Caddyfile config (no mounted file)
   - Volume mounts for hot reload

3. **Justfile**
   - Updated docker commands to use `--profile dev` flag
   - `just docker-build` - Builds with dev profile
   - `just docker-up` - Starts with dev profile
   - `just build-prod --target prod` - Builds production image
   - Fixed recipe names (docker-build, docker-logs-service, etc.)

4. **services/frontend/Dockerfile.dev** (NEW)
   - Simple development-only image
   - Runs Vite dev server with hot reload
   - Used only for local docker-compose development

5. **README.md**
   - Updated structure diagram (removed old Dockerfiles)
   - Documented single Dockerfile approach
   - Fixed recipe command references (env-setup, docker-build, etc.)

### ❌ Files That Should Be Deleted

These are now redundant and can be safely removed:

```bash
# Run these commands to clean up:
rm services/backend/Dockerfile
rm services/frontend/Dockerfile  
rm caddy/Caddyfile
```

## Why This Approach?

### ✨ Benefits

1. **Single Source of Truth**
   - One Dockerfile for all builds (dev, builder, prod)
   - Easy to maintain and understand
   - Better version control (fewer file changes)

2. **Clear Separation**
   - Dev stage: Fast iteration with live reload
   - Builder stage: Full build pipeline
   - Prod stage: Optimized production image

3. **Matches post-pigeon Pattern**
   - Consistent across your projects
   - Proven approach for multi-service apps
   - Easier for new contributors

4. **Simpler docker-compose**
   - Uses `--profile dev` to activate only dev services
   - Volume mounts for hot reload
   - Dynamic Caddy config (no file maintenance)

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│ Dockerfile (root)                       │
├─────────────────────────────────────────┤
│                                         │
│  FROM node:20-alpine AS dev             │
│  └─> Backend dev (node --watch)         │
│      Used by: docker-compose            │
│      Hot reload: ./services/backend     │
│                                         │
│  FROM node:20-alpine AS builder         │
│  └─> Builds backend + frontend          │
│      Used by: both dev and prod         │
│                                         │
│  FROM caddy:2-alpine AS prod            │
│  └─> Final production image             │
│      Contains: Backend + Frontend dist  │
│      Routing: Caddy reverse proxy       │
│      Used by: Railway deployment        │
│                                         │
└─────────────────────────────────────────┘

┌──────────────────────────────────────┐
│ docker-compose.yaml                  │
├──────────────────────────────────────┤
│ profiles: ["dev"]  ← Only for dev    │
│                                      │
│ backend:   target: dev               │
│ frontend:  Dockerfile.dev            │
│ caddy:     dynamic config            │
└──────────────────────────────────────┘
```

## Development Workflows

### Local (No Docker)
```bash
just dev
# Runs backend + frontend locally with your system Node.js
```

### Docker Development
```bash
just docker-dev
# Builds images, starts all services with volume mounts for hot reload
# Services routed through Caddy on port 80
```

### Production Build
```bash
just build-prod
# docker build -f Dockerfile --target prod -t railway-manage:latest .
# Creates single production image for Railway
```

## Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `Dockerfile` | Root - all build stages | ✅ Updated |
| `docker-compose.yaml` | Dev orchestration | ✅ Updated |
| `services/frontend/Dockerfile.dev` | Frontend dev only | ✅ Created |
| `services/backend/Dockerfile` | Old - DELETE | ❌ Remove |
| `services/frontend/Dockerfile` | Old - DELETE | ❌ Remove |
| `caddy/Caddyfile` | Old - DELETE | ❌ Remove |
| `Justfile` | Task recipes | ✅ Updated |
| `README.md` | Documentation | ✅ Updated |

## Next Steps

1. **Remove old files** (run in terminal):
   ```bash
   rm services/backend/Dockerfile
   rm services/frontend/Dockerfile
   rm caddy/Caddyfile
   ```

2. **Test the new setup**:
   ```bash
   just docker-dev          # Test Docker workflow
   just docker-logs         # Check service logs
   just docker-down         # Cleanup
   ```

3. **Commit changes**:
   ```bash
   git add -A
   git commit -m "chore: consolidate Docker setup to single Dockerfile"
   ```

## Validation

Run these to verify everything works:

```bash
# Check Justfile recipes
just --list | grep docker

# Test build
just docker-build

# Test startup
just docker-up
curl http://localhost:3000/health
curl http://localhost

# Cleanup
just docker-down
```

## Notes

- The `caddy/` directory can be kept (for organization) but the Caddyfile is no longer used
- Caddyfile config is now generated dynamically at runtime in docker-compose
- For production on Railway, the start.sh still orchestrates Caddy creation
- Volume mounts in docker-compose enable live reload for both services
