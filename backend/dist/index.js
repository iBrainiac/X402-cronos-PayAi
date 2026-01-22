"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const facilitator_1 = require("./lib/facilitator");
const env_1 = require("./config/env");
const services_1 = require("./config/services");
const app = (0, express_1.default)();
app.use(express_1.default.json());
// CORS middleware for frontend
// Allow specific origins for production, all for development
const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://cronos-payai-facilitator.vercel.app', 'http://localhost:5173',
    'http://localhost:5173', // Local dev
    'http://localhost:3000', // Local dev alternative
];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Allow requests from allowed origins or all in development
    if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production')) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    else if (!origin || process.env.NODE_ENV !== 'production') {
        // Allow all origins in development
        res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, X-PAYMENT");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});
// Request logging middleware (for debugging)
app.use((req, res, next) => {
    if (req.path === "/api/agent/chat") {
        console.log(`\n🔵 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    }
    next();
});
const SERVICE = services_1.SERVICES.AI_AGENT_ACCESS;
// Get USDC.e contract address based on network
const getUSDCEAddress = () => {
    return env_1.ENV.NETWORK === "cronos"
        ? env_1.ENV.USDCE_CONTRACT_MAINNET
        : env_1.ENV.USDCE_CONTRACT_TESTNET;
};
/**
 * GET /api/agent/run
 *
 * Protected endpoint that requires payment via Cronos X402 Facilitator.
 *
 * Flow (per X402 Facilitator spec):
 * 1. First request → Returns 402 Payment Required with payment requirements
 * 2. Client signs EIP-3009 authorization and sends X-PAYMENT header
 * 3. Backend verifies payment header with facilitator
 * 4. Backend settles payment on-chain via facilitator
 * 5. Access granted → Returns protected resource
 */
app.get("/api/agent/run", async (req, res) => {
    const paymentHeader = req.headers["x-payment"];
    // Step 1: Payment Required (402) - Return payment requirements
    if (!paymentHeader) {
        const paymentRequirements = {
            scheme: "exact",
            network: env_1.ENV.NETWORK,
            payTo: env_1.ENV.SELLER_WALLET,
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
    // Step 2: Verify payment header
    const paymentRequirements = {
        scheme: "exact",
        network: env_1.ENV.NETWORK,
        payTo: env_1.ENV.SELLER_WALLET,
        asset: getUSDCEAddress(),
        description: SERVICE.description,
        mimeType: SERVICE.mimeType,
        maxAmountRequired: SERVICE.priceUSDC,
        maxTimeoutSeconds: SERVICE.maxTimeoutSeconds,
    };
    const verifyResult = await (0, facilitator_1.verifyPaymentHeader)(paymentHeader, paymentRequirements);
    if (!verifyResult.isValid) {
        return res.status(402).json({
            error: "Invalid payment",
            invalidReason: verifyResult.invalidReason,
        });
    }
    // Step 3: Settle payment on-chain
    const settleResult = await (0, facilitator_1.settlePayment)(paymentHeader, paymentRequirements);
    if (settleResult.event !== "payment.settled") {
        return res.status(402).json({
            error: "Payment settlement failed",
            reason: settleResult.error,
        });
    }
    // Step 4: Access Granted - Execute Crypto Price Feed Agent
    try {
        console.log("🚀 Executing agent service...");
        // Fetch crypto prices from CoinGecko (free, no API key required)
        const symbols = req.query.symbols;
        const coins = symbols ? symbols.split(',').map(s => s.trim().toLowerCase()) : ['bitcoin', 'ethereum'];
        // Limit to 5 coins max for simplicity
        const limitedCoins = coins.slice(0, 5).join(',');
        console.log(`📊 Fetching prices for: ${limitedCoins}`);
        const coingeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${limitedCoins}&vs_currencies=usd&include_24hr_change=true`;
        const response = await fetch(coingeckoUrl, {
            headers: {
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(10000), // 10 second timeout
        });
        console.log(`📡 CoinGecko response status: ${response.status}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ CoinGecko API error: ${response.status} - ${errorText}`);
            throw new Error(`CoinGecko API error: ${response.status}`);
        }
        const priceData = await response.json();
        if (!priceData || Object.keys(priceData).length === 0) {
            console.warn("⚠️ No price data returned from CoinGecko");
            throw new Error("No price data available");
        }
        console.log(`✅ Received price data for ${Object.keys(priceData).length} coins`);
        // Format the response
        const formattedPrices = Object.entries(priceData).map(([id, data]) => {
            if (!data || typeof data.usd !== 'number') {
                console.warn(`⚠️ Invalid data for ${id}:`, data);
                return null;
            }
            return {
                symbol: id.charAt(0).toUpperCase() + id.slice(1),
                price: data.usd,
                change24h: data.usd_24h_change !== undefined ? data.usd_24h_change.toFixed(2) : null,
            };
        }).filter(Boolean);
        if (formattedPrices.length === 0) {
            throw new Error("No valid price data to return");
        }
        console.log(`✅ Formatted ${formattedPrices.length} prices`);
        // Return protected resource with payment details (per X402 spec)
        const responseData = {
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
        };
        console.log("✅ Agent execution successful");
        res.status(200).json(responseData);
    }
    catch (error) {
        console.error("❌ Agent execution error:", error);
        console.error("Error details:", {
            message: error.message,
            name: error.name,
            stack: error.stack?.substring(0, 200),
        });
        // Still return success with error message in data (payment was successful)
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
});
// Agent chat endpoint (for interactive agent after payment)
app.post("/api/agent/chat", async (req, res) => {
    console.log("📨 Received chat request:", req.body);
    const { message } = req.body;
    if (!message) {
        console.error("❌ No message provided");
        return res.status(400).json({ error: "Message is required" });
    }
    // Check if API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    console.log("🔑 API Key present:", !!apiKey, apiKey ? `${apiKey.substring(0, 7)}...` : "NOT SET");
    if (!apiKey) {
        console.error("❌ OPENAI_API_KEY is not set in environment variables");
        return res.status(500).json({
            error: "agent_chat_failed",
            message: "OpenAI API key is not configured. Please add OPENAI_API_KEY to your .env file.",
        });
    }
    try {
        console.log("🚀 Calling OpenAI API with message:", message.substring(0, 50) + "...");
        // OpenAI integration
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
        console.log("📡 OpenAI response status:", openaiResponse.status);
        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json().catch(() => ({}));
            console.error("❌ OpenAI API error:", openaiResponse.status, JSON.stringify(errorData));
            throw new Error(`OpenAI API error: ${openaiResponse.status} - ${JSON.stringify(errorData)}`);
        }
        const data = await openaiResponse.json();
        if (!data.choices || data.choices.length === 0) {
            console.error("❌ No choices in OpenAI response:", JSON.stringify(data));
            throw new Error("No response from OpenAI API");
        }
        const agentResponse = data.choices[0].message.content;
        console.log("✅ OpenAI response received, choices:", data.choices.length);
        console.log("💬 Sending response to frontend:", agentResponse.substring(0, 100) + "...");
        res.json({
            response: agentResponse,
        });
    }
    catch (error) {
        console.error("❌ Agent chat error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            error: "agent_chat_failed",
            message: error.message || "Failed to process chat message",
        });
    }
});
// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "x402-gateway" });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 X402 Gateway running on port ${PORT}`);
    console.log(`📍 Protected endpoint: GET /api/agent/run`);
    console.log(`🔗 Facilitator: ${env_1.ENV.FACILITATOR_URL}`);
    console.log(`💰 Seller Wallet: ${env_1.ENV.SELLER_WALLET}`);
    console.log(`💵 USDC.e Contract: ${getUSDCEAddress()}`);
    console.log(`⛓️  Network: ${env_1.ENV.NETWORK}`);
});
