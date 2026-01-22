"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SERVICES = void 0;
const ethers_1 = require("ethers");
// Service configurations
exports.SERVICES = {
    AI_AGENT_ACCESS: {
        name: "Crypto Price Feed Agent",
        // Use keccak256 to create a proper bytes32 (32 bytes)
        id: ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes("ai-agent-access-v1")),
        priceUSDC: "1000000", // 1 USDC.e (6 decimals) = 1 * 10^6
        description: "Premium crypto price feed API access",
        mimeType: "application/json",
        maxTimeoutSeconds: 300, // 5 minutes
    },
};
