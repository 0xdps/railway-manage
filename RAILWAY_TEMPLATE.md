# Deploy and Host Railway Manage on Railway

Railway Manage is a self-hosted operations control plane for Railway projects. It provides automated SQLite backups, service restart monitoring, infrastructure visibility, and a clean dashboard — giving you disaster-recovery and day-to-day management capabilities that Railway's own UI doesn't cover.

## About Hosting Railway Manage

Railway Manage runs as a single unified container: a Node.js backend, a prebuilt React dashboard, and a Caddy reverse proxy — all bundled into one Alpine-based image. When deployed on Railway, the app authenticates via your Railway API token, polls your project's services and metrics, schedules rolling backups to local storage, and exposes a protected dashboard behind JWT-authenticated sessions. All state lives in an embedded SQLite database — no external databases needed.

## Common Use Cases

- **Automated backup scheduling** — run hourly/daily SQLite backups with configurable retention policies without relying on Railway's native restore capability
- **Service health monitoring** — detect crashed or unresponsive Railway services and trigger automatic restarts before they affect users
- **Infrastructure audit trail** — keep a searchable log of all management actions for compliance and post-incident review

## Dependencies for Railway Manage Hosting

- **Railway API token** — scoped to the project you want to manage ([generate one here](https://docs.railway.app/reference/public-api))

### Deployment Dependencies

- [Railway API Tokens](https://docs.railway.app/reference/public-api) — generate a token from Account Settings → Tokens

### Implementation Details

The template pre-configures everything — a persistent volume is already attached at `/app/data` and all optional variables have sensible defaults. You only need to supply:

```env
ADMIN_KEY=choose_a_login_password
SESSION_SECRET=any_random_string_of_32_or_more_characters
RAILWAY_TOKEN=your_railway_api_token
RAILWAY_PROJECT_ID=your_railway_project_id
RAILWAY_ENVIRONMENT_ID=your_railway_environment_id
```

`PORT` is injected automatically by Railway. Everything else is optional.

## Why Deploy Railway Manage on Railway?

Railway is a singular platform to deploy your infrastructure stack. Railway will host your infrastructure so you don't have to deal with configuration, while allowing you to vertically and horizontally scale it.

By deploying Railway Manage on Railway, you are one step closer to supporting a complete full-stack application with minimal burden. Host your servers, databases, AI agents, and more on Railway.
