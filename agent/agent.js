import fetch from "node-fetch";
import { ethers } from "ethers";


const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, new ethers.JsonRpcProvider("https://evm.cronos.org"));


async function run() {
let res = await fetch("http://localhost:3000/price", { method: "POST" });


if (res.status === 402) {
const spec = await res.json();
const contract = new ethers.Contract(process.env.PAYMENT_CONTRACT, ["function pay(bytes32,uint256)"], wallet);
const tx = await contract.pay(spec.x402.service.id, spec.x402.payment.amount);
await tx.wait(1);


res = await fetch("http://localhost:3000/price", {
method: "POST",
headers: { "X-Payment-Tx": tx.hash }
});
}


console.log(await res.json());
}


run();