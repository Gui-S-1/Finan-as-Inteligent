export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY as string | undefined;
const isDev = import.meta.env.DEV;

/** Rate limiter: max 1 request per 3 seconds */
let lastCallTime = 0;
const MIN_INTERVAL_MS = 3000;

function getEndpoint(): string {
  // In production, use serverless proxy (API key stays server-side)
  // In dev, fallback to direct if env key available
  if (!isDev) return '/api/chat';
  if (OPENAI_KEY) return 'https://api.openai.com/v1/chat/completions';
  return '/api/chat';
}

export async function chatCompletionStream(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  // Rate limiting
  const now = Date.now();
  if (now - lastCallTime < MIN_INTERVAL_MS) {
    throw new Error('Aguarde alguns segundos entre mensagens.');
  }
  lastCallTime = now;

  const endpoint = getEndpoint();
  const isDirect = endpoint.includes('openai.com');

  if (isDirect && !OPENAI_KEY) {
    throw new Error('Chave da OpenAI nao configurada. Adicione VITE_OPENAI_KEY no .env');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (isDirect && OPENAI_KEY) {
    headers['Authorization'] = `Bearer ${OPENAI_KEY}`;
  }

  const body: Record<string, unknown> = {
    messages,
    max_tokens: 1000,
  };

  // Direct API needs model + stream + temperature
  if (isDirect) {
    body.model = 'gpt-4o-mini';
    body.temperature = 0.7;
    body.stream = true;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Erro OpenAI: ${res.status}`;
    try {
      msg = JSON.parse(errBody).error?.message ?? msg;
    } catch { /* skip */ }
    throw new Error(msg);
  }

  if (!res.body) {
    throw new Error('Resposta vazia do servidor');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
        // skip invalid chunks
      }
    }
  }

  return full;
}
