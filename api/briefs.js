import { requirePin, corsHeaders } from './_pin.js';
import { getDb } from './_db.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requirePin(req, res)) return;

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const { client_id } = req.query;
      if (client_id) {
        const rows = await sql`SELECT * FROM client_briefs WHERE client_id = ${client_id} LIMIT 1`;
        return res.status(200).json(rows[0] || null);
      }
      const all = await sql`
        SELECT cb.client_id, cb.nicho_slug, cb.brief, c.nombre
        FROM client_briefs cb
        JOIN clients c ON c.id = cb.client_id
      `;
      return res.status(200).json(all);
    }

    if (req.method === 'POST') {
      const { client_id, nicho_slug, brief } = req.body;
      if (!client_id) return res.status(400).json({ error: 'client_id requerido' });
      const safeBrief = brief && typeof brief === 'object' ? brief : {};

      const result = await sql`
        INSERT INTO client_briefs (client_id, nicho_slug, brief, updated_at)
        VALUES (${client_id}, ${nicho_slug || null}, ${JSON.stringify(safeBrief)}, NOW())
        ON CONFLICT (client_id) DO UPDATE
          SET brief = EXCLUDED.brief,
              nicho_slug = EXCLUDED.nicho_slug,
              updated_at = NOW()
        RETURNING *
      `;
      return res.status(200).json(result[0]);
    }

    if (req.method === 'DELETE') {
      const { client_id } = req.body || req.query;
      if (!client_id) return res.status(400).json({ error: 'client_id requerido' });
      await sql`DELETE FROM client_briefs WHERE client_id = ${client_id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('briefs error', e);
    return res.status(500).json({ error: e.message });
  }
}
