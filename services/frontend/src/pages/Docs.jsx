import { BookOpen, Terminal, Database, Clock, ShieldCheck, Info } from 'lucide-react';

export default function Docs() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
      <div>
        <p className="stat-label">Documentation</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
          How railway-manage works and how to configure it.
        </p>
      </div>

      <article className="docs-body">
        <h2><BookOpen size={14} style={{ flexShrink: 0 }} /> Overview</h2>
        <p>
          <strong>railway-manage</strong> is a self-hosted operations dashboard for Railway projects.
          It connects to your Railway account via the GraphQL API to give you visibility into
          services, automate database backups, and run scheduled maintenance jobs.
        </p>

        <div className="callout callout-info">
          <Info size={14} />
          <span>
            Credentials (database URLs) are <strong>never stored</strong>. They are fetched live
            from Railway environment variables at the moment a backup runs.
          </span>
        </div>

        <h2><Terminal size={14} style={{ flexShrink: 0 }} /> Getting Started</h2>
        <h3>1. Set Environment Variables</h3>
        <p>The backend requires these variables set in your environment:</p>
        <pre><code>{`RAILWAY_API_TOKEN=your_railway_token
RAILWAY_PROJECT_ID=your_project_id
RAILWAY_ENVIRONMENT_ID=your_env_id   # optional
JWT_SECRET=long_random_string
BACKUP_STORAGE_PATH=/data/backups    # inside container`}</code></pre>

        <h3>2. Start with Docker Compose</h3>
        <pre><code>{`docker compose up -d`}</code></pre>
        <p>
          The frontend is served on port <code>3000</code> behind Caddy on port <code>80</code>.
          The backend API runs on port <code>3001</code>.
        </p>

        <h3>3. Sign In</h3>
        <p>
          Default credentials are set via the <code>ADMIN_PASSWORD</code> env var (default:{' '}
          <code>admin</code>). Change this immediately in production.
        </p>

        <h2><Database size={14} style={{ flexShrink: 0 }} /> Managed Services</h2>
        <p>
          Add a Railway service as a <strong>managed service</strong> to enable automated backups.
          When adding a service you specify:
        </p>
        <ul>
          <li>The Railway service (fetched from your project)</li>
          <li>The database type: <code>postgres</code>, <code>mysql</code>, or <code>redis</code></li>
          <li>The environment variable that contains the connection string (e.g. <code>DATABASE_URL</code>)</li>
          <li>A display name</li>
        </ul>
        <p>
          At backup runtime, railway-manage fetches the variable value from Railway, runs a
          dump (<code>pg_dump</code> / <code>mysqldump</code> / <code>redis-cli BGSAVE</code>),
          compresses the output, and stores it in the configured storage path.
        </p>

        <h2><Clock size={14} style={{ flexShrink: 0 }} /> Jobs</h2>
        <p>Scheduled jobs drive automatic backups and cleanup:</p>
        <ul>
          <li><strong>backup_hourly</strong> — runs every hour for services with hourly schedule</li>
          <li><strong>backup_daily</strong> — runs at midnight UTC</li>
          <li><strong>backup_weekly</strong> — runs every Sunday</li>
          <li><strong>backup_monthly</strong> — runs on the 1st of each month</li>
          <li><strong>retention_cleanup</strong> — prunes old backups per retention policy</li>
        </ul>
        <p>
          Jobs can be enabled or disabled individually on the <strong>Jobs</strong> page. Cron
          expressions can be edited inline.
        </p>

        <h2><ShieldCheck size={14} style={{ flexShrink: 0 }} /> Security Notes</h2>
        <ul>
          <li>All API routes require a valid JWT (signed with <code>JWT_SECRET</code>)</li>
          <li>The JWT is stored in an <code>httpOnly</code> cookie — not accessible to JavaScript</li>
          <li>Rate limiting is applied to the login endpoint to prevent brute-force</li>
          <li>Set a strong <code>ADMIN_PASSWORD</code> and <code>JWT_SECRET</code> before exposing to the internet</li>
        </ul>
      </article>
    </div>
  );
}
