import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, ArrowRight, Github, Package, Server, Filter,
  Shield,
} from 'lucide-react';
import api from '../api';
import { useToast } from '../components/Toast';
import { detectType, TypeBadge } from '../utils/serviceTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const [services, setServices]             = useState([]);
  const [managed, setManaged]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [restartPolicies, setRestartPolicies] = useState([]);
  const [filterTag, setFilterTag]            = useState('');
  const [filterName, setFilterName]          = useState('');
  const [filterManaged, setFilterManaged]    = useState(false);
  const [filterRestart, setFilterRestart]    = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [svcRes, managedRes, policiesRes] = await Promise.all([
        api.getServices(),
        api.getManagedServices(),
        api.getAllRestartPolicies(),
      ]);
      setServices(svcRes.services || []);
      setManaged(managedRes.services || []);
      setRestartPolicies(policiesRes.policies || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const managedMap = useMemo(
    () => new Map(managed.map((ms) => [ms.railway_service_id, ms])),
    [managed],
  );

  const restartMap = useMemo(
    () => new Map(restartPolicies.filter((p) => p.enabled).map((p) => [p.service_id, p])),
    [restartPolicies],
  );

  const displayed = services.filter((s) => {
    if (filterName    && !s.name.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterTag     && !s.tags.includes(filterTag)) return false;
    if (filterManaged && !managedMap.has(s.id)) return false;
    if (filterRestart && !restartMap.has(s.id)) return false;
    return true;
  });

  const allUsedTags = [...new Set(services.flatMap((s) => s.tags))].sort();

  const topbar = document.getElementById('topbar-actions');

  return (
    <>
      {topbar && createPortal(
        <>
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
          <button
            onClick={() => setFilterManaged((v) => !v)}
            className={`btn ${filterManaged ? 'btn-primary' : 'btn-ghost'}`}
            title="Show only managed services"
          >
            <Shield size={13} />
            Managed
          </button>
          <button
            onClick={() => setFilterRestart((v) => !v)}
            className={`btn ${filterRestart ? 'btn-primary' : 'btn-ghost'}`}
            title="Show only services with restart policy"
          >
            <RefreshCw size={13} />
            Restart
          </button>
          <button onClick={load} className="btn btn-ghost" disabled={loading}>
            <RefreshCw size={13} />
            Refresh
          </button>
        </>,
        topbar,
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                <th style={{ width: '22%' }}>Service</th>
                <th style={{ width: '11%' }}>Type</th>
                <th style={{ width: '22%' }}>Source</th>
                <th style={{ width: '9%' }}>Region</th>
                <th style={{ width: '11%' }}>Status</th>
                <th>Tags</th>
                <th style={{ width: '36px' }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((svc) => {
                const type        = detectType(svc.name, svc.source, svc.typeOverride);
                const sm          = statusMeta(svc.status);
                const managedSvc  = managedMap.get(svc.id);
                const hasRestart  = restartMap.has(svc.id);
                return (
                  <tr
                    key={svc.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/services/${svc.id}`)}
                  >
                    <td style={{ paddingLeft: 14 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>{svc.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{svc.id.slice(0, 16)}…</span>
                        {managedSvc && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 2,
                            background: 'rgba(34,197,94,0.1)', color: '#4ade80',
                            border: '1px solid rgba(34,197,94,0.2)',
                            fontFamily: 'var(--font-mono)', lineHeight: '14px',
                          }}>backup</span>
                        )}
                        {hasRestart && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 2,
                            background: 'rgba(99,102,241,0.12)', color: '#a5b4fc',
                            border: '1px solid rgba(99,102,241,0.25)',
                            fontFamily: 'var(--font-mono)', lineHeight: '14px',
                          }}>restart</span>
                        )}
                      </div>
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
                    <td>
                      {svc.region
                        ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{svc.region}</span>
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


    </>
  );
}

