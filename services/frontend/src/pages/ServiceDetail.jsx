import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, RotateCcw, Github, Package, Server,
  Globe, Link2, HardDrive, Clock, Cpu,
  Tag, X, Plus, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';
import { TAG_PALETTE } from './Services';

// detectType and TYPE_COLORS/STATUS_META are local; TAG_PALETTE is shared from Services.
function detectType(name, source) {
  const img = (source?.image || '').toLowerCase();
  const n   = name.toLowerCase();
  if (img.includes('postgres') || img.includes('postgre') || n.includes('postgres') || n.includes('-db')) return 'PostgreSQL';
  if (img.includes('mysql')    || img.includes('mariadb')  || n.includes('mysql'))    return 'MySQL';
  if (img.includes('redis')    || n.includes('redis')      || n.includes('cache'))    return 'Redis';
  if (img.includes('mongo')    || n.includes('mongo'))                                return 'MongoDB';
  if (img.includes('nginx')    || n.includes('nginx'))                                return 'Nginx';
  if (source?.repo)   return 'GitHub';
  if (source?.image)  return 'Docker';
  return 'Service';
}

const TYPE_COLORS = {
  PostgreSQL: { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  MySQL:      { bg: 'rgba(234,88,12,0.1)',   color: '#fb923c', border: 'rgba(234,88,12,0.25)'  },
  Redis:      { bg: 'rgba(239,68,68,0.1)',   color: '#f87171', border: 'rgba(239,68,68,0.25)'  },
  MongoDB:    { bg: 'rgba(34,197,94,0.1)',   color: '#4ade80', border: 'rgba(34,197,94,0.25)'  },
  Nginx:      { bg: 'rgba(34,197,94,0.1)',   color: '#4ade80', border: 'rgba(34,197,94,0.25)'  },
  GitHub:     { bg: 'rgba(255,255,255,0.05)',color: '#a3a3b8', border: 'rgba(255,255,255,0.1)' },
  Docker:     { bg: 'rgba(14,165,233,0.1)',  color: '#38bdf8', border: 'rgba(14,165,233,0.25)' },
  Service:    { bg: 'rgba(255,255,255,0.04)',color: '#7070a0', border: 'rgba(255,255,255,0.08)'},
};

const STATUS_META = {
  SUCCESS:      { label: 'Running',   cls: 'badge-success', icon: CheckCircle2 },
  FAILED:       { label: 'Failed',    cls: 'badge-danger',  icon: XCircle      },
  CRASHED:      { label: 'Crashed',   cls: 'badge-danger',  icon: XCircle      },
  SLEEPING:     { label: 'Sleeping',  cls: 'badge-warning', icon: AlertTriangle },
  DEPLOYING:    { label: 'Deploying', cls: 'badge-info',    icon: RefreshCw    },
  BUILDING:     { label: 'Building',  cls: 'badge-info',    icon: RefreshCw    },
  INITIALIZING: { label: 'Starting',  cls: 'badge-info',    icon: RefreshCw    },
  WAITING:      { label: 'Waiting',   cls: 'badge-warning', icon: AlertTriangle },
  REMOVED:      { label: 'Removed',   cls: 'badge-neutral', icon: null         },
  REMOVING:     { label: 'Removing',  cls: 'badge-neutral', icon: null         },
};

function statusMeta(raw) {
  return STATUS_META[raw?.toUpperCase()] || { label: raw || 'Unknown', cls: 'badge-neutral', icon: null };
}

function relTime(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function absTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionHead({ children }) {
  return (
    <p style={{
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      color: 'var(--text-muted)', marginBottom: 10,
    }}>{children}</p>
  );
}

function Panel({ children, style }) {
  return (
    <div className="panel" style={{ padding: '18px 20px', ...style }}>
      {children}
    </div>
  );
}

// ─── Tag editor ───────────────────────────────────────────────────────────────
const PRESET_TAGS = ['production', 'staging', 'critical', 'db', 'cache', 'infra', 'api', 'worker'];

function TagEditor({ tags, onSave, saving }) {
  const [local, setLocal] = useState(tags.slice());
  const [input, setInput] = useState('');

  // sync when parent updates (after save)
  useEffect(() => { setLocal(tags.slice()); }, [tags]);

  function add(raw) {
    const t = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    if (t && local.length < 10 && !local.includes(t)) setLocal((l) => [...l, t]);
    setInput('');
  }

  function remove(t) { setLocal((l) => l.filter((x) => x !== t)); }

  const dirty = JSON.stringify(local) !== JSON.stringify(tags);

  return (
    <div>
      {/* Current tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 24 }}>
        {local.map((t) => {
          const bg = TAG_PALETTE[t] || 'rgba(255,255,255,0.05)';
          return (
            <span key={t} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 8px', borderRadius: 3,
              fontSize: 11, fontFamily: 'var(--font-mono)',
              background: bg, color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}>
              {t}
              <button onClick={() => remove(t)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--text-muted)', lineHeight: 1 }}>
                <X size={10} />
              </button>
            </span>
          );
        })}
        {local.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tags yet</span>}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
          placeholder="Type a tag and press Enter…"
          className="form-control"
          style={{ fontSize: 12, padding: '5px 10px', flex: 1 }}
        />
        <button onClick={() => add(input)} className="btn btn-ghost btn-sm" disabled={!input.trim()}>
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {PRESET_TAGS.filter((t) => !local.includes(t)).map((t) => (
          <button key={t} onClick={() => add(t)} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 3,
            padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}>{t}</button>
        ))}
      </div>

      {dirty && (
        <button
          onClick={() => onSave(local)}
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? 'Saving…' : 'Save tags'}
        </button>
      )}
    </div>
  );
}

// ─── Deployment status icon ───────────────────────────────────────────────────
function DeployStatus({ status }) {
  const m = statusMeta(status);
  return <span className={`badge ${m.cls}`} style={{ fontSize: 10 }}>{m.label}</span>;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ServiceDetail() {
  const { serviceId } = useParams();
  const navigate      = useNavigate();
  const toast         = useToast();

  const [svc, setSvc]                   = useState(null);
  const [metrics, setMetrics]           = useState(null);   // { cpu, memoryGB }
  const [deployments, setDeployments]   = useState([]);
  const [managedSvc, setManagedSvc]     = useState(null);
  const [backups, setBackups]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [restarting, setRestarting]     = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [savingTags, setSavingTags]     = useState(false);

  useEffect(() => { load(); }, [serviceId]);

  async function load() {
    setLoading(true);
    try {
      const [svcRes, deploymentsRes, managedRes, backupsRes, metricsRes] = await Promise.all([
        api.getServices(),
        api.getDeployments(serviceId).catch(() => ({ deployments: [] })),
        api.getManagedServices(),
        api.getBackups().catch(() => ({ backups: [] })),
        api.getMetrics(serviceId).catch(() => ({ metrics: null })),
      ]);

      setMetrics(metricsRes?.metrics || null);

      const found = (svcRes.services || []).find((s) => s.id === serviceId);
      if (!found) {
        toast('Service not found', 'error');
        navigate('/services');
        return;
      }
      setSvc(found);

      // normalize deployments response — backend returns array or { deployments: [] }
      const deps = Array.isArray(deploymentsRes)
        ? deploymentsRes
        : (deploymentsRes.deployments || []);
      setDeployments(deps);

      const managed = (managedRes.services || []).find(
        (m) => m.railway_service_id === serviceId
      );
      setManagedSvc(managed || null);

      if (managed) {
        setBackups((backupsRes.backups || []).filter((b) => b.service_id === managed.id));
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart() {
    setRestarting(true);
    setConfirmRestart(false);
    try {
      await api.restartService(serviceId);
      toast(`${svc.name} restart triggered`, 'success');
      // Reload after a short delay so status reflects deploying state
      setTimeout(load, 2000);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRestarting(false);
    }
  }

  async function handleSaveTags(newTags) {
    setSavingTags(true);
    try {
      const res = await api.updateServiceTags(serviceId, newTags);
      setSvc((s) => ({ ...s, tags: res.tags }));
      toast('Tags saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingTags(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/services')} className="btn btn-ghost btn-sm">
            <ArrowLeft size={13} /> Back
          </button>
        </div>
        <div className="empty-state">Loading service…</div>
      </div>
    );
  }

  if (!svc) return null;

  const type     = detectType(svc.name, svc.source);
  const tc       = TYPE_COLORS[type] || TYPE_COLORS.Service;
  const sm       = statusMeta(svc.status);
  const isDB     = ['PostgreSQL', 'MySQL', 'Redis', 'MongoDB'].includes(type);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Breadcrumb / back ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
        <button onClick={() => navigate('/services')} className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }}>
          <ArrowLeft size={12} /> Infrastructure
        </button>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--text-secondary)' }}>{svc.name}</span>
      </div>

      {/* ── Service header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{svc.name}</h1>
            <span style={{
              padding: '3px 9px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 500,
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
            }}>{type}</span>
            <span className={`badge ${sm.cls}`}>{sm.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{svc.id}</span>
            {svc.deployedAt && (
              <span style={{ color: 'var(--text-muted)' }}>
                <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Deployed {relTime(svc.deployedAt)}
              </span>
            )}
            {svc.numReplicas > 1 && (
              <span style={{ color: 'var(--text-muted)' }}>{svc.numReplicas} replicas</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={load} className="btn btn-ghost" disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            onClick={() => setConfirmRestart(true)}
            disabled={restarting}
            className="btn btn-primary"
          >
            <RotateCcw size={13} style={restarting ? { animation: 'spin 0.8s linear infinite' } : {}} />
            {restarting ? 'Restarting…' : 'Restart'}
          </button>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Resources */}
        <Panel style={{ gridColumn: '1 / -1' }}>
          <SectionHead>Resources</SectionHead>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Cpu size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2 }}>CPU</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {metrics?.cpu != null ? `${(metrics.cpu * 100).toFixed(2)}%` : '—'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HardDrive size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2 }}>Memory</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {metrics?.memoryGB != null ? `${(metrics.memoryGB * 1024).toFixed(0)} MB` : '—'}
                </p>
              </div>
            </div>
            {svc.numReplicas > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Server size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 2 }}>Replicas</p>
                  <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{svc.numReplicas}</p>
                </div>
              </div>
            )}
            {metrics == null && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Metrics not available — service may be sleeping or stopped.</span>
            )}
          </div>
        </Panel>

        {/* Source */}
        <Panel>
          <SectionHead>Source</SectionHead>
          {svc.source?.repo ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Github size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <a
                  href={svc.source.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', textDecoration: 'none' }}
                >
                  {svc.source.repo.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </div>
          ) : svc.source?.image ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                {svc.source.image}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Railway internal / no source</span>
          )}
        </Panel>

        {/* Networking */}
        <Panel>
          <SectionHead>Networking</SectionHead>
          {!svc.upstreamUrl && svc.domains.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No domains or upstream URL</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {svc.upstreamUrl && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Link2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>Internal URL</p>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{svc.upstreamUrl}</span>
                  </div>
                </div>
              )}
              {svc.domains.map((d) => (
                <div key={d} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <Globe size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>Public domain</p>
                    <a
                      href={`https://${d}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent)', wordBreak: 'break-all', textDecoration: 'none' }}
                    >{d}</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Volumes */}
        <Panel>
          <SectionHead>Volumes</SectionHead>
          {svc.volumes.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No volumes attached</span>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Mount path', 'Size', 'Volume ID'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {svc.volumes.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', padding: '6px 0' }}>{v.mountPath}</td>
                    <td style={{ color: 'var(--text-secondary)', padding: '6px 12px 6px 0' }}>{v.sizeMB ? `${(v.sizeMB / 1024).toFixed(1)} GB` : '—'}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{v.id.slice(0, 20)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        {/* Tags */}
        <Panel>
          <SectionHead>Tags</SectionHead>
          <TagEditor tags={svc.tags} onSave={handleSaveTags} saving={savingTags} />
        </Panel>

      </div>

      {/* ── Deployments ── */}
      <Panel>
        <SectionHead>Recent Deployments</SectionHead>
        {deployments.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No deployments found</span>
        ) : (
          <table className="data-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>Status</th>
                <th>Commit</th>
                <th>Branch</th>
                <th>Started</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {deployments.slice(0, 10).map((d) => {
                const meta = d.meta || {};
                const shortHash = meta.commitHash ? meta.commitHash.slice(0, 7) : null;
                const finishedAt = d.statusUpdatedAt || d.updatedAt;
                return (
                  <tr key={d.id}>
                    <td><DeployStatus status={d.status} /></td>
                    <td style={{ maxWidth: 260 }}>
                      {shortHash ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{shortHash}</span>
                          {meta.commitMessage && (
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }} title={meta.commitMessage}>
                              {meta.commitMessage}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{d.id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{meta.branch || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{absTime(d.createdAt)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {finishedAt && finishedAt !== d.createdAt ? absTime(finishedAt) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      {/* ── Backups (only for managed / DB services) ── */}
      {isDB && (
        <Panel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <SectionHead>Backups</SectionHead>
            {!managedSvc && (
              <Link to="/managed" style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
                Register as managed service →
              </Link>
            )}
          </div>
          {!managedSvc ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              This service is not registered as a managed service. Register it to enable automated backups.
            </span>
          ) : backups.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No backup runs yet for this service.</span>
          ) : (
            <table className="data-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th>Schedule</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {backups.slice(0, 10).map((b) => {
                  const started  = b.started_at  ? new Date(b.started_at  * 1000) : null;
                  const finished = b.finished_at ? new Date(b.finished_at * 1000) : null;
                  const durationSec = started && finished ? Math.round((finished - started) / 1000) : null;
                  return (
                    <tr key={b.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{b.schedule}</td>
                      <td>
                        <span className={`badge badge-${b.status === 'success' ? 'success' : b.status === 'failed' ? 'danger' : 'warning'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{started ? absTime(started.toISOString()) : '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{durationSec != null ? `${durationSec}s` : '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {b.size_bytes ? `${(b.size_bytes / 1048576).toFixed(1)} MB` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      )}

      {/* ── Confirm restart modal ── */}
      {confirmRestart && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setConfirmRestart(false)}
        >
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">Confirm Restart</span>
              <button onClick={() => setConfirmRestart(false)} className="modal-close"><X size={14} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '8px 0 16px' }}>
              Restart <strong style={{ color: 'var(--text-primary)' }}>{svc.name}</strong>?
              This triggers a new deployment — any in-progress work will be interrupted.
            </p>
            <div className="modal-actions">
              <button onClick={() => setConfirmRestart(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleRestart} className="btn btn-primary">
                <RotateCcw size={12} /> Restart
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
