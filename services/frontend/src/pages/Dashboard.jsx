import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../api';

function relativeTime(unixSecs) {
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Dashboard() {
  const [data, setData] = useState({ services: [], backups: [], managedServices: [], recentAudit: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [svcRes, backupsRes, managedRes, auditRes] = await Promise.all([
        api.getServices(),
        api.getBackups(),
        api.getManagedServices(),
        api.getAuditLog(6),
      ]);
      setData({
        services: svcRes.services || [],
        backups: backupsRes.backups || [],
        managedServices: managedRes.services || [],
        recentAudit: auditRes.auditLog || [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="empty-state">Loading dashboard…</div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          background: 'var(--danger-bg)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          color: 'var(--danger)',
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }

  const successBackups = data.backups.filter((b) => b.status === 'success').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="stat-card">
          <p className="stat-label">Infrastructure</p>
          <p className="stat-value">{data.services.length}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>Railway services</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Managed</p>
          <p className="stat-value">{data.managedServices.length}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>Backup targets</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Backups</p>
          <p className="stat-value">{successBackups}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>Successful</p>
        </div>
      </div>

      {/* Two panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Recent backups */}
        <div className="panel panel-accent">
          <div className="panel-header">
            <span className="panel-title">Recent Backups</span>
            <button onClick={load} className="btn btn-ghost btn-sm" disabled={loading}>
              <RefreshCw size={12} />
            </button>
          </div>
          {data.backups.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px' }}>No backups yet</div>
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
                {data.backups.slice(0, 6).map((b) => (
                  <tr key={b.id}>
                    <td className="mono">{b.service_id.slice(0, 8)}</td>
                    <td>{b.schedule}</td>
                    <td>
                      <span className={`badge badge-${b.status === 'success' ? 'success' : b.status === 'failed' ? 'danger' : 'warning'}`}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{relativeTime(b.started_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Audit log */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Audit Log</span>
          </div>
          {data.recentAudit.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px' }}>No activity</div>
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
                    <td>{e.actor}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{relativeTime(e.created_at)}</td>
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

