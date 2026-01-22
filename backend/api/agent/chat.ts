import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // STEP 1: Set CORS headers FIRST (like Express middleware)
  const allowedOrigin = process.env.FRONTEND_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  // STEP 2: Handle OPTIONS preflight FIRST (before any other logic)
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
    res.status(500).json({
      error: "agent_chat_failed",
      message: error.message || "Failed to process chat message",
    });
  }
}

