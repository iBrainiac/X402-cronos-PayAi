import type { VercelRequest, VercelResponse } from '@vercel/node';

function applyCors(res: VercelResponse) {
  const origin = process.env.FRONTEND_URL || '*';
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CRITICAL: Set CORS headers FIRST, before ANY logic
  applyCors(res);

  // Handle OPTIONS preflight request - MUST return early
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({
      error: "agent_chat_failed",
      message: "OpenAI API key is not configured.",
    });
  }
  
  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: message }
        ],
      })
    });
    
    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }
    
    const data = await openaiResponse.json() as {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    };
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI API");
    }
    
    res.json({
      response: data.choices[0].message.content,
    });
    
  } catch (error: any) {
    // CORS headers already set at top, but ensure they're on error response too
    res.status(500).json({
      error: "agent_chat_failed",
      message: error.message || "Failed to process chat message",
    });
  }
}

