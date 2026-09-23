const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(body?.error?.message || `Request failed with ${res.status}`);
  }

  return body.data;
}

export const api = {
  listClients: () => request('/clients'),
  getClient: (id) => request(`/clients/${id}`),

  updateClient: (id, changes) =>
    request(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),

  getLogs: (id, limit = 20) => request(`/clients/${id}/logs?limit=${limit}`),

  triggerRun: (force = false) =>
    request('/reports/trigger', { method: 'POST', body: JSON.stringify({ force }) }),

  getQueueDepth: () => request('/reports/queue'),
};
