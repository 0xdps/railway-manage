import { useEffect, useState } from 'react';
import { ChevronRight, ChevronDown, Database, AlarmClock, Clock, CheckCircle, AlertTriangle, XCircle, LogIn, Server, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

// ─── Static quick-reference items ─────────────────────────────────────────────
const QUICK_REF = [
  'Backup files are stored in /data/backups — mount a persistent Docker volume there.',
  'JWT is stored in an httpOnly cookie and cannot be read by JavaScript — safe against XSS.',
  'Set BACKUP_STORAGE_PATH to change where backup files are written on the host.',
  'Login endpoint is rate-limited to prevent brute-force attacks.',
  'Trigger a manual backup any time from the Backups page using "Trigger Now".',
  'Disable a job on the Jobs page to pause its schedule without deleting it.',
  'Change ADMIN_PASSWORD and JWT_SECRET before exposing railway-manage to the internet.',
  'RAILWAY_ENVIRONMENT_ID is optional — falls back to the default Railway environment if unset.',
];

function formatJobType(type) {
  const map = {
    backup_hourly: 'Hourly Backup',
    backup_daily: 'Daily Backup',
    backup_weekly: 'Weekly Backup',
    retention_cleanup: 'Retention Cleanup',
  };
  return map[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function activityMeta(action) {
  if (action.includes('failed') || action.includes('error')) return { color: 'var(--danger)',  Icon: XCircle };
  if (action.startsWith('backup.'))                            return { color: 'var(--success)', Icon: Database };
  if (action.startsWith('auth.'))                             return { color: 'var(--accent)',  Icon: LogIn };
  if (action.startsWith('service.'))                          return { color: 'var(--warning)', Icon: Server };
  return { color: 'var(--text-secondary)', Icon: Activity };
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
  const [qrOpen, setQrOpen] = useState(false);

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
  const failures24h = data.backups.filter((b) => b.started_at && now - b.started_at < 86400 && b.status === 'failed').length;

  const lastSuccess = data.backups
    .filter((b) => b.status === 'success' && b.started_at)
    .sort((a, b) => b.started_at - a.started_at)[0];
  const timeSinceSuccess = lastSuccess ? now - lastSuccess.started_at : null;

  // Derive health state
  let healthState = 'healthy';
  if (data.backups.length > 0) {
    if (timeSinceSuccess === null || timeSinceSuccess > 6 * 3600) healthState = 'critical';
    else if (failures24h > 0) healthState = 'warning';
  }

  const healthConfig = {
    healthy:  { Icon: CheckCircle,  label: 'All systems operational',                  color: 'var(--success)', bg: 'var(--success-bg)', border: 'rgba(34,197,94,0.2)' },
    warning:  { Icon: AlertTriangle, label: `${failures24h} backup${failures24h !== 1 ? 's' : ''} failed in the last 24h`, color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'rgba(245,158,11,0.2)' },
    critical: { Icon: XCircle,      label: 'No successful backups in the last 6h',     color: 'var(--danger)',  bg: 'var(--danger-bg)',  border: 'rgba(239,68,68,0.2)' },
  }[healthState];

  const upcomingJobs = data.jobs
    .filter((j) => j.enabled && j.next_run_at && j.job_type.startsWith('backup'))
    .sort((a, b) => a.next_run_at - b.next_run_at)
    .slice(0, 5);

  if (loading) return <div className="empty-state">Loading dashboard…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Stats Row (4 cards) ──────────────────────────────────────────── */}
      <div className="overview-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: 0 }}>
        <div className="panel overview-card">
          <p className="overview-card-label">Managed Services</p>
          <p className="overview-card-value">{data.managedServices.length}</p>
          <p className="overview-card-sub">Registered for backup</p>
        </div>
        <div className="panel overview-card">
          <p className="overview-card-label">Total Services</p>
          <p className="overview-card-value">{data.services.length}</p>
          <p className="overview-card-sub">Railway services in project</p>
        </div>
        <div className="panel overview-card">
          <p className="overview-card-label">Backups (24h)</p>
          <p className="overview-card-value">{backups24h}</p>
          <p className="overview-card-sub">Runs in the last 24h</p>
        </div>
        <div className="panel overview-card" style={{ borderColor: failures24h > 0 ? 'rgba(239,68,68,0.25)' : undefined }}>
          <p className="overview-card-label">Failures (24h)</p>
          <p className="overview-card-value" style={{ color: failures24h > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {failures24h}
          </p>
          <p className="overview-card-sub">{failures24h > 0 ? 'Action may be needed' : 'No failures'}</p>
        </div>
      </div>

      {/* ── System Health Summary ────────────────────────────────────────── */}
      {data.backups.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 'var(--radius-md)',
          background: healthConfig.bg,
          border: `1px solid ${healthConfig.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <healthConfig.Icon size={15} style={{ color: healthConfig.color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>System Status</span>
            <span style={{ color: 'var(--text-muted)' }}>—</span>
            <span style={{ color: healthConfig.color, fontWeight: 500 }}>{healthConfig.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
            {lastSuccess && (
              <span>Last success: <strong style={{ color: 'var(--text-primary)' }}>{relativeTime(lastSuccess.started_at)}</strong></span>
            )}
            {failures24h > 0 && (
              <span>Failures: <strong style={{ color: 'var(--danger)' }}>{failures24h}</strong></span>
            )}
            {upcomingJobs[0] && (
              <span>Next backup: <strong style={{ color: 'var(--accent)' }}>{timeUntil(upcomingJobs[0].next_run_at)}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* ── Recent Backups (full-width primary section) ──────────────────── */}
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
              {data.backups.slice(0, 8).map((b) => {
                const managed = data.managedServices.find(
                  (m) => m.id === b.service_id || m.railway_service_id === b.service_id
                );
                return (
                  <tr key={b.id}>
                    <td className="primary">{managed?.name ?? b.service_id.slice(0, 10) + '…'}</td>
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

      {/* ── Upcoming Jobs + Recent Activity ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Upcoming Jobs — next run time only, no raw cron */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Upcoming Jobs</span>
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
                  <th>Next Run</th>
                </tr>
              </thead>
              <tbody>
                {upcomingJobs.map((j) => (
                  <tr key={j.id}>
                    <td className="primary">{formatJobType(j.job_type)}</td>
                    <td style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{timeUntil(j.next_run_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Activity — color-coded by event type */}
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
                {data.recentAudit.map((e) => {
                  const { color, Icon } = activityMeta(e.action);
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Icon size={12} style={{ color, flexShrink: 0 }} />
                          <span style={{ color, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{e.action}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{e.actor}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{relativeTime(e.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Quick Reference (collapsed accordion, lowest priority) ─────── */}
      <div className="panel">
        <button
          onClick={() => setQrOpen((o) => !o)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Quick Reference
          </span>
          <ChevronDown
            size={14}
            style={{ color: 'var(--text-muted)', transition: 'transform 0.18s', transform: qrOpen ? 'rotate(180deg)' : 'none' }}
          />
        </button>
        {qrOpen && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {QUICK_REF.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 14px',
                  borderBottom: i < QUICK_REF.length - 1 ? '1px solid var(--border)' : 'none',
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
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
