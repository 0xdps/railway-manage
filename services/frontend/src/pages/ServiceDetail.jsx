import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, RotateCcw, Github, Package, Server,
  Globe, Link2, HardDrive, Clock, Cpu, Copy,
  Tag, X, CheckCircle2, XCircle, AlertTriangle,
  Eye, EyeOff, Edit2, MapPin,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import api from '../api';
import { useToast } from '../components/Toast';
import { TAG_PALETTE } from './Services';
import MathCaptcha from '../components/MathCaptcha';
import { detectType, TypeBadge, TYPE_META, DB_TYPES, ALL_TYPES } from '../utils/serviceTypes';
import CustomSelect from '../components/CustomSelect';

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

  function addAndSave(inputVal, currentLocal) {
    const t = inputVal.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    const next = (t && currentLocal.length < 10 && !currentLocal.includes(t))
      ? [...currentLocal, t]
      : currentLocal;
    setInput('');
    onSave(next);
    // optimistically update local so dirty resets
    setLocal(next);
  }

  function remove(t) { setLocal((l) => l.filter((x) => x !== t)); }

  const dirty = JSON.stringify(local) !== JSON.stringify(tags);
  const canSave = dirty || input.trim().length > 0;

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

      {/* Input + Save */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAndSave(input, local); } }}
          placeholder="Type a tag and press Enter…"
          className="form-control"
          style={{ fontSize: 12, padding: '5px 10px', flex: 1 }}
        />
        <button
          onClick={() => addAndSave(input, local)}
          disabled={saving || !canSave}
          className="btn btn-primary btn-sm"
        >
          {saving ? 'Saving…' : 'Save tags'}
        </button>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {PRESET_TAGS.filter((t) => !local.includes(t)).map((t) => (
          <button key={t} onClick={() => add(t)} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 3,
            padding: '2px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}>{t}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Metric chart ────────────────────────────────────────────────────────────
const RANGES = [
  { label: '30m', minutes: 30 },
  { label: '1h',  minutes: 60 },
  { label: '3h',  minutes: 180 },
];

function SingleChart({ data, color, gradId, unit, domain, label, icon: Icon, currentVal, yAxisWidth = 50, yAxisTickCount = 5 }) {
  const tickCount = 6;
  const tickStep  = Math.max(1, Math.floor(data.length / tickCount));
  const ticks     = data
    .filter((_, i) => i % tickStep === 0 || i === data.length - 1)
    .map((d) => d.ts);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* mini header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={12} style={{ color }} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{currentVal}</span>
      </div>

      {data.length < 2 ? (
        <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No data</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="ts"
              ticks={ticks}
              tickFormatter={(ts) => new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              axisLine={false} tickLine={false} interval="preserveStartEnd"
            />
            <YAxis
              domain={domain}
              tickCount={yAxisTickCount}
              tickFormatter={(v) => `${typeof v === 'number' ? +v.toFixed(1) : v}${unit}`}
              tick={{ fontSize: 9, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              axisLine={false} tickLine={false} width={yAxisWidth}
            />
            <Tooltip
              content={({ active, payload, label: ts }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 11px' }}>
                    <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 3 }}>
                      {new Date(ts * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>
                      {payload[0].value}{unit}
                    </p>
                  </div>
                );
              }}
              cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 2' }}
            />
            <Area
              type="monotone" dataKey="value"
              stroke={color} strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false} activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
        {data.length} samples
      </p>
    </div>
  );
}

function MetricChart({ cpuData, memData, currentCpu, currentMem, range }) {
  const now    = Math.floor(Date.now() / 1000);
  const cutoff = now - range * 60;

  const cpuChart = (cpuData || [])
    .filter((d) => d.ts >= cutoff)
    .map((d) => ({ ts: d.ts, value: +(d.value * 100).toFixed(2) }));

  const memChart = (memData || [])
    .filter((d) => d.ts >= cutoff)
    .map((d) => ({ ts: d.ts, value: +(d.value * 1024).toFixed(1) }));

  return (
    <div style={{ width: '100%' }}>
      {/* side-by-side charts */}
      <div style={{ display: 'flex', gap: 20 }}>
        <SingleChart
          data={cpuChart}
          color="#60a5fa"
          gradId="gradCpu"
          unit="%"
          domain={[0, 100]}
          label="CPU"
          icon={Cpu}
          currentVal={currentCpu != null ? `${(currentCpu * 100).toFixed(1)}%` : '—'}
        />
        <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
        <SingleChart
          data={memChart}
          color="#a78bfa"
          gradId="gradMem"
          unit=" MB"
          domain={['auto', 'auto']}
          label="Memory"
          icon={HardDrive}
          currentVal={currentMem != null ? `${(currentMem * 1024).toFixed(0)} MB` : '—'}
          yAxisWidth={80}
          yAxisTickCount={4}
        />
      </div>
    </div>
  );
}

// ─── Resources panel (has own range state) ───────────────────────────────────
function ResourcesPanel({ svc, metricHistory, metrics }) {
  const [range, setRange] = useState(180);
  return (
    <Panel style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SectionHead>Resources</SectionHead>
          {svc.numReplicas > 1 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
              <Server size={12} /> {svc.numReplicas} replicas
            </span>
          )}
        </div>
        <div style={{
          display: 'flex',
          border: '1px solid var(--border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}>
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRange(r.minutes)}
              style={{
                padding: '4px 12px',
                border: 'none',
                borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: range === r.minutes ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: range === r.minutes ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: range === r.minutes ? 600 : 400,
                transition: 'background .15s, color .15s',
              }}
            >{r.label}</button>
          ))}
        </div>
      </div>
      {(metricHistory.cpu.length > 0 || metricHistory.mem.length > 0) ? (
        <MetricChart
          cpuData={metricHistory.cpu}
          memData={metricHistory.mem}
          currentCpu={metrics?.cpu ?? null}
          currentMem={metrics?.memoryGB ?? null}
          range={range}
        />
      ) : (
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Metrics not available — service may be sleeping or stopped.</span>
      )}
    </Panel>
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
  const [metricHistory, setMetricHistory] = useState({ cpu: [], mem: [] });
  const [restartPolicy, setRestartPolicy] = useState(null);
  const [localPolicy, setLocalPolicy]   = useState(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Env vars
  const [varKeys, setVarKeys]               = useState([]);
  const [loadingVarKeys, setLoadingVarKeys] = useState(false);
  const [revealedVars, setRevealedVars]     = useState({}); // key → plaintext value
  const revealTimers                         = useRef({});   // key → timeout id
  const [editVar, setEditVar]               = useState(null); // { key, currentValue, newValue, saving }
  const [restartCaptchaOk, setRestartCaptchaOk] = useState(false);
  const [editVarCaptchaOk, setEditVarCaptchaOk] = useState(false);

  useEffect(() => { load(); loadVarKeys(); }, [serviceId]);

  async function load() {
    setLoading(true);
    try {
      const [svcRes, deploymentsRes, managedRes, backupsRes, metricsRes, historyRes, policyRes] = await Promise.all([
        api.getServices(),
        api.getDeployments(serviceId).catch(() => ({ deployments: [] })),
        api.getManagedServices(),
        api.getBackups().catch(() => ({ backups: [] })),
        api.getMetrics(serviceId).catch(() => ({ metrics: null })),
        api.getMetricHistory(serviceId, 3).catch(() => ({ cpu: [], mem: [] })),
        api.getRestartPolicy(serviceId).catch(() => ({ policy: null })),
      ]);

      setMetrics(metricsRes?.metrics || null);
      setMetricHistory(historyRes && (historyRes.cpu || historyRes.mem) ? historyRes : { cpu: [], mem: [] });
      const pol = policyRes?.policy ?? null;
      setRestartPolicy(pol);
      setLocalPolicy(pol ? { ...pol } : {
        enabled: false, cpu_threshold: null, mem_threshold_gb: null,
        window_minutes: 5, violation_ratio: 0.8, restart_cron: '', cooldown_minutes: 30,
      });

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

  async function handleSavePolicy() {
    setSavingPolicy(true);
    try {
      const res = await api.updateRestartPolicy(serviceId, localPolicy);
      setRestartPolicy(res.policy);
      setLocalPolicy({ ...res.policy });
      toast('Restart policy saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingPolicy(false);
    }
  }

  async function loadVarKeys() {
    setLoadingVarKeys(true);
    setVarKeys([]);
    setRevealedVars({});
    try {
      const res = await api.getServiceVariableKeys(serviceId);
      setVarKeys(res.keys || []);
    } catch (err) {
      toast(`Could not load variables: ${err.message}`, 'error');
    } finally {
      setLoadingVarKeys(false);
    }
  }

  function clearReveal(key) {
    if (revealTimers.current[key]) { clearTimeout(revealTimers.current[key]); delete revealTimers.current[key]; }
    setRevealedVars((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  async function handleReveal(key) {
    try {
      const res = await api.getServiceVariable(serviceId, key);
      if (revealTimers.current[key]) clearTimeout(revealTimers.current[key]);
      revealTimers.current[key] = setTimeout(() => {
        setRevealedVars((prev) => { const next = { ...prev }; delete next[key]; return next; });
        delete revealTimers.current[key];
      }, 10000);
      setRevealedVars((prev) => ({ ...prev, [key]: res.value }));
    } catch (err) {
      toast(`Failed to reveal ${key}: ${err.message}`, 'error');
    }
  }

  async function handleCopyVar(key) {
    try {
      const existing = revealedVars[key];
      const value = existing != null ? existing : (await api.getServiceVariable(serviceId, key)).value;
      await navigator.clipboard.writeText(value);
      toast(`${key} copied`, 'success');
      if (revealTimers.current[key]) clearTimeout(revealTimers.current[key]);
      revealTimers.current[key] = setTimeout(() => {
        setRevealedVars((prev) => { const next = { ...prev }; delete next[key]; return next; });
        delete revealTimers.current[key];
      }, 10000);
      setRevealedVars((prev) => ({ ...prev, [key]: value }));
    } catch (err) {
      toast(`Failed to copy ${key}: ${err.message}`, 'error');
    }
  }

  async function openEditVar(key) {
    setEditVarCaptchaOk(false);
    try {
      const existing = revealedVars[key];
      const value = existing != null ? existing : (await api.getServiceVariable(serviceId, key)).value;
      setEditVar({ key, currentValue: value, newValue: value, saving: false });
    } catch (err) {
      toast(`Failed to load variable: ${err.message}`, 'error');
    }
  }

  async function handleSaveVar() {
    if (!editVar || !editVarCaptchaOk) return;
    setEditVar((v) => ({ ...v, saving: true }));
    try {
      await api.updateServiceVariable(serviceId, editVar.key, editVar.newValue);
      toast(`${editVar.key} updated`, 'success');
      clearReveal(editVar.key);
      setEditVar(null);
    } catch (err) {
      toast(`Failed to update variable: ${err.message}`, 'error');
      setEditVar((v) => v ? { ...v, saving: false } : v);
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

  const type     = detectType(svc.name, svc.source, svc.typeOverride);
  const m        = TYPE_META[type] || TYPE_META.Service;
  const sm       = statusMeta(svc.status);
  const isDB     = DB_TYPES.has(type);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Service header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'nowrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>{svc.name}</h1>
            <TypeBadge type={type} />
            <span className={`badge ${sm.cls}`}>{sm.label}</span>
            {/* Type override — custom select with icons */}
            <CustomSelect
              className="custom-select-sm"
              value={svc.typeOverride || null}
              onChange={async (val) => {
                try {
                  await api.updateTypeOverride(svc.id, val);
                  setSvc((s) => ({ ...s, typeOverride: val }));
                  toast('Type updated', 'success');
                } catch (err) {
                  toast(`Failed: ${err.message}`, 'error');
                }
              }}
              placeholder="auto-detect"
              options={[
                { value: null, label: 'auto-detect' },
                ...ALL_TYPES.map((t) => ({ value: t, label: t, Icon: TYPE_META[t]?.Icon }))
              ]}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, flexWrap: 'wrap' }}>
            {/* Service ID + copy */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{svc.id}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(svc.id); toast('Copied!', 'success'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', lineHeight: 1 }}
                title="Copy service ID"
              >
                <Copy size={11} />
              </button>
            </span>
            {svc.deployedAt && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                <Clock size={10} />
                <span>{sm.label} · {relTime(svc.deployedAt)}</span>
              </span>
            )}
            {svc.numReplicas > 1 && (
              <span style={{ color: 'var(--text-muted)' }}>{svc.numReplicas} replicas</span>
            )}
            {svc.region && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                <MapPin size={10} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{svc.region}</span>
              </span>
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
        <ResourcesPanel svc={svc} metricHistory={metricHistory} metrics={metrics} />

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
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{v.name || v.id.slice(0, 12) + '…'}</td>
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

        {/* Environment Variables */}
        <Panel>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SectionHead>Environment Variables</SectionHead>
            <button onClick={loadVarKeys} disabled={loadingVarKeys} className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }}>
              <RefreshCw size={12} style={loadingVarKeys ? { animation: 'spin 0.8s linear infinite' } : {}} />
              Refresh
            </button>
          </div>
          {varKeys.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {loadingVarKeys ? 'Loading…' : 'No variables found for this service.'}
            </span>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 252, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...varKeys]
                .sort((a, b) => {
                  const aR = a.startsWith('RAILWAY_');
                  const bR = b.startsWith('RAILWAY_');
                  if (aR !== bR) return aR ? 1 : -1;
                  return a.localeCompare(b);
                })
                .map((key) => {
                const revealed = revealedVars[key];
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 4, background: 'var(--bg-hover)', border: '1px solid var(--border)', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', flex: '0 0 auto', minWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={key}>{key}</span>
                    {revealed != null ? (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {revealed}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1, fontFamily: 'var(--font-mono)' }}>••••••••••••</span>
                    )}
                    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                      <button
                        onClick={() => revealed != null ? clearReveal(key) : handleReveal(key)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 7px' }}
                        title={revealed != null ? 'Hide' : 'Read secret'}
                      >
                        {revealed != null ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                      <button
                        onClick={() => handleCopyVar(key)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 7px' }}
                        title="Copy secret"
                      >
                        <Copy size={11} />
                      </button>
                      <button
                        onClick={() => openEditVar(key)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '3px 7px' }}
                        title="Edit secret"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Recent Deployments (inline, half-width) */}
        <Panel>
          <SectionHead>Recent Deployments</SectionHead>
          {deployments.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No deployments found</span>
          ) : (
            <div style={{ overflowY: 'auto', maxHeight: 252 }}>
              <table className="data-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Commit</th>
                    <th>Branch</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.slice(0, 10).map((d) => {
                    const meta = d.meta || {};
                    const shortHash = meta.commitHash ? meta.commitHash.slice(0, 7) : null;
                    return (
                      <tr key={d.id}>
                        <td><DeployStatus status={d.status} /></td>
                        <td style={{ maxWidth: 140 }}>
                          {shortHash ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{shortHash}</span>
                              {meta.commitMessage && (
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }} title={meta.commitMessage}>
                                  {meta.commitMessage}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{d.id.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{meta.branch || '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{absTime(d.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Restart Policy — not applicable for DB services */}
        {!isDB && (
        <Panel style={{ gridColumn: '1 / -1' }}>
          <SectionHead>Restart Policy</SectionHead>
          {localPolicy ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!localPolicy.enabled}
                  onChange={(e) => setLocalPolicy((p) => ({ ...p, enabled: e.target.checked }))}
                />
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Enable automated restarts</span>
              </label>

              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 14,
                opacity: localPolicy.enabled ? 1 : 0.45,
                pointerEvents: localPolicy.enabled ? 'auto' : 'none',
              }}>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>CPU threshold (%)</label>
                  <input
                    type="number" min="0" max="100" step="1"
                    className="form-control" style={{ fontSize: 12, padding: '5px 10px' }}
                    placeholder="e.g. 90"
                    value={localPolicy.cpu_threshold != null ? +(localPolicy.cpu_threshold * 100).toFixed(0) : ''}
                    onChange={(e) => setLocalPolicy((p) => ({ ...p, cpu_threshold: e.target.value === '' ? null : parseFloat(e.target.value) / 100 }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>Memory threshold (GB)</label>
                  <input
                    type="number" min="0" step="0.1"
                    className="form-control" style={{ fontSize: 12, padding: '5px 10px' }}
                    placeholder="e.g. 1.5"
                    value={localPolicy.mem_threshold_gb ?? ''}
                    onChange={(e) => setLocalPolicy((p) => ({ ...p, mem_threshold_gb: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>Window (minutes)</label>
                  <input
                    type="number" min="1" max="60" step="1"
                    className="form-control" style={{ fontSize: 12, padding: '5px 10px' }}
                    value={localPolicy.window_minutes ?? 5}
                    onChange={(e) => setLocalPolicy((p) => ({ ...p, window_minutes: parseInt(e.target.value, 10) || 5 }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>Violation ratio (%)</label>
                  <input
                    type="number" min="0" max="100" step="1"
                    className="form-control" style={{ fontSize: 12, padding: '5px 10px' }}
                    placeholder="e.g. 80"
                    value={localPolicy.violation_ratio != null ? +(localPolicy.violation_ratio * 100).toFixed(0) : 80}
                    onChange={(e) => setLocalPolicy((p) => ({ ...p, violation_ratio: parseFloat(e.target.value) / 100 }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>Scheduled cron (optional)</label>
                  <input
                    type="text"
                    className="form-control" style={{ fontSize: 12, padding: '5px 10px', fontFamily: 'var(--font-mono)' }}
                    placeholder="e.g. 0 3 * * *"
                    value={localPolicy.restart_cron ?? ''}
                    onChange={(e) => setLocalPolicy((p) => ({ ...p, restart_cron: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>Cooldown (minutes)</label>
                  <input
                    type="number" min="1" step="1"
                    className="form-control" style={{ fontSize: 12, padding: '5px 10px' }}
                    value={localPolicy.cooldown_minutes ?? 30}
                    onChange={(e) => setLocalPolicy((p) => ({ ...p, cooldown_minutes: parseInt(e.target.value, 10) || 30 }))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button onClick={handleSavePolicy} disabled={savingPolicy} className="btn btn-primary btn-sm">
                  {savingPolicy ? 'Saving…' : 'Save policy'}
                </button>
                {restartPolicy?.last_triggered_at && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Last triggered: {absTime(new Date(restartPolicy.last_triggered_at * 1000).toISOString())}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading policy…</span>
          )}
        </Panel>
        )}

      </div>

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

      {/* ── Edit variable modal ── */}
      {editVar && (
        <div
          className="modal-backdrop"
          onClick={(e) => e.target === e.currentTarget && setEditVar(null)}
        >
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">Edit Variable</span>
              <button onClick={() => setEditVar(null)} className="modal-close"><X size={14} /></button>
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', padding: '8px 0 4px' }}>
              {editVar.key}
            </p>
            <textarea
              value={editVar.newValue}
              onChange={(e) => setEditVar((v) => ({ ...v, newValue: e.target.value }))}
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '8px 10px',
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--text-primary)', resize: 'vertical', outline: 'none',
                marginBottom: 12,
              }}
            />
            <MathCaptcha onVerified={setEditVarCaptchaOk} />
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button onClick={() => setEditVar(null)} className="btn btn-ghost">Cancel</button>
              <button
                onClick={handleSaveVar}
                disabled={!editVarCaptchaOk || editVar.saving}
                className="btn btn-primary"
              >
                {editVar.saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
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
