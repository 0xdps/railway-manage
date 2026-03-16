import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, ArrowRight, Github, Package, Server, Filter,
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
export const TAG_PALETTE = {
  production: 'rgba(239,68,68,0.15)',
  critical:   'rgba(239,68,68,0.15)',
  staging:    'rgba(245,158,11,0.12)',
  db:         'rgba(59,130,246,0.12)',
  cache:      'rgba(239,68,68,0.1)',
  infra:      'rgba(255,255,255,0.05)',
  api:        'rgba(34,197,94,0.1)',
  worker:     'rgba(168,85,247,0.1)',
};

export function TagChip({ tag }) {
  const bg = TAG_PALETTE[tag] || 'rgba(255,255,255,0.05)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '1px 7px', borderRadius: 2,
      fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)',
      background: bg, color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    }}>
      {tag}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Services() {
  const toast    = useToast();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filterTag, setFilterTag]   = useState('');
  const [filterName, setFilterName] = useState('');

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
            {services.length} Railway service{services.length !== 1 ? 's' : ''} — click a row for details
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Filter by name…"
            className="form-control"
            style={{ width: 180, fontSize: 12, padding: '5px 10px' }}
          />
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
                <th style={{ width: '26%' }}>Service</th>
                <th style={{ width: '11%' }}>Type</th>
                <th style={{ width: '23%' }}>Source</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Volume</th>
                <th style={{ width: '11%' }}>Status</th>
                <th>Tags</th>
                <th style={{ width: '36px' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((svc) => {
                const type = detectType(svc.name, svc.source);
                const sm   = statusMeta(svc.status);
                return (
                  <tr
                    key={svc.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/services/${svc.id}`)}
                  >
                    <td style={{ paddingLeft: 14 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{svc.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{svc.id.slice(0, 16)}…</div>
                    </td>
                    <td><TypeBadge type={type} /></td>
                    <td style={{ maxWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
                        {svc.source?.repo  ? <Github  size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                          : svc.source?.image ? <Package size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                          : <Server size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sourceLabel(svc.source)}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {svc.volumes.length > 0
                        ? <span style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>✓{svc.volumes.length > 1 ? ` ${svc.volumes.length}` : ''}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                    </td>
                    <td><span className={`badge ${sm.cls}`}>{sm.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {svc.tags.map((t) => <TagChip key={t} tag={t} />)}
                      </div>
                    </td>
                    <td>
                      <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


