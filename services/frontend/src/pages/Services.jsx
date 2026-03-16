import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';

export default function Services() {
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(null);
  const [confirmRestart, setConfirmRestart] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getServices();
      setServices(res.services || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart(svc) {
    setRestarting(svc.id);
    setConfirmRestart(null);
    try {
      await api.restartService(svc.id);
      toast(`${svc.name} restart triggered`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRestarting(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p className="stat-label">Infrastructure</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
            Railway services in this environment
          </p>
        </div>
        <button onClick={load} className="btn btn-ghost" disabled={loading}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="panel">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : services.length === 0 ? (
          <div className="empty-state">No services found in this environment</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '45%' }}>Name</th>
                <th>ID</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.id}>
                  <td className="primary">{svc.name}</td>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {svc.id}
                  </td>
                  <td>
                    <button
                      onClick={() => setConfirmRestart(svc)}
                      disabled={restarting === svc.id}
                      className="btn btn-ghost btn-sm"
                    >
                      <RotateCcw size={12} />
                      {restarting === svc.id ? 'Restarting…' : 'Restart'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm restart modal */}
      {confirmRestart && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setConfirmRestart(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">Confirm Restart</span>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Restart <strong style={{ color: 'var(--text-primary)' }}>{confirmRestart.name}</strong>?
                This triggers a new deployment.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setConfirmRestart(null)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => handleRestart(confirmRestart)} className="btn btn-primary">
                <RotateCcw size={12} /> Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

