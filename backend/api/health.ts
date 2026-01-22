import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCORSHeaders, handleOPTIONS } from './utils/cors';

export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  setCORSHeaders(res, {
    methods: 'GET, OPTIONS',
  });

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return handleOPTIONS(res);
  }

  res.status(200).json({ 
    status: "ok", 
    service: "x402-gateway",
    timestamp: new Date().toISOString()
  });
}

