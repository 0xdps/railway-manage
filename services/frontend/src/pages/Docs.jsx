import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

const TOC = [
  { id: 'overview',  label: 'Overview' },
  { id: 'env-vars',  label: 'Environment variables' },
  { id: 'managed',   label: 'Managed services' },
  { id: 'jobs',      label: 'Scheduled jobs' },
  { id: 'storage',   label: 'Storage' },
  { id: 'audit',     label: 'Audit log' },
  { id: 'security',  label: 'Security' },
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    TOC.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs-layout page-body--docs">

      {/* Sticky TOC */}
      <nav className="docs-toc">
        <div className="docs-toc-label">On this page</div>
        {TOC.map(({ id, label }) => (
          <a key={id} href={`#${id}`} className={activeSection === id ? 'active' : ''}>
            {label}
          </a>
        ))}
      </nav>

      {/* Body */}
      <article className="docs-body">

        <h2 id="overview">Overview</h2>
        <p>
          <strong>railway-manage</strong> is a self-hosted disaster-recovery and operations
          control plane for Railway-hosted projects. It connects to your Railway account via the
          GraphQL API to automate database backups, run scheduled jobs, and give you full
          visibility into backup health and system activity.
        </p>
        <p>
          Supported databases: <strong>PostgreSQL</strong>, <strong>MySQL</strong>, and{' '}
          <strong>Redis</strong>. Backups use native dump tools —{' '}
          <code>pg_dump</code>, <code>mysqldump --single-transaction</code>, and{' '}
          <code>redis-cli BGSAVE</code> — then compress with gzip before writing to disk.
        </p>

        <div className="callout callout-info">
          <Info size={14} />
          <span>
            Credentials (database URLs) are <strong>never stored</strong>. They are fetched live
            from Railway environment variables at the moment each backup job runs.
          </span>
        </div>

        <hr className="docs-divider" />

        <h2 id="env-vars">Environment variables</h2>
        <p>Set the following variables in your Railway service before deploying.</p>

        <div className="panel" style={{ overflow: 'hidden', marginTop: 14 }}>
          <table className="env-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ADMIN_PASSWORD</td>
                <td>Password for the dashboard login page. Use a strong random string — at least 32 characters. The app refuses to start without this variable set.</td>
              </tr>
              <tr>
                <td>JWT_SECRET</td>
                <td>Secret used to sign the session JWT. Rotate this if you suspect it has been leaked. Minimum 32 characters.</td>
              </tr>
              <tr>
                <td>RAILWAY_API_TOKEN</td>
                <td>Railway API token with project-level read access. Used to list services and fetch environment variables at backup runtime. Generate one from <strong>Account → Tokens</strong>.</td>
              </tr>
              <tr>
                <td>RAILWAY_PROJECT_ID</td>
                <td>The Railway project ID to manage. Auto-injected by Railway when running inside a Railway service.</td>
              </tr>
              <tr>
                <td>RAILWAY_ENVIRONMENT_ID</td>
                <td>Optional. Defaults to the project's default environment. Auto-injected by Railway when running inside a Railway service.</td>
              </tr>
              <tr>
                <td>BACKUP_STORAGE_PATH</td>
                <td>Path inside the container where backup files are written. Default: <code>/data/backups</code>. Mount a volume here to persist backups across redeploys.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr className="docs-divider" />

        <h2 id="managed">Managed services</h2>
        <p>
          Add a Railway service as a <strong>managed service</strong> to enable automated backups
          for it. When registering a service you provide:
        </p>
        <ul>
          <li>The Railway service (listed from your project via the GraphQL API)</li>
          <li>The database type: <code>postgres</code>, <code>mysql</code>, or <code>redis</code></li>
          <li>The environment variable holding the connection string (e.g. <code>DATABASE_URL</code>)</li>
          <li>A display name</li>
        </ul>
        <p>
          At backup runtime, railway-manage fetches the variable value live from Railway, runs the
          appropriate dump command, compresses the output, and writes it to the configured storage
          path. The connection string is never written to disk.
        </p>

        <hr className="docs-divider" />

        <h2 id="jobs">Scheduled jobs</h2>
        <p>Scheduled jobs drive automatic backups and cleanup. Default jobs:</p>
        <ul>
          <li><strong>backup_hourly</strong> — runs every hour (<code>0 * * * *</code>)</li>
          <li><strong>backup_daily</strong> — runs at midnight UTC (<code>0 0 * * *</code>)</li>
          <li><strong>backup_weekly</strong> — runs every Sunday (<code>0 0 * * 0</code>)</li>
          <li><strong>backup_monthly</strong> — runs on the 1st of each month (<code>0 0 1 * *</code>)</li>
          <li><strong>retention_cleanup</strong> — prunes old backup files per retention policy</li>
        </ul>
        <p>
          Jobs can be enabled or disabled individually on the <strong>Jobs</strong> page. Cron
          expressions can be edited inline — press <code>Enter</code> to save. Manual backup
          triggers are available from the <strong>Backups</strong> page.
        </p>

        <div className="callout callout-info">
          <Info size={14} />
          <span>
            The built-in scheduler checks every minute which jobs are due. A job runs when its
            cron expression matches the current time. Set a job's enabled flag to <code>false</code>{' '}
            to pause it without deleting the configuration.
          </span>
        </div>

        <hr className="docs-divider" />

        <h2 id="storage">Storage</h2>
        <p>
          Backup files are written to <code>BACKUP_STORAGE_PATH</code> (default:{' '}
          <code>/data/backups</code>) inside the container. To survive container restarts, mount a
          volume to that path:
        </p>
        <pre><code>{`# docker-compose.yaml (already configured)
volumes:
  - ./data:/data`}</code></pre>
        <p>
          Each backup is stored as{' '}
          <code>[service-name]-[schedule]-[timestamp].sql.gz</code>. The retention cleanup job
          removes files older than the configured retention window per service and schedule tier.
        </p>
        <p>
          The SQLite database (<code>railway-manage.sqlite</code>) is also stored in the{' '}
          <code>/data</code> volume. It holds managed service configuration, job definitions,
          and the audit log — but never credential values.
        </p>

        <hr className="docs-divider" />

        <h2 id="audit">Audit log</h2>
        <p>
          Every API action is recorded in the audit log with actor, action type, and timestamp.
          Use it to trace who triggered manual backups, changed job configurations, or
          added/removed managed services. The full log is available on the{' '}
          <strong>Audit</strong> page.
        </p>
        <p>
          Logged events include: login, logout, service add/remove, job enable/disable, cron
          expression edits, manual backup triggers, and retention policy changes.
        </p>

        <hr className="docs-divider" />

        <h2 id="security">Security</h2>
        <ul>
          <li>All API routes require a valid JWT signed with <code>JWT_SECRET</code></li>
          <li>The JWT is stored in an <code>httpOnly</code> cookie — inaccessible to JavaScript, safe against XSS</li>
          <li>Rate limiting is applied to the login endpoint to prevent brute-force attacks</li>
          <li>Use strong random values (32+ characters) for <code>ADMIN_PASSWORD</code> and <code>JWT_SECRET</code></li>
          <li>The <code>RAILWAY_API_TOKEN</code> should have project-level scope, not account-level</li>
          <li>Backup files contain plain SQL — treat them as sensitive data and restrict volume access accordingly</li>
          <li>Never commit <code>.env</code> or expose any of the keys above</li>
        </ul>

      </article>
    </div>
  );
}

