#!/bin/sh
set -e

# Backend internal port (configurable via env)
export BACKEND_PORT=${BACKEND_PORT:-3000}

# External port (for Caddy/Railway)
export PORT=${PORT:-80}

echo "=========================================="
echo "Railway Manage - Starting Services..."
echo "=========================================="

# Start backend in background
echo "[1/3] Starting backend on port $BACKEND_PORT..."
PORT=$BACKEND_PORT node /app/services/backend/index.js &
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
if [ ! -f /usr/share/caddy/index.html ]; then
  echo "✗ Frontend files not found in /usr/share/caddy"
  echo "  Available files:"
  ls -la /usr/share/caddy/ || echo "  Directory does not exist"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
fi
echo "✓ Frontend files verified"

# Generate Caddyfile at runtime (same approach as dev's inline Caddy config)
cat > /tmp/Caddyfile <<EOF
{
  auto_https off
  admin off
}

:$PORT {
  root * /usr/share/caddy

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

echo "Formatting Caddyfile..."
caddy fmt --overwrite /tmp/Caddyfile

echo ""
echo "=========================================="
echo "✓ All services ready!"
echo "=========================================="
echo "Backend:  http://localhost:$BACKEND_PORT"
echo "Frontend: http://localhost:$PORT"
echo "=========================================="
echo ""

# Start Caddy in foreground
caddy run --config /tmp/Caddyfile
