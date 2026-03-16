import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw } from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';

function relativeTime(unixSecs) {
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(unixSecs * 1000).toLocaleString();
}

export default function Audit() {
  const toast = useToast();
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getAuditLog(100);
      setAuditLog(res.auditLog || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {document.getElementById('topbar-actions') && createPortal(
        <button onClick={load} className="btn btn-ghost" disabled={loading}>
          <RefreshCw size={13} />
          Refresh
        </button>,
        document.getElementById('topbar-actions'),
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="panel">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : auditLog.length === 0 ? (
          <div className="empty-state">No audit entries yet</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Action</th>
                <th style={{ width: '12%' }}>Actor</th>
                <th style={{ width: '28%' }}>Target</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry) => (
                <tr key={entry.id}>
                  <td className="primary mono" style={{ fontSize: 11 }}>{entry.action}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{entry.actor}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {entry.target ?? '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {relativeTime(entry.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </>
  );
}

