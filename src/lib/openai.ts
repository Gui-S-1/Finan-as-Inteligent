export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const OPENAI_KEY = import.meta.env.VITE_OPENAI_KEY as string;

export async function chatCompletionStream(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<string> {
  if (!OPENAI_KEY) {
    throw new Error('Chave da OpenAI não configurada. Adicione VITE_OPENAI_KEY no .env');
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    let msg = `Erro OpenAI: ${res.status}`;
    try {
      msg = JSON.parse(errBody).error?.message ?? msg;
    } catch { /* skip */ }
    throw new Error(msg);
  }

  const reader = res.body!.getReader();
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
