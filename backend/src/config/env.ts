import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  RPC_URL: process.env.RPC_URL!,
  CHAIN_ID: Number(process.env.CHAIN_ID),
  // Legacy - not used with facilitator, kept for compatibility
  X402_CONTRACT: process.env.X402_CONTRACT || "",
  SERVICE_PRICE_USDC: process.env.SERVICE_PRICE_USDC || "1",
  // Cronos X402 Facilitator
  FACILITATOR_URL: process.env.FACILITATOR_URL || "https://facilitator.cronoslabs.org/v2/x402",
  SELLER_WALLET: process.env.SELLER_WALLET || process.env.TREASURY_ADDRESS || "",
  // USDC.e contract addresses (from facilitator docs)
  USDCE_CONTRACT_TESTNET: "0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0",
  USDCE_CONTRACT_MAINNET: "0xf951eC28187D9E5Ca673Da8FE6757E6f0Be5F77C",
  NETWORK: process.env.NETWORK || "cronos-testnet", // "cronos-testnet" or "cronos"
};
