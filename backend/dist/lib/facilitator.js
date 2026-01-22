"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPaymentHeader = verifyPaymentHeader;
exports.settlePayment = settlePayment;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const FACILITATOR_URL = env_1.ENV.FACILITATOR_URL;
/**
 * Verify a payment header with the Cronos X402 Facilitator
 */
async function verifyPaymentHeader(paymentHeader, paymentRequirements) {
    try {
        const requestBody = {
            x402Version: 1,
            paymentHeader,
            paymentRequirements,
        };
        const response = await axios_1.default.post(`${FACILITATOR_URL}/verify`, requestBody, {
            headers: {
                "Content-Type": "application/json",
                "X402-Version": "1",
            },
        });
        return response.data;
    }
    catch (error) {
        console.error("Facilitator verify error:", error.response?.data || error.message);
        return {
            isValid: false,
            invalidReason: error.response?.data?.invalidReason || "Verification failed",
        };
    }
}
/**
 * Settle a verified payment on-chain via the Cronos X402 Facilitator
 */
async function settlePayment(paymentHeader, paymentRequirements) {
    try {
        const requestBody = {
            x402Version: 1,
            paymentHeader,
            paymentRequirements,
        };
        const response = await axios_1.default.post(`${FACILITATOR_URL}/settle`, requestBody, {
            headers: {
                "Content-Type": "application/json",
                "X402-Version": "1",
            },
        });
        return response.data;
    }
    catch (error) {
        console.error("Facilitator settle error:", error.response?.data || error.message);
        return {
            x402Version: 1,
            event: "payment.failed",
            network: paymentRequirements.network,
            timestamp: new Date().toISOString(),
            error: error.response?.data?.error || "Settlement failed",
        };
    }
}
