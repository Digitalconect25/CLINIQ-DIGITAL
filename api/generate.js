import { requirePin, corsHeaders } from './_pin.js';
import { buildCacheKey, shouldCache, getFromCache, saveToCache, streamCachedResult } from './_cache.js';

export const config = {
  maxDuration: 60,
  supportsResponseStreaming: true,
};

export default async function handler(req, res) {
  corsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requirePin(req, res)) return;

  const body = req.body;
  const provider = body.provider || 'anthropic';
  const useStream = body.stream === true;
  const hint = body.hint || body.tool || '';

  const cacheKey = buildCacheKey({
    provider,
    model: body.model || '',
    system: body.system || '',
    messages: body.messages || [],
  });
  const cacheable = !body.web_search && shouldCache({ tools: body.tools, hint, system: body.system });

  if (cacheable) {
    const cached = await getFromCache(cacheKey);
    if (cached && cached.resultado) {
      res.setHeader('X-Cliniq-Cache', 'HIT');
      if (useStream) {
        return streamCachedResult(res, cached.resultado);
      }
      return res.status(200).json({
        content: [{ type: 'text', text: cached.resultado }],
        _cache_hit: true,
        _cache_hits: cached.hits,
      });
    }
  }

  res.setHeader('X-Cliniq-Cache', 'MISS');

  // Busqueda web GRATIS con Gemini + Google Search grounding.
  // Traduce la respuesta de Gemini al formato SSE estilo Anthropic que ya entiende el front.
  if (body.web_search === true) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.write(`data: ${JSON.stringify({ type: 'error', error: { message: 'GEMINI_API_KEY not configured.' } })}\n\n`);
      return res.end();
    }
    return handleGeminiGrounded({ res, body, apiKey: geminiKey, model: body.model || 'gemini-2.5-flash' });
  }

  if (provider === 'groq') {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured.' });
    return handleOpenAICompatible({
      res, body, useStream, cacheable, cacheKey, hint,
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: groqKey,
      defaultModel: 'llama-3.3-70b-versatile',
      providerName: 'Groq',
      providerSlug: 'groq',
    });
  }

  if (provider === 'deepseek') {
    const dsKey = process.env.DEEPSEEK_API_KEY;
    if (!dsKey) return res.status(500).json({ error: 'DEEPSEEK_API_KEY not configured.' });
    return handleOpenAICompatible({
      res, body, useStream, cacheable, cacheKey, hint,
      apiUrl: 'https://api.deepseek.com/v1/chat/completions',
      apiKey: dsKey,
      defaultModel: 'deepseek-chat',
      providerName: 'DeepSeek',
      providerSlug: 'deepseek',
    });
  }

  if (provider === 'gemini') {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' });
    return handleOpenAICompatible({
      res, body, useStream, cacheable, cacheKey, hint,
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: geminiKey,
      defaultModel: 'gemini-2.5-flash',
      providerName: 'Gemini',
      providerSlug: 'gemini',
    });
  }

  if (provider === 'cerebras') {
    const cbKey = process.env.CEREBRAS_API_KEY;
    if (!cbKey) return res.status(500).json({ error: 'CEREBRAS_API_KEY not configured.' });
    return handleOpenAICompatible({
      res, body, useStream, cacheable, cacheKey, hint,
      apiUrl: 'https://api.cerebras.ai/v1/chat/completions',
      apiKey: cbKey,
      defaultModel: 'llama-3.3-70b',
      providerName: 'Cerebras',
      providerSlug: 'cerebras',
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });

  try {
    const modelUsed = body.model || 'claude-sonnet-4-20250514';
    const anthropicBody = {
      model: modelUsed,
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
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: errMsg } })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let tokensIn = 0;
      let tokensOut = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);

          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
                fullText += ev.delta.text;
              }
              if (ev.type === 'message_start' && ev.message?.usage) {
                tokensIn = ev.message.usage.input_tokens || 0;
              }
              if (ev.type === 'message_delta' && ev.usage) {
                tokensOut = ev.usage.output_tokens || 0;
              }
            } catch (pe) {}
          }
        }
      } catch (streamErr) {
        console.error('Stream error:', streamErr);
      }
      res.end();

      if (cacheable && fullText && fullText.length > 100) {
        saveToCache({
          key: cacheKey, provider: 'anthropic', model: modelUsed,
          system: body.system, resultado: fullText, hint,
          tokensIn, tokensOut,
        });
      }
    } else {
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (e) {
        return res.status(502).json({ error: 'Respuesta no valida de Anthropic: ' + text.slice(0, 200) });
      }
      if (cacheable && response.ok) {
        const fullText = data.content?.[0]?.text || '';
        if (fullText.length > 100) {
          saveToCache({
            key: cacheKey, provider: 'anthropic', model: modelUsed,
            system: body.system, resultado: fullText, hint,
            tokensIn: data.usage?.input_tokens, tokensOut: data.usage?.output_tokens,
          });
        }
      }
      return res.status(response.status).json(data);
    }
  } catch (error) {
    console.error('Anthropic proxy error:', error);
    if (useStream) {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: error.message } })}\n\n`);
        res.end();
      } catch(e) { res.end(); }
    } else {
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

async function handleOpenAICompatible({ res, body, useStream, cacheable, cacheKey, hint, apiUrl, apiKey, defaultModel, providerName, providerSlug }) {
  const modelUsed = body.model || defaultModel;
  // IMPORTANTE: hacemos siempre la peticion a Groq/DeepSeek SIN stream.
  // El streaming SSE pasando por Vercel serverless puede quedar bufferizado
  // dando aspecto de "no genera nada". Hacemos no-stream y simulamos SSE al cliente.
  const reqBody = {
    model: modelUsed,
    max_tokens: body.max_tokens || 4096,
    stream: false,
    messages: [],
  };
  if (body.system) reqBody.messages.push({ role: 'system', content: body.system });
  if (body.messages) reqBody.messages.push(...body.messages);
  if (body.temperature !== undefined) reqBody.temperature = body.temperature;

  try {
    console.log(`[${providerName}] Request -> model=${modelUsed} system_len=${(body.system||'').length} max_tokens=${reqBody.max_tokens}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(reqBody),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (e) {
      console.error(`[${providerName}] Respuesta no JSON:`, text.slice(0, 300));
      if (useStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `${providerName}: respuesta no valida del servidor` } })}\n\n`);
        res.end();
        return;
      }
      return res.status(502).json({ error: `Respuesta no valida de ${providerName}: ` + text.slice(0, 200) });
    }

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || data.error || `HTTP ${response.status}`;
      console.error(`[${providerName}] Error API:`, errMsg);
      if (useStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `${providerName}: ${errMsg}` } })}\n\n`);
        res.end();
        return;
      }
      return res.status(response.status).json({ error: `${providerName}: ${errMsg}` });
    }

    const content = data.choices?.[0]?.message?.content || '';
    const tokensIn = data.usage?.prompt_tokens || 0;
    const tokensOut = data.usage?.completion_tokens || 0;

    console.log(`[${providerName}] OK -> content_len=${content.length} tokens_in=${tokensIn} tokens_out=${tokensOut}`);

    if (!content) {
      const errMsg = `${providerName} devolvio contenido vacio (revisa el system prompt o el modelo ${modelUsed})`;
      console.error(`[${providerName}] Contenido vacio. usage:`, data.usage);
      if (useStream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: errMsg } })}\n\n`);
        res.end();
        return;
      }
      return res.status(502).json({ error: errMsg });
    }

    // Cachear si procede
    if (cacheable && content.length > 100) {
      saveToCache({
        key: cacheKey, provider: providerSlug, model: modelUsed,
        system: body.system, resultado: content, hint,
        tokensIn, tokensOut,
      });
    }

    if (useStream) {
      // Simulamos SSE: envio en bloques de ~80 caracteres para que el frontend
      // vea texto cayendo (no instantaneo) sin depender del streaming real.
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      res.write(`data: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`);

      const CHUNK = 80;
      for (let i = 0; i < content.length; i += CHUNK) {
        const piece = content.slice(i, i + CHUNK);
        res.write(`data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } })}\n\n`);
      }
      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      res.end();
    } else {
      return res.status(200).json({ content: [{ type: 'text', text: content }] });
    }
  } catch (error) {
    console.error(`[${providerName}] proxy exception:`, error.message || error);
    if (useStream) {
      try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `${providerName}: ${error.message || 'Error de conexion'}` } })}\n\n`);
        res.end();
      } catch(e) { try{res.end();}catch{} }
    } else {
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

// Busqueda web con Gemini 2.5 + Google Search grounding (GRATIS).
// Hace la peticion nativa a Gemini (no-stream) y emite SSE estilo Anthropic
// para que el parser de aiSearch del front funcione sin cambios:
//  - content_block_start con web_search_tool_result -> fuentes
//  - content_block_delta text_delta -> texto en bloques
//  - message_stop
async function handleGeminiGrounded({ res, body, apiKey, model }) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendError = (message) => {
    res.write(`data: ${JSON.stringify({ type: 'error', error: { message } })}\n\n`);
    res.end();
  };

  try {
    const contents = (body.messages || []).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    }));

    const reqBody = {
      contents,
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: body.max_tokens || 4096 },
    };
    if (body.system) reqBody.systemInstruction = { parts: [{ text: body.system }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (e) {
      return sendError(`Gemini: respuesta no valida (${text.slice(0, 200)})`);
    }
    if (!response.ok || data.error) {
      return sendError(`Gemini: ${data.error?.message || `HTTP ${response.status}`}`);
    }

    const cand = data.candidates?.[0];
    const parts = cand?.content?.parts || [];
    const fullText = parts.filter((p) => p.text).map((p) => p.text).join('');

    // Fuentes desde groundingMetadata
    const chunks = cand?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((c) => c.web)
      .filter((w) => w && w.uri)
      .map((w) => ({ type: 'web_search_result', url: w.uri, title: w.title || w.uri }));

    if (sources.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'web_search_tool_result', content: sources } })}\n\n`);
    }

    if (!fullText) {
      return sendError('Gemini devolvio contenido vacio en la busqueda web.');
    }

    res.write(`data: ${JSON.stringify({ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } })}\n\n`);
    const CHUNK = 80;
    for (let i = 0; i < fullText.length; i += CHUNK) {
      const piece = fullText.slice(i, i + CHUNK);
      res.write(`data: ${JSON.stringify({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: piece } })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Gemini grounded error:', error.message || error);
    try { sendError(`Gemini: ${error.message || 'Error de conexion'}`); } catch (e) { try { res.end(); } catch (e2) {} }
  }
}
