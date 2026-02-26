import { getDb } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    // GET - List activity log (optionally filter by client)
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
        INSERT INTO activity_log (tool, client_name, inputs, preview, full_output)
        VALUES (${e.tool||'IA'}, ${e.client||'Sin asignar'},
          ${JSON.stringify(e.inputs||{})}, ${(e.preview||'').slice(0,500)},
          ${e.fullOutput||''})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Activity API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
