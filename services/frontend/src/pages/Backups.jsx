import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Play, X } from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';
import CustomSelect from '../components/CustomSelect';

const SCHEDULES = ['hourly', 'daily', 'weekly', 'monthly'];

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function relativeTime(unixSecs) {
  if (!unixSecs) return '—';
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(unixSecs * 1000).toLocaleDateString();
}

export default function Backups() {
  const toast = useToast();
  const [backups, setBackups] = useState([]);
  const [managedServices, setManagedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggerModal, setTriggerModal] = useState(false);
  const [triggerForm, setTriggerForm] = useState({ serviceId: '', schedule: 'daily' });
  const [triggering, setTriggering] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [bRes, mRes] = await Promise.all([api.getBackups(), api.getManagedServices()]);
      setBackups(bRes.backups || []);
      setManagedServices(mRes.services || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleTrigger(e) {
    e.preventDefault();
    if (!triggerForm.serviceId) { toast('Select a service', 'error'); return; }
    setTriggering(true);
    try {
      await api.triggerBackup(triggerForm.serviceId, triggerForm.schedule);
      toast('Backup triggered', 'success');
      setTriggerModal(false);
      setTimeout(load, 2000);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <>
      {document.getElementById('topbar-actions') && createPortal(
        <>
          <button onClick={load} className="btn btn-ghost" disabled={loading}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button onClick={() => setTriggerModal(true)} className="btn btn-primary">
            <Play size={13} />
            Trigger Now
          </button>
        </>,
        document.getElementById('topbar-actions'),
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : backups.length === 0 ? (
          <div className="empty-state">No backups yet. Add a managed service and trigger one.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Service</th>
                <th style={{ width: '12%' }}>Schedule</th>
                <th style={{ width: '14%' }}>Status</th>
                <th style={{ width: '12%' }}>Size</th>
                <th style={{ width: '16%' }}>Started</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => {
                const duration = b.finished_at && b.started_at
                  ? `${b.finished_at - b.started_at}s`
                  : '—';
                return (
                  <tr key={b.id}>
                    <td className="mono" style={{ fontSize: 11 }}>{b.service_id}</td>
                    <td>
                      <span className="badge badge-neutral">{b.schedule}</span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          b.status === 'success'
                            ? 'success'
                            : b.status === 'failed'
                            ? 'danger'
                            : 'warning'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatSize(b.size_bytes)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{relativeTime(b.started_at)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{duration}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Trigger modal */}
      {triggerModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setTriggerModal(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">Trigger Backup</span>
              <button onClick={() => setTriggerModal(false)} className="modal-close"><X size={14} /></button>
            </div>
            <form onSubmit={handleTrigger}>
              <div style={{ marginBottom: 4 }}>
                <div className="form-group">
                  <label className="form-label">Service</label>
                  <CustomSelect
                    options={managedServices.map((s) => ({ value: s.id, label: s.name }))}
                    value={triggerForm.serviceId}
                    onChange={(v) => setTriggerForm((f) => ({ ...f, serviceId: v }))}
                    placeholder="— Select service —"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Schedule Type</label>
                  <CustomSelect
                    options={SCHEDULES.map((s) => ({ value: s, label: s }))}
                    value={triggerForm.schedule}
                    onChange={(v) => setTriggerForm((f) => ({ ...f, schedule: v }))}
                    placeholder="Select schedule"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setTriggerModal(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={triggering}>
                  <Play size={12} />
                  {triggering ? 'Triggering…' : 'Trigger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
