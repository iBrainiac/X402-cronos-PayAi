"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = verifyPayment;
const ethers_1 = require("ethers");
const provider_1 = require("./provider");
const env_1 = require("../config/env");
const abi = [
    "event PaymentSettled(address indexed payer, bytes32 indexed serviceId, uint256 amount, uint256 timestamp)"
];
const iface = new ethers_1.ethers.Interface(abi);
async function verifyPayment(txHash, serviceId) {
    try {
        const receipt = await provider_1.provider.getTransactionReceipt(txHash);
        if (!receipt || receipt.status !== 1)
            return false;
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== env_1.ENV.X402_CONTRACT.toLowerCase())
                continue;
            try {
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === "PaymentSettled") {
                    // Compare serviceId (both should be hex strings)
                    const logServiceId = parsed.args.serviceId;
                    if (logServiceId.toLowerCase() === serviceId.toLowerCase()) {
                        return true;
                    }
                }
            }
            catch (e) {
                // Not a PaymentSettled event, continue
                continue;
            }
        }
        return false;
    }
    catch (error) {
        console.error("Payment verification error:", error);
        return false;
    }
}
