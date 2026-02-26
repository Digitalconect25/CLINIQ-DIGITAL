export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });

  try {
    const body = req.body;
    const anthropicBody = {
      model: body.model || 'claude-sonnet-4-20250514',
      max_tokens: body.max_tokens || 4096,
      system: body.system || '',
      messages: body.messages || [],
    };
    if (body.tools) anthropicBody.tools = body.tools;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2024-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || data.error || 'Anthropic API error',
        status: response.status,
        type: data.error?.type || 'unknown'
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Anthropic API error:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
