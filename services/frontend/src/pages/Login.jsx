import { useState } from 'react';
import { Lock } from 'lucide-react';
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-railway-50 via-railway-100 to-railway-200">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-railway-600 to-railway-800 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
            Railway Manage
          </h1>
          <p className="text-center text-gray-600 mb-8">
            Control plane for disaster recovery & operations
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Key
              </label>
              <input
                id="key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your admin key"
                disabled={loading}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-railway-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || !key.trim()}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-xs mt-6">
            For security, never share your admin key
          </p>
        </div>
      </div>
    </div>
  );
}
