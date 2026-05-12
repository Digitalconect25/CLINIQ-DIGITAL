// Helper compartido. Verifica que la peticion lleve el PIN correcto.
// Si no hay ACCESS_PIN en env (entorno local sin configurar), no bloquea para no romper dev.
// En produccion, ACCESS_PIN debe estar siempre configurado.

export function requirePin(req, res) {
  const expected = process.env.ACCESS_PIN;
  if (!expected) return true;
  const given = req.headers['x-cliniq-pin'];
  if (!given || String(given) !== String(expected)) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

export function corsHeaders(res) {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cliniq-Pin');
}
