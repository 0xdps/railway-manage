# Railway-Manage Task Runner
# Usage: just <recipe> [args]

set shell := ["zsh", "-cu"]
set dotenv-load := true

# Configuration
env_file := ".env"
env_example := ".env.example"

# Default help
default:
  @just --list

# ============================================================================
# Development
# ============================================================================

# Install dependencies (backend + frontend)
install:
  #!/usr/bin/env zsh
  echo "📦 Installing dependencies..."
  cd services/backend && npm install
  cd ../.. 
  cd services/frontend && npm install
  echo "✓ Dependencies installed"

# Start local dev environment (backend + frontend without Docker)
dev:
  #!/usr/bin/env zsh
  just install
  echo "🚀 Starting development server..."
  npm run dev:local

# Start development with Docker Compose
docker-dev:
  #!/usr/bin/env zsh
  just docker-build
  just docker-up
  echo "🐳 Docker development environment started"
  echo "   Backend: http://localhost:3000"
  echo "   Frontend: http://localhost"
  echo "   Type 'just docker-logs' to see logs"

# ============================================================================
# Docker Commands
# ============================================================================

# Build Docker images (development)
docker-build:
  #!/usr/bin/env zsh
  echo "🔨 Building Docker images..."
  docker-compose -f docker-compose.yaml --profile dev build
  echo "✓ Images built"

# Start Docker Compose with dev profile
docker-up:
  #!/usr/bin/env zsh
  if [ ! -f "{{env_file}}" ]; then
    echo "❌ Missing .env file. Copy from .env.example:"
    echo "   cp {{env_example}} {{env_file}}"
    exit 1
  fi
  echo "🚀 Starting Docker Compose (dev profile)..."
  docker-compose -f docker-compose.yaml --profile dev up -d
  echo "✓ Services running"
  echo "   Backend: http://localhost:3000/health"
  echo "   Frontend: http://localhost"
  echo "   Caddy: http://localhost (reverse proxy)"

# Stop Docker Compose
docker-down:
  #!/usr/bin/env zsh
  echo "🛑 Stopping Docker Compose..."
  docker-compose -f docker-compose.yaml --profile dev down
  echo "✓ Services stopped"

# View logs from all Docker services
docker-logs:
  #!/usr/bin/env zsh
  docker-compose -f docker-compose.yaml --profile dev logs -f

# View logs for a specific service (backend, frontend, or caddy)
docker-logs-service service:
  #!/usr/bin/env zsh
  docker-compose -f docker-compose.yaml --profile dev logs -f {{service}}

# Rebuild and restart services
docker-restart:
  #!/usr/bin/env zsh
  @just docker-down
  @just docker-build
  @just docker-up
  echo "✓ Restarted"

# Clean containers, networks, and volumes (destructive)
docker-reset:
  #!/usr/bin/env zsh
  echo "⚠️  Removing containers, networks, and volumes..."
  docker-compose -f docker-compose.yaml --profile dev down -v
  echo "✓ Reset complete"

# ============================================================================
# Service Commands
# ============================================================================

# Install backend dependencies
backend-install:
  #!/usr/bin/env zsh
  echo "📦 Installing backend dependencies..."
  cd services/backend && npm install
  echo "✓ Backend ready"

# Start backend dev server (without Docker)
backend-dev:
  #!/usr/bin/env zsh
  @just backend-install
  echo "🚀 Starting backend..."
  cd services/backend && npm run dev

# Install frontend dependencies
frontend-install:
  #!/usr/bin/env zsh
  echo "📦 Installing frontend dependencies..."
  cd services/frontend && npm install
  echo "✓ Frontend ready"

# Start frontend dev server (without Docker)
frontend-dev:
  #!/usr/bin/env zsh
  @just frontend-install
  echo "🚀 Starting frontend..."
  cd services/frontend && npm run dev

# ============================================================================
# Build for Production
# ============================================================================

# Build production Docker image
build-prod:
  #!/usr/bin/env zsh
  echo "🔨 Building production image..."
  docker build -f Dockerfile --target prod -t railway-manage:latest .
  echo "✓ Production image ready: railway-manage:latest"

# ============================================================================
# Utilities
# ============================================================================

# Setup .env from example (if not exists)
env-setup:
  #!/usr/bin/env zsh
  if [ ! -f "{{env_file}}" ]; then
    echo "📝 Creating .env from .env.example..."
    cp {{env_example}} {{env_file}}
    echo "⚠️  Edit .env with your actual configuration"
  else
    echo "✓ .env already exists"
  fi

# Format code
fmt:
  #!/usr/bin/env zsh
  echo "🎨 Formatting code..."
  cd services/backend && npm run format 2>/dev/null || true
  cd ../../services/frontend && npm run format 2>/dev/null || true
  echo "✓ Code formatted"

# Lint code
lint:
  #!/usr/bin/env zsh
  echo "🔍 Linting code..."
  cd services/backend && npm run lint 2>/dev/null || true
  cd ../../services/frontend && npm run lint 2>/dev/null || true
  echo "✓ Linting complete"

# Remove all node_modules and package-lock files
clean-cache:
  #!/usr/bin/env zsh
  echo "🧹 Cleaning dependencies..."
  find services -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
  find services -name package-lock.json -delete
  echo "✓ Cache cleaned"

# Remove local data directory
clean-data:
  #!/usr/bin/env zsh
  echo "🗑️  Removing local data..."
  rm -rf data
  echo "✓ Data removed"

# Full clean (dependencies + data)
clean-all: clean-cache clean-data
  #!/usr/bin/env zsh
  echo "✓ Full cleanup complete"

# ============================================================================
# Recipes Summary
# ============================================================================

# Show this help
help:
  @just --list --unsorted

# Show development workflow
info:
  #!/usr/bin/env zsh
  echo ""
  echo "🚀 Railway-Manage Development Guide"
  echo "===================================="
  echo ""
  echo "📌 INITIAL SETUP:"
  echo "  1. just env-setup          # Create .env from example"
  echo "  2. just install            # Install frontend + backend deps"
  echo "  3. just dev                # Start local development"
  echo ""
  echo "🐳 DOCKER WORKFLOW:"
  echo "  just docker-dev            # Build images & start services"
  echo "  just docker-logs           # View all logs"
  echo "  just docker-logs-service backend  # View backend logs"
  echo "  just docker-restart        # Restart all services"
  echo "  just docker-reset          # Full reset (destructive)"
  echo ""
  echo "🛠️  SERVICE DEVELOPMENT:"
  echo "  just backend-dev           # Start backend only (no Docker)"
  echo "  just frontend-dev          # Start frontend only (no Docker)"
  echo ""
  echo "🧹 MAINTENANCE:"
  echo "  just fmt                   # Format code"
  echo "  just lint                  # Lint code"
  echo "  just clean-all             # Remove deps + data"
  echo ""
