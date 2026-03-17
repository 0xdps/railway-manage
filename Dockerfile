# Builder stage - compile both backend and frontend with native modules for Linux
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++ build-base linux-headers postgresql17-client mysql-client redis

# Copy package.json files for both services
COPY services/backend/package*.json ./services/backend/
COPY services/frontend/package*.json ./services/frontend/

# Clear npm cache to ensure clean build (no cached prebuilt binaries)
RUN npm cache clean --force

# Install backend dependencies WITHOUT prebuilt binaries
# This forces better-sqlite3 to compile from source for Linux architecture
RUN cd services/backend && \
    npm install --verbose --no-optional 2>&1 | tee npm-install.log && \
    cd /app

# Verify better-sqlite3 was compiled correctly (check file type)
RUN apk add --no-cache file
RUN file /app/services/backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node

# Install frontend dependencies
RUN cd services/frontend && npm install && cd /app

# Copy backend source files
COPY services/backend/core ./services/backend/core
COPY services/backend/http ./services/backend/http
COPY services/backend/railway ./services/backend/railway
COPY services/backend/backup ./services/backend/backup
COPY services/backend/restart ./services/backend/restart
COPY services/backend/metrics ./services/backend/metrics
COPY services/backend/index.js ./services/backend/

# Copy frontend source files
COPY services/frontend/src ./services/frontend/src
COPY services/frontend/index.html ./services/frontend/
COPY services/frontend/vite.config.js ./services/frontend/
COPY services/frontend/postcss.config.js ./services/frontend/
COPY services/frontend/tailwind.config.js ./services/frontend/

# Build frontend
RUN npm --prefix services/frontend run build

# Dev stage - backend with node --watch for hot reload
# Uses precompiled node_modules from builder (contains Linux-compiled better-sqlite3)
FROM node:22-alpine AS dev
WORKDIR /app
RUN apk add --no-cache curl postgresql17-client mysql-client redis

# Copy precompiled backend dependencies FROM BUILDER (not from macOS host)
COPY --from=builder /app/services/backend/node_modules ./services/backend/node_modules

# Copy source files from host
COPY services/backend/core ./services/backend/core
COPY services/backend/http ./services/backend/http
COPY services/backend/railway ./services/backend/railway
COPY services/backend/backup ./services/backend/backup
COPY services/backend/restart ./services/backend/restart
COPY services/backend/metrics ./services/backend/metrics
COPY services/backend/index.js ./services/backend/
COPY services/backend/package.json ./services/backend/

EXPOSE 3000
CMD ["node", "--watch", "services/backend/index.js"]

# Production stage - Node 22 (ABI-compatible with builder) + official Caddy binary
# Caddy binary is copied from the official image to avoid apk community-repo availability issues.
FROM caddy:2-alpine AS caddy-bin

FROM node:22-alpine AS prod
# Pull the official Caddy binary from the caddy image
COPY --from=caddy-bin /usr/bin/caddy /usr/bin/caddy
RUN apk add --no-cache curl postgresql17-client mysql-client redis
WORKDIR /app
RUN mkdir -p /usr/share/caddy /var/data /data

# Copy precompiled backend dependencies FROM BUILDER (contains Linux-compiled better-sqlite3)
COPY --from=builder /app/services/backend/node_modules ./services/backend/node_modules

# Copy backend code and config
COPY --from=builder /app/services/backend/core ./services/backend/core
COPY --from=builder /app/services/backend/http ./services/backend/http
COPY --from=builder /app/services/backend/railway ./services/backend/railway
COPY --from=builder /app/services/backend/backup ./services/backend/backup
COPY --from=builder /app/services/backend/restart ./services/backend/restart
COPY --from=builder /app/services/backend/metrics ./services/backend/metrics
COPY --from=builder /app/services/backend/index.js ./services/backend/
COPY --from=builder /app/services/backend/package.json ./services/backend/

# Copy built frontend
COPY --from=builder /app/services/frontend/dist /usr/share/caddy

# Startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80 443

# Default to production stage
CMD ["/app/start.sh"]
