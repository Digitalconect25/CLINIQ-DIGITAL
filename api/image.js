export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!falKey) return res.status(500).json({ error: 'FAL_KEY no configurada en Vercel.' });

  const { prompt, model, image_size, num_images } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt requerido' });

  const modelMap = {
    schnell: 'fal-ai/flux/schnell',
    dev: 'fal-ai/flux/dev',
    pro: 'fal-ai/flux-pro/v1.1-ultra',
    realism: 'fal-ai/flux-realism',
  };
  const modelId = modelMap[model] || modelMap.schnell;

  try {
    // Synchronous call - fal.run blocks until image is ready
    const response = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: image_size || 'landscape_16_9',
        num_images: num_images || 1,
        enable_safety_checker: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let msg;
      try { msg = JSON.parse(errText).detail || JSON.parse(errText).message || errText.slice(0, 300); } catch(e) { msg = errText.slice(0, 300); }
      return res.status(response.status).json({ error: `Fal.ai error (${response.status}): ${msg}` });
    }

    const result = await response.json();
    const images = result.images || [];

    if (images.length === 0) {
      return res.status(500).json({ error: 'No se generaron imagenes. Intenta con otro prompt.' });
    }

    return res.status(200).json({
      images: images.map(img => ({
        url: img.url,
        width: img.width,
        height: img.height,
      })),
      model: modelId,
      seed: result.seed,
    });

  } catch (error) {
    console.error('Fal.ai error:', error);
    return res.status(500).json({ error: 'Error conectando con Fal.ai: ' + (error.message || 'Error desconocido') });
  }
}
