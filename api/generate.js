export const config = {
  maxDuration: 60,
  supportsResponseStreaming: true,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });

  const body = req.body;
  const useStream = body.stream === true;

  try {
    const anthropicBody = {
      model: body.model || 'claude-sonnet-4-20250514',
      max_tokens: body.max_tokens || 4096,
      system: body.system || '',
      messages: body.messages || [],
      stream: useStream,
    };
    if (body.tools) anthropicBody.tools = body.tools;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (!response.ok) {
        const errText = await response.text();
        let errMsg;
        try { errMsg = JSON.parse(errText).error?.message || errText.slice(0, 200); } catch(e) { errMsg = errText.slice(0, 200); }
        res.write(`data: ${JSON.stringify({ type: 'error', error: errMsg })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (streamErr) {
        console.error('Stream error:', streamErr);
      }
      res.end();
    } else {
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return res.status(502).json({ error: 'Respuesta no valida de Anthropic: ' + text.slice(0, 200) });
      }
      return res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('Anthropic proxy error:', error);
    if (useStream) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      } catch(e) { res.end(); }
    } else {
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}
