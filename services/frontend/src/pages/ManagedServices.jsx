import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2, Edit2, X, ExternalLink, Zap } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import MathCaptcha from '../components/MathCaptcha';
import api from '../api';
import { useToast } from '../components/Toast';

const SERVICE_TYPES = ['postgres', 'mysql', 'redis'];
const SCHEDULES     = ['hourly', 'daily', 'weekly', 'monthly'];

const DEFAULT_FORM = {
  name: '',
  type: 'postgres',
  railway_service_id: '',
  env_var_key: '',
};

export default function ManagedServices() {
  const toast    = useToast();
  const navigate = useNavigate();
  const [services, setServices]               = useState([]);
  const [railwayServices, setRailwayServices] = useState([]);
  const [restartPolicies, setRestartPolicies] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [modalOpen, setModalOpen]             = useState(false);
  const [editingRecord, setEditingRecord]     = useState(null);
  const [form, setForm]                       = useState(DEFAULT_FORM);
  const [varKeys, setVarKeys]                 = useState([]);
  const [loadingVars, setLoadingVars]         = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [confirmDelete, setConfirmDelete]     = useState(null);
  const [deleteCaptchaOk, setDeleteCaptchaOk] = useState(false);
  const [backupFor, setBackupFor]             = useState(null);
  const [backupSchedule, setBackupSchedule]   = useState('daily');
  const [triggering, setTriggering]           = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [managedRes, svcRes, policiesRes] = await Promise.all([
        api.getManagedServices(),
        api.getServices(),
        api.getAllRestartPolicies(),
      ]);
      setServices(managedRes.services || []);
      setRailwayServices(svcRes.services || []);
      setRestartPolicies(policiesRes.policies || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingRecord(null);
    setForm(DEFAULT_FORM);
    setVarKeys([]);
    setModalOpen(true);
  }

  function openEditModal(svc) {
    setEditingRecord(svc);
    setForm({ name: svc.name, type: svc.type, railway_service_id: svc.railway_service_id, env_var_key: svc.env_var_key });
    setVarKeys([]);
    setModalOpen(true);
    loadVarKeys(svc.railway_service_id);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingRecord(null);
    setVarKeys([]);
  }

  async function loadVarKeys(railwayServiceId) {
    if (!railwayServiceId) return;
    setLoadingVars(true);
    try {
      const res = await api.getServiceVariableKeys(railwayServiceId);
      setVarKeys(res.keys || []);
    } catch { /* silently ignore */ }
    finally { setLoadingVars(false); }
  }

  async function onRailwayServiceChange(railwayServiceId) {
    const rSvc = railwayServices.find((s) => s.id === railwayServiceId);
    setForm((f) => ({ ...f, railway_service_id: railwayServiceId, name: rSvc?.name ?? f.name, env_var_key: '' }));
    setVarKeys([]);
    if (railwayServiceId) await loadVarKeys(railwayServiceId);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.env_var_key) { toast('Select or enter the connection string variable', 'error'); return; }
    setSaving(true);
    try {
      if (editingRecord) {
        await api.updateManagedService(editingRecord.id, { name: form.name, type: form.type, env_var_key: form.env_var_key });
        toast(`Updated "${form.name}"`, 'success');
      } else {
        if (!form.railway_service_id) { toast('Select a Railway service', 'error'); return; }
        await api.createManagedService(form);
        toast(`Backup configured for "${form.name}"`, 'success');
      }
      closeModal();
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(svc) {
    try {
      await api.updateManagedService(svc.id, { enabled: !svc.enabled });
      setServices((prev) =>
        prev.map((s) => (s.id === svc.id ? { ...s, enabled: svc.enabled ? 0 : 1 } : s))
      );
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteManagedService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
      toast('Backup config removed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setConfirmDelete(null);
      setDeleteCaptchaOk(false);
    }
  }

  async function handleTriggerBackup() {
    if (!backupFor) return;
    setTriggering(true);
    try {
      await api.triggerBackup(backupFor.railway_service_id, backupSchedule);
      toast(`Backup triggered for "${backupFor.name}"`, 'success');
      setBackupFor(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setTriggering(false);
    }
  }

  const topbar = document.getElementById('topbar-actions');
  return (
    <>
      {topbar && createPortal(
        <>
          <button onClick={load} className="btn btn-ghost" disabled={loading}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button onClick={openAddModal} className="btn btn-primary">
            <Plus size={13} />
            Add Backup Config
          </button>
        </>,
        topbar,
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* \u2500\u2500\u2500 Table 1: Backup Configs \u2500\u2500\u2500 */}
        <div className="panel">
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Backup Configs</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{services.length} {services.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          {loading ? (
            <div className="empty-state">Loading\u2026</div>
          ) : services.length === 0 ? (
            <div className="empty-state">
              No backup configs yet.{' '}
              <button onClick={openAddModal} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                Add one \u2192
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Display Name</th>
                  <th style={{ width: '10%' }}>Type</th>
                  <th style={{ width: '22%' }}>Railway Service</th>
                  <th style={{ width: '18%' }}>Env Var</th>
                  <th style={{ width: '8%' }}>Active</th>
                  <th style={{ width: '18%' }}></th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc) => {
                  const rSvc = railwayServices.find((r) => r.id === svc.railway_service_id);
                  return (
                    <tr key={svc.id}>
                      <td className="primary">{svc.name}</td>
                      <td><span className="badge badge-neutral">{svc.type}</span></td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {rSvc?.name ?? svc.railway_service_id.slice(0, 14) + '\u2026'}
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>{svc.env_var_key}</td>
                      <td>
                        <label className="toggle-container" title={svc.enabled ? 'Disable' : 'Enable'}>
                          <input type="checkbox" checked={!!svc.enabled} onChange={() => toggleEnabled(svc)} />
                          <span className="toggle-switch" />
                        </label>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => { setBackupFor(svc); setBackupSchedule('daily'); }}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                            title="Trigger backup now"
                          >
                            <Zap size={11} /> Backup Now
                          </button>
                          <button onClick={() => openEditModal(svc)} className="btn btn-ghost btn-sm" style={{ padding: '3px 7px' }} title="Edit">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => setConfirmDelete(svc)} className="btn btn-danger btn-sm" style={{ padding: '3px 7px' }} title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* \u2500\u2500\u2500 Table 2: Restart Policies \u2500\u2500\u2500 */}
        <div className="panel">
          <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Restart Policies</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{restartPolicies.length} {restartPolicies.length === 1 ? 'entry' : 'entries'}</span>
          </div>
          {loading ? (
            <div className="empty-state">Loading\u2026</div>
          ) : restartPolicies.length === 0 ? (
            <div className="empty-state">
              No restart policies configured.{' '}
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Open a service to configure one.</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '24%' }}>Service</th>
                  <th style={{ width: '13%' }}>CPU Limit</th>
                  <th style={{ width: '14%' }}>Memory Limit</th>
                  <th style={{ width: '12%' }}>Window</th>
                  <th style={{ width: '12%' }}>Ratio</th>
                  <th style={{ width: '10%' }}>Active</th>
                  <th style={{ width: '15%' }}></th>
                </tr>
              </thead>
              <tbody>
                {restartPolicies.map((p) => {
                  const rSvc = railwayServices.find((r) => r.id === p.service_id);
                  return (
                    <tr key={p.service_id}>
                      <td className="primary">
                        {rSvc?.name ?? <span className="mono" style={{ fontSize: 11 }}>{p.service_id.slice(0, 14)}\u2026</span>}
                      </td>
                      <td>
                        {p.cpu_threshold != null
                          ? <span className="badge badge-neutral">{Math.round(p.cpu_threshold * 100)}%</span>
                          : <span style={{ color: 'var(--text-muted)' }}>\u2014</span>}
                      </td>
                      <td>
                        {p.mem_threshold_gb != null
                          ? <span className="badge badge-neutral">{p.mem_threshold_gb} GB</span>
                          : <span style={{ color: 'var(--text-muted)' }}>\u2014</span>}
                      </td>
                      <td><span className="badge badge-neutral">{p.window_minutes}m</span></td>
                      <td><span className="badge badge-neutral">{Math.round(p.violation_ratio * 100)}%</span></td>
                      <td>
                        <span className={`badge ${p.enabled ? 'badge-success' : 'badge-neutral'}`}>
                          {p.enabled ? 'on' : 'off'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/services/${p.service_id}`)}
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                        >
                          <ExternalLink size={11} /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* \u2500\u2500 Add / Edit Backup Config Modal \u2500\u2500 */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">{editingRecord ? 'Edit Backup Config' : 'Add Backup Config'}</span>
              <button onClick={closeModal} className="modal-close"><X size={14} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              {!editingRecord && (
                <div className="form-group">
                  <label className="form-label">Railway Service</label>
                  <CustomSelect
                    options={railwayServices.map((s) => ({ value: s.id, label: s.name }))}
                    value={form.railway_service_id}
                    onChange={onRailwayServiceChange}
                    placeholder="\u2014 Select a service \u2014"
                  />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Database Type</label>
                <CustomSelect
                  options={SERVICE_TYPES.map((t) => ({ value: t, label: t }))}
                  value={form.type}
                  onChange={(v) => setForm((f) => ({ ...f, type: v }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Connection String Variable
                  {loadingVars && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>loading\u2026</span>}
                </label>
                {varKeys.length > 0 ? (
                  <CustomSelect
                    options={varKeys.map((k) => ({ value: k, label: k }))}
                    value={form.env_var_key}
                    onChange={(v) => setForm((f) => ({ ...f, env_var_key: v }))}
                    placeholder="\u2014 Pick the env var \u2014"
                  />
                ) : (
                  <input
                    className="form-control"
                    placeholder={
                      form.railway_service_id
                        ? loadingVars ? 'Loading variables\u2026' : 'No variables found \u2014 type key name manually'
                        : editingRecord ? 'e.g. DATABASE_URL' : 'Select a Railway service first'
                    }
                    value={form.env_var_key}
                    onChange={(e) => setForm((f) => ({ ...f, env_var_key: e.target.value }))}
                    disabled={!editingRecord && (!form.railway_service_id || loadingVars)}
                  />
                )}
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Only the variable name is stored. The value is fetched from Railway at backup time.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. production-postgres"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="btn btn-ghost">Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !form.env_var_key || !form.name || (!editingRecord && !form.railway_service_id)}
                >
                  {saving ? (editingRecord ? 'Saving\u2026' : 'Adding\u2026') : (editingRecord ? 'Save Changes' : 'Add Config')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* \u2500\u2500 Delete Confirmation Modal \u2500\u2500 */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && (setConfirmDelete(null), setDeleteCaptchaOk(false))}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">Confirm Delete</span>
            </div>
            <div style={{ padding: '8px 0 12px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                Remove <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.name}</strong> from backup configs?
                Existing backups are not deleted.
              </p>
              <MathCaptcha onVerified={setDeleteCaptchaOk} />
            </div>
            <div className="modal-actions">
              <button onClick={() => { setConfirmDelete(null); setDeleteCaptchaOk(false); }} className="btn btn-ghost">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} disabled={!deleteCaptchaOk} className="btn btn-danger">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Backup Trigger Modal ── */}
      {backupFor && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setBackupFor(null)}>
          <div className="modal-box" style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <span className="modal-title">Trigger Backup</span>
              <button onClick={() => setBackupFor(null)} className="modal-close"><X size={14} /></button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Triggering backup for <strong style={{ color: 'var(--text-secondary)' }}>{backupFor.name}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Schedule Type</label>
              <CustomSelect
                options={SCHEDULES.map((s) => ({ value: s, label: s }))}
                value={backupSchedule}
                onChange={setBackupSchedule}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setBackupFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={triggering} onClick={handleTriggerBackup}>
                {triggering ? 'Triggering…' : 'Trigger Backup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
