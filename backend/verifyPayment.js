import { ethers } from "ethers";


const provider = new ethers.JsonRpcProvider("https://evm.cronos.org");
const CONTRACT = process.env.PAYMENT_CONTRACT;


const abi = [
"event PaymentSettled(address payer, bytes32 serviceId, uint256 amount, uint256 timestamp)"
];


export async function verifyPayment(txHash, serviceId) {
const receipt = await provider.getTransactionReceipt(txHash);
if (!receipt || receipt.status !== 1) return false;


const iface = new ethers.Interface(abi);


for (const log of receipt.logs) {
if (log.address.toLowerCase() !== CONTRACT.toLowerCase()) continue;
const parsed = iface.parseLog(log);
if (parsed.args.serviceId !== serviceId) return false;
return true;
}
return false;
}