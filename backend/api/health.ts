import type { VercelRequest, VercelResponse } from '@vercel/node';

function applyCors(res: VercelResponse) {
  const origin = process.env.FRONTEND_URL || '*';
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (origin !== '*') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
}

export default function handler(
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

  res.status(200).json({ 
    status: "ok", 
    service: "x402-gateway",
    timestamp: new Date().toISOString()
  });
}

