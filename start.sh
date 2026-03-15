#!/bin/bash
set -e

# Backend internal port (configurable via env)
export BACKEND_PORT=${BACKEND_PORT:-3000}

# External port (for Caddy/Railway)
export PORT=${PORT:-80}

# Data directory
export DATA_DIR=${DATA_DIR:-/var/data}

echo "=========================================="
echo "Railway Manage - Starting Services..."
echo "=========================================="

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# Start backend in background
echo "[1/3] Starting backend on port $BACKEND_PORT..."
cd /app/backend
PORT=$BACKEND_PORT node index.js &
BACKEND_PID=$!

# Wait for backend to be ready
echo "[2/3] Waiting for backend health check..."
max_attempts=30
attempt=0
until curl -sf http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -eq $max_attempts ]; then
    echo "✗ Backend failed to start on port $BACKEND_PORT after ${max_attempts}s"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
  echo "  Attempt $attempt/$max_attempts - waiting for backend..."
  sleep 1
done

echo "✓ Backend ready on port $BACKEND_PORT"

# Check frontend files
echo "[3/3] Configuring Caddy..."
if [ ! -f /app/frontend/dist/index.html ]; then
  echo "✗ Frontend files not found in /app/frontend/dist"
  echo "  Available files:"
  ls -la /app/frontend/dist/ || echo "  Directory does not exist"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi
echo "✓ Frontend files verified"

# Generate Caddyfile with correct backend port
cat > /etc/caddy/Caddyfile <<EOF
{
  auto_https off
  admin off
}

:$PORT {
  root * /app/frontend/dist

  handle /api/* {
    reverse_proxy localhost:${BACKEND_PORT}
  }

  handle /health {
    reverse_proxy localhost:${BACKEND_PORT}
  }

  handle /assets/* {
    header Cache-Control "public, max-age=31536000"
    file_server
  }

  handle {
    try_files {path} /index.html
    file_server
  }
}
EOF

echo "✓ Caddyfile generated"

# Format Caddyfile
caddy fmt --overwrite /etc/caddy/Caddyfile 2>/dev/null || true

echo ""
echo "=========================================="
echo "✓ All services ready!"
echo "=========================================="
echo "Backend:  http://localhost:$BACKEND_PORT"
echo "Frontend: http://localhost:$PORT"
echo "=========================================="
echo ""

# Start Caddy in foreground
caddy run --config /etc/caddy/Caddyfile
