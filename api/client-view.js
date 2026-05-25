import { getDb } from './_db.js';

let migrated = false;

function genToken() {
  const chars = 'abcdef0123456789';
  let t = '';
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

async function ensureMigration(sql) {
  if (migrated) return;
  try {
    await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE`;
  } catch (e) {}
  migrated = true;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = getDb();
  await ensureMigration(sql);

  try {
    // POST - Generate or get share token for a client
    if (req.method === 'POST') {
      const { clientId } = req.body;
      if (!clientId) return res.status(400).json({ error: 'clientId required' });

      // Base del enlace publico de la ficha de cliente (dominio propio).
      const base = process.env.CLIENT_VIEW_BASE_URL || 'https://clientes.conectanex.com';
      const buildUrl = (t) => `${base}/api/client-view?token=${t}`;

      // Check if token exists
      const existing = await sql`SELECT share_token FROM clients WHERE id = ${clientId}`;
      if (existing[0]?.share_token) {
        const token = existing[0].share_token;
        return res.status(200).json({ token, url: buildUrl(token) });
      }

      // Generate new token
      const token = genToken();
      await sql`UPDATE clients SET share_token = ${token} WHERE id = ${clientId}`;
      return res.status(200).json({ token, url: buildUrl(token) });
    }

    // GET - Render public view
    if (req.method === 'GET') {
      const { token } = req.query;
      if (!token) return res.status(400).send('Token requerido');

      // Fetch client
      const clients = await sql`SELECT * FROM clients WHERE share_token = ${token}`;
      if (!clients[0]) return res.status(404).send('Enlace no valido o expirado');
      const c = clients[0];

      // Fetch activity for this client
      const activity = await sql`SELECT tool, preview, full_output, created_at FROM activity_log WHERE client_name = ${c.nombre} ORDER BY created_at DESC LIMIT 100`;

      // Group activity by tool
      const byTool = {};
      activity.forEach(a => {
        if (!byTool[a.tool]) byTool[a.tool] = [];
        byTool[a.tool].push(a);
      });

      const toolSections = Object.entries(byTool).map(([tool, items]) => {
        const itemsHtml = items.map(a => {
          const d = new Date(a.created_at);
          const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
          const content = (a.full_output || a.preview || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<div class="item">
            <div class="item-header">
              <span class="item-date">${dateStr}</span>
            </div>
            <div class="item-content">${content}</div>
          </div>`;
        }).join('');
        return `<div class="tool-section">
          <h2>${tool.replace(/</g, '&lt;')} <span class="count">(${items.length})</span></h2>
          ${itemsHtml}
        </div>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${c.nombre} - Portal de Contenido | Cliniq Digital</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0f1a;color:#e2e8f0;line-height:1.6}
.header{background:linear-gradient(135deg,#0f172a,#1a2744);border-bottom:1px solid #1e293b;padding:32px 24px;text-align:center}
.header h1{font-size:24px;font-weight:700;color:#fff;margin-bottom:4px}
.header .sub{font-size:13px;color:#64748b}
.header .badge{display:inline-block;margin-top:12px;padding:4px 16px;background:rgba(45,212,191,0.15);color:#2dd4bf;border-radius:20px;font-size:12px;font-weight:600}
.container{max-width:900px;margin:0 auto;padding:24px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:32px}
.stat{background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:16px;text-align:center}
.stat .val{font-size:24px;font-weight:700;color:#2dd4bf}
.stat .lbl{font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px}
.tool-section{margin-bottom:32px}
.tool-section h2{font-size:16px;font-weight:700;color:#fff;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #1e293b}
.tool-section h2 .count{font-weight:400;color:#64748b;font-size:13px}
.item{background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:16px;margin-bottom:10px}
.item-header{display:flex;justify-content:space-between;margin-bottom:8px}
.item-date{font-size:11px;color:#64748b}
.item-content{font-size:13px;color:#cbd5e1;white-space:pre-wrap;line-height:1.7;max-height:200px;overflow:hidden;position:relative}
.item-content.expanded{max-height:none}
.toggle{display:inline-block;margin-top:8px;font-size:12px;color:#2dd4bf;cursor:pointer;font-weight:600}
.footer{text-align:center;padding:32px;color:#475569;font-size:12px;border-top:1px solid #1e293b;margin-top:32px}
.footer a{color:#2dd4bf;text-decoration:none}
.empty{text-align:center;padding:60px 24px;color:#64748b}
@media(max-width:600px){.container{padding:16px}.header{padding:24px 16px}}
</style>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
</head>
<body>
<div class="header">
  <h1>${c.nombre.replace(/</g, '&lt;')}</h1>
  <div class="sub">${(c.nicho || 'Cliente').replace(/</g, '&lt;')} ${c.ciudad_fiscal ? '- ' + c.ciudad_fiscal.replace(/</g, '&lt;') : ''}</div>
  <div class="badge">Cliniq Digital - Portal de Contenido</div>
</div>
<div class="container">
  <div class="stats">
    <div class="stat"><div class="val">${activity.length}</div><div class="lbl">Contenidos</div></div>
    <div class="stat"><div class="val">${Object.keys(byTool).length}</div><div class="lbl">Herramientas</div></div>
    <div class="stat"><div class="val">${activity[0] ? new Date(activity[0].created_at).toLocaleDateString('es-ES', {day:'numeric',month:'short'}) : '-'}</div><div class="lbl">Ultima actualizacion</div></div>
  </div>
  ${activity.length === 0 ? '<div class="empty"><p>Aun no hay contenido generado.</p></div>' : toolSections}
</div>
<div class="footer">
  Generado por <a href="https://cliniqdigital.com" target="_blank">Cliniq Digital</a> - Marketing para clinicas
</div>
<script>
document.querySelectorAll('.item-content').forEach(el=>{
  if(el.scrollHeight>200){
    const btn=document.createElement('span');
    btn.className='toggle';btn.textContent='Ver mas';
    btn.onclick=()=>{el.classList.toggle('expanded');btn.textContent=el.classList.contains('expanded')?'Ver menos':'Ver mas';};
    el.parentNode.appendChild(btn);
  }
});
</script>
</body></html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Client-view API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
