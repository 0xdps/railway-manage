# ── Stage: build-core ────────────────────────────────────────────────────────
# Builds the mesahub-server Go binary for embedded mode.
# Override MESAHUB_CORE_VERSION to pin a specific commit/tag:
#   docker build --build-arg MESAHUB_CORE_VERSION=v1.0.0 .
FROM golang:1.24-alpine AS build-core
RUN apk add --no-cache gcc musl-dev sqlite-dev git
ARG MESAHUB_CORE_VERSION=trunk
RUN git clone --depth 1 --branch ${MESAHUB_CORE_VERSION} \
    https://github.com/0xdps/mesahub-core.git /mesahub-core
WORKDIR /mesahub-core/server
RUN CGO_ENABLED=1 GOOS=linux go build -o /go/bin/mesahub-server ./cmd/server

# ── Stage: build-backend ──────────────────────────────────────────────────────
FROM node:22-alpine AS build-backend
WORKDIR /app/backend
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY services/backend/package.json services/backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY services/backend/ ./

# ── Stage: build-frontend ─────────────────────────────────────────────────────
FROM node:22-alpine AS build-frontend
WORKDIR /app/frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY services/frontend/package.json services/frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY services/frontend/ ./
RUN pnpm run build

# ── Stage: caddy ─────────────────────────────────────────────────────────────
FROM caddy:2-alpine AS caddy-bin

# ── Stage: prod ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS prod
COPY --from=caddy-bin /usr/bin/caddy /usr/bin/caddy
RUN apk add --no-cache curl openssl postgresql17-client mysql-client redis
WORKDIR /app

# mesahub-server (for embedded mode — skipped if MESAHUB_URL points to external)
COPY --from=build-core /go/bin/mesahub-server /usr/local/bin/mesahub-server
RUN mkdir -p /data
VOLUME ["/data"]

RUN mkdir -p /usr/share/caddy

# Backend runtime
COPY --from=build-backend /app/backend/node_modules ./services/backend/node_modules
COPY --from=build-backend /app/backend/core          ./services/backend/core
COPY --from=build-backend /app/backend/http          ./services/backend/http
COPY --from=build-backend /app/backend/railway       ./services/backend/railway
COPY --from=build-backend /app/backend/backup        ./services/backend/backup
COPY --from=build-backend /app/backend/restart       ./services/backend/restart
COPY --from=build-backend /app/backend/metrics       ./services/backend/metrics
COPY --from=build-backend /app/backend/index.js      ./services/backend/
COPY --from=build-backend /app/backend/package.json  ./services/backend/

# Frontend static files
COPY --from=build-frontend /app/frontend/dist /usr/share/caddy

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80

CMD ["/app/start.sh"]
