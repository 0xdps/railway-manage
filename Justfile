# railway-manage — development & build recipes
# Usage: just <recipe>  (install just: https://just.systems)

IMAGE     := "ghcr.io/0xdps/railway-manage"
PLATFORMS := "linux/amd64,linux/arm64"

# ── Local dev (docker compose) ───────────────────────────────────────────────

# Build and start the local stack (http://localhost:8080)
dev:
    docker compose up --build

# Start without rebuilding
up:
    docker compose up

# Start detached
up-detached:
    docker compose up -d

# Rebuild without cache (useful after Go/dep changes)
dev-fresh:
    docker compose build --no-cache && docker compose up

# Stop and remove containers
down:
    docker compose down

# Stop and remove containers + the data volume (full reset)
reset:
    docker compose down -v

# Follow container logs
logs:
    docker compose logs -f

# Open a shell inside the running app container
shell:
    docker compose exec app sh

# ── Production image builds ──────────────────────────────────────────────────

# Build a local amd64 image tagged as IMAGE:dev (fast, no push)
build:
    docker build \
        --build-arg MESAHUB_CORE_VERSION=trunk \
        --platform linux/amd64 \
        -t {{IMAGE}}:dev \
        .

# Build multi-platform image without pushing (uses buildx)
build-multiplatform:
    docker buildx build \
        --build-arg MESAHUB_CORE_VERSION=trunk \
        --platform {{PLATFORMS}} \
        -t {{IMAGE}}:dev \
        .

# Run the prod image locally using .env.prod
# Usage: just run-prod v1.2.3   (or omit to use :dev)
run-prod TAG="dev":
    docker run --rm -it \
        --env-file .env.prod \
        -p 8099:80 \
        -v railway-manage-data:/data \
        {{IMAGE}}:{{TAG}}

# Build and push a release image — requires a semver tag argument
# Usage: just publish v1.2.3
publish TAG:
    @if [ -z "{{TAG}}" ]; then echo "Usage: just publish v1.2.3"; exit 1; fi
    docker buildx build \
        --build-arg MESAHUB_CORE_VERSION=trunk \
        --platform {{PLATFORMS}} \
        -t {{IMAGE}}:{{TAG}} \
        -t {{IMAGE}}:latest \
        --push \
        .

# ── Housekeeping ─────────────────────────────────────────────────────────────

# Remove the local :dev image
clean:
    docker rmi {{IMAGE}}:dev 2>/dev/null || true

# Set up .env.local from example (if not exists)
env-setup:
    #!/usr/bin/env sh
    if [ ! -f .env.local ]; then \
        cp .env.example .env.local; \
        echo "Created .env.local — edit it with your credentials"; \
    else \
        echo ".env.local already exists"; \
    fi
