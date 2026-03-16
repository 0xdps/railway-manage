/**
 * Fetch wrapper for API calls with automatic error handling.
 */
async function fetchJson(url, options = {}) {
  const headers = options.body
    ? { 'Content-Type': 'application/json', ...options.headers }
    : { ...options.headers };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (key) => fetchJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ key }),
  }),

  logout: () => fetchJson('/api/auth/logout', { method: 'DELETE' }),

  getMe: () => fetchJson('/api/auth/me'),

  // Infrastructure
  getServices: () => fetchJson('/api/services'),

  getMetrics: (serviceId) => fetchJson(`/api/metrics/${serviceId}`),

  getDeployments: (serviceId) => fetchJson(`/api/deployments/${serviceId}`),

  restartService: (serviceId) =>
    fetchJson(`/api/deployments/${serviceId}/restart`, { method: 'POST' }),

  // Backups
  getBackups: () => fetchJson('/api/backups'),

  triggerBackup: (serviceId, schedule) =>
    fetchJson('/api/backups/trigger', {
      method: 'POST',
      body: JSON.stringify({ serviceId, schedule }),
    }),

  restore: (backupId) =>
    fetchJson('/api/restore', {
      method: 'POST',
      body: JSON.stringify({ backupId }),
    }),

  // Jobs
  getJobs: () => fetchJson('/api/jobs'),

  updateJob: (jobId, data) =>
    fetchJson(`/api/jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Audit
  getAuditLog: (limit = 100, offset = 0) =>
    fetchJson(`/api/audit?limit=${limit}&offset=${offset}`),

  // Managed Services
  getManagedServices: () => fetchJson('/api/managed-services'),

  createManagedService: (data) =>
    fetchJson('/api/managed-services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateManagedService: (id, data) =>
    fetchJson(`/api/managed-services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteManagedService: (id) =>
    fetchJson(`/api/managed-services/${id}`, { method: 'DELETE' }),

  getServiceVariableKeys: (serviceId) =>
    fetchJson(`/api/services/${serviceId}/variable-keys`),

  updateServiceTags: (serviceId, tags) =>
    fetchJson(`/api/services/${serviceId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    }),

  // Metrics history (stored per-minute samples, 3h rolling window)
  getMetricHistory: (serviceId, hours = 3) =>
    fetchJson(`/api/services/${serviceId}/metrics/history?hours=${hours}`),

  // Restart policy
  getRestartPolicy: (serviceId) =>
    fetchJson(`/api/services/${serviceId}/restart-policy`),

  updateRestartPolicy: (serviceId, data) =>
    fetchJson(`/api/services/${serviceId}/restart-policy`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Variable secrets (on-demand reveal / update)
  getServiceVariable: (serviceId, key) =>
    fetchJson(`/api/services/${serviceId}/variable?key=${encodeURIComponent(key)}`),

  updateServiceVariable: (serviceId, key, value) =>
    fetchJson(`/api/services/${serviceId}/variable?key=${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  updateTypeOverride: (serviceId, typeOverride) =>
    fetchJson(`/api/services/${serviceId}/type-override`, {
      method: 'PUT',
      body: JSON.stringify({ typeOverride }),
    }),

  // All restart policies (bulk, for Manage page)
  getAllRestartPolicies: () => fetchJson('/api/restart-policies'),
};

export default api;
