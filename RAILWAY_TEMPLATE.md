# Deploy and Host Railway Manage on Railway

Railway Manage is a self-hosted operations control plane for Railway projects. It provides automated SQLite backups, service restart monitoring, infrastructure visibility, and a clean dashboard — giving you disaster-recovery and day-to-day management capabilities that Railway's own UI doesn't cover.

## About Hosting Railway Manage

Railway Manage runs as a single unified container: a Node.js backend, a prebuilt React dashboard, and a Caddy reverse proxy — all bundled into one Alpine-based image. When deployed on Railway, the app authenticates via your Railway API token, polls your project's services and metrics, schedules rolling backups to local storage, and exposes a protected dashboard behind JWT-authenticated sessions. No external databases are required; all state is stored in an embedded SQLite database that persists across deploys via a Railway volume mount.

## Common Use Cases

- **Automated backup scheduling** — run hourly/daily SQLite backups with configurable retention policies without relying on Railway's native restore capability
- **Service health monitoring** — detect crashed or unresponsive Railway services and trigger automatic restarts before they affect users
- **Infrastructure audit trail** — keep a searchable log of all management actions (restarts, backup events, config changes) for compliance and post-incident review

## Dependencies for Railway Manage Hosting

- **Railway project with API access** — a Railway API token scoped to the project you want to manage
- **Persistent volume** — a Railway volume mounted at `/app/data` to persist the SQLite database and backup files across redeploys

### Deployment Dependencies

- [Railway API Tokens](https://docs.railway.app/reference/public-api) — generate a token from Account Settings → Tokens
- [Railway Volumes](https://docs.railway.app/reference/volumes) — attach a volume to the service for durable data storage
- [Caddy Web Server](https://caddyserver.com/docs/) — bundled in the production image, no separate setup needed

### Implementation Details

Set the following environment variables on your Railway service:

```env
# Railway API token with read/write access to your project (from railway.app → Account Settings → Tokens)
RAILWAY_TOKEN=your_railway_api_token
```

Mount a Railway volume at `/app/data` to persist the database and backups. The app listens on `$PORT` (Railway injects this automatically) and serves both the API (`/api/*`) and the dashboard (`/*`) through the bundled Caddy proxy.

## Why Deploy Railway Manage on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Railway Manage on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
