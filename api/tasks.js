import { getDb } from './_db.js';

let tableChecked = false;

async function ensureTable(sql) {
  if (tableChecked) return;
  await sql`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    client_name TEXT NOT NULL DEFAULT 'General',
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT DEFAULT 'media',
    status TEXT DEFAULT 'pendiente',
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
  )`;
  tableChecked = true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    await ensureTable(sql);

    // GET - List tasks
    if (req.method === 'GET') {
      const { client, status, limit = 200 } = req.query;
      let rows;
      if (client && client !== 'all') {
        rows = await sql`SELECT * FROM tasks WHERE client_name = ${client} ORDER BY
          CASE WHEN status = 'pendiente' THEN 0 WHEN status = 'en_progreso' THEN 1 ELSE 2 END,
          CASE WHEN priority = 'alta' THEN 0 WHEN priority = 'media' THEN 1 ELSE 2 END,
          due_date ASC NULLS LAST LIMIT ${Number(limit)}`;
      } else if (status && status !== 'all') {
        rows = await sql`SELECT * FROM tasks WHERE status = ${status} ORDER BY
          CASE WHEN priority = 'alta' THEN 0 WHEN priority = 'media' THEN 1 ELSE 2 END,
          due_date ASC NULLS LAST LIMIT ${Number(limit)}`;
      } else {
        rows = await sql`SELECT * FROM tasks ORDER BY
          CASE WHEN status = 'pendiente' THEN 0 WHEN status = 'en_progreso' THEN 1 ELSE 2 END,
          CASE WHEN priority = 'alta' THEN 0 WHEN priority = 'media' THEN 1 ELSE 2 END,
          due_date ASC NULLS LAST LIMIT ${Number(limit)}`;
      }
      return res.status(200).json(rows);
    }

    // POST - Create task
    if (req.method === 'POST') {
      const t = req.body;
      if (!t.title) return res.status(400).json({ error: 'title required' });
      const rows = await sql`
        INSERT INTO tasks (client_name, title, description, priority, status, due_date)
        VALUES (${t.client || 'General'}, ${t.title}, ${t.description || ''},
          ${t.priority || 'media'}, ${t.status || 'pendiente'}, ${t.due_date || null})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    }

    // PUT - Update task
    if (req.method === 'PUT') {
      const t = req.body;
      if (!t.id) return res.status(400).json({ error: 'id required' });
      const completedAt = t.status === 'completada' ? new Date().toISOString() : null;
      const rows = await sql`
        UPDATE tasks SET
          client_name = COALESCE(${t.client || null}, client_name),
          title = COALESCE(${t.title || null}, title),
          description = COALESCE(${t.description !== undefined ? t.description : null}, description),
          priority = COALESCE(${t.priority || null}, priority),
          status = COALESCE(${t.status || null}, status),
          due_date = COALESCE(${t.due_date || null}, due_date),
          completed_at = ${completedAt}
        WHERE id = ${t.id}
        RETURNING *`;
      return res.status(200).json(rows[0] || null);
    }

    // DELETE
    if (req.method === 'DELETE') {
      const { id } = req.body || req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`DELETE FROM tasks WHERE id = ${id}`;
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Tasks API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
