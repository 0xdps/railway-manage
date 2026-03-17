# Railway-Manage Development & Production Task Runner

# Variables
COMPOSE_FILE := "docker-compose.yaml"
APP_INTERNAL_PORT := "8080"
CADDY_INTERNAL_PORT := "8080"
PORTLESS_ALIAS := "railway-manage"
PORTLESS_PROXY_PORT := "1355"

# Compose service names
DEV_CADDY_SERVICE := "caddy"
PROD_APP_SERVICE := "app"

# Default recipe when running `just`
default:
    @just --list

# Validate local prerequisites and runtime contract.
doctor:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v docker >/dev/null 2>&1 || { echo "❌ docker is required"; exit 1; }
    docker info >/dev/null 2>&1 || { echo "❌ Docker daemon is not running"; exit 1; }
    command -v node >/dev/null 2>&1 || { echo "❌ node is required"; exit 1; }
    command -v npm >/dev/null 2>&1 || { echo "❌ npm is required"; exit 1; }
    command -v just >/dev/null 2>&1 || { echo "❌ just is required"; exit 1; }
    [ -f .env ] || { echo "❌ .env missing. Run: cp .env.example .env"; exit 1; }
    npx portless --help >/dev/null 2>&1 || { echo "❌ Portless not available via npx"; exit 1; }
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev config >/dev/null
        docker-compose -f {{COMPOSE_FILE}} --profile prod config >/dev/null
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev config >/dev/null
        docker compose -f {{COMPOSE_FILE}} --profile prod config >/dev/null
    fi
    echo "✅ doctor: environment is ready"

# Validate compose profile contract.
contract:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev config >/dev/null
        docker-compose -f {{COMPOSE_FILE}} --profile prod config >/dev/null
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev config >/dev/null
        docker compose -f {{COMPOSE_FILE}} --profile prod config >/dev/null
    fi
    echo "✅ contract: compose profiles are valid"

# ============================================================================
# DEVELOPMENT RECIPES
# ============================================================================

# Start development environment with hot reload (Caddy + Backend + Frontend)
dev:
    #!/usr/bin/env bash
    set -euo pipefail

    [ -f .env ] || { echo "❌ .env missing. Run: cp .env.example .env"; exit 1; }
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE="docker-compose"
    else
        COMPOSE="docker compose"
    fi

    echo "🚀 Starting Railway-Manage Development Environment"
    echo ""
    echo "Starting Portless proxy..."
    npx portless proxy start >/dev/null 2>&1 || true

    echo "Starting containers (Docker will assign a random port)..."
    $COMPOSE -f {{COMPOSE_FILE}} --profile dev up -d --build --force-recreate {{DEV_CADDY_SERVICE}}

    tries=0
    max_tries=90
    PORT=""
    while [ $tries -lt $max_tries ]; do
        PORT=$($COMPOSE -f {{COMPOSE_FILE}} --profile dev port {{DEV_CADDY_SERVICE}} {{CADDY_INTERNAL_PORT}} 2>/dev/null | awk -F: '{print $NF}')
        if [ -n "$PORT" ]; then
            break
        fi
        tries=$((tries + 1))
        sleep 1
    done

    if [ -z "$PORT" ]; then
        echo "❌ Could not detect Caddy port. Check container status:"
        $COMPOSE -f {{COMPOSE_FILE}} --profile dev ps
        exit 1
    fi

    echo ""
    echo "✅ Services started successfully!"
    echo ""
    echo "Direct access:"
    echo "  → http://localhost:$PORT"
    echo ""
    npx portless alias {{PORTLESS_ALIAS}} $PORT >/dev/null 2>&1 || true
    echo "✅ Portless alias ready:"
    echo "  → http://{{PORTLESS_ALIAS}}.localhost:{{PORTLESS_PROXY_PORT}}"
    echo ""

    health_tries=0
    health_max=120
    while [ $health_tries -lt $health_max ]; do
        if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
            echo "✅ Dev service is healthy"
            break
        fi
        health_tries=$((health_tries + 1))
        sleep 1
    done
    if [ $health_tries -ge $health_max ]; then
        echo "⚠️  Dev service did not become healthy within timeout"
    fi

    cleanup() {
        $COMPOSE -f {{COMPOSE_FILE}} --profile dev down --remove-orphans >/dev/null 2>&1 || true
        npx portless alias --remove {{PORTLESS_ALIAS}} >/dev/null 2>&1 || true
    }
    trap cleanup EXIT INT TERM

    echo "Streaming app logs (backend + frontend)."
    echo "Ctrl+C stops containers."
    $COMPOSE -f {{COMPOSE_FILE}} --profile dev logs -f backend frontend

# Start development in background (silent)
dev-bg:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev up --build -d
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev up --build -d
    fi

# Start development locally without Docker (requires Node.js locally)
dev-local:
    npm run dev

# Start backend locally (direct Node.js)
dev-be-local:
    cd services/backend && node index.js

# Start frontend locally (direct Node.js)
dev-fe-local:
    cd services/frontend && npm run dev

# Stop all development services
down:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev down
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev down
    fi
    npx portless alias --remove {{PORTLESS_ALIAS}} >/dev/null 2>&1 || true

# View all logs
logs:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev logs -f backend frontend
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev logs -f backend frontend
    fi

# View backend logs only
logs-backend:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev logs -f backend
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev logs -f backend
    fi

# View frontend logs only
logs-frontend:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev logs -f frontend
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev logs -f frontend
    fi

# View Caddy logs only
logs-caddy:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev logs -f caddy
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev logs -f caddy
    fi

# Reset development environment (removes volumes and containers)
reset:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile dev down -v
        docker-compose -f {{COMPOSE_FILE}} --profile dev up --build
    else
        docker compose -f {{COMPOSE_FILE}} --profile dev down -v
        docker compose -f {{COMPOSE_FILE}} --profile dev up --build
    fi

# ============================================================================
# PRODUCTION RECIPES
# ============================================================================

# Start production environment
prod:
    #!/usr/bin/env bash
    echo "🚀 Starting Railway-Manage Production"
    echo ""
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE="docker-compose"
    else
        COMPOSE="docker compose"
    fi
    echo "Starting containers (Docker will assign a random port)..."
    $COMPOSE -f {{COMPOSE_FILE}} --profile prod up --build -d
    sleep 3

    PORT=$($COMPOSE -f {{COMPOSE_FILE}} --profile prod port {{PROD_APP_SERVICE}} {{APP_INTERNAL_PORT}} 2>/dev/null | awk -F: '{print $NF}')
    if [ -z "$PORT" ]; then
        echo "❌ Could not detect production port. Check container status:"
        $COMPOSE -f {{COMPOSE_FILE}} --profile prod ps
        exit 1
    fi

    echo ""
    echo "✅ Production started successfully!"
    echo ""
    echo "Direct access:"
    echo "  → http://localhost:$PORT"
    echo ""

# Start production in background
prod-bg:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile prod up --build -d
    else
        docker compose -f {{COMPOSE_FILE}} --profile prod up --build -d
    fi

# Stop production services
prod-down:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile prod down
    else
        docker compose -f {{COMPOSE_FILE}} --profile prod down
    fi

# View production logs
prod-logs:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile prod logs -f
    else
        docker compose -f {{COMPOSE_FILE}} --profile prod logs -f
    fi

# Reset production environment (removes volumes)
prod-reset:
    #!/usr/bin/env bash
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f {{COMPOSE_FILE}} --profile prod down -v
        docker-compose -f {{COMPOSE_FILE}} --profile prod up --build
    else
        docker compose -f {{COMPOSE_FILE}} --profile prod down -v
        docker compose -f {{COMPOSE_FILE}} --profile prod up --build
    fi

# ============================================================================
# BUILD RECIPES
# ============================================================================

# Build frontend
build-fe:
    cd services/frontend && npm run build

# Build backend (syntax check)
build-be:
    node -c services/backend/index.js

# Build both frontend and backend
build:
    just build-be
    just build-fe

# ============================================================================
# LINTING & FORMATTING
# ============================================================================

# Run ESLint
lint:
    #!/usr/bin/env bash
    cd services/backend && npm run lint 2>/dev/null || true
    cd ../frontend && npm run lint 2>/dev/null || true

# Format code
format:
    #!/usr/bin/env bash
    cd services/backend && npm run format 2>/dev/null || true
    cd ../frontend && npm run format 2>/dev/null || true

# Check formatting without changes
format-check:
    #!/usr/bin/env bash
    cd services/backend && npm run format:check 2>/dev/null || true
    cd ../frontend && npm run format:check 2>/dev/null || true

# Run all checks (lint + format check)
check:
    just lint
    just format-check

# ============================================================================
# INFRASTRUCTURE
# ============================================================================

# Install dependencies for all packages
install:
    npm --prefix services/backend install
    npm --prefix services/frontend install

# Setup .env from example (if not exists)
env-setup:
    #!/usr/bin/env bash
    if [ ! -f .env ]; then
        echo "📝 Creating .env from .env.example..."
        cp .env.example .env
        echo "⚠️  Edit .env with your actual configuration"
    else
        echo "✓ .env already exists"
    fi

# Remove all node_modules
clean:
    #!/usr/bin/env bash
    find services -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
    echo "✓ node_modules cleaned"
