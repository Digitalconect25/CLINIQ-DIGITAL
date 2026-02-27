export const config = {
  maxDuration: 55,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!falKey) return res.status(500).json({ error: 'FAL_KEY not configured. Añade FAL_KEY o FAL_API_KEY en Vercel > Settings > Environment Variables.' });

  const { prompt, model, image_size, num_images } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });

  // Models: schnell (fastest/cheapest), dev (balanced), pro (best quality)
  const modelMap = {
    schnell: 'fal-ai/flux/schnell',
    dev: 'fal-ai/flux/dev',
    pro: 'fal-ai/flux-pro/v1.1-ultra',
    realism: 'fal-ai/flux-realism',
  };
  const modelId = modelMap[model] || modelMap.schnell;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Key ${falKey}`,
  };

  try {
    // 1. Submit to queue
    const submitRes = await fetch(`https://queue.fal.run/${modelId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        image_size: image_size || 'landscape_16_9',
        num_images: num_images || 1,
        enable_safety_checker: false,
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      let msg;
      try { msg = JSON.parse(err).detail || err; } catch(e) { msg = err.slice(0, 300); }
      return res.status(submitRes.status).json({ error: msg });
    }

    const { request_id } = await submitRes.json();
    if (!request_id) return res.status(500).json({ error: 'No request_id from Fal.ai' });

    // 2. Poll for completion (max ~45s)
    const maxPolls = 45;
    const pollInterval = 1000;
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(ok => setTimeout(ok, pollInterval));

      const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${request_id}/status`, {
        headers,
      });

      if (!statusRes.ok) continue;
      const status = await statusRes.json();

      if (status.status === 'COMPLETED') {
        // 3. Fetch result
        const resultRes = await fetch(`https://queue.fal.run/${modelId}/requests/${request_id}`, {
          headers,
        });
        if (!resultRes.ok) {
          return res.status(500).json({ error: 'Error fetching result from Fal.ai' });
        }
        const result = await resultRes.json();
        const images = result.images || [];
        return res.status(200).json({
          images: images.map(img => ({
            url: img.url,
            width: img.width,
            height: img.height,
          })),
          model: modelId,
          seed: result.seed,
        });
      }

      if (status.status === 'FAILED') {
        return res.status(500).json({ error: 'Generacion fallida: ' + (status.error || 'Error desconocido') });
      }
      // IN_QUEUE or IN_PROGRESS -> keep polling
    }

    return res.status(504).json({ error: 'Timeout: la imagen tardo demasiado. Intenta con modelo schnell.' });

  } catch (error) {
    console.error('Fal.ai error:', error);
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
}
