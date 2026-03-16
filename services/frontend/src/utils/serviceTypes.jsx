/**
 * Shared type detection, metadata, and TypeBadge for railway services.
 * Imported by both Services.jsx and ServiceDetail.jsx.
 */
import { Database, Zap, Globe, Github, Box, Server, Coffee } from 'lucide-react';

// ─── Icon for language runtimes (styled letter-chip) ─────────────────────────
function LangIcon({ text, bg, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 14, height: 14, borderRadius: 2,
      fontSize: 7, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1,
      background: bg, color, flexShrink: 0, padding: '0 2px',
    }}>{text}</span>
  );
}

// ─── Type metadata ────────────────────────────────────────────────────────────
export const TYPE_META = {
  // Databases
  PostgreSQL: { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa', border: 'rgba(59,130,246,0.28)', Icon: () => <Database size={10} />, isDB: true  },
  MySQL:      { bg: 'rgba(234,88,12,0.12)',   color: '#fb923c', border: 'rgba(234,88,12,0.28)',  Icon: () => <Database size={10} />, isDB: true  },
  Redis:      { bg: 'rgba(239,68,68,0.12)',   color: '#f87171', border: 'rgba(239,68,68,0.28)',  Icon: () => <Zap size={10} />,      isDB: true  },
  MongoDB:    { bg: 'rgba(34,197,94,0.12)',   color: '#4ade80', border: 'rgba(34,197,94,0.28)',  Icon: () => <Database size={10} />, isDB: true  },
  // Infrastructure
  Nginx:      { bg: 'rgba(34,197,94,0.10)',   color: '#4ade80', border: 'rgba(34,197,94,0.25)',  Icon: () => <Globe size={10} />     },
  GitHub:     { bg: 'rgba(255,255,255,0.05)', color: '#a3a3b8', border: 'rgba(255,255,255,0.1)', Icon: () => <Github size={10} />    },
  Docker:     { bg: 'rgba(14,165,233,0.12)',  color: '#38bdf8', border: 'rgba(14,165,233,0.28)', Icon: () => <Box size={10} />       },
  // Language runtimes
  'Node.js':  { bg: 'rgba(74,222,128,0.10)',  color: '#4ade80', border: 'rgba(74,222,128,0.25)', Icon: () => <LangIcon text="JS"  bg="rgba(74,222,128,0.2)"  color="#4ade80" /> },
  Python:     { bg: 'rgba(250,204,21,0.10)',  color: '#fbbf24', border: 'rgba(250,204,21,0.25)', Icon: () => <LangIcon text="PY"  bg="rgba(250,204,21,0.2)"  color="#fbbf24" /> },
  Go:         { bg: 'rgba(34,211,238,0.10)',  color: '#22d3ee', border: 'rgba(34,211,238,0.25)', Icon: () => <LangIcon text="GO"  bg="rgba(34,211,238,0.2)"  color="#22d3ee" /> },
  PHP:        { bg: 'rgba(129,140,248,0.10)', color: '#818cf8', border: 'rgba(129,140,248,0.25)',Icon: () => <LangIcon text="PHP" bg="rgba(129,140,248,0.2)" color="#818cf8" /> },
  Ruby:       { bg: 'rgba(248,113,113,0.10)', color: '#f87171', border: 'rgba(248,113,113,0.25)',Icon: () => <LangIcon text="RB"  bg="rgba(248,113,113,0.2)"  color="#f87171" /> },
  Java:       { bg: 'rgba(251,146,60,0.10)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)', Icon: () => <Coffee size={10} />    },
  Rust:       { bg: 'rgba(251,113,133,0.10)', color: '#fb7185', border: 'rgba(251,113,133,0.25)',Icon: () => <LangIcon text="RS"  bg="rgba(251,113,133,0.2)"  color="#fb7185" /> },
  '.NET':     { bg: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: 'rgba(167,139,250,0.25)',Icon: () => <LangIcon text=".N"  bg="rgba(167,139,250,0.2)"  color="#a78bfa" /> },
  Elixir:     { bg: 'rgba(192,132,252,0.10)', color: '#c084fc', border: 'rgba(192,132,252,0.25)',Icon: () => <LangIcon text="EX"  bg="rgba(192,132,252,0.2)"  color="#c084fc" /> },
  // Generic
  Service:    { bg: 'rgba(255,255,255,0.04)', color: '#7070a0', border: 'rgba(255,255,255,0.08)',Icon: () => <Server size={10} />    },
};

export const DB_TYPES = new Set(['PostgreSQL', 'MySQL', 'Redis', 'MongoDB']);

export const ALL_TYPES = Object.keys(TYPE_META);

// ─── Type detection ───────────────────────────────────────────────────────────
export function detectType(name, source, override) {
  if (override) return override;
  const img = (source?.image || '').toLowerCase();
  const n   = name.toLowerCase();

  // ── Databases (most specific — check first) ──
  if (img.includes('postgres') || img.includes('postgre') || n.includes('postgres')) return 'PostgreSQL';
  if (img.includes('mysql')    || img.includes('mariadb')  || n.includes('mysql'))    return 'MySQL';
  if (img.includes('redis')    || n.includes('redis')      || n.includes('cache'))    return 'Redis';
  if (img.includes('mongo')    || n.includes('mongo'))                                return 'MongoDB';

  // ── Web servers ──
  if (img.includes('nginx')    || n.includes('nginx'))                                return 'Nginx';

  // ── Language runtimes (Docker image–based) ──
  if (/(?:^|\/)node:/.test(img) || img.includes('nodejs') || img.includes('/node-') || img.includes('deno:') || img.includes('bun:'))  return 'Node.js';
  if (/(?:^|\/)python:/.test(img) || img.includes('django') || img.includes('flask') || img.includes('fastapi') || img.includes('uvicorn') || img.includes('gunicorn')) return 'Python';
  if (/(?:^|\/)golang:/.test(img) || /(?:^|\/)go:/.test(img) || img.includes('golang/'))                                               return 'Go';
  if (/(?:^|\/)php:/.test(img) || img.includes('wordpress') || img.includes('laravel') || img.includes('drupal') || img.includes('phpmyadmin')) return 'PHP';
  if (/(?:^|\/)ruby:/.test(img) || img.includes('rails'))                                                                              return 'Ruby';
  if (img.includes('openjdk') || img.includes('eclipse-temurin') || img.includes('tomcat') || img.includes('spring-boot') || /(?:^|\/)java:/.test(img)) return 'Java';
  if (/(?:^|\/)rust:/.test(img))                                                                                                       return 'Rust';
  if (img.includes('mcr.microsoft.com/dotnet') || img.includes('dotnet') || img.includes('aspnet'))                                   return '.NET';
  if (/(?:^|\/)elixir:/.test(img) || img.includes('phoenix'))                                                                         return 'Elixir';

  // ── Source fallbacks ──
  if (source?.repo)   return 'GitHub';
  if (source?.image)  return 'Docker';
  return 'Service';
}

// ─── TypeBadge component ──────────────────────────────────────────────────────
export function TypeBadge({ type }) {
  const m = TYPE_META[type] || TYPE_META.Service;
  const { Icon } = m;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
      whiteSpace: 'nowrap', letterSpacing: '0.03em',
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
    }}>
      <Icon />
      {type}
    </span>
  );
}
