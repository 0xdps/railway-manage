import { useState } from 'react';
import api from '../api';

export default function Login({ onSuccess }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(key);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ marginBottom: 28 }}>
          <p className="stat-label" style={{ marginBottom: 4 }}>Control Plane</p>
          <h1
            style={{
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            Railway Manage
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
            Disaster recovery &amp; operations
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--danger)',
              }}
            >
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="admin-key">Admin Key</label>
            <input
              id="admin-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Enter your admin key"
              disabled={loading}
              className="form-control"
              autoFocus
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="btn btn-primary"
            style={{ justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>

        <p
          style={{
            marginTop: 20,
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Never share your admin key
        </p>
      </div>
    </div>
  );
}
