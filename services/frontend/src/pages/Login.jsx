import { useState } from 'react';
import { Lock, Shield } from 'lucide-react';
import api from '../api';
import BrandLogo from '../components/BrandLogo';

export default function Login({ onSuccess }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(key);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Invalid admin key');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className={`auth-card auth-card-enter${shake ? ' auth-card-shake' : ''}`}>

        {/* Header — no duplicate, single clear identity */}
        <div style={{ marginBottom: 28 }}>
          <BrandLogo size="lg" className="login-brand" />
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 8 }}>
            Infrastructure control &amp; recovery
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Lock size={11} />
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="admin-key">
              Admin Key
            </label>
            <input
              id="admin-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste your admin key"
              disabled={loading}
              className={`form-control${error ? ' form-control-error' : ''}`}
              autoFocus
              autoComplete="current-password"
            />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
              Set via <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>ADMIN_PASSWORD</code> env var
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="btn btn-primary auth-submit-btn"
          >
            {loading ? (
              <>
                <span className="auth-spinner" />
                Signing in…
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Trust signal */}
        <div style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}>
          <Shield size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          Secure access &nbsp;·&nbsp; Local-only auth &nbsp;·&nbsp; No third-party login
        </div>

      </div>
    </div>
  );
}
