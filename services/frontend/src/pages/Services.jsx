import { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw } from 'lucide-react';
import api from '../api';

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restarting, setRestarting] = useState(null);

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    try {
      setLoading(true);
      const res = await api.getServices();
      setServices(res.services || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestart(serviceId) {
    try {
      setRestarting(serviceId);
      await api.restartService(serviceId);
      alert('Service restarted successfully');
      await loadServices();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setRestarting(null);
    }
  }

  if (loading) return <div className="text-center py-12">Loading services...</div>;
  if (error)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Error: {error}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Available Services</h3>
        <button
          onClick={loadServices}
          className="btn-secondary flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Services List */}
      {services.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">No services found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {services.map((service) => (
            <div key={service.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{service.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{service.id}</p>
                </div>
                <button
                  onClick={() => handleRestart(service.id)}
                  disabled={restarting === service.id}
                  className="btn-primary flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {restarting === service.id ? 'Restarting...' : 'Restart'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
