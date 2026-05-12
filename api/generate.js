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
  const cacheable = shouldCache({ tools: body.tools, hint, system: body.system });

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

  if (provider === 'groq') {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY not configured.' });
    return handleOpenAICompatible({
      res, body, useStream, cacheable, cacheKey, hint,
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: groqKey,
      defaultModel: 'meta-llama/llama-4-maverick-17b-128e-instruct',
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
  const reqBody = {
    model: modelUsed,
    max_tokens: body.max_tokens || 4096,
    stream: useStream,
    messages: [],
  };
  if (body.system) reqBody.messages.push({ role: 'system', content: body.system });
  if (body.messages) reqBody.messages.push(...body.messages);
  if (body.temperature !== undefined) reqBody.temperature = body.temperature;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(reqBody),
    });

    if (useStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (!response.ok) {
        const errText = await response.text();
        let errMsg;
        try { errMsg = JSON.parse(errText).error?.message || errText.slice(0, 300); } catch(e) { errMsg = errText.slice(0, 300); }
        res.write(`data: ${JSON.stringify({ type: 'error', error: { message: `${providerName}: ${errMsg}` } })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let blockStarted = false;
      let fullText = '';
      let tokensIn = 0;
      let tokensOut = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') {
              res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
              continue;
            }
            try {
              const chunk = JSON.parse(raw);
              const delta = chunk.choices?.[0]?.delta;
              if (delta?.content) {
                if (!blockStarted) {
                  res.write(`data: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`);
                  blockStarted = true;
                }
                res.write(`data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: delta.content } })}\n\n`);
                fullText += delta.content;
              }
              if (chunk.usage) {
                tokensIn = chunk.usage.prompt_tokens || tokensIn;
                tokensOut = chunk.usage.completion_tokens || tokensOut;
              }
            } catch (pe) {}
          }
        }
      } catch (streamErr) {
        console.error(`${providerName} stream error:`, streamErr);
      }
      res.end();

      if (cacheable && fullText && fullText.length > 100) {
        saveToCache({
          key: cacheKey, provider: providerSlug, model: modelUsed,
          system: body.system, resultado: fullText, hint,
          tokensIn, tokensOut,
        });
      }
    } else {
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch (e) {
        return res.status(502).json({ error: `Respuesta no valida de ${providerName}: ` + text.slice(0, 200) });
      }
      const content = data.choices?.[0]?.message?.content || '';
      if (cacheable && response.ok && content.length > 100) {
        saveToCache({
          key: cacheKey, provider: providerSlug, model: modelUsed,
          system: body.system, resultado: content, hint,
          tokensIn: data.usage?.prompt_tokens, tokensOut: data.usage?.completion_tokens,
        });
      }
      return res.status(response.status).json({ content: [{ type: 'text', text: content }] });
    }
  } catch (error) {
    console.error(`${providerName} proxy error:`, error);
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
