import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const TTL_DEFAULT = 60 * 60 * 24 * 30;
const TTL_BY_HINT = {
  'Respuesta Reseñas': 60 * 60 * 24 * 7,
  'WhatsApp': 60 * 60 * 24 * 30,
  'Landing Pages': 60 * 60 * 24 * 60,
  'Contenido SEO': 60 * 60 * 24 * 60,
  'Arquitectura Web': 60 * 60 * 24 * 90,
  'Manual Comunicación': 60 * 60 * 24 * 180,
};

export function buildCacheKey({ provider, model, system, messages }) {
  const payload = JSON.stringify({
    provider: provider || 'anthropic',
    model: model || '',
    system: system || '',
    messages: messages || [],
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function shouldCache({ tools, hint, system }) {
  if (tools && Array.isArray(tools) && tools.length > 0) return false;
  if (hint && /scan|busqueda|investiga|presencia 360|profundo|implementacion|reputacion/i.test(hint)) return false;
  if (system && /busca en internet|web search|investiga en internet/i.test(system)) return false;
  return true;
}

export async function getFromCache(key) {
  try {
    const rows = await sql`
      SELECT resultado, proveedor, modelo, tokens_input, tokens_output, hits
      FROM cache_ia
      WHERE hash_clave = ${key}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    sql`UPDATE cache_ia SET hits = hits + 1 WHERE hash_clave = ${key}`.catch(() => {});
    return rows[0];
  } catch (e) {
    console.warn('Cache lookup error:', e.message);
    return null;
  }
}

export async function saveToCache({ key, provider, model, system, resultado, hint, tokensIn, tokensOut }) {
  try {
    const ttl = TTL_BY_HINT[hint] || TTL_DEFAULT;
    const promptResumen = (system || '').slice(0, 200);
    await sql`
      INSERT INTO cache_ia (hash_clave, proveedor, modelo, prompt_resumen, resultado, tokens_input, tokens_output, expires_at)
      VALUES (${key}, ${provider}, ${model}, ${promptResumen}, ${resultado}, ${tokensIn || 0}, ${tokensOut || 0}, NOW() + (${ttl} || ' seconds')::interval)
      ON CONFLICT (hash_clave) DO UPDATE
      SET hits = cache_ia.hits + 1,
          expires_at = NOW() + (${ttl} || ' seconds')::interval
    `;
  } catch (e) {
    console.warn('Cache save error:', e.message);
  }
}

export function streamCachedResult(res, resultado) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ type: 'message_start', message: { id: 'cache', role: 'assistant', content: [], model: 'cache', stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } } })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`);

  const CHUNK = 60;
  for (let i = 0; i < resultado.length; i += CHUNK) {
    const piece = resultado.slice(i, i + CHUNK);
    res.write(`data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: Math.ceil(resultado.length / 4) } })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
  res.end();
}
