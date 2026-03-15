import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../api';

export default function Audit() {
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAuditLog();
  }, []);

  async function loadAuditLog() {
    try {
      setLoading(true);
      const res = await api.getAuditLog(100);
      setAuditLog(res.auditLog || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-12">Loading audit log...</div>;
  if (error)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Error: {error}
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
        <button onClick={loadAuditLog} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {auditLog.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">No audit entries</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {entry.action}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{entry.actor}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{entry.target || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(entry.created_at * 1000).toLocaleString()}
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
