// Vercel Serverless Function — proxies OpenAI calls
// API key stays server-side, never exposed to client

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const OPENAI_KEY = process.env.OPENAI_KEY;
  if (!OPENAI_KEY) {
    return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting via simple header check
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const allowedHosts = ['localhost', '127.0.0.1', '.vercel.app', 'neuroledger'];
  const isAllowed = allowedHosts.some((h) => origin.includes(h) || referer.includes(h));
  if (!isAllowed && origin) {
    return new Response(JSON.stringify({ error: 'Unauthorized origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();

    // Validate request shape
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cap tokens to prevent abuse
    const maxTokens = Math.min(body.max_tokens || 1000, 1500);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: body.messages,
        max_tokens: maxTokens,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(errText, {
        status: openaiRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream the response back
    return new Response(openaiRes.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
