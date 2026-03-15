/**
 * Fetch wrapper for API calls with automatic error handling.
 */
async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
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
};

export default api;
