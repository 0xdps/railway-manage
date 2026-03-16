import { useEffect, useState } from 'react';
import { RefreshCw, ChevronRight, Database, AlarmClock, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

// ─── 18 rotating hints ────────────────────────────────────────────────────────
const ALL_HINTS = [
  { key: 1,  text: <><strong>Managed services</strong> need a <code>DATABASE_URL</code> (or similar) env var key — the connection string variable from Railway.</> },
  { key: 2,  text: <>Credentials are <strong>never stored</strong>. They are fetched live from Railway at the moment each backup runs.</> },
  { key: 3,  text: <>Trigger a <strong>manual backup</strong> any time from the Backups page using the "Trigger Now" button.</> },
  { key: 4,  text: <>Disable a job on the <strong>Jobs page</strong> to pause its schedule without removing it.</> },
  { key: 5,  text: <>Click any <strong>cron expression</strong> on the Jobs page to edit it inline — press Enter to save.</> },
  { key: 6,  text: <>The <strong>retention_cleanup</strong> job automatically prunes old backup files per your retention policy.</> },
  { key: 7,  text: <>Backup files land in <code>/data/backups</code> — mount a persistent Docker volume there to survive container restarts.</> },
  { key: 8,  text: <>Set <code>BACKUP_STORAGE_PATH</code> to change where compressed backup files are written on the host.</> },
  { key: 9,  text: <>All backup dumps are <strong>gzip-compressed</strong> automatically before being written to disk.</> },
  { key: 10, text: <><strong>Redis</strong> backups use <code>BGSAVE</code> — <code>dump.rdb</code> is copied after the background save completes.</> },
  { key: 11, text: <><strong>MySQL</strong> backups use <code>mysqldump --single-transaction</code> for a consistent snapshot without table locks.</> },
  { key: 12, text: <><strong>PostgreSQL</strong> backups use <code>pg_dump</code> in custom format for better compression and restore flexibility.</> },
  { key: 13, text: <>The <strong>Audit Log</strong> records every API action with actor and timestamp — useful for traceability.</> },
  { key: 14, text: <>Change <code>ADMIN_PASSWORD</code> and <code>JWT_SECRET</code> before exposing railway-manage to the internet.</> },
  { key: 15, text: <>The <strong>JWT</strong> is stored in an <code>httpOnly</code> cookie and cannot be read by JavaScript — safe against XSS.</> },
  { key: 16, text: <><strong>Rate limiting</strong> is applied to the login endpoint to prevent brute-force attacks.</> },
  { key: 17, text: <>You can register <strong>Postgres</strong>, <strong>MySQL</strong>, and <strong>Redis</strong> services from the same Railway project simultaneously.</> },
  { key: 18, text: <><code>RAILWAY_ENVIRONMENT_ID</code> is optional — railway-manage falls back to the default Railway environment if unset.</> },
];

function pickHints(all) {
  return [...all].sort(() => Math.random() - 0.5).slice(0, 5);
}

function relativeTime(unixSecs) {
  if (!unixSecs) return '—';
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function timeUntil(unixSecs) {
  if (!unixSecs) return '—';
  const diff = unixSecs - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'overdue';
  if (diff < 60) return `in ${diff}s`;
  if (diff < 3600) return `in ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `in ${Math.floor(diff / 3600)}h`;
  return `in ${Math.floor(diff / 86400)}d`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ services: [], backups: [], managedServices: [], recentAudit: [], jobs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hints, setHints] = useState(() => pickHints(ALL_HINTS));

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [svcRes, backupsRes, managedRes, auditRes, jobsRes] = await Promise.all([
        api.getServices(),
        api.getBackups(),
        api.getManagedServices(),
        api.getAuditLog(6),
        api.getJobs(),
      ]);
      setData({
        services: svcRes.services || [],
        backups: backupsRes.backups || [],
        managedServices: managedRes.services || [],
        recentAudit: auditRes.auditLog || [],
        jobs: jobsRes.jobs || [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const backups24h = data.backups.filter((b) => b.started_at && now - b.started_at < 86400).length;
  const upcomingJobs = data.jobs
    .filter((j) => j.enabled && j.next_run_at && j.job_type.startsWith('backup'))
    .sort((a, b) => a.next_run_at - b.next_run_at)
    .slice(0, 5);

  if (loading) return <div className="empty-state">Loading dashboard…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Overview stat cards */}
      <div className="overview-grid">
        <div className="panel overview-card">
          <p className="overview-card-label">Managed Services</p>
          <p className="overview-card-value">{data.managedServices.length}</p>
          <p className="overview-card-sub">Services registered for backup</p>
        </div>
        <div className="panel overview-card">
          <p className="overview-card-label">Services</p>
          <p className="overview-card-value">{data.services.length}</p>
          <p className="overview-card-sub">Railway services in this project</p>
        </div>
        <div className="panel overview-card">
          <p className="overview-card-label">Backups (24H)</p>
          <p className="overview-card-value">{backups24h}</p>
          <p className="overview-card-sub">Backup runs in the last 24 h</p>
        </div>
      </div>

      {/* Middle row: Quick Reference + Recent Backups */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: 12 }}>

        {/* Quick Reference */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Quick Reference</span>
            <button
              onClick={() => setHints(pickHints(ALL_HINTS))}
              className="btn btn-ghost btn-sm"
              title="Shuffle tips"
            >
              <RefreshCw size={11} />
            </button>
          </div>
          <div>
            {hints.map((hint, i) => (
              <div
                key={hint.key}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '11px 14px',
                  borderBottom: i < hints.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.55,
                }}
              >
                <span style={{
                  flexShrink: 0,
                  width: 6, height: 6,
                  marginTop: 5,
                  borderRadius: 1,
                  background: 'var(--accent)',
                  display: 'inline-block',
                }} />
                <span>{hint.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Backups */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Recent Backups</span>
            <button onClick={() => navigate('/backups')} className="btn btn-ghost btn-sm">
              View all <ChevronRight size={11} />
            </button>
          </div>
          {data.backups.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <Database size={24} />
              <p>No backup runs yet.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.backups.slice(0, 5).map((b) => {
                  const managed = data.managedServices.find(
                    (m) => m.id === b.service_id || m.railway_service_id === b.service_id
                  );
                  return (
                    <tr key={b.id}>
                      <td className="primary" style={{ maxWidth: 130 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                          {managed?.name ?? b.service_id.slice(0, 10) + '…'}
                        </span>
                      </td>
                      <td><span className="badge badge-neutral">{b.schedule}</span></td>
                      <td>
                        <span className={`badge badge-${b.status === 'success' ? 'success' : b.status === 'failed' ? 'danger' : 'warning'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{relativeTime(b.started_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom row: Upcoming Backups + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Upcoming Backups */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Upcoming Backups</span>
            <button onClick={() => navigate('/jobs')} className="btn btn-ghost btn-sm">
              View jobs <ChevronRight size={11} />
            </button>
          </div>
          {upcomingJobs.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <AlarmClock size={24} />
              <p>No scheduled backup jobs enabled.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Schedule</th>
                  <th>Next Run</th>
                </tr>
              </thead>
              <tbody>
                {upcomingJobs.map((j) => (
                  <tr key={j.id}>
                    <td className="primary mono" style={{ fontSize: 12 }}>{j.job_type}</td>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.schedule}</td>
                    <td style={{ color: 'var(--accent)', fontSize: 12 }}>{timeUntil(j.next_run_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Activity (Audit Log) */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Recent Activity</span>
            <button onClick={() => navigate('/audit')} className="btn btn-ghost btn-sm">
              View all <ChevronRight size={11} />
            </button>
          </div>
          {data.recentAudit.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <Clock size={24} />
              <p>No audit activity yet.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {data.recentAudit.map((e) => (
                  <tr key={e.id}>
                    <td className="primary mono" style={{ fontSize: 11 }}>{e.action}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{e.actor}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{relativeTime(e.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}

