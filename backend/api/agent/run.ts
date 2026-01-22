import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';
import { setCORSHeaders, handleOPTIONS } from '../utils/cors';

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

const getUSDCEAddress = () => {
  return ENV.NETWORK === "cronos" 
    ? ENV.USDCE_CONTRACT_MAINNET 
    : ENV.USDCE_CONTRACT_TESTNET;
};

interface PaymentRequirements {
  scheme: "exact";
  network: "cronos-testnet" | "cronos";
  payTo: string;
  asset: string;
  description?: string;
  mimeType?: string;
  maxAmountRequired: string;
  maxTimeoutSeconds: number;
}

async function verifyPaymentHeader(
  paymentHeader: string,
  paymentRequirements: PaymentRequirements
): Promise<{ isValid: boolean; invalidReason?: string }> {
  try {
    const response = await axios.post(`${ENV.FACILITATOR_URL}/verify`, {
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    }, {
      headers: {
        "Content-Type": "application/json",
        "X402-Version": "1",
      },
    });
    return response.data;
  } catch (error: any) {
    return { 
      isValid: false, 
      invalidReason: error.response?.data?.invalidReason || error.message 
    };
  }
}

async function settlePayment(
  paymentHeader: string,
  paymentRequirements: PaymentRequirements
): Promise<{
  event: "payment.settled" | "payment.failed";
  txHash?: string;
  from?: string;
  to?: string;
  value?: string;
  blockNumber?: number;
  timestamp?: string;
  error?: string;
}> {
  try {
    const response = await axios.post(`${ENV.FACILITATOR_URL}/settle`, {
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    }, {
      headers: {
        "Content-Type": "application/json",
        "X402-Version": "1",
      },
    });
    return response.data;
  } catch (error: any) {
    return { 
      event: "payment.failed", 
      timestamp: new Date().toISOString(),
      error: error.response?.data?.error || error.message 
    };
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  setCORSHeaders(res, {
    methods: 'GET, POST, OPTIONS',
    headers: 'Content-Type, X-PAYMENT',
  });

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return handleOPTIONS(res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const paymentHeader = req.headers["x-payment"] as string | undefined;

  if (!paymentHeader) {
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

    return res.status(402).json({
      error: "Payment Required",
      x402Version: 1,
      paymentRequirements,
    });
  }

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

  const verifyResult = await verifyPaymentHeader(paymentHeader, paymentRequirements);
  
  if (!verifyResult.isValid) {
    return res.status(402).json({
      error: "Invalid payment",
      invalidReason: verifyResult.invalidReason,
    });
  }

  const settleResult = await settlePayment(paymentHeader, paymentRequirements);
  
  if (settleResult.event !== "payment.settled") {
    return res.status(402).json({
      error: "Payment settlement failed",
      reason: settleResult.error,
    });
  }

  try {
    const symbols = req.query.symbols as string | undefined;
    const coins = symbols ? symbols.split(',').map(s => s.trim().toLowerCase()) : ['bitcoin', 'ethereum'];
    const limitedCoins = coins.slice(0, 5).join(',');
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${limitedCoins}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const priceData = await response.json() as Record<string, { usd: number; usd_24h_change?: number }>;
    
    if (!priceData || Object.keys(priceData).length === 0) {
      throw new Error("No price data available");
    }
    
    const formattedPrices = Object.entries(priceData).map(([id, data]) => {
      if (!data || typeof data.usd !== 'number') return null;
      return {
        symbol: id.charAt(0).toUpperCase() + id.slice(1),
        price: data.usd,
        change24h: data.usd_24h_change !== undefined ? data.usd_24h_change.toFixed(2) : null,
      };
    }).filter(Boolean);
    
    if (formattedPrices.length === 0) {
      throw new Error("No valid price data to return");
    }
    
    res.status(200).json({
      data: {
        prices: formattedPrices,
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
      payment: {
        txHash: settleResult.txHash,
        from: settleResult.from,
        to: settleResult.to,
        value: settleResult.value,
        blockNumber: settleResult.blockNumber,
        timestamp: settleResult.timestamp,
      },
    });
  } catch (error: any) {
    res.status(200).json({
      data: {
        error: "agent_execution_failed",
        message: error.message || "Failed to fetch crypto prices",
        timestamp: new Date().toISOString(),
        requestId: `req_${Date.now()}`,
      },
      payment: {
        txHash: settleResult.txHash,
        from: settleResult.from,
        to: settleResult.to,
        value: settleResult.value,
        blockNumber: settleResult.blockNumber,
        timestamp: settleResult.timestamp,
      },
    });
  }
}

