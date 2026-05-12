// API client - connects to Vercel serverless functions backed by Neon PostgreSQL

const API_BASE = '';

export const db = {
  // -- CLIENTS --
  async getClients() {
    try {
      const r = await fetch(`${API_BASE}/api/clients`);
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  },

  async createClient(client) {
    try {
      const r = await fetch(`${API_BASE}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(client)
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  },

  async updateClient(id, data) {
    try {
      const r = await fetch(`${API_BASE}/api/clients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  },

  // Wrapper unico que decide crear o actualizar segun haya id (v2.0)
  async saveClient(client) {
    if (client && client.id) {
      return await this.updateClient(client.id, client);
    }
    return await this.createClient(client);
  },

  async deleteClient(id) {
    try {
      await fetch(`${API_BASE}/api/clients`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch {}
  },

  // -- ACTIVITY LOG --
  async getActivity(clientName) {
    try {
      const params = clientName && clientName !== 'all'
        ? `?client=${encodeURIComponent(clientName)}` : '';
      const r = await fetch(`${API_BASE}/api/activity${params}`);
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  },

  async logActivity(entry) {
    try {
      const r = await fetch(`${API_BASE}/api/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }
};
