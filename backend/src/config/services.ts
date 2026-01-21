import { ethers } from "ethers";

// Service configurations
export const SERVICES = {
  AI_AGENT_ACCESS: {
    name: "Crypto Price Feed Agent",
    // Use keccak256 to create a proper bytes32 (32 bytes)
    id: ethers.keccak256(ethers.toUtf8Bytes("ai-agent-access-v1")),
    priceUSDC: "1000000", // 1 USDC.e (6 decimals) = 1 * 10^6
    description: "Premium crypto price feed API access",
    mimeType: "application/json",
    maxTimeoutSeconds: 300, // 5 minutes
  },
};

