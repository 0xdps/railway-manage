import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, X } from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';

const SERVICE_TYPES = ['postgres', 'mysql', 'redis'];

const DEFAULT_FORM = {
  name: '',
  type: 'postgres',
  railway_service_id: '',
  env_var_key: '',
};

export default function ManagedServices() {
  const toast = useToast();
  const [services, setServices] = useState([]);
  const [railwayServices, setRailwayServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [varKeys, setVarKeys] = useState([]);
  const [loadingVars, setLoadingVars] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [managedRes, svcRes] = await Promise.all([
        api.getManagedServices(),
        api.getServices(),
      ]);
      setServices(managedRes.services || []);
      setRailwayServices(svcRes.services || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function openModal() {
    setForm(DEFAULT_FORM);
    setVarKeys([]);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setVarKeys([]);
  }

  async function onRailwayServiceChange(railwayServiceId) {
    setForm((f) => ({ ...f, railway_service_id: railwayServiceId, env_var_key: '' }));
    if (!railwayServiceId) { setVarKeys([]); return; }

    // Auto-fill name from the selected Railway service
    const rSvc = railwayServices.find((s) => s.id === railwayServiceId);
    if (rSvc) setForm((f) => ({ ...f, name: rSvc.name, railway_service_id: railwayServiceId, env_var_key: '' }));

    setLoadingVars(true);
    setVarKeys([]);
    try {
      const res = await api.getServiceVariableKeys(railwayServiceId);
      setVarKeys(res.keys || []);
    } catch (err) {
      toast(`Could not load variables: ${err.message}`, 'error');
    } finally {
      setLoadingVars(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.railway_service_id || !form.env_var_key) {
      toast('Select a Railway service and env var key', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.createManagedService(form);
      toast(`Service "${form.name}" added`, 'success');
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
      toast('Service removed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <p className="stat-label">Managed Services</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
            Services registered for automated backup. Credentials are never stored — fetched live from Railway.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} className="btn btn-ghost" disabled={loading}>
            <RefreshCw size={13} />
            Refresh
          </button>
          <button onClick={openModal} className="btn btn-primary">
            <Plus size={13} />
            Add Service
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="panel">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : services.length === 0 ? (
          <div className="empty-state">
            No managed services yet.{' '}
            <button
              onClick={openModal}
              style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              Add one →
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Name</th>
                <th style={{ width: '12%' }}>Type</th>
                <th style={{ width: '28%' }}>Railway Service</th>
                <th style={{ width: '18%' }}>Env Var Key</th>
                <th style={{ width: '8%' }}>Status</th>
                <th style={{ width: '6%' }}></th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => {
                const rSvc = railwayServices.find((r) => r.id === svc.railway_service_id);
                return (
                  <tr key={svc.id}>
                    <td className="primary">{svc.name}</td>
                    <td>
                      <span className="badge badge-accent">{svc.type}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {rSvc?.name ?? svc.railway_service_id.slice(0, 14) + '…'}
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>{svc.env_var_key}</td>
                    <td>
                      <label className="toggle" title={svc.enabled ? 'Disable' : 'Enable'}>
                        <input
                          type="checkbox"
                          checked={!!svc.enabled}
                          onChange={() => toggleEnabled(svc)}
                        />
                        <span className="toggle-track" />
                      </label>
                    </td>
                    <td>
                      <button
                        onClick={() => setConfirmDelete(svc)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '3px 7px' }}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Service Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">Add Managed Service</span>
              <button onClick={closeModal} className="btn btn-ghost btn-sm" style={{ padding: '3px 7px' }}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Step 1: Pick Railway service */}
                <div className="form-group">
                  <label className="form-label">Railway Service</label>
                  <select
                    className="form-control"
                    value={form.railway_service_id}
                    onChange={(e) => onRailwayServiceChange(e.target.value)}
                    required
                  >
                    <option value="">— Select a service —</option>
                    {railwayServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Service type */}
                <div className="form-group">
                  <label className="form-label">Database Type</label>
                  <select
                    className="form-control"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    {SERVICE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 3: Env var key picker */}
                <div className="form-group">
                  <label className="form-label">
                    Connection String Variable
                    {loadingVars && (
                      <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontStyle: 'normal', fontSize: 10 }}>
                        loading…
                      </span>
                    )}
                  </label>
                  {varKeys.length > 0 ? (
                    <select
                      className="form-control"
                      value={form.env_var_key}
                      onChange={(e) => setForm((f) => ({ ...f, env_var_key: e.target.value }))}
                      required
                    >
                      <option value="">— Pick the env var —</option>
                      {varKeys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-control"
                      placeholder={
                        form.railway_service_id
                          ? loadingVars
                            ? 'Loading variables…'
                            : 'No variables found — type key name manually'
                          : 'Select a Railway service first'
                      }
                      value={form.env_var_key}
                      onChange={(e) => setForm((f) => ({ ...f, env_var_key: e.target.value }))}
                      disabled={!form.railway_service_id || loadingVars}
                    />
                  )}
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Only the variable name is stored. The actual value is fetched from Railway at backup time.
                  </p>
                </div>

                {/* Step 4: Display name */}
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
              </div>

              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn btn-ghost">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !form.railway_service_id || !form.env_var_key || !form.name}
                >
                  {saving ? 'Adding…' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">Confirm Delete</span>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                Remove <strong style={{ color: 'var(--text-primary)' }}>{confirmDelete.name}</strong> from managed services?
                Existing backups are not deleted.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)} className="btn btn-danger">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
