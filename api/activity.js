import { getDb } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    // Ensure provider and cost columns exist (runs once, no-op if already there)
    await sql`DO $$ BEGIN
      ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'anthropic';
      ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS model TEXT DEFAULT '';
      ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS est_cost NUMERIC(8,5) DEFAULT 0;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$`;

    // GET - List activity log
    if (req.method === 'GET') {
      const { client, limit = 500 } = req.query;
      let rows;
      if (client && client !== 'all') {
        rows = await sql`SELECT * FROM activity_log WHERE client_name = ${client} ORDER BY created_at DESC LIMIT ${Number(limit)}`;
      } else {
        rows = await sql`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ${Number(limit)}`;
      }
      return res.status(200).json(rows);
    }

    // POST - Create log entry
    if (req.method === 'POST') {
      const e = req.body;
      const rows = await sql`
        INSERT INTO activity_log (tool, client_name, inputs, preview, full_output, provider, model, est_cost)
        VALUES (${e.tool || 'IA'}, ${e.client || 'Sin asignar'},
          ${JSON.stringify(e.inputs || {})}, ${(e.preview || '').slice(0, 500)},
          ${e.fullOutput || ''}, ${e.provider || 'anthropic'}, ${e.model || ''}, ${e.estCost || 0})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    }

    // DELETE - Single entry or clear all
    if (req.method === 'DELETE') {
      const { id, clearAll } = req.body || {};
      if (clearAll) {
        await sql`DELETE FROM activity_log`;
        return res.status(200).json({ cleared: true });
      }
      if (id) {
        await sql`DELETE FROM activity_log WHERE id = ${id}`;
        return res.status(200).json({ deleted: true });
      }
      return res.status(400).json({ error: 'id or clearAll required' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Activity API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
