import { corsHeaders } from './_pin.js';

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const expected = process.env.ACCESS_PIN;
  if (!expected) return res.status(500).json({ error: 'ACCESS_PIN no configurado en el servidor' });

  const pin = req.body?.pin;
  if (!pin) return res.status(400).json({ ok: false, error: 'PIN requerido' });
  if (String(pin) !== String(expected)) return res.status(401).json({ ok: false });
  return res.status(200).json({ ok: true });
}
