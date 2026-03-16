import { useEffect, useState } from 'react';
import { RefreshCw, Check, X } from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';

function nextRunLabel(unixSecs) {
  if (!unixSecs) return '—';
  const now = Math.floor(Date.now() / 1000);
  const diff = unixSecs - now;
  if (diff <= 0) return 'overdue';
  if (diff < 60) return `in ${diff}s`;
  if (diff < 3600) return `in ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `in ${Math.floor(diff / 3600)}h`;
  return `in ${Math.floor(diff / 86400)}d`;
}

function lastRunLabel(unixSecs) {
  if (!unixSecs) return 'never';
  const diff = Math.floor(Date.now() / 1000) - unixSecs;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function JobRow({ job, onUpdate }) {
  const toast = useToast();
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleInput, setScheduleInput] = useState(job.schedule);
  const [saving, setSaving] = useState(false);

  async function toggleEnabled() {
    setSaving(true);
    try {
      await api.updateJob(job.id, { enabled: !job.enabled });
      onUpdate(job.id, { enabled: !job.enabled });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveSchedule() {
    if (scheduleInput === job.schedule) { setEditingSchedule(false); return; }
    setSaving(true);
    try {
      await api.updateJob(job.id, { schedule: scheduleInput });
      onUpdate(job.id, { schedule: scheduleInput });
      setEditingSchedule(false);
      toast('Schedule updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
      setScheduleInput(job.schedule);
      setEditingSchedule(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td className="primary mono" style={{ fontSize: 12 }}>{job.job_type}</td>
      <td>
        {editingSchedule ? (
          <div className="inline-edit" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              value={scheduleInput}
              onChange={(e) => setScheduleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveSchedule();
                if (e.key === 'Escape') { setScheduleInput(job.schedule); setEditingSchedule(false); }
              }}
              autoFocus
              style={{ width: 140 }}
            />
            <button onClick={saveSchedule} disabled={saving} className="btn btn-primary btn-sm" style={{ padding: '2px 6px' }}>
              <Check size={11} />
            </button>
            <button onClick={() => { setScheduleInput(job.schedule); setEditingSchedule(false); }} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>
              <X size={11} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingSchedule(true)}
            className="mono"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: 3,
            }}
            title="Click to edit"
          >
            {job.schedule}
          </button>
        )}
      </td>
      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{lastRunLabel(job.last_run_at)}</td>
      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{nextRunLabel(job.next_run_at)}</td>
      <td>
        <label className="toggle" title={job.enabled ? 'Disable' : 'Enable'}>
          <input
            type="checkbox"
            checked={!!job.enabled}
            onChange={toggleEnabled}
            disabled={saving}
          />
          <span className="toggle-track" />
        </label>
      </td>
    </tr>
  );
}

export default function Jobs() {
  const toast = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getJobs();
      setJobs(res.jobs || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function handleUpdate(id, patch) {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p className="stat-label">Scheduled Jobs</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
            Click a schedule to edit inline. Toggle to enable/disable.
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
        ) : jobs.length === 0 ? (
          <div className="empty-state">No jobs found</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Job</th>
                <th style={{ width: '24%' }}>Schedule</th>
                <th style={{ width: '18%' }}>Last Run</th>
                <th style={{ width: '18%' }}>Next Run</th>
                <th style={{ width: '12%' }}>Enabled</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} onUpdate={handleUpdate} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

