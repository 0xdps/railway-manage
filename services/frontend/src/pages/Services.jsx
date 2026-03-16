import { useEffect, useState, useRef } from 'react';
import {
  RefreshCw, RotateCcw, ChevronDown, ChevronRight,
  Github, Package, Server, Database, Cpu, HardDrive,
  Globe, Link2, Tag, X, Plus, Filter,
} from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectType(name, source) {
  const img = (source?.image || '').toLowerCase();
  const n   = name.toLowerCase();
  if (img.includes('postgres') || img.includes('postgre') || n.includes('postgres') || n.includes('-db')) return 'PostgreSQL';
  if (img.includes('mysql') || img.includes('mariadb') || n.includes('mysql'))                              return 'MySQL';
  if (img.includes('redis') || n.includes('redis') || n.includes('cache'))                                 return 'Redis';
  if (img.includes('mongo') || n.includes('mongo'))                                                        return 'MongoDB';
  if (img.includes('nginx') || n.includes('nginx'))                                                        return 'Nginx';
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
  SUCCESS:      { label: 'Running',   cls: 'badge-success'  },
  FAILED:       { label: 'Failed',    cls: 'badge-danger'   },
  CRASHED:      { label: 'Crashed',   cls: 'badge-danger'   },
  SLEEPING:     { label: 'Sleeping',  cls: 'badge-warning'  },
  DEPLOYING:    { label: 'Deploying', cls: 'badge-info'     },
  BUILDING:     { label: 'Building',  cls: 'badge-info'     },
  INITIALIZING: { label: 'Starting',  cls: 'badge-info'     },
  WAITING:      { label: 'Waiting',   cls: 'badge-warning'  },
  REMOVED:      { label: 'Removed',   cls: 'badge-neutral'  },
  REMOVING:     { label: 'Removing',  cls: 'badge-neutral'  },
};

function statusMeta(raw) {
  return STATUS_META[raw?.toUpperCase()] || { label: raw || '—', cls: 'badge-neutral' };
}

function relTime(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function sourceLabel(source) {
  if (source?.repo)  return source.repo.replace(/^https?:\/\//, '');
  if (source?.image) return source.image.split('@')[0];
  return '—';
}

// ─── Type badge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS.Service;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 500,
      whiteSpace: 'nowrap', letterSpacing: '0.04em',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {type}
    </span>
  );
}

// ─── Tag chip & input ────────────────────────────────────────────────────────
const TAG_COLORS = ['production', 'staging', 'critical', 'db', 'cache', 'infra', 'api', 'worker'];
const TAG_PALETTE = {
  production: 'rgba(239,68,68,0.15)',
  critical:   'rgba(239,68,68,0.15)',
  staging:    'rgba(245,158,11,0.12)',
  db:         'rgba(59,130,246,0.12)',
  cache:      'rgba(239,68,68,0.1)',
  infra:      'rgba(255,255,255,0.05)',
  api:        'rgba(34,197,94,0.1)',
  worker:     'rgba(168,85,247,0.1)',
};

function TagChip({ tag, onRemove }) {
  const bg = TAG_PALETTE[tag] || 'rgba(255,255,255,0.05)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 7px 1px 7px', borderRadius: 2,
      fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)',
      background: bg, color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    }}>
      {tag}
      {onRemove && (
        <button onClick={onRemove} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', color: 'var(--text-muted)', lineHeight: 1 }}>
          <X size={9} />
        </button>
      )}
    </span>
  );
}

// ─── Tag editor (popover) ────────────────────────────────────────────────────
function TagEditor({ tags, onSave, onClose }) {
  const [input, setInput] = useState('');
  const [local, setLocal] = useState(tags);
  const ref = useRef(null);

  useEffect(() => {
    function outside(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [onClose]);

  function add(tag) {
    const t = tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    if (t && !local.includes(t)) setLocal((l) => [...l, t]);
    setInput('');
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 300, top: '100%', left: 0, marginTop: 4,
      background: 'var(--bg-overlay)', border: '1px solid var(--border-mid)',
      borderRadius: 'var(--radius-sm)', padding: 12, minWidth: 220,
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Tags</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {local.map((t) => <TagChip key={t} tag={t} onRemove={() => setLocal((l) => l.filter((x) => x !== t))} />)}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
          placeholder="add tag…"
          className="form-control"
          style={{ fontSize: 11, padding: '4px 8px' }}
          autoFocus
        />
        <button onClick={() => add(input)} className="btn btn-ghost btn-sm"><Plus size={11} /></button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 10 }}>
        {TAG_COLORS.filter((t) => !local.includes(t)).map((t) => (
          <button key={t} onClick={() => add(t)} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 2,
            padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-mono)', cursor: 'pointer', color: 'var(--text-muted)',
          }}>{t}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave(local)} className="btn btn-primary btn-sm">Save</button>
        <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </div>
  );
}

// ─── Expanded detail panel ────────────────────────────────────────────────────
function ExpandedRow({ svc, managedServices, backups }) {
  const [metrics, setMetrics] = useState(null);
  const [vars, setVars] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMetrics(svc.id).catch(() => ({ metrics: null })),
      api.getServiceVariableKeys(svc.id).catch(() => ({ keys: [] })),
    ]).then(([m, v]) => {
      setMetrics(m?.metrics || null);
      setVars(Array.isArray(v?.keys) ? v.keys : []);
      setLoadingMetrics(false);
    });
  }, [svc.id]);

  const managed = managedServices.find((m) => m.railway_service_id === svc.id);
  const svcBackups = backups.filter((b) => b.service_id === managed?.id).slice(0, 3);
  const lastBackup = svcBackups[0];

  const type = detectType(svc.name, svc.source);
  const isDB = ['PostgreSQL', 'MySQL', 'Redis', 'MongoDB'].includes(type);

  return (
    <tr style={{ background: 'var(--bg-soft)' }}>
      <td colSpan={7} style={{ padding: '0 14px 14px 44px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, paddingTop: 14 }}>

          {/* Source */}
          <section>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Source</p>
            {svc.source?.repo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Github size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{svc.source.repo.replace(/^https?:\/\//, '')}</span>
              </div>
            ) : svc.source?.image ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Package size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{svc.source.image}</span>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Railway internal</span>
            )}
          </section>

          {/* Resources */}
          <section>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Resources</p>
            {loadingMetrics ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>
            ) : metrics ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {metrics.currentStatus?.cpu != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Cpu size={11} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>CPU: <strong style={{ color: 'var(--text-primary)' }}>{(metrics.currentStatus.cpu * 100).toFixed(1)}%</strong></span>
                  </div>
                )}
                {metrics.currentStatus?.memory != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HardDrive size={11} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Memory: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(metrics.currentStatus.memory / 1048576)} MB</strong></span>
                  </div>
                )}
                {!metrics.currentStatus && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Metrics not available</span>
                )}
              </div>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not available</span>
            )}
            {svc.numReplicas > 1 && (
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                Replicas: <strong style={{ color: 'var(--text-primary)' }}>{svc.numReplicas}</strong>
              </div>
            )}
          </section>

          {/* Networking */}
          <section>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Networking</p>
            {svc.domains.length === 0 && !svc.upstreamUrl ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No public domains</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {svc.upstreamUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Link2 size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{svc.upstreamUrl}</span>
                  </div>
                )}
                {svc.domains.map((d) => (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <a href={`https://${d}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent)', wordBreak: 'break-all', textDecoration: 'none' }}>{d}</a>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Volumes */}
          <section>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Volumes</p>
            {svc.volumes.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None attached</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {svc.volumes.map((v) => (
                  <div key={v.id} style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{v.mountPath}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      {v.sizeMB ? `${(v.sizeMB / 1024).toFixed(1)} GB` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Env Vars */}
          <section>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Env Variables</p>
            {vars.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None / not loaded</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {vars.slice(0, 12).map((k) => (
                  <span key={k} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: 2, padding: '1px 6px' }}>{k}</span>
                ))}
                {vars.length > 12 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{vars.length - 12} more</span>}
              </div>
            )}
          </section>

          {/* Backups */}
          {isDB && (
            <section>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>Backups</p>
              {!managed ? (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not registered as managed service</span>
              ) : svcBackups.length === 0 ? (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No backups yet</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {svcBackups.map((b) => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span className={`badge badge-${b.status === 'success' ? 'success' : b.status === 'failed' ? 'danger' : 'warning'}`} style={{ fontSize: 9 }}>{b.status}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{b.schedule}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{relTime(b.started_at ? new Date(b.started_at * 1000).toISOString() : null)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

        </div>
      </td>
    </tr>
  );
}

// ─── Single service row ───────────────────────────────────────────────────────
function ServiceRow({ svc, onRestart, restarting, onTagsUpdate, managedServices, backups }) {
  const [expanded, setExpanded]     = useState(false);
  const [tagsOpen, setTagsOpen]     = useState(false);
  const tagsWrap = useRef(null);

  const type   = detectType(svc.name, svc.source);
  const sm     = statusMeta(svc.status);
  const source = sourceLabel(svc.source);

  async function saveTags(tags) {
    try {
      const res = await api.updateServiceTags(svc.id, tags);
      onTagsUpdate(svc.id, res.tags);
    } catch { /* ignore */ }
    setTagsOpen(false);
  }

  return (
    <>
      <tr
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Service name + ID */}
        <td style={{ paddingLeft: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChevronRight
              size={13}
              style={{ color: 'var(--text-muted)', flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.12s' }}
            />
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>{svc.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{svc.id.slice(0, 16)}…</div>
            </div>
          </div>
        </td>

        {/* Type badge */}
        <td onClick={(e) => e.stopPropagation()}>
          <TypeBadge type={type} />
        </td>

        {/* Source */}
        <td style={{ maxWidth: 160 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
            {svc.source?.repo ? <Github size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} /> : svc.source?.image ? <Package size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} /> : <Server size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{source}</span>
          </div>
        </td>

        {/* Volume */}
        <td style={{ textAlign: 'center' }}>
          {svc.volumes.length > 0 ? (
            <span style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>✓ {svc.volumes.length > 1 ? svc.volumes.length : ''}</span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>✗</span>
          )}
        </td>

        {/* Status */}
        <td><span className={`badge ${sm.cls}`}>{sm.label}</span></td>

        {/* Tags */}
        <td onClick={(e) => e.stopPropagation()}>
          <div ref={tagsWrap} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {svc.tags.map((t) => <TagChip key={t} tag={t} />)}
            <button
              onClick={() => setTagsOpen((o) => !o)}
              className="btn-icon"
              style={{ width: 20, height: 20, fontSize: 10 }}
              title="Edit tags"
            >
              <Tag size={10} />
            </button>
            {tagsOpen && (
              <TagEditor tags={svc.tags} onSave={saveTags} onClose={() => setTagsOpen(false)} />
            )}
          </div>
        </td>

        {/* Actions */}
        <td onClick={(e) => e.stopPropagation()}>
          <div className="actions-cell">
            <button
              onClick={() => onRestart(svc)}
              disabled={restarting === svc.id}
              className="btn-icon"
              title="Restart service"
            >
              <RotateCcw size={12} style={restarting === svc.id ? { animation: 'spin 0.8s linear infinite' } : {}} />
            </button>
          </div>
        </td>
      </tr>

      {expanded && (
        <ExpandedRow
          svc={svc}
          managedServices={managedServices}
          backups={backups}
        />
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
const ALL_TAG_FILTERS = ['production', 'staging', 'critical', 'db', 'cache', 'api', 'worker', 'infra'];

export default function Services() {
  const toast = useToast();
  const [services, setServices]           = useState([]);
  const [managedServices, setManagedServices] = useState([]);
  const [backups, setBackups]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [restarting, setRestarting]       = useState(null);
  const [confirmRestart, setConfirmRestart] = useState(null);
  const [filterTag, setFilterTag]         = useState('');
  const [filterName, setFilterName]       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [svcRes, managedRes, backupsRes] = await Promise.all([
        api.getServices(),
        api.getManagedServices(),
        api.getBackups(),
      ]);
      setServices(svcRes.services || []);
      setManagedServices(managedRes.services || []);
      setBackups(backupsRes.backups || []);
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

  function handleTagsUpdate(serviceId, newTags) {
    setServices((prev) =>
      prev.map((s) => s.id === serviceId ? { ...s, tags: newTags } : s)
    );
  }

  const displayed = services.filter((s) => {
    if (filterName && !s.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterTag  && !s.tags.includes(filterTag)) return false;
    return true;
  });

  const allUsedTags = [...new Set(services.flatMap((s) => s.tags))].sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <p className="stat-label">Infrastructure</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
            {services.length} Railway service{services.length !== 1 ? 's' : ''} — click a row to expand details
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Name filter */}
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Filter by name…"
            className="form-control"
            style={{ width: 180, fontSize: 12, padding: '5px 10px' }}
          />
          {/* Tag filter */}
          {allUsedTags.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Filter size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: filterTag ? 'var(--accent)' : 'var(--text-muted)', pointerEvents: 'none' }} />
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="form-control"
                style={{ paddingLeft: 26, fontSize: 12, width: 150, padding: '5px 10px 5px 26px' }}
              >
                <option value="">All tags</option>
                {allUsedTags.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <button onClick={load} className="btn btn-ghost" disabled={loading}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">
            <Server size={24} />
            <p>{services.length === 0 ? 'No services found in this environment' : 'No services match the current filter'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '28%' }}>Service</th>
                <th style={{ width: '10%' }}>Type</th>
                <th style={{ width: '22%' }}>Source</th>
                <th style={{ width: '7%', textAlign: 'center' }}>Volume</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '16%' }}>Tags</th>
                <th style={{ width: '7%' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((svc) => (
                <ServiceRow
                  key={svc.id}
                  svc={svc}
                  onRestart={setConfirmRestart}
                  restarting={restarting}
                  onTagsUpdate={handleTagsUpdate}
                  managedServices={managedServices}
                  backups={backups}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm restart modal */}
      {confirmRestart && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setConfirmRestart(null)}>
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">Confirm Restart</span>
              <button onClick={() => setConfirmRestart(null)} className="modal-close"><X size={14} /></button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '8px 0 16px' }}>
              Restart <strong style={{ color: 'var(--text-primary)' }}>{confirmRestart.name}</strong>?
              This triggers a new deployment.
            </p>
            <div className="modal-actions">
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


