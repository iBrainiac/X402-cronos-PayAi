import axios from "axios";
import { ENV } from "../config/env";

const FACILITATOR_URL = ENV.FACILITATOR_URL;

export interface PaymentRequirements {
  scheme: "exact";
  network: "cronos-testnet" | "cronos";
  payTo: string;
  asset: string;
  description?: string;
  mimeType?: string;
  maxAmountRequired: string;
  maxTimeoutSeconds: number;
}

export interface VerifyRequest {
  x402Version: 1;
  paymentHeader: string;
  paymentRequirements: PaymentRequirements;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
}

export interface SettleResponse {
  x402Version: 1;
  event: "payment.settled" | "payment.failed";
  txHash?: string;
  from?: string;
  to?: string;
  value?: string;
  blockNumber?: number;
  network?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Verify a payment header with the Cronos X402 Facilitator
 */
export async function verifyPaymentHeader(
  paymentHeader: string,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse> {
  try {
    const requestBody: VerifyRequest = {
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    };

    const response = await axios.post<VerifyResponse>(
      `${FACILITATOR_URL}/verify`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "X402-Version": "1",
        },
      }
    );

    return response.data;
  } catch (error: any) {
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
export async function settlePayment(
  paymentHeader: string,
  paymentRequirements: PaymentRequirements
): Promise<SettleResponse> {
  try {
    const requestBody: VerifyRequest = {
      x402Version: 1,
      paymentHeader,
      paymentRequirements,
    };

    const response = await axios.post<SettleResponse>(
      `${FACILITATOR_URL}/settle`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "X402-Version": "1",
        },
      }
    );

    return response.data;
  } catch (error: any) {
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

