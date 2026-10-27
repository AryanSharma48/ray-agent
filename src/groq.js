import { red, yellow } from './colors.js';
import { SYSTEM_PROMPT } from './prompts.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Stream a chat completion from Groq API
 * @param {Object} options
 * @param {string} options.apiKey
 * @param {string} options.model
 * @param {Array<{role: string, content: string}>} options.messages
 * @param {function(string): void} options.onChunk
 */
export async function streamChat({
  apiKey,
  model = 'llama-3.1-8b-instant',
  messages = [],
  onChunk
}) {
  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages
  ];

  let res;
  try {
    res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        temperature: 0.1,
        max_tokens: 2048,
        stream: true
      })
    });
  } catch (err) {
    throw new Error(`Failed to connect to Groq API: ${err.message}`);
  }

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text();
    }

    // Smart fallback if the requested model is retired or not on this account
    if (res.status === 404 && model !== 'qwen/qwen3.8-27b') {
      return streamChat({
        apiKey,
        model: 'qwen/qwen3.8-27b',
        messages,
        onChunk
      });
    }

    throw new Error(`Groq API error (${res.status}): ${errorDetail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') {
        return fullResponse;
      }

      if (trimmed.startsWith('data: ')) {
        const jsonStr = trimmed.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullResponse += delta;
            if (onChunk) {
              onChunk(delta);
            }
          }
        } catch {
          // ignore incomplete SSE chunk parse errors
        }
      }
    }
  }

  return fullResponse;
}
