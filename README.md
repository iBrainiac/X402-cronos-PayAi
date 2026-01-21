🚀 Project Summary — x402 Agentic Payments on Cronos
What We’re Building

We are building a pay-per-request AI agent access gateway on Cronos EVM, powered by x402-style programmatic payments.

The app allows users (or AI agents) to access a protected service (e.g. an AI agent, API endpoint, or on-chain service) only after completing an on-chain USDC payment, enforced using the HTTP 402 Payment Required pattern.

Instead of subscriptions or off-chain billing, each request is settled trustlessly on-chain, and access is unlocked automatically once the payment is verified.

🧠 Core Concept

HTTP 402 is used as a native on-chain paywall

Payments are settled via a Cronos smart contract

Backend verifies payments by reading on-chain events

Access is granted only after successful settlement

Fully compatible with agentic workflows and AI-native systems

This creates a machine-readable, trust-minimized payment flow that works for:

humans

bots

AI agents

automated services

🔗 Key Components
1️⃣ Smart Contract (Cronos EVM)

Accepts USDC payments

Emits PaymentSettled events

Links each payment to a specific serviceId

2️⃣ x402 Gateway (Backend)

Protects API endpoints

Returns HTTP 402 when unpaid

Verifies on-chain payments

Unlocks access after settlement

3️⃣ Frontend (Minimal UI)

Detects 402 responses

Prompts wallet payment

Confirms transaction

Retries access automatically

🔄 User Flow (End-to-End)
Step 1 — Access Request

The user (or AI agent) requests access to a protected endpoint:

GET /api/agent/run

Step 2 — Payment Required (402)

The backend rejects the request with:

HTTP 402 Payment Required

Required payment details:

amount

currency (USDC)

chain (Cronos)

contract address

serviceId

Step 3 — On-Chain Payment

The client:

Connects wallet

Calls the pay() function on the Cronos smart contract

Sends USDC payment on-chain

Step 4 — On-Chain Verification

The backend:

Reads the transaction receipt

Verifies the PaymentSettled event

Confirms correct payer, amount, and serviceId

Step 5 — Access Granted

Once verified:

Backend unlocks access

The original request is retried

The protected service executes successfully

🎯 Why This Matters
🔹 For Developers

Simple, composable pay-per-use model

No subscriptions or off-chain billing

AI-agent compatible

🔹 For Users

Transparent pricing

On-chain settlement

No vendor lock-in

🔹 For Cronos

Native USDC utility

AI + payments synergy

EVM-compatible x402 infrastructure