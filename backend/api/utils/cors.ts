import type { VercelResponse } from '@vercel/node';

/**
 * Sets CORS headers for Vercel serverless functions
 */
export function setCORSHeaders(
  res: VercelResponse,
  options: {
    methods?: string;
    headers?: string;
    origin?: string;
  } = {}
): void {
  const {
    methods = 'GET, POST, OPTIONS',
    headers = 'Content-Type, X-PAYMENT',
    origin = '*',
  } = options;

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
}

/**
 * Handles OPTIONS preflight request
 */
export function handleOPTIONS(res: VercelResponse): boolean {
  setCORSHeaders(res);
  res.status(200).end();
  return true;
}

