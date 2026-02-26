import { getDb } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();

  try {
    // GET - List all clients
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM clients ORDER BY created_at DESC`;
      return res.status(200).json(rows);
    }

    // POST - Create client
    if (req.method === 'POST') {
      const c = req.body;
      const rows = await sql`
        INSERT INTO clients (nombre, nif, dir_fiscal, cp_fiscal, ciudad_fiscal, provincia_fiscal,
          email, telefono, web, contacto, cargo_contacto, nicho, plan, servicios,
          forma_pago, iban, fecha_alta, notas, empresa, email_empresa, tel_empresa, cif_empresa)
        VALUES (${c.nombre}, ${c.nif||null}, ${c.dirFiscal||null}, ${c.cpFiscal||null},
          ${c.ciudadFiscal||null}, ${c.provinciaFiscal||null}, ${c.email||null}, ${c.telefono||null},
          ${c.web||null}, ${c.contacto||null}, ${c.cargoContacto||null}, ${c.nicho||null},
          ${c.plan||'Esencial'}, ${c.servicios||null}, ${c.formaPago||'Transferencia'},
          ${c.iban||null}, ${c.fechaAlta||null}, ${c.notas||null},
          ${c.empresa||'Cliniq Digital'}, ${c.emailEmpresa||'info@cliniqdigital.com'},
          ${c.telEmpresa||null}, ${c.cifEmpresa||null})
        RETURNING *`;
      return res.status(201).json(rows[0]);
    }

    // PUT - Update client
    if (req.method === 'PUT') {
      const c = req.body;
      if (!c.id) return res.status(400).json({ error: 'id required' });
      const rows = await sql`
        UPDATE clients SET
          nombre = COALESCE(${c.nombre}, nombre),
          nif = COALESCE(${c.nif}, nif),
          dir_fiscal = COALESCE(${c.dirFiscal}, dir_fiscal),
          cp_fiscal = COALESCE(${c.cpFiscal}, cp_fiscal),
          ciudad_fiscal = COALESCE(${c.ciudadFiscal}, ciudad_fiscal),
          provincia_fiscal = COALESCE(${c.provinciaFiscal}, provincia_fiscal),
          email = COALESCE(${c.email}, email),
          telefono = COALESCE(${c.telefono}, telefono),
          web = COALESCE(${c.web}, web),
          contacto = COALESCE(${c.contacto}, contacto),
          cargo_contacto = COALESCE(${c.cargoContacto}, cargo_contacto),
          nicho = COALESCE(${c.nicho}, nicho),
          plan = COALESCE(${c.plan}, plan),
          servicios = COALESCE(${c.servicios}, servicios),
          forma_pago = COALESCE(${c.formaPago}, forma_pago),
          iban = COALESCE(${c.iban}, iban),
          notas = COALESCE(${c.notas}, notas)
        WHERE id = ${c.id}
        RETURNING *`;
      return res.status(200).json(rows[0] || null);
    }

    // DELETE
    if (req.method === 'DELETE') {
      const { id } = req.body || req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`DELETE FROM clients WHERE id = ${id}`;
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Clients API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
