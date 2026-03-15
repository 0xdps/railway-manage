import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import api from '../api';

export default function Dashboard() {
  const [data, setData] = useState({
    services: [],
    backups: [],
    recentAudit: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [servicesRes, backupsRes, auditRes] = await Promise.all([
        api.getServices(),
        api.getBackups(),
        api.getAuditLog(5),
      ]);

      setData({
        services: servicesRes.services || [],
        backups: backupsRes.backups || [],
        recentAudit: auditRes.auditLog || [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-12">Loading...</div>;
  if (error)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Error: {error}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Services</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data.services.length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-75" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Recent Backups</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data.backups.length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-blue-600 opacity-75" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Status</p>
              <p className="text-3xl font-bold text-green-600 mt-2">Operational</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-75" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Backups</h3>
          {data.backups.length === 0 ? (
            <p className="text-gray-500 text-sm">No backups yet</p>
          ) : (
            <div className="space-y-3">
              {data.backups.slice(0, 5).map((backup) => (
                <div key={backup.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{backup.service_id}</span>
                    <span className="badge badge-success">{backup.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{backup.schedule} backup</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Log</h3>
          {data.recentAudit.length === 0 ? (
            <p className="text-gray-500 text-sm">No activity</p>
          ) : (
            <div className="space-y-3">
              {data.recentAudit.map((entry) => (
                <div key={entry.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{entry.action}</span>
                    <span className="text-xs text-gray-600">
                      {new Date(entry.created_at * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  {entry.target && <p className="text-sm text-gray-600 mt-1">{entry.target}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
