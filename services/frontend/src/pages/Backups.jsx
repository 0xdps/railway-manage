import { useEffect, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import api from '../api';

export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBackups();
  }, []);

  async function loadBackups() {
    try {
      setLoading(true);
      const res = await api.getBackups();
      setBackups(res.backups || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-12">Loading backups...</div>;
  if (error)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Error: {error}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Backups</h3>
        <button onClick={loadBackups} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {backups.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">No backups available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Schedule
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {backup.service_id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{backup.schedule}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`badge ${
                        backup.status === 'success'
                          ? 'badge-success'
                          : backup.status === 'running'
                          ? 'badge-info'
                          : 'badge-error'
                      }`}
                    >
                      {backup.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {backup.size_bytes
                      ? `${(backup.size_bytes / 1024 / 1024).toFixed(2)} MB`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(backup.started_at * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
