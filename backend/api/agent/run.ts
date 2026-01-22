import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

/* -------------------- ENV -------------------- */

const ENV = {
  NETWORK: process.env.NETWORK || "cronos-testnet",
  SELLER_WALLET: process.env.SELLER_WALLET || "",
  FACILITATOR_URL: process.env.FACILITATOR_URL || "https://facilitator.cronoslabs.org/v2/x402",
  USDCE_CONTRACT_TESTNET: "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
  USDCE_CONTRACT_MAINNET: "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C",
};

const SERVICE = {
  priceUSDC: process.env.SERVICE_PRICE_USDC || "1000000",
  description: "Premium crypto price feed API access",
  mimeType: "application/json",
  maxTimeoutSeconds: 300,
};

/* -------------------- HELPERS -------------------- */

const getUSDCEAddress = () =>
  ENV.NETWORK === "cronos"
    ? ENV.USDCE_CONTRACT_MAINNET
    : ENV.USDCE_CONTRACT_TESTNET;

function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = process.env.FRONTEND_URL || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Payment, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
}

/* -------------------- HANDLER -------------------- */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ✅ ALWAYS apply CORS first
  applyCors(req, res);

  // ✅ CORRECT preflight handling for Vercel
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const paymentHeader = req.headers['x-payment'] as string | undefined;

  const paymentRequirements = {
    scheme: "exact" as const,
    network: ENV.NETWORK as "cronos-testnet" | "cronos",
    payTo: ENV.SELLER_WALLET,
    asset: getUSDCEAddress(),
    description: SERVICE.description,
    mimeType: SERVICE.mimeType,
    maxAmountRequired: SERVICE.priceUSDC,
    maxTimeoutSeconds: SERVICE.maxTimeoutSeconds,
  };

  // -------------------- x402 FLOW --------------------

  if (!paymentHeader) {
    return res.status(402).json({
      error: "Payment Required",
      x402Version: 1,
      paymentRequirements,
    });
  }

  const verifyResult = await verifyPaymentHeader(
    paymentHeader,
    paymentRequirements
  );

  if (!verifyResult.isValid) {
    return res.status(402).json({
      error: "Invalid payment",
      invalidReason: verifyResult.invalidReason,
    });
  }

  const settleResult = await settlePayment(
    paymentHeader,
    paymentRequirements
  );

  if (settleResult.event !== "payment.settled") {
    return res.status(402).json({
      error: "Payment settlement failed",
      reason: settleResult.error,
    });
  }

  // -------------------- AGENT EXECUTION --------------------

  try {
    const symbols = req.query.symbols as string | undefined;
    const coins = symbols
      ? symbols.split(',').map(s => s.trim().toLowerCase())
      : ['bitcoin', 'ethereum'];

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coins
        .slice(0, 5)
        .join(',')}&vs_currencies=usd&include_24hr_change=true`
    );

    const priceData = await response.json();

    return res.status(200).json({
      data: priceData,
      payment: settleResult,
    });
  } catch (err: any) {
    return res.status(200).json({
      error: "agent_execution_failed",
      message: err.message,
      payment: settleResult,
    });
  }
}

/* -------------------- FACILITATOR CALLS -------------------- */

async function verifyPaymentHeader(paymentHeader: string, paymentRequirements: any) {
  const response = await axios.post(
    `${ENV.FACILITATOR_URL}/verify`,
    { x402Version: 1, paymentHeader, paymentRequirements },
    { headers: { "Content-Type": "application/json", "X402-Version": "1" } }
  );
  return response.data;
}

async function settlePayment(paymentHeader: string, paymentRequirements: any) {
  const response = await axios.post(
    `${ENV.FACILITATOR_URL}/settle`,
    { x402Version: 1, paymentHeader, paymentRequirements },
    { headers: { "Content-Type": "application/json", "X402-Version": "1" } }
  );
  return response.data;
}