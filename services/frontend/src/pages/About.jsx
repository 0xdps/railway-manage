import { Package } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

const VERSION = '1.0.0';

const STACK = [
  { label: 'Runtime', value: 'Node.js 20 (backend)' },
  { label: 'Frontend', value: 'React 18 + Vite' },
  { label: 'Database', value: 'SQLite (via better-sqlite3)' },
  { label: 'Styling', value: 'IBM Plex Sans / Mono  +  custom CSS' },
  { label: 'Proxy', value: 'Caddy 2' },
  { label: 'Container', value: 'Docker Compose' },
];

export default function About() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560 }}>
      <div>
        <p className="stat-label">About</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 }}>
          Version info and attributions.
        </p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">railway-manage</span>
          <span className="badge badge-info">v{VERSION}</span>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandLogo size="lg" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                railway-manage
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Self-hosted operations dashboard for Railway projects
              </p>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {STACK.map(({ label, value }) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{
                    padding: '8px 0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                    width: '38%',
                  }}>
                    {label}
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Open Source</span>
          <Package size={14} style={{ color: 'var(--text-muted)' }} />
        </div>
        <div style={{ padding: '14px 18px' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            railway-manage is open-source software. You are free to use, modify, and distribute it
            under the terms of the MIT License.
          </p>
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            Built with ❤ for the Railway community.
          </p>
        </div>
      </div>
    </div>
  );
}
